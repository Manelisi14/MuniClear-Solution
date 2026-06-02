using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MuniClear.Data;
using Microsoft.AspNetCore.Authorization;

namespace MuniClear.Controllers
{
    [Route("api/[controller]")]
    [Authorize]
    [ApiController]
    public class NotificationsController : ControllerBase
    {
        private readonly MuniClearContext _context;
        public NotificationsController(MuniClearContext context) => _context = context;

        // GET api/Notifications/{accountId}
        [HttpGet("{accountId}")]
        public async Task<IActionResult> GetNotifications(int accountId)
        {
            var notifications = await _context.Notifications
                .Where(n => n.AccountID == accountId)
                .OrderByDescending(n => n.CreatedAt)
                .Take(20)
                .ToListAsync();
            return Ok(notifications);
        }

        // GET api/Notifications/{accountId}/unread-count
        [HttpGet("{accountId}/unread-count")]
        public async Task<IActionResult> UnreadCount(int accountId)
        {
            var count = await _context.Notifications
                .CountAsync(n => n.AccountID == accountId && !n.IsRead);
            return Ok(new { count });
        }

        // PUT api/Notifications/{accountId}/mark-all-read
        [HttpPut("{accountId}/mark-all-read")]
        public async Task<IActionResult> MarkAllRead(int accountId)
        {
            var unread = await _context.Notifications
                .Where(n => n.AccountID == accountId && !n.IsRead)
                .ToListAsync();
            unread.ForEach(n => n.IsRead = true);
            await _context.SaveChangesAsync();
            return Ok(new { marked = unread.Count });
        }

        // PUT api/Notifications/{id}/read
        [HttpPut("{id}/read")]
        public async Task<IActionResult> MarkRead(int id)
        {
            var n = await _context.Notifications.FindAsync(id);
            if (n == null) return NotFound();
            n.IsRead = true;
            await _context.SaveChangesAsync();
            return Ok();
        }
    }
}