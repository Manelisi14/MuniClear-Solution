using Microsoft.EntityFrameworkCore.Metadata.Internal;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace MuniClear.Data.Models
{
    public class Resident
    {
        [Key]
        public int ResidentID { get; set; }

        [Required]
        [StringLength(13, MinimumLength = 13, ErrorMessage = "SA ID must be 13 digits")]
        public string SA_IDNumber { get; set; } = string.Empty;

        [Required]
        [StringLength(100)]
        public string FullName { get; set; } = string.Empty;

        [EmailAddress]
        public string? Email { get; set; }

        [Phone]
        [StringLength(15)]
        public string? Phone { get; set; }

        [Required]
        public string PasswordHash { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // ── NAVIGATION ───────────────────────────────
        public virtual ICollection<Property> Properties { get; set; } = new List<Property>();
        public virtual ICollection<Account> Accounts { get; set; } = new List<Account>();
    }
}
