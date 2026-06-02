using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace MuniClear.Data.Models
{
    public class Fault
    {
        [Key]
        public int FaultID { get; set; }

        [ForeignKey("Account")]
        public int AccountID { get; set; }
        public string Category { get; set; } = "";   // Water, Electricity, Roads, Sewerage, Other
        public string Description { get; set; } = "";
        public string Status { get; set; } = "Pending"; // Pending, InProgress, Resolved
        public double Latitude { get; set; }
        public double Longitude { get; set; }
        public string? PhotoUrl { get; set; }
        public string? Reference { get; set; }   // e.g. FAULT-2026-0001
        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime? ResolvedAt { get; set; }

        public Account? Account { get; set; }
    }
}
