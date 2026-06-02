using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace MuniClear.Data.Models
{
    public class Notification
    {
        public int NotificationID { get; set; }
        public int AccountID { get; set; }
        public string Title { get; set; } = "";
        public string Message { get; set; } = "";
        public string Type { get; set; } = "Info"; // Info, Success, Warning, Danger
        public bool IsRead { get; set; } = false;
        public DateTime CreatedAt { get; set; } = DateTime.Now;

        public Account? Account { get; set; }
    }
}
