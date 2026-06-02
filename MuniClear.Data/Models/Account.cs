using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace MuniClear.Data.Models
{
    public class Account
    {
        [Key]
        public int AccountID { get; set; }
       
        [Required]
        public int ResidentID { get; set; }

        [ForeignKey("Property")]
        public int PropertyID { get; set; }

        public string AccountNumber { get; set; } = string.Empty;

        public decimal ArrearsBalance { get; set; }

        [Column("CurrentBalance")]
        public decimal OutstandingBalance { get; set; }

        public bool IsBlocked { get; set; }

        public DateTime CreatedAt { get; set; }

        public virtual Property? Property { get; set; }

        public virtual Resident? Resident { get; set; } = null!;

        public virtual ICollection<Bills> Bills { get; set; } = new List<Bills>();

        public virtual ICollection<Payment> Payment { get; set; } = new List<Payment>();

        public virtual ICollection<Transaction> Transactions { get; set; } = new List<Transaction>();
    }
}
