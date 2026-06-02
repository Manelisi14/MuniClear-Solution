using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.ComponentModel.DataAnnotations;

namespace MuniClear.Data.Models
{
    public class PasskeyCredential
    {
        [Key]
        public int CredentialID { get; set; }
        public int ResidentID { get; set; }

        // WebAuthn credential ID — base64url encoded, unique per device
        public string CredentialIdB64 { get; set; } = "";

        // Public key bytes — base64 encoded (private key NEVER leaves device)
        public string PublicKeyB64 { get; set; } = "";

        // Signature counter — increments each login, prevents replay attacks
        public uint SignCount { get; set; } = 0;

        // e.g. "iPhone Touch ID", "Windows Hello", "MacBook Touch ID"
        public string DeviceLabel { get; set; } = "My device";

        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime LastUsedAt { get; set; } = DateTime.Now;

        public Resident? Resident { get; set; }
    }
}
