using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MuniClear.Data;
using MuniClear.Data.Models;
using Microsoft.AspNetCore.Authorization;

namespace MuniClear.Controllers
{
    [Route("api/[controller]")]
    [Authorize]
    [ApiController]
    public class MobilePurchasesController : ControllerBase
    {
        private readonly MuniClearContext _context;

        public MobilePurchasesController(MuniClearContext context)
        {
            _context = context;
        }

        // 1. GET ALL AIRTIME FOR A SPECIFIC ACCOUNT
        // Route: GET api/MobilePurchases/account/1
        [HttpGet("account/{accountId}")]
        public async Task<ActionResult<IEnumerable<MobilePurchase>>> GetAccountHistory(int accountId)
        {
            if (_context.MobilePurchases == null) return NotFound();

            var history = await _context.MobilePurchases
                .Where(x => x.AccountID == accountId)
                .OrderByDescending(x => x.CreatedAt)
                .ToListAsync();

            return Ok(history);
        }

        // 2. GET ALL (Admin view)
        [HttpGet]
        public async Task<ActionResult<IEnumerable<MobilePurchase>>> GetMobilePurchases()
        {
            if (_context.MobilePurchases == null) return NotFound();
            return await _context.MobilePurchases.ToListAsync();
        }

        // 3. GET SINGLE BY ID
        [HttpGet("{id}")]
        public async Task<ActionResult<MobilePurchase>> GetMobilePurchase(int id)
        {
            if (_context.MobilePurchases == null) return NotFound();
            var mobilePurchase = await _context.MobilePurchases.FindAsync(id);
            if (mobilePurchase == null) return NotFound();
            return mobilePurchase;
        }

        // 4. DELETE
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteMobilePurchase(int id)
        {
            if (_context.MobilePurchases == null) return NotFound();
            var mobilePurchase = await _context.MobilePurchases.FindAsync(id);
            if (mobilePurchase == null) return NotFound();

            _context.MobilePurchases.Remove(mobilePurchase);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        private bool MobilePurchaseExists(int id)
        {
            return (_context.MobilePurchases?.Any(e => e.PurchaseID == id)).GetValueOrDefault();
        }
    }
}
