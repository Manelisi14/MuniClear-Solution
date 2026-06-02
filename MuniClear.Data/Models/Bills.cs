using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace MuniClear.Data.Models
{
    public class Bills
    {
        [Key]
        public int BillID { get; set; }

        [ForeignKey("Account")]
        public int AccountID { get; set; }

        public string BillingMonth { get; set; } = string.Empty;

        public decimal WaterCharge { get; set; }

        public decimal ElectricityCharge { get; set; }

        public decimal RefuseCharge { get; set; }

        public decimal SewerCharge { get; set; }

        public decimal TotalAmount { get; set; }

        public DateTime CreatedAt { get; set; }

        public virtual Account? Account { get; set; }
    }
}
