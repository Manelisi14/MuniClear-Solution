using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using MuniClear.Data;
using MuniClear.Data.Models;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

namespace MuniClear.Controllers
{
    [Route("api/Auth/passkey")]
    [ApiController]
    public class PasskeyController : ControllerBase
    {
        private readonly MuniClearContext _context;
        private readonly IConfiguration _config;

        // In-memory challenge store keyed by session/resident ID
        // In production replace with IDistributedCache (Redis etc.)
        private static readonly Dictionary<string, (byte[] Challenge, DateTime Expiry)>
            _challenges = new();

        public PasskeyController(MuniClearContext context, IConfiguration config)
        {
            _context = context;
            _config = config;
        }

        // ── REGISTRATION ─────────────────────────────────────────────────────
        // Step 1: Angular calls this AFTER normal login to get a challenge
        // POST api/Auth/passkey/register-options
        // Body: { residentId, origin }
        [Authorize]
        [HttpPost("register-options")]
        public async Task<IActionResult> RegisterOptions([FromBody] RegisterOptionsRequest req)
        {
            var resident = await _context.Residents.FindAsync(req.ResidentId);
            if (resident == null) return NotFound("Resident not found.");

            var challenge = GenerateChallenge();
            var key = $"reg_{req.ResidentId}";
            _challenges[key] = (challenge, DateTime.UtcNow.AddMinutes(5));

            var rpId = ParseRpId(req.Origin);

            return Ok(new
            {
                challenge = Base64UrlEncode(challenge),
                rpId,
                rpName = "MuniClear",
                userId = Base64UrlEncode(Encoding.UTF8.GetBytes(resident.ResidentID.ToString())),
                userName = resident.Email,
                userDisplayName = resident.FullName,
                timeout = 60000,
                attestation = "none",
                authenticatorSelection = new
                {
                    authenticatorAttachment = "platform",  // device biometric only (no USB keys)
                    userVerification = "required",  // fingerprint/PIN required
                    residentKey = "preferred"
                },
                pubKeyCredParams = new[]
                {
                    new { type = "public-key", alg = -7   }, // ES256 (most common)
                    new { type = "public-key", alg = -257 }  // RS256 (Windows Hello)
                }
            });
        }

        // Step 2: Angular sends the credential created by the browser
        // POST api/Auth/passkey/register
        // Body: { residentId, credentialId, publicKey, deviceLabel }
        [Authorize]
        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequest req)
        {
            var key = $"reg_{req.ResidentId}";
            if (!_challenges.TryGetValue(key, out var pending) || pending.Expiry < DateTime.UtcNow)
                return BadRequest("Challenge expired or not found. Please try again.");

            _challenges.Remove(key);

            // Check for duplicate
            var exists = await _context.PasskeyCredentials
                .AnyAsync(c => c.CredentialIdB64 == req.CredentialId);
            if (exists)
                return BadRequest("This passkey is already registered on this account.");

            var credential = new PasskeyCredential
            {
                ResidentID = req.ResidentId,
                CredentialIdB64 = req.CredentialId,
                PublicKeyB64 = req.PublicKey ?? "",
                SignCount = 0,
                DeviceLabel = req.DeviceLabel ?? DetectDeviceLabel(Request.Headers["User-Agent"].ToString()),
                CreatedAt = DateTime.Now,
                LastUsedAt = DateTime.Now
            };

            _context.PasskeyCredentials.Add(credential);

            // Save a success notification
            _context.Notifications.Add(new Notification
            {
                AccountID = req.ResidentId,
                Title = "Passkey registered",
                Message = $"Biometric login enabled on '{credential.DeviceLabel}'. You can now sign in with your fingerprint or Face ID.",
                Type = "Success"
            });

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Passkey registered successfully.",
                credentialId = credential.CredentialID,
                deviceLabel = credential.DeviceLabel
            });
        }

        // ── AUTHENTICATION ────────────────────────────────────────────────────
        // Step 1: Angular calls this to get a challenge (no login required)
        // POST api/Auth/passkey/login-options
        // Body: { sessionId, origin }
        [AllowAnonymous]
        [HttpPost("login-options")]
        public IActionResult LoginOptions([FromBody] LoginOptionsRequest req)
        {
            var challenge = GenerateChallenge();
            var key = $"auth_{req.SessionId}";
            _challenges[key] = (challenge, DateTime.UtcNow.AddMinutes(5));

            var rpId = ParseRpId(req.Origin);

            return Ok(new
            {
                challenge = Base64UrlEncode(challenge),
                rpId,
                timeout = 60000,
                userVerification = "required"
                // No allowCredentials — browser will find the matching passkey automatically
            });
        }

        // Step 2: Angular sends the signed assertion — returns JWT on success
        // POST api/Auth/passkey/login
        // Body: { sessionId, credentialId, signCount }
        [AllowAnonymous]
        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] PasskeyLoginRequest req)
        {
            var key = $"auth_{req.SessionId}";
            if (!_challenges.TryGetValue(key, out var pending) || pending.Expiry < DateTime.UtcNow)
                return BadRequest("Challenge expired. Please try again.");

            _challenges.Remove(key);

            // Find the credential
            var credential = await _context.PasskeyCredentials
                .Include(c => c.Resident)
                .FirstOrDefaultAsync(c => c.CredentialIdB64 == req.CredentialId);

            if (credential == null)
                return Unauthorized("Passkey not recognised. Please register your biometric first.");

            // Replay attack check — signCount must be greater than stored value
            if (req.SignCount > 0 && req.SignCount <= credential.SignCount)
                return Unauthorized("Possible replay attack detected. Please try again.");

            // Update counter and last used
            credential.SignCount = req.SignCount;
            credential.LastUsedAt = DateTime.Now;
            await _context.SaveChangesAsync();

            // Find linked account to include in JWT
            var resident = credential.Resident!;
            var account = await _context.Accounts.FirstOrDefaultAsync();
            if (account == null)
                return StatusCode(500, "No account found for this resident.");

            var token = GenerateJwt(resident, account);

            return Ok(new
            {
                token = token.Token,
                expiresAt = token.ExpiresAt,
                accountId = account.AccountID,
                userName = resident.FullName,
                accountNumber = account.AccountNumber,
                isBlocked = account.IsBlocked
            });
        }

        // ── MANAGE PASSKEYS ───────────────────────────────────────────────────
        // GET api/Auth/passkey/list/{residentId}
        [Authorize]
        [HttpGet("list/{residentId}")]
        public async Task<IActionResult> List(int residentId)
        {
            var creds = await _context.PasskeyCredentials
                .Where(c => c.ResidentID == residentId)
                .OrderByDescending(c => c.LastUsedAt)
                .Select(c => new
                {
                    c.CredentialID,
                    c.DeviceLabel,
                    c.CreatedAt,
                    c.LastUsedAt,
                    c.SignCount
                })
                .ToListAsync();

            return Ok(creds);
        }

        // DELETE api/Auth/passkey/{credentialId}
        [Authorize]
        [HttpDelete("{credentialId}")]
        public async Task<IActionResult> Delete(int credentialId)
        {
            var cred = await _context.PasskeyCredentials.FindAsync(credentialId);
            if (cred == null) return NotFound();

            _context.PasskeyCredentials.Remove(cred);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Passkey removed successfully." });
        }

        // ── Helpers ───────────────────────────────────────────────────────────
        private static byte[] GenerateChallenge()
        {
            var bytes = new byte[32];
            RandomNumberGenerator.Fill(bytes);
            return bytes;
        }

        private static string Base64UrlEncode(byte[] data) =>
            Convert.ToBase64String(data)
                   .TrimEnd('=')
                   .Replace('+', '-')
                   .Replace('/', '_');

        private static string ParseRpId(string origin) =>
            origin.Replace("https://", "")
                  .Replace("http://", "")
                  .Split('/')[0]
                  .Split(':')[0]; // strip port e.g. localhost:4200 → localhost

        private static string DetectDeviceLabel(string userAgent)
        {
            if (string.IsNullOrEmpty(userAgent)) return "Unknown device";
            if (userAgent.Contains("iPhone") || userAgent.Contains("iPad")) return "iPhone / Face ID";
            if (userAgent.Contains("Android")) return "Android fingerprint";
            if (userAgent.Contains("Windows")) return "Windows Hello";
            if (userAgent.Contains("Mac")) return "MacBook Touch ID";
            return "Device passkey";
        }

        private (string Token, DateTime ExpiresAt) GenerateJwt(
            MuniClear.Data.Models.Resident resident,
            MuniClear.Data.Models.Account account)
        {
            var keyBytes = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));
            var creds = new SigningCredentials(keyBytes, SecurityAlgorithms.HmacSha256);
            var hours = int.Parse(_config["Jwt:ExpiryHours"] ?? "8");
            var expires = DateTime.UtcNow.AddHours(hours);

            var claims = new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub,   resident.ResidentID.ToString()),
                new Claim(JwtRegisteredClaimNames.Email, resident.Email),
                new Claim(JwtRegisteredClaimNames.Name,  resident.FullName),
                new Claim("accountId",                   account.AccountID.ToString()),
                new Claim("accountNumber",               account.AccountNumber),
                new Claim(JwtRegisteredClaimNames.Jti,   Guid.NewGuid().ToString())
            };

            var jwt = new JwtSecurityToken(
                issuer: _config["Jwt:Issuer"],
                audience: _config["Jwt:Audience"],
                claims: claims,
                expires: expires,
                signingCredentials: creds
            );

            return (new JwtSecurityTokenHandler().WriteToken(jwt), expires);
        }
    }

    // ── Request DTOs ──────────────────────────────────────────────────────────
    public class RegisterOptionsRequest
    {
        public int ResidentId { get; set; }
        public string Origin { get; set; } = "http://localhost:4200";
    }

    public class RegisterRequest
    {
        public int ResidentId { get; set; }
        public string CredentialId { get; set; } = "";
        public string? PublicKey { get; set; }
        public string? DeviceLabel { get; set; }
    }

    public class LoginOptionsRequest
    {
        public string SessionId { get; set; } = Guid.NewGuid().ToString();
        public string Origin { get; set; } = "http://localhost:4200";
    }

    public class PasskeyLoginRequest
    {
        public string SessionId { get; set; } = "";
        public string CredentialId { get; set; } = "";
        public uint SignCount { get; set; }
    }
}
