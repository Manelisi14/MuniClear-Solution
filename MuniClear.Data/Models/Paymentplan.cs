using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;


namespace MuniClear.Data.Models
{
    public class PaymentPlan
    {
        [Key]
        public int PlanID { get; set; }
        public int AccountID { get; set; }
        public decimal TotalArrears { get; set; }
        public int TermMonths { get; set; }
        public decimal MonthlyInstalment { get; set; }
        public decimal InterestRate { get; set; }
        public decimal PaidToDate { get; set; }
        public string Status { get; set; } = "Active";
        public DateTime StartDate { get; set; } = DateTime.Now;
        public DateTime NextPaymentDate { get; set; }

        public Account? Account { get; set; }
    }
}
