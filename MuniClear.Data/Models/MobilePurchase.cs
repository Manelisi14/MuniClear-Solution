using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace MuniClear.Data.Models
{
    public class MobilePurchase
    {
        [Key]
        public int PurchaseID { get; set; }

        [ForeignKey("Account")]
        public int AccountID { get; set; }

        public string PhoneNumber { get; set; } = string.Empty;
        public string Network { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public DateTime CreatedAt { get; set; }

        // 13-digit voucher code generated after successful payment
        public string VoucherCode { get; set; } = string.Empty;

        public virtual Account? Account { get; set; }
    }
}