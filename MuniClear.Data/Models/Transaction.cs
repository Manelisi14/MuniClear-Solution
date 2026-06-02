using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace MuniClear.Data.Models
{
    public class Transaction
    {
        [Key]
        public int TxID { get; set; }

        [ForeignKey("Account")]
        public int AccountID { get; set; }

        public string Type { get; set; } = string.Empty;

        public decimal Amount { get; set; }

        public string Reference { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; }

        public virtual Account? Account { get; set; }
    }
}
