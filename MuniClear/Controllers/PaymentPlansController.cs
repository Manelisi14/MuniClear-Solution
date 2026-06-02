using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MuniClear.Data;
using MuniClear.Data.Models;

namespace MuniClear.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class PaymentPlansController : ControllerBase
    {
        private readonly MuniClearContext _context;
        public PaymentPlansController(MuniClearContext context) => _context = context;

        [HttpGet("{accountId}")]
        public async Task<IActionResult> GetPlans(int accountId)
        {
            var plans = await _context.PaymentPlans
                .Where(p => p.AccountID == accountId)
                .OrderByDescending(p => p.StartDate)
                .ToListAsync();
            return Ok(plans);
        }

        [HttpPost("calculate")]
        public IActionResult Calculate([FromBody] PlanRequest req)
            => Ok(ComputePlan(req));

        [HttpPost("apply")]
        public async Task<IActionResult> ApplyPlan([FromBody] PlanRequest req)
        {
            var account = await _context.Accounts.FindAsync(req.AccountId);
            if (account == null) return NotFound("Account not found.");
            if (!account.IsBlocked) return BadRequest("Account is not blocked. No payment plan needed.");

            var existing = await _context.PaymentPlans
                .Where(p => p.AccountID == req.AccountId && p.Status == "Active")
                .ToListAsync();
            existing.ForEach(p => p.Status = "Superseded");

            var plan = ComputePlan(req);
            var entity = new PaymentPlan
            {
                AccountID = req.AccountId,
                TotalArrears = req.TotalArrears,
                TermMonths = req.TermMonths,
                MonthlyInstalment = plan.MonthlyInstalment,
                InterestRate = plan.InterestRate,
                PaidToDate = 0,
                Status = "Active",
                StartDate = DateTime.Now,
                NextPaymentDate = DateTime.Now.AddMonths(1)
            };

            _context.PaymentPlans.Add(entity);

            _context.Notifications.Add(new Notification
            {
                AccountID = req.AccountId,
                Title = "Payment plan approved",
                Message = $"Your {req.TermMonths}-month plan is active. Monthly instalment: R{plan.MonthlyInstalment:N2}.",
                Type = "Success"
            });

            await _context.SaveChangesAsync();

            // Use PlanID — matches the [Key] property in your PaymentPlan model
            return Ok(new { planID = entity.PlanID, monthlyInstalment = entity.MonthlyInstalment });
        }

        private static PlanResult ComputePlan(PlanRequest req)
        {
            decimal rate = req.TermMonths switch
            {
                3 => 0.00m,
                6 => 0.05m,
                12 => 0.10m,
                _ => 0.05m
            };
            decimal total = req.TotalArrears * (1 + rate);
            decimal instalment = Math.Ceiling(total / req.TermMonths * 100) / 100;
            return new PlanResult
            {
                TotalArrears = req.TotalArrears,
                TermMonths = req.TermMonths,
                InterestRate = rate,
                TotalRepayable = total,
                MonthlyInstalment = instalment
            };
        }
    }

    public class PlanRequest
    {
        public int AccountId { get; set; }
        public decimal TotalArrears { get; set; }
        public int TermMonths { get; set; }
    }

    public class PlanResult
    {
        public decimal TotalArrears { get; set; }
        public int TermMonths { get; set; }
        public decimal InterestRate { get; set; }
        public decimal TotalRepayable { get; set; }
        public decimal MonthlyInstalment { get; set; }
    }
}