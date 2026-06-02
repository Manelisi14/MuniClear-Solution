using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using MuniClear.Data;
using MuniClear.Data.Models;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace MuniClear.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly MuniClearContext _context;
        private readonly IConfiguration _config;

        public AuthController(MuniClearContext context, IConfiguration config)
        {
            _context = context;
            _config = config;
        }

        // ───────────────────────────── 
        // LOGIN 
        // ───────────────────────────── 
        [HttpPost("login")]
        [AllowAnonymous]
        public async Task<IActionResult> Login([FromBody] LoginRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.IdNumber))
                return BadRequest("Email and password/ID are required.");

            var email = req.Email.Trim().ToLower();
            var inputPassword = req.IdNumber.Trim();

            Console.WriteLine($"[DEBUG] Login attempt → Email: '{email}', IdNumber length: {inputPassword.Length}");

            // 1. ADMIN LOGIN 
            var admin = await _context.AdminUsers
                .FirstOrDefaultAsync(a => a.Email != null && a.Email.ToLower() == email);

            if (admin != null)
            {
                Console.WriteLine($"[DEBUG] Admin found: {admin.Email}, HashPrefix: {admin.PasswordHash[..Math.Min(7, admin.PasswordHash.Length)]}");
                bool validPassword = BCrypt.Net.BCrypt.Verify(inputPassword, admin.PasswordHash);
                Console.WriteLine($"[DEBUG] BCrypt.Verify result: {validPassword}");

                if (!validPassword)
                    return Unauthorized("Invalid admin password.");

                var token = GenerateAdminToken(admin);
                return Ok(new { token = token.Token, expiresAt = token.ExpiresAt, userName = admin.FullName, role = "Admin", isAdmin = true });
            }

            Console.WriteLine($"[DEBUG] No admin found for {email}, trying residents...");

            // 2. RESIDENT LOGIN 
            var resident = await _context.Residents
                .FirstOrDefaultAsync(r => r.Email != null && r.Email.ToLower() == email && r.SA_IDNumber == inputPassword);

            if (resident == null)
                return Unauthorized("Invalid credentials.");

            var account = await _context.Accounts
                .FirstOrDefaultAsync(a => a.ResidentID == resident.ResidentID);

            if (account == null)
                return Unauthorized("No account linked to resident.");

            var resToken = GenerateResidentToken(resident, account);
            return Ok(new { token = resToken.Token, expiresAt = resToken.ExpiresAt, accountId = account.AccountID, userName = resident.FullName, role = "Resident" });
        }

        // ───────────────────────────── 
        // DEMO LOGIN
        // ───────────────────────────── 
        [HttpPost("demo")]
        [AllowAnonymous]
        public async Task<IActionResult> DemoLogin()
        {
            Console.WriteLine("[DEBUG] Processing automated system sandbox fallback login...");

            // 1. Resolve seed data context entries to use as the profile tracking context
            var account = await _context.Accounts.Include(a => a.Resident).FirstOrDefaultAsync();

            if (account == null || account.Resident == null)
            {
                // Fallback virtual mock context generation if database tables are temporarily unseeded
                var mockResident = new Resident { ResidentID = 999, FullName = "Demo Resident", Email = "resident@municlear.co.za" };
                var mockAccount = new Account { AccountID = 1, ResidentID = 999, Resident = mockResident };

                var fallbackToken = GenerateResidentToken(mockResident, mockAccount);
                return Ok(new { token = fallbackToken.Token, expiresAt = fallbackToken.ExpiresAt, accountId = mockAccount.AccountID, userName = mockResident.FullName, role = "Resident" });
            }

            // 2. Build official signed authorization tokens using standard infrastructure pipeline profiles
            var demoToken = GenerateResidentToken(account.Resident, account);
            return Ok(new
            {
                token = demoToken.Token,
                expiresAt = demoToken.ExpiresAt,
                accountId = account.AccountID,
                userName = account.Resident.FullName,
                role = "Resident"
            });
        }

        // ───────────────────────────── 
        // DEBUG — remove before deploy 
        // ───────────────────────────── 
        [HttpGet("debug-admins")]
        [AllowAnonymous]
        public async Task<IActionResult> DebugAdmins()
        {
            var admins = await _context.AdminUsers.Select(a => new { a.AdminID, a.Email, a.Role, HashPrefix = a.PasswordHash.Substring(0, Math.Min(10, a.PasswordHash.Length)), IsValidBcrypt = a.PasswordHash.StartsWith("$2") }).ToListAsync();
            return Ok(new { count = admins.Count, admins });
        }

        // ───────────────────────────── 
        // TOKEN GENERATION 
        // ───────────────────────────── 
        private (string Token, DateTime ExpiresAt) GenerateAdminToken(AdminUser admin)
        {
            var claims = new[] {
                new Claim(JwtRegisteredClaimNames.Sub, admin.AdminID.ToString()),
                new Claim(JwtRegisteredClaimNames.Email, admin.Email ?? ""),
                new Claim(ClaimTypes.Role, "Admin"),
                new Claim("role", "Admin")
            };
            return CreateToken(claims);
        }

        private (string Token, DateTime ExpiresAt) GenerateResidentToken(Resident resident, Account account)
        {
            var claims = new[] {
                new Claim(JwtRegisteredClaimNames.Sub, resident.ResidentID.ToString()),
                new Claim(ClaimTypes.Role, "Resident"),
                new Claim("role", "Resident"),
                new Claim("accountId", account.AccountID.ToString())
            };
            return CreateToken(claims);
        }

        private (string Token, DateTime ExpiresAt) CreateToken(IEnumerable<Claim> claims)
        {
            var keyStr = _config["Jwt:Key"];
            if (string.IsNullOrWhiteSpace(keyStr)) throw new Exception("JWT Key missing in configuration.");

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(keyStr));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
            var expires = DateTime.UtcNow.AddHours(8);

            var token = new JwtSecurityToken(
                issuer: _config["Jwt:Issuer"] ?? "MuniClear",
                audience: _config["Jwt:Audience"] ?? "MuniClearUsers",
                claims: claims,
                expires: expires,
                signingCredentials: creds
            );

            return (new JwtSecurityTokenHandler().WriteToken(token), expires);
        }
    }

    public class LoginRequest
    {
        public string Email { get; set; } = string.Empty;
        public string IdNumber { get; set; } = string.Empty;
    }
}
