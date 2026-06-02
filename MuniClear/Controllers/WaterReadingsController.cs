using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MuniClear.Data;
using MuniClear.Data.Models;
using Microsoft.AspNetCore.SignalR;
using MuniClear.Hubs;
using Twilio;
using Twilio.Rest.Api.V2010.Account;

namespace MuniClear.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class WaterReadingsController : ControllerBase
    {
        private readonly MuniClearContext _context;
        private readonly IConfiguration _config;
        private readonly IHubContext<PaymentHub> _hub;

        public WaterReadingsController(
            MuniClearContext context,
            IConfiguration config,
            IHubContext<PaymentHub> hub)
        {
            _context = context;
            _config = config;
            _hub = hub;
        }

        // GET api/WaterReadings/{accountId}
        // Returns all readings for an account, newest first
        [HttpGet("{accountId}")]
        public async Task<IActionResult> GetReadings(int accountId)
        {
            var readings = await _context.WaterReadings
                .Where(r => r.AccountID == accountId)
                .OrderByDescending(r => r.CreatedAt)
                .Select(r => new
                {
                    r.ReadingID,
                    r.AccountID,
                    r.Reading,
                    r.Usage,
                    r.MeterNumber,
                    r.LeakAlert,
                    r.CreatedAt
                })
                .ToListAsync();

            return Ok(readings);
        }

        // GET api/WaterReadings/latest/{accountId}
        // Returns the single most recent reading — used to display previous reading on the form
        [HttpGet("latest/{accountId}")]
        public async Task<IActionResult> GetLatest(int accountId)
        {
            var latest = await _context.WaterReadings
                .Where(r => r.AccountID == accountId)
                .OrderByDescending(r => r.CreatedAt)
                .FirstOrDefaultAsync();

            if (latest == null)
                return Ok(new { reading = 0, createdAt = (DateTime?)null, meterNumber = "" });

            return Ok(new
            {
                latest.ReadingID,
                latest.Reading,
                latest.Usage,
                latest.MeterNumber,
                latest.CreatedAt
            });
        }

        // GET api/WaterReadings/monthly-usage/{accountId}
        // Returns last 6 months of grouped usage — used by Chart.js analytics page
        [HttpGet("monthly-usage/{accountId}")]
        public async Task<IActionResult> GetMonthlyUsage(int accountId)
        {
            var sixMonthsAgo = DateTime.Now.AddMonths(-6);

            var readings = await _context.WaterReadings
                .Where(r => r.AccountID == accountId && r.CreatedAt >= sixMonthsAgo)
                .OrderBy(r => r.CreatedAt)
                .ToListAsync();

            var monthly = readings
                .GroupBy(r => new { r.CreatedAt.Year, r.CreatedAt.Month })
                .Select(g => new
                {
                    label = new DateTime(g.Key.Year, g.Key.Month, 1).ToString("MMM yyyy"),
                    usage = g.Sum(r => r.Usage),
                    leakAlerts = g.Count(r => r.LeakAlert)
                })
                .ToList();

            return Ok(monthly);
        }

        // POST api/WaterReadings
        // Body: { accountId, reading, meterNumber, phone }
        // Calculates usage, detects leaks, saves to DB, fires SignalR + SMS
        [HttpPost]
        public async Task<IActionResult> SubmitReading([FromBody] WaterReadingRequest req)
        {
            if (req.Reading <= 0)
                return BadRequest("Reading must be greater than zero.");

            // Get previous reading to calculate usage
            var previous = await _context.WaterReadings
                .Where(r => r.AccountID == req.AccountId)
                .OrderByDescending(r => r.CreatedAt)
                .FirstOrDefaultAsync();

            decimal prevValue = previous?.Reading ?? 0;
            decimal usage = req.Reading - prevValue;

            if (usage < 0)
                return BadRequest(new { message = $"Reading ({req.Reading} kL) must be greater than your previous reading ({prevValue} kL)." });

            // Leak detection: flag if usage > 50% above 3-month rolling average
            var recentReadings = await _context.WaterReadings
                .Where(r => r.AccountID == req.AccountId)
                .OrderByDescending(r => r.CreatedAt)
                .Take(3)
                .ToListAsync();

            decimal avgUsage = recentReadings.Any() ? recentReadings.Average(r => r.Usage) : 0;
            bool leakAlert = avgUsage > 0 && usage > avgUsage * 1.5m;

            // uMhlathuze rising block tariff 2025/26 (incl 15% VAT)
            decimal estimatedCharge = CalculateWaterCharge(usage);

            var waterReading = new WaterReading
            {
                AccountID = req.AccountId,
                Reading = req.Reading,
                Usage = usage,
                MeterNumber = req.MeterNumber ?? "Unknown",
                LeakAlert = leakAlert,
                CreatedAt = DateTime.Now
            };

            _context.WaterReadings.Add(waterReading);

            // Save leak notification if detected
            if (leakAlert)
            {
                _context.Notifications.Add(new Notification
                {
                    AccountID = req.AccountId,
                    Title = "⚠️ Possible water leak detected",
                    Message = $"Usage of {usage:N1} kL is significantly above your average of {avgUsage:N1} kL. Please check your plumbing.",
                    Type = "Warning"
                });
            }
            else
            {
                _context.Notifications.Add(new Notification
                {
                    AccountID = req.AccountId,
                    Title = "Water reading submitted",
                    Message = $"Reading of {req.Reading:N1} kL recorded. Usage: {usage:N1} kL. Estimated charge: R{estimatedCharge:N2}.",
                    Type = "Success"
                });
            }

            await _context.SaveChangesAsync();

            // Notify Angular via SignalR — dashboard + water page update in real time
            await _hub.Clients.All.SendAsync("ReceiveNotification", new
            {
                accountId = req.AccountId,
                type = "WaterReading",
                leakAlert,
                usage,
                estimatedCharge
            });

            // SMS — send to resident's phone
            if (!string.IsNullOrWhiteSpace(req.Phone))
            {
                var smsBody = leakAlert
                    ? $"⚠️ MuniClear Leak Alert: Your water usage of {usage:N1} kL is unusually high (avg: {avgUsage:N1} kL). Please check your plumbing urgently."
                    : $"✅ MuniClear: Water reading of {req.Reading:N1} kL submitted. Usage: {usage:N1} kL. Est. charge: R{estimatedCharge:N2}. Thank you.";

                SendSms(req.Phone, smsBody);
            }

            return Ok(new
            {
                readingID = waterReading.ReadingID,
                reading = waterReading.Reading,
                usage,
                leakAlert,
                estimatedCharge,
                previousReading = prevValue,
                message = leakAlert
                    ? $"⚠️ Leak alert! Usage of {usage:N1} kL is above your average."
                    : $"Reading submitted. Usage: {usage:N1} kL. Estimated charge: R{estimatedCharge:N2}."
            });
        }

        // ── uMhlathuze Rising Block Tariff 2025/26 (incl. 15% VAT) ──────────
        // Block 1: 0–6 kL   = FREE (basic water allocation)
        // Block 2: 7–15 kL  = R12.65/kL
        // Block 3: 16–30 kL = R18.97/kL
        // Block 4: 31–60 kL = R28.46/kL
        // Block 5: 60+ kL   = R42.69/kL
        private static decimal CalculateWaterCharge(decimal usage)
        {
            decimal charge = 0;
            decimal remaining = usage;

            // Block 1: 0–6 kL free
            decimal block1 = Math.Min(remaining, 6);
            remaining -= block1;
            if (remaining <= 0) return 0;

            // Block 2: 7–15 kL
            decimal block2 = Math.Min(remaining, 9);   // 15 - 6 = 9 kL span
            charge += block2 * 12.65m;
            remaining -= block2;
            if (remaining <= 0) return charge;

            // Block 3: 16–30 kL
            decimal block3 = Math.Min(remaining, 15);  // 30 - 15 = 15 kL span
            charge += block3 * 18.97m;
            remaining -= block3;
            if (remaining <= 0) return charge;

            // Block 4: 31–60 kL
            decimal block4 = Math.Min(remaining, 30);  // 60 - 30 = 30 kL span
            charge += block4 * 28.46m;
            remaining -= block4;
            if (remaining <= 0) return charge;

            // Block 5: 60+ kL
            charge += remaining * 42.69m;
            return Math.Round(charge, 2);
        }

        private void SendSms(string phone, string body)
        {
            if (phone.StartsWith("0")) phone = "+27" + phone[1..];
            try
            {
                TwilioClient.Init(_config["Twilio:AccountSid"], _config["Twilio:AuthToken"]);
                MessageResource.Create(
                    body: body,
                    from: new Twilio.Types.PhoneNumber(_config["Twilio:PhoneNumber"]),
                    to: new Twilio.Types.PhoneNumber(phone)
                );
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[SMS ERROR] {ex.Message}");
            }
        }
    }

    public class WaterReadingRequest
    {
        public int AccountId { get; set; }
        public decimal Reading { get; set; }
        public string? MeterNumber { get; set; }
        public string? Phone { get; set; }
    }
}
