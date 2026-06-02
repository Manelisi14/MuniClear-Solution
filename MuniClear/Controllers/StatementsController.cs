using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MuniClear.Data;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using Microsoft.AspNetCore.Authorization;

namespace MuniClear.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class StatementsController : ControllerBase
    {
        private readonly MuniClearContext _context;

        public StatementsController(MuniClearContext context)
        {
            _context = context;
            QuestPDF.Settings.License = LicenseType.Community;
        }

        // GET api/Statements/monthly/{accountId}
        [HttpGet("monthly/{accountId}")]
        public async Task<IActionResult> MonthlyStatement(int accountId)
        {
            var account = await _context.Accounts.FindAsync(accountId);
            if (account == null) return NotFound();

            var now = DateTime.Now;
            var monthStr = now.ToString("MMMM yyyy");

            var payments = await _context.Payments
                .Where(p => p.AccountID == accountId && p.CreatedAt.Month == now.Month)
                .ToListAsync();

            var electricity = await _context.ElectricityPurchases
                .Where(e => e.AccountID == accountId && e.CreatedAt.Month == now.Month)
                .ToListAsync();

            var waterReadings = await _context.WaterReadings
                .Where(w => w.AccountID == accountId && w.CreatedAt.Month == now.Month)
                .ToListAsync();

            // Bills — using real field names from Bills.cs
            var bills = await _context.Bills
                .Where(b => b.AccountID == accountId)
                .OrderByDescending(b => b.CreatedAt)
                .Take(1) // most recent bill record
                .ToListAsync();

            var latestBill = bills.FirstOrDefault();

            // Use bill charges if available, otherwise fall back to defaults
            decimal ratesMonthly = 533.47m;
            decimal waterCharge = latestBill?.WaterCharge
                ?? (waterReadings.Any() ? waterReadings.Sum(w => w.Usage) * 12.65m : 285.34m);
            decimal sewerCharge = latestBill?.SewerCharge ?? waterCharge * 0.65m;
            decimal refuseCharge = latestBill?.RefuseCharge ?? 185.50m;
            decimal elecCharge = latestBill?.ElectricityCharge ?? 0m;

            decimal totalCharges = ratesMonthly + waterCharge + sewerCharge + refuseCharge + elecCharge;
            decimal vatAmount = totalCharges * 0.15m;
            decimal totalWithVat = totalCharges + vatAmount;
            decimal totalPaid = payments.Sum(p => p.Amount);

            var document = Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A4);
                    page.Margin(40);
                    page.DefaultTextStyle(x => x.FontSize(10));

                    // ── HEADER ──────────────────────────────────────────────
                    page.Header().Column(col =>
                    {
                        col.Item().Row(row =>
                        {
                            row.RelativeItem().Column(c =>
                            {
                                c.Item().Text("MuniClear")
                                    .FontSize(24).SemiBold().FontColor("#0a5c8a");
                                c.Item().Text("uMhlathuze Local Municipality")
                                    .FontSize(9).FontColor("#6b7280");
                            });
                            row.RelativeItem().AlignRight().Column(c =>
                            {
                                c.Item().Text("TAX INVOICE")
                                    .FontSize(18).SemiBold().FontColor("#0a5c8a");
                                c.Item().Text($"Period: {monthStr}")
                                    .FontSize(9).FontColor("#6b7280");
                                c.Item().Text($"Generated: {now:dd MMM yyyy}")
                                    .FontSize(9).FontColor("#6b7280");
                            });
                        });
                        col.Item().PaddingTop(8).LineHorizontal(1).LineColor("#e5e7eb");
                    });

                    // ── CONTENT ──────────────────────────────────────────────
                    page.Content().PaddingVertical(16).Column(col =>
                    {
                        // Account info
                        col.Item().Background("#f8fafc").Padding(10).Row(row =>
                        {
                            row.RelativeItem().Column(c =>
                            {
                                c.Item().Text("Account Details").SemiBold().FontSize(11);
                                c.Item().PaddingTop(4).Text($"Account: {account.AccountNumber}");
                                c.Item().Text($"Status: {(account.IsBlocked ? "BLOCKED" : "Active")}")
                                    .FontColor(account.IsBlocked ? "#991b1b" : "#166534");
                            });
                            row.RelativeItem().Column(c =>
                            {
                                c.Item().Text("Balance Summary").SemiBold().FontSize(11);
                                c.Item().PaddingTop(4).Text($"Outstanding Balance: R{account.OutstandingBalance:N2}");
                                c.Item().Text($"Arrears: R{account.ArrearsBalance:N2}")
                                    .FontColor(account.ArrearsBalance > 0 ? "#991b1b" : "#166534");
                            });
                        });

                        if (latestBill != null)
                        {
                            col.Item().PaddingTop(8).Text($"Billing period: {latestBill.BillingMonth}")
                                .FontSize(9).FontColor("#6b7280");
                        }

                        // Charges table
                        col.Item().PaddingTop(16).Text("Monthly Charges").SemiBold().FontSize(12);
                        col.Item().PaddingTop(6).Table(table =>
                        {
                            table.ColumnsDefinition(c =>
                            {
                                c.RelativeColumn(3);
                                c.RelativeColumn();
                                c.RelativeColumn();
                            });

                            table.Header(h =>
                            {
                                h.Cell().Background("#0a5c8a").Padding(6)
                                    .Text("Description").FontColor("#ffffff").SemiBold();
                                h.Cell().Background("#0a5c8a").Padding(6)
                                    .AlignRight().Text("Excl. VAT").FontColor("#ffffff").SemiBold();
                                h.Cell().Background("#0a5c8a").Padding(6)
                                    .AlignRight().Text("Incl. VAT").FontColor("#ffffff").SemiBold();
                            });

                            void AddRow(string desc, decimal excl)
                            {
                                table.Cell().BorderBottom(0.5f).BorderColor("#f3f4f6").Padding(6).Text(desc);
                                table.Cell().BorderBottom(0.5f).BorderColor("#f3f4f6").Padding(6).AlignRight().Text($"R{excl:N2}");
                                table.Cell().BorderBottom(0.5f).BorderColor("#f3f4f6").Padding(6).AlignRight().Text($"R{excl * 1.15m:N2}");
                            }

                            AddRow("Rates & taxes", ratesMonthly);
                            AddRow("Water consumption", waterCharge);
                            AddRow("Sewer & sanitation", sewerCharge);
                            AddRow("Refuse removal", refuseCharge);
                            if (elecCharge > 0)
                                AddRow("Electricity charges", elecCharge);

                            // VAT row
                            table.Cell().Background("#fefce8").Padding(6).Text("VAT (15%)").SemiBold();
                            table.Cell().Background("#fefce8").Padding(6).AlignRight().Text("—");
                            table.Cell().Background("#fefce8").Padding(6).AlignRight().Text($"R{vatAmount:N2}").SemiBold();

                            // Total row
                            table.Cell().Background("#e6f4fb").Padding(6).Text("TOTAL DUE").SemiBold().FontColor("#0a5c8a");
                            table.Cell().Background("#e6f4fb").Padding(6).AlignRight().Text($"R{totalCharges:N2}").SemiBold().FontColor("#0a5c8a");
                            table.Cell().Background("#e6f4fb").Padding(6).AlignRight().Text($"R{totalWithVat:N2}").SemiBold().FontColor("#0a5c8a");
                        });

                        // Electricity tokens
                        if (electricity.Any())
                        {
                            col.Item().PaddingTop(16).Text("Electricity Tokens Purchased").SemiBold().FontSize(12);
                            col.Item().PaddingTop(6).Table(table =>
                            {
                                table.ColumnsDefinition(c =>
                                {
                                    c.RelativeColumn();
                                    c.RelativeColumn();
                                    c.RelativeColumn(2);
                                });
                                table.Header(h =>
                                {
                                    h.Cell().Background("#0a5c8a").Padding(5).Text("Date").FontColor("#fff").SemiBold();
                                    h.Cell().Background("#0a5c8a").Padding(5).Text("Amount").FontColor("#fff").SemiBold();
                                    h.Cell().Background("#0a5c8a").Padding(5).Text("Token").FontColor("#fff").SemiBold();
                                });
                                foreach (var e in electricity)
                                {
                                    table.Cell().BorderBottom(0.5f).BorderColor("#f3f4f6").Padding(5).Text(e.CreatedAt.ToString("dd MMM"));
                                    table.Cell().BorderBottom(0.5f).BorderColor("#f3f4f6").Padding(5).AlignRight().Text($"R{e.Amount:N2}");
                                    table.Cell().BorderBottom(0.5f).BorderColor("#f3f4f6").Padding(5).Text(e.Token);
                                }
                            });
                        }

                        // Payments received
                        if (payments.Any())
                        {
                            col.Item().PaddingTop(16).Text("Payments Received").SemiBold().FontSize(12);
                            col.Item().PaddingTop(6).Table(table =>
                            {
                                table.ColumnsDefinition(c =>
                                {
                                    c.RelativeColumn();
                                    c.RelativeColumn();
                                    c.RelativeColumn();
                                });
                                table.Header(h =>
                                {
                                    h.Cell().Background("#166534").Padding(5).Text("Date").FontColor("#fff").SemiBold();
                                    h.Cell().Background("#166534").Padding(5).Text("Method").FontColor("#fff").SemiBold();
                                    h.Cell().Background("#166534").Padding(5).Text("Amount").FontColor("#fff").SemiBold();
                                });
                                foreach (var p in payments)
                                {
                                    table.Cell().BorderBottom(0.5f).BorderColor("#f3f4f6").Padding(5).Text(p.CreatedAt.ToString("dd MMM yyyy"));
                                    table.Cell().BorderBottom(0.5f).BorderColor("#f3f4f6").Padding(5).Text(p.PaymentMethod ?? "Stripe");
                                    table.Cell().BorderBottom(0.5f).BorderColor("#f3f4f6").Padding(5).AlignRight().Text($"R{p.Amount:N2}").FontColor("#166634");
                                }
                                table.Cell().Background("#f0fdf4").Padding(5).Text("Total Paid").SemiBold();
                                table.Cell().Background("#f0fdf4").Padding(5);
                                table.Cell().Background("#f0fdf4").Padding(5).AlignRight().Text($"R{totalPaid:N2}").SemiBold().FontColor("#166534");
                            });
                        }
                    });

                    // ── FOOTER ───────────────────────────────────────────────
                    page.Footer().BorderTop(0.5f).BorderColor("#e5e7eb").PaddingTop(8).Row(row =>
                    {
                        row.RelativeItem().Text("MuniClear — uMhlathuze Local Municipality")
                            .FontSize(8).FontColor("#9ca3af");
                        row.RelativeItem().AlignRight().Text(t =>
                        {
                            t.Span("Page ").FontSize(8).FontColor("#9ca3af");
                            t.CurrentPageNumber().FontSize(8).FontColor("#9ca3af");
                            t.Span(" of ").FontSize(8).FontColor("#9ca3af");
                            t.TotalPages().FontSize(8).FontColor("#9ca3af");
                        });
                    });
                });
            });

            return File(
                document.GeneratePdf(),
                "application/pdf",
                $"MuniClear_Statement_{accountId}_{now:yyyy-MM}.pdf"
            );
        }
    }
}