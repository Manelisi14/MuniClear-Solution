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
    public class ElectricityPurchasesController : ControllerBase
    {
        private readonly MuniClearContext _context;

        public byte[]? EntityState { get; private set; }

        public ElectricityPurchasesController(MuniClearContext context)
        {
            _context = context;
        }

        // 1. GET ALL HISTORY FOR A SPECIFIC ACCOUNT
        // Route: GET api/ElectricityPurchases/account/1
        [HttpGet("account/{accountId}")]
        public async Task<ActionResult<IEnumerable<ElectricityPurchase>>> GetAccountHistory(int accountId)
        {
            if (_context.ElectricityPurchases == null) return NotFound();

            var history = await _context.ElectricityPurchases
                .Where(x => x.AccountID == accountId)
                .OrderByDescending(x => x.CreatedAt)
                .ToListAsync();

            return Ok(history);
        }

        // 2. GET ALL PURCHASES (Global Admin View)
        // Route: GET api/ElectricityPurchases
        [HttpGet]
        public async Task<ActionResult<IEnumerable<ElectricityPurchase>>> GetElectricityPurchases()
        {
            if (_context.ElectricityPurchases == null) return NotFound();
            return await _context.ElectricityPurchases.ToListAsync();
        }

        // 3. GET SINGLE PURCHASE BY ID
        // Route: GET api/ElectricityPurchases/5
        [HttpGet("{id}")]
        public async Task<ActionResult<ElectricityPurchase>> GetElectricityPurchase(int id)
        {
            if (_context.ElectricityPurchases == null) return NotFound();

            var purchase = await _context.ElectricityPurchases.FindAsync(id);
            if (purchase == null) return NotFound();

            return purchase;
        }

        // 4. DELETE A PURCHASE
        // Route: DELETE api/ElectricityPurchases/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteElectricityPurchase(int id)
        {
            if (_context.ElectricityPurchases == null) return NotFound();

            var purchase = await _context.ElectricityPurchases.FindAsync(id);
            if (purchase == null) return NotFound();

            _context.ElectricityPurchases.Remove(purchase);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool ElectricityPurchaseExists(int id)
        {
            return (_context.ElectricityPurchases?.Any(e => e.PurchaseID == id)).GetValueOrDefault();
        }
    }
}
