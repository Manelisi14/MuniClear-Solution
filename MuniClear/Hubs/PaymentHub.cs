using Microsoft.AspNetCore.SignalR;

namespace MuniClear.Hubs // Better to use .Hubs than .Data.Models
{
    public class PaymentHub : Hub
    {
        // This is the "station" that connects your Backend and Angular.
        // It remains empty because we are just using it to send messages.
    }
}

