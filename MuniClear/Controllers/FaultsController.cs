using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MuniClear.Data;
using MuniClear.Data.Models;
using Microsoft.AspNetCore.SignalR;
using MuniClear.Hubs;
using Twilio;
using Twilio.Rest.Api.V2010.Account;
using Microsoft.AspNetCore.Authorization;

namespace MuniClear.Controllers
{
    [Route("api/[controller]")]
    [Authorize]
    [ApiController]
    public class FaultsController : ControllerBase
    {
        private readonly MuniClearContext _context;
        private readonly IConfiguration _config;
        private readonly IHubContext<PaymentHub> _hub;

        public FaultsController(MuniClearContext context, IConfiguration config, IHubContext<PaymentHub> hub)
        {
            _context = context;
            _config = config;
            _hub = hub;
        }

        // GET api/Faults — all faults (used for map, admin)
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var faults = await _context.Faults
                .OrderByDescending(f => f.CreatedAt)
                .Select(f => new {
                    f.FaultID,
                    f.AccountID,
                    f.Category,
                    f.Description,
                    f.Status,
                    f.Latitude,
                    f.Longitude,
                    f.Reference,
                    f.CreatedAt,
                    f.ResolvedAt
                })
                .ToListAsync();
            return Ok(faults);
        }

        // GET api/Faults/account/{accountId} — faults for one resident
        [HttpGet("account/{accountId}")]
        public async Task<IActionResult> GetByAccount(int accountId)
        {
            var faults = await _context.Faults
                .Where(f => f.AccountID == accountId)
                .OrderByDescending(f => f.CreatedAt)
                .ToListAsync();
            return Ok(faults);
        }

        // POST api/Faults — log a new fault
        [HttpPost]
        public async Task<IActionResult> LogFault([FromBody] FaultRequest req)
        {
            var count = await _context.Faults.CountAsync() + 1;
            var fault = new Fault
            {
                AccountID = req.AccountId,
                Category = req.Category,
                Description = req.Description,
                Latitude = req.Latitude,
                Longitude = req.Longitude,
                Status = "Pending",
                Reference = $"FAULT-{DateTime.Now:yyyy}-{count:D4}",
                CreatedAt = DateTime.Now
            };

            _context.Faults.Add(fault);

            // Notification for the resident
            _context.Notifications.Add(new Notification
            {
                AccountID = req.AccountId,
                Title = $"Fault logged: {req.Category}",
                Message = $"Your fault report ({fault.Reference}) has been received. Status: Pending.",
                Type = "Info"
            });

            await _context.SaveChangesAsync();

            // Notify all Angular clients via SignalR (map updates in real time)
            await _hub.Clients.All.SendAsync("ReceiveFaultUpdate", new
            {
                faultId = fault.FaultID,
                accountId = req.AccountId,
                category = fault.Category,
                status = fault.Status,
                latitude = fault.Latitude,
                longitude = fault.Longitude,
                reference = fault.Reference
            });

            // SMS confirmation
            if (!string.IsNullOrEmpty(req.Phone))
                SendSms(req.Phone, $"✅ MuniClear: Fault logged successfully.\nRef: {fault.Reference}\nCategory: {fault.Category}\nStatus: Pending\nWe'll notify you when it's resolved.");

            return Ok(new { faultID = fault.FaultID, reference = fault.Reference });
        }

        // PUT api/Faults/{id}/status — update status (admin)
        [HttpPut("{id}/status")]
        public async Task<IActionResult> UpdateStatus(int id, [FromBody] FaultStatusUpdate req)
        {
            var fault = await _context.Faults.FindAsync(id);
            if (fault == null) return NotFound();

            fault.Status = req.Status;
            if (req.Status == "Resolved") fault.ResolvedAt = DateTime.Now;

            // Notify resident
            _context.Notifications.Add(new Notification
            {
                AccountID = fault.AccountID,
                Title = $"Fault {req.Status}: {fault.Category}",
                Message = $"Your fault report {fault.Reference} is now {req.Status}.",
                Type = req.Status == "Resolved" ? "Success" : "Info"
            });

            await _context.SaveChangesAsync();

            await _hub.Clients.All.SendAsync("ReceiveFaultUpdate", new
            {
                faultId = fault.FaultID,
                status = fault.Status,
                latitude = fault.Latitude,
                longitude = fault.Longitude
            });

            return Ok(new { faultID = fault.FaultID, status = fault.Status });
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
            catch (Exception ex) { Console.WriteLine("[SMS ERROR] " + ex.Message); }
        }
    }

    public class FaultRequest
    {
        public int AccountId { get; set; }
        public string Category { get; set; } = "";
        public string Description { get; set; } = "";
        public double Latitude { get; set; }
        public double Longitude { get; set; }
        public string? Phone { get; set; }
    }

    public class FaultStatusUpdate
    {
        public string Status { get; set; } = "";
    }
}