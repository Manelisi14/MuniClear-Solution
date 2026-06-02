using System;

namespace MuniClear.Data.Models
{
    // Change 'internal' to 'public' here
    public class LoginRequest
    {
        public string Email { get; set; } = string.Empty;
        public string IdNumber { get; set; } = string.Empty;
    }
}
