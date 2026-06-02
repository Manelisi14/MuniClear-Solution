using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MuniClear.Data;
using MuniClear.Data.Models;
using Twilio;
using Twilio.Rest.Api.V2010.Account;

namespace MuniClear.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class AdminController : ControllerBase
    {
        private readonly MuniClearContext _context;
        private readonly IConfiguration _config;

        public AdminController(MuniClearContext context, IConfiguration config)
        {
            _context = context;
            _config = config;
        }

        // ── 1. STATS ─────────────────────────────────────────────────────────
        [HttpGet("stats")]
        public async Task<IActionResult> GetStats()
        {
            var now = DateTime.Now;
            var monthStart = new DateTime(now.Year, now.Month, 1);

            // SQLite requires casting decimal to double for aggregates
            var totalArrears = (decimal)await _context.Accounts.SumAsync(a => (double)a.ArrearsBalance);
            var monthlyRevenue = (decimal)await _context.Payments
                .Where(p => p.CreatedAt >= monthStart)
                .SumAsync(p => (double)p.Amount);
            var totalRevenue = (decimal)await _context.Payments.SumAsync(p => (double)p.Amount);

            var totalResidents = await _context.Residents.CountAsync();
            var blockedAccounts = await _context.Accounts.CountAsync(a => a.IsBlocked);
            var totalAccounts = await _context.Accounts.CountAsync();

            // Faults — safe in case migration hasn't run
            int pendingFaults = 0, resolvedFaults = 0, totalFaults = 0;
            object faultsByCategory = new List<object>();
            object recentFaults = new List<object>();
            try
            {
                pendingFaults = await _context.Faults.CountAsync(f => f.Status == "Pending");
                resolvedFaults = await _context.Faults.CountAsync(f => f.Status == "Resolved");
                totalFaults = await _context.Faults.CountAsync();

                faultsByCategory = await _context.Faults
                    .GroupBy(f => f.Category)
                    .Select(g => new { category = g.Key, count = g.Count() })
                    .ToListAsync();

                recentFaults = await _context.Faults
                    .OrderByDescending(f => f.CreatedAt)
                    .Take(5)
                    .Select(f => new { f.FaultID, f.Category, f.Status, f.Reference, f.CreatedAt })
                    .ToListAsync<object>();
            }
            catch { /* Faults table not yet migrated */ }

            // Payment plans — safe
            int activePlans = 0;
            try { activePlans = await _context.PaymentPlans.CountAsync(p => p.Status == "Active"); }
            catch { }

            var collectionRate = (totalArrears + monthlyRevenue) > 0
                ? Math.Round((double)(monthlyRevenue / (totalArrears + monthlyRevenue)) * 100, 1)
                : 100.0;

            // Revenue by month — last 6 months (group in memory to avoid SQLite issues)
            var recentPayments = await _context.Payments
                .Where(p => p.CreatedAt >= now.AddMonths(-6))
                .ToListAsync();

            var revenueByMonth = recentPayments
                .GroupBy(p => new { p.CreatedAt.Year, p.CreatedAt.Month })
                .Select(g => new {
                    label = new DateTime(g.Key.Year, g.Key.Month, 1).ToString("MMM yyyy"),
                    revenue = g.Sum(p => p.Amount)
                })
                .OrderBy(x => x.label)
                .ToList();

            // Recent payments feed
            var recentPaymentsFeed = await _context.Payments
                .OrderByDescending(p => p.CreatedAt)
                .Take(5)
                .Select(p => new { p.PaymentID, p.AccountID, p.Amount, p.PaymentMethod, p.CreatedAt })
                .ToListAsync();

            // Top arrears
            var topArrears = await _context.Accounts
                .Where(a => a.ArrearsBalance > 0)
                .OrderByDescending(a => a.ArrearsBalance)
                .Take(5)
                .Select(a => new { a.AccountID, a.AccountNumber, a.ArrearsBalance, a.IsBlocked })
                .ToListAsync();

            return Ok(new
            {
                totalResidents,
                blockedAccounts,
                totalAccounts,
                totalArrears,
                monthlyRevenue,
                totalRevenue,
                pendingFaults,
                resolvedFaults,
                totalFaults,
                activePlans,
                collectionRate,
                revenueByMonth,
                faultsByCategory,
                recentPayments = recentPaymentsFeed,
                recentFaults,
                topArrears
            });
        }

        // ── 2. RESIDENTS ─────────────────────────────────────────────────────
        // NOTE: Resident model has NO Accounts navigation property
        // We join manually to avoid CS1061
        [HttpGet("residents")]
        public async Task<IActionResult> GetResidents([FromQuery] string? search)
        {
            var query = _context.Residents.AsQueryable();
            if (!string.IsNullOrWhiteSpace(search))
                query = query.Where(r =>
                    r.FullName.Contains(search) ||
                    r.Email.Contains(search) ||
                    r.SA_IDNumber.Contains(search));

            var residents = await query.ToListAsync();
            var accounts = await _context.Accounts.ToListAsync();

            var result = residents.Select(r => new {
                r.ResidentID,
                r.FullName,
                r.Email,
                r.Phone,
                idMasked = r.SA_IDNumber?.Length >= 4
                    ? "•••••••••" + r.SA_IDNumber[^4..]
                    : "•••••",
                account = accounts.FirstOrDefault(a => a.AccountID == r.ResidentID)
            });

            return Ok(result);
        }

        [HttpPut("residents/{id}/block")]
        public async Task<IActionResult> BlockResident(int id, [FromBody] BlockRequest req)
        {
            var account = await _context.Accounts.FirstOrDefaultAsync(a => a.AccountID == id);
            if (account == null) return NotFound("Account not found.");

            account.IsBlocked = req.Block;

            try
            {
                _context.Notifications.Add(new Notification
                {
                    AccountID = id,
                    Title = req.Block ? "Account blocked" : "Account unblocked",
                    Message = req.Block
                        ? $"Your account has been blocked. Reason: {req.Reason ?? "Non-payment"}."
                        : "Your account has been unblocked. Services restored.",
                    Type = req.Block ? "Danger" : "Success"
                });
            }
            catch { }

            await _context.SaveChangesAsync();
            return Ok(new { accountID = id, isBlocked = account.IsBlocked });
        }

        // ── 3. BILLING ───────────────────────────────────────────────────────
        [HttpGet("bills")]
        public async Task<IActionResult> GetBills()
            => Ok(await _context.Bills.OrderByDescending(b => b.CreatedAt).ToListAsync());

        [HttpPost("bills/generate")]
        public async Task<IActionResult> GenerateBill([FromBody] GenerateBillRequest req)
        {
            var account = await _context.Accounts.FindAsync(req.AccountId);
            if (account == null) return NotFound("Account not found.");

            var subtotal = req.WaterCharge + req.ElectricityCharge
                         + req.RefuseCharge + req.SewerCharge;
            var total = subtotal * 1.15m;

            var bill = new Bills
            {
                AccountID = req.AccountId,
                BillingMonth = DateTime.Now.ToString("MMMM yyyy"),
                WaterCharge = req.WaterCharge,
                ElectricityCharge = req.ElectricityCharge,
                RefuseCharge = req.RefuseCharge,
                SewerCharge = req.SewerCharge,
                TotalAmount = total,
                CreatedAt = DateTime.Now
            };

            _context.Bills.Add(bill);
            account.OutstandingBalance -= total;

            try
            {
                _context.Notifications.Add(new Notification
                {
                    AccountID = req.AccountId,
                    Title = $"New bill — {bill.BillingMonth}",
                    Message = $"Your municipal bill of R{total:N2} for {bill.BillingMonth} is ready. Please pay by the 30th.",
                    Type = "Info"
                });
            }
            catch { }

            await _context.SaveChangesAsync();
            return Ok(new { billID = bill.BillID, totalAmount = bill.TotalAmount });
        }

        // ── 4. PAYMENTS ──────────────────────────────────────────────────────
        [HttpGet("payments")]
        public async Task<IActionResult> GetPayments(
            [FromQuery] DateTime? from,
            [FromQuery] DateTime? to)
        {
            var query = _context.Payments.AsQueryable();
            if (from.HasValue) query = query.Where(p => p.CreatedAt >= from.Value);
            if (to.HasValue) query = query.Where(p => p.CreatedAt <= to.Value);

            var payments = await query.OrderByDescending(p => p.CreatedAt).ToListAsync();
            var total = (decimal)await query.SumAsync(p => (double)p.Amount);

            return Ok(new
            {
                payments = payments.Select(p => new {
                    p.PaymentID,
                    p.AccountID,
                    p.Amount,
                    p.PaymentMethod,
                    p.CreatedAt,
                    p.IsVerified
                }),
                total,
                count = payments.Count
            });
        }

        [HttpPut("payments/{id}/verify")]
        public async Task<IActionResult> VerifyPayment(int id)
        {
            var payment = await _context.Payments.FindAsync(id);
            if (payment == null) return NotFound();
            payment.IsVerified = true;
            await _context.SaveChangesAsync();
            return Ok(new { verified = true });
        }

        [HttpGet("payments/export")]
        public async Task<IActionResult> ExportPayments()
        {
            var payments = await _context.Payments.ToListAsync();
            var csv = "PaymentID,AccountID,Amount,Method,Date,Verified\n"
                + string.Join("\n", payments.Select(p =>
                    $"{p.PaymentID},{p.AccountID},{p.Amount},{p.PaymentMethod},{p.CreatedAt:yyyy-MM-dd},{p.IsVerified}"));
            return File(System.Text.Encoding.UTF8.GetBytes(csv),
                "text/csv", $"MuniClear_Payments_{DateTime.Now:yyyyMMdd}.csv");
        }

        // ── 5. FAULTS ────────────────────────────────────────────────────────
        [HttpGet("faults")]
        public async Task<IActionResult> GetFaults([FromQuery] string? status, [FromQuery] string? category)
        {
            try
            {
                var query = _context.Faults.AsQueryable();
                if (!string.IsNullOrEmpty(status)) query = query.Where(f => f.Status == status);
                if (!string.IsNullOrEmpty(category)) query = query.Where(f => f.Category == category);
                return Ok(await query.OrderByDescending(f => f.CreatedAt).ToListAsync());
            }
            catch { return Ok(new List<object>()); }
        }

        [HttpPut("faults/{id}/assign")]
        public async Task<IActionResult> AssignFault(int id, [FromBody] AssignFaultRequest req)
        {
            var fault = await _context.Faults.FindAsync(id);
            if (fault == null) return NotFound();
            fault.Status = "InProgress";
            try
            {
                _context.Notifications.Add(new Notification
                {
                    AccountID = fault.AccountID,
                    Title = $"Fault assigned — {fault.Category}",
                    Message = $"Your report {fault.Reference} assigned to {req.Team}. Expected: {req.ExpectedDate}.",
                    Type = "Info"
                });
            }
            catch { }
            await _context.SaveChangesAsync();
            return Ok(new { status = "InProgress" });
        }

        [HttpPut("faults/{id}/resolve")]
        public async Task<IActionResult> ResolveFault(int id, [FromBody] ResolveRequest req)
        {
            var fault = await _context.Faults.FindAsync(id);
            if (fault == null) return NotFound();

            fault.Status = "Resolved";
            fault.ResolvedAt = DateTime.Now;

            try
            {
                _context.Notifications.Add(new Notification
                {
                    AccountID = fault.AccountID,
                    Title = $"Fault resolved — {fault.Category}",
                    Message = $"Your report {fault.Reference} has been resolved. {req.Note}",
                    Type = "Success"
                });
                if (!string.IsNullOrEmpty(req.Phone))
                    SendSms(req.Phone, $"✅ MuniClear: Fault {fault.Reference} ({fault.Category}) resolved.");
            }
            catch { }

            await _context.SaveChangesAsync();
            return Ok(new { status = "Resolved" });
        }

        // ── 6. BULK NOTIFY ───────────────────────────────────────────────────
        [HttpPost("notify/bulk")]
        public async Task<IActionResult> BulkNotify([FromBody] BulkNotifyRequest req)
        {
            try
            {
                var accounts = await _context.Accounts.ToListAsync();
                var notifications = accounts.Select(a => new Notification
                {
                    AccountID = a.AccountID,
                    Title = req.Title,
                    Message = req.Message,
                    Type = "Info"
                }).ToList();

                _context.Notifications.AddRange(notifications);

                if (req.SendSms)
                {
                    var residents = await _context.Residents
                        .Where(r => !string.IsNullOrEmpty(r.Phone)).ToListAsync();
                    foreach (var r in residents)
                        SendSms(r.Phone, $"MuniClear: {req.Title}\n{req.Message}");
                }

                await _context.SaveChangesAsync();
                return Ok(new { sent = accounts.Count });
            }
            catch (Exception ex) { return StatusCode(500, new { message = ex.Message }); }
        }

        // ── 7. PAYMENT PLANS ─────────────────────────────────────────────────
        [HttpGet("payment-plans")]
        public async Task<IActionResult> GetAllPlans()
        {
            try
            {
                var plans = await _context.PaymentPlans
                    .OrderByDescending(p => p.StartDate)
                    .Select(p => new {
                        p.PlanID,
                        p.AccountID,
                        p.TotalArrears,
                        p.TermMonths,
                        p.MonthlyInstalment,
                        p.PaidToDate,
                        p.Status,
                        p.StartDate,
                        p.NextPaymentDate,
                        complianceRate = p.TotalArrears > 0
                            ? Math.Round((double)(p.PaidToDate / p.TotalArrears) * 100, 1)
                            : 0.0
                    })
                    .ToListAsync();
                return Ok(plans);
            }
            catch { return Ok(new List<object>()); }
        }

        [HttpPut("payment-plans/{id}/default")]
        public async Task<IActionResult> MarkDefault(int id)
        {
            var plan = await _context.PaymentPlans.FindAsync(id);
            if (plan == null) return NotFound();
            plan.Status = "Defaulted";
            var account = await _context.Accounts.FindAsync(plan.AccountID);
            if (account != null) account.IsBlocked = true;
            try
            {
                _context.Notifications.Add(new Notification
                {
                    AccountID = plan.AccountID,
                    Title = "Payment plan defaulted",
                    Message = "Your plan has been defaulted due to missed instalments. Account blocked.",
                    Type = "Danger"
                });
            }
            catch { }
            await _context.SaveChangesAsync();
            return Ok(new { status = "Defaulted" });
        }

        // ── 8. PROPERTIES ────────────────────────────────────────────────────
        [HttpGet("properties")]
        public async Task<IActionResult> GetProperties()
            => Ok(await _context.Properties.ToListAsync());

        // ── HELPER ───────────────────────────────────────────────────────────
        private void SendSms(string phone, string body)
        {
            if (string.IsNullOrEmpty(phone)) return;
            if (phone.StartsWith("0")) phone = "+27" + phone[1..];
            try
            {
                TwilioClient.Init(_config["Twilio:AccountSid"], _config["Twilio:AuthToken"]);
                MessageResource.Create(
                    body: body,
                    from: new Twilio.Types.PhoneNumber(_config["Twilio:PhoneNumber"]),
                    to: new Twilio.Types.PhoneNumber(phone));
            }
            catch (Exception ex) { Console.WriteLine($"[SMS] {ex.Message}"); }
        }
    }

    // ── DTOs ─────────────────────────────────────────────────────────────────
    public class BlockRequest { public bool Block { get; set; } public string? Reason { get; set; } }
    public class AssignFaultRequest { public string Team { get; set; } = ""; public string ExpectedDate { get; set; } = ""; }
    public class ResolveRequest { public string Note { get; set; } = ""; public string? Phone { get; set; } }
    public class BulkNotifyRequest { public string Title { get; set; } = ""; public string Message { get; set; } = ""; public bool SendSms { get; set; } }
    public class GenerateBillRequest
    {
        public int AccountId { get; set; }
        public decimal WaterCharge { get; set; }
        public decimal ElectricityCharge { get; set; }
        public decimal RefuseCharge { get; set; }
        public decimal SewerCharge { get; set; }
    }
}