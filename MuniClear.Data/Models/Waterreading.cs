using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace MuniClear.Data.Models
{
    public class WaterReading
    {
        [Key]
        public int ReadingID { get; set; }

        [ForeignKey("Account")]
        public int AccountID { get; set; }
        public decimal Reading { get; set; }   // kL on meter dial
        public decimal Usage { get; set; }   // kL consumed since last reading
        public string MeterNumber { get; set; } = "";
        public bool LeakAlert { get; set; }   // true if usage spike > 50% above average
        public DateTime CreatedAt { get; set; } = DateTime.Now;

        public Account? Account { get; set; }
    }
}
