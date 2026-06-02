using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace MuniClear.Data.Models
{
    public class Payment
    {
        [Key]
        public int PaymentID { get; set; }

        [ForeignKey("Account")]
        public int AccountID { get; set; }

        public decimal Amount { get; set; }

        public string PaymentMethod { get; set; } = string.Empty;

        public string Status { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; }

        public virtual Account? Account { get; set; }
        public string? ExternalReference { get; set; } // PayFast Transaction ID
        public string? PaymentUrl { get; set; }        // The link John clicks to pay
        public bool IsVerified { get; set; } = false;   // Did the money actually land?

    }
}
