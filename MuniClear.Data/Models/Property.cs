using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Security.Principal;
using System.Text;
using System.Threading.Tasks;

namespace MuniClear.Data.Models
{
    public class Property
    {
        [Key]
        public int PropertyID { get; set; }

        [ForeignKey("Resident")]
        public int ResidentID { get; set; }

        public string Address { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public string Suburb { get; set; } = string.Empty;

        public string MeterNumber { get; set; } = string.Empty;

        public string PropertyType { get; set; } = string.Empty;

        public virtual Resident? Resident { get; set; }

        public virtual Account? Account { get; set; }
    }
}
