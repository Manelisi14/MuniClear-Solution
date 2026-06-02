using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MuniClear.Data.Models
{
    public class ElectricityPurchase
    {
        [Key]
        public int PurchaseID { get; set; }

        [Required]
        [ForeignKey("Account")]
        public int AccountID { get; set; }

        [Required]
        [StringLength(20)]
        public string MeterNumber { get; set; } = string.Empty;

        [Column(TypeName = "decimal(18,2)")]
        public decimal Amount { get; set; }

        [Required]
        [StringLength(50)]
        public string Token { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; } = DateTime.Now;

        // Navigation property
        public virtual Account? Account { get; set; }
    }
}
