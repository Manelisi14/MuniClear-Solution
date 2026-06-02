using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using MuniClear.Data.Models;

namespace MuniClear.Data
{
    public class MuniClearContext : DbContext
    {
        public MuniClearContext(DbContextOptions<MuniClearContext> options) : base(options)
        {
        }

        // ── TABLES ──────────────────────────────────────────────────────────
        public DbSet<Resident> Residents { get; set; }
        public DbSet<Property> Properties { get; set; }
        public DbSet<Account> Accounts { get; set; }
        public DbSet<Bills> Bills { get; set; }
        public DbSet<Payment> Payments { get; set; }
        public DbSet<Transaction> Transactions { get; set; }
        public DbSet<ElectricityPurchase> ElectricityPurchases { get; set; }
        public DbSet<MobilePurchase> MobilePurchases { get; set; }
        public DbSet<UnblockRequest> UnblockRequests { get; set; }
        public DbSet<AdminUser> AdminUsers { get; set; }
        public DbSet<WaterReading> WaterReadings { get; set; }
        public DbSet<Fault> Faults { get; set; }
        public DbSet<PaymentPlan> PaymentPlans { get; set; }
        public DbSet<Notification> Notifications { get; set; }
        public DbSet<PasskeyCredential> PasskeyCredentials { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // ── SQLITE DECIMAL SUM FIX ──────────────────────────────────────
            // SQLite doesn't support 'decimal' for Sum(). 
            // We convert Decimals to Doubles for the DB, but keep them as Decimals in C#.
            var decimalConverter = new ValueConverter<decimal, double>(
                v => (double)v,
                v => (decimal)v);

            var nullableDecimalConverter = new ValueConverter<decimal?, double?>(
                v => v.HasValue ? (double?)v.Value : null,
                v => v.HasValue ? (decimal?)v.Value : null);

            foreach (var entityType in modelBuilder.Model.GetEntityTypes())
            {
                var properties = entityType.GetProperties()
                    .Where(p => p.ClrType == typeof(decimal) || p.ClrType == typeof(decimal?));

                foreach (var property in properties)
                {
                    if (property.ClrType == typeof(decimal))
                    {
                        property.SetValueConverter(decimalConverter);
                    }
                    else
                    {
                        property.SetValueConverter(nullableDecimalConverter);
                    }

                    // Set standard currency precision for other DB providers (like SQL Server)
                    property.SetColumnType("REAL");
                }
            }

            // ── ADDITIONAL RELATIONSHIPS (Optional but recommended) ──────────
            modelBuilder.Entity<Account>()
                .HasOne(a => a.Resident)
                .WithMany(r => r.Accounts)
                .HasForeignKey(a => a.ResidentID);
        }
    }
}
