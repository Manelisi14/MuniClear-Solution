using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MuniClear.Data;
using MuniClear.Data.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using MuniClear.Hubs;
using Stripe;
using Stripe.Checkout;
using System.Globalization;
using Twilio;
using Twilio.Rest.Api.V2010.Account;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace MuniClear.Api.Controllers
{
    [Route("api/[controller]")]
    [Authorize]
    [ApiController]
    public class PaymentsController : ControllerBase
    {
        private readonly MuniClearContext _context;
        private readonly IConfiguration _config;
        private readonly IHubContext<PaymentHub> _hubContext;

        public PaymentsController(MuniClearContext context, IConfiguration config, IHubContext<PaymentHub> hubContext)
        {
            _context = context;
            _config = config;
            _hubContext = hubContext;

            // Set QuestPDF license (required for community use)
            QuestPDF.Settings.License = LicenseType.Community;
        }

        // GET: api/Payments/history/{accountId}
        [HttpGet("history/{accountId}")]
        public async Task<IActionResult> GetPaymentHistory(int accountId)
        {
            var history = await _context.Payments
                .Where(p => p.AccountID == accountId)
                .OrderByDescending(p => p.CreatedAt)
                .ToListAsync();

            return Ok(history);
        }

        // GET: api/Payments/download-invoice/{paymentId}
        [HttpGet("download-invoice/{paymentId}")]
        public async Task<IActionResult> DownloadInvoice(int paymentId)
        {
            var payment = await _context.Payments
                .Include(p => p.Account)
                .FirstOrDefaultAsync(p => p.PaymentID == paymentId);

            if (payment == null) return NotFound();

            var document = Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Margin(50);
                    page.Header().Row(row =>
                    {
                        row.RelativeItem().Column(col =>
                        {
                            col.Item().Text("MuniClear").FontSize(22).SemiBold().FontColor("#0057FF");
                            col.Item().Text("Pietermaritzburg, South Africa").FontSize(10);
                        });
                        row.RelativeItem().AlignRight().Text("TAX INVOICE").FontSize(20).SemiBold();
                    });

                    page.Content().PaddingVertical(25).Column(col =>
                    {
                        col.Item().Text($"Invoice To: {payment.Account?.AccountNumber}").SemiBold();
                        col.Item().PaddingTop(10).Table(table =>
                        {
                            table.ColumnsDefinition(c =>
                            {
                                c.RelativeColumn();
                                c.RelativeColumn();
                            });
                            table.Header(h =>
                            {
                                h.Cell().BorderBottom(1).Padding(5).Text("Description");
                                h.Cell().BorderBottom(1).Padding(5).AlignRight().Text("Total");
                            });
                            table.Cell().Padding(5).Text($"{payment.PaymentMethod} Payment");
                            table.Cell().Padding(5).AlignRight().Text($"R {payment.Amount:N2}");
                        });
                    });

                    page.Footer().AlignCenter().Text(t =>
                    {
                        t.Span("Thank you for your payment. | Date: ");
                        t.Span(payment.CreatedAt.ToString("f"));
                    });
                });
            });

            return File(document.GeneratePdf(), "application/pdf", $"MuniClear_Invoice_{paymentId}.pdf");
        }

        [HttpPost("create-checkout/{accountId}")]
        public async Task<IActionResult> CreateStripeSession(int accountId, [FromBody] MockPaymentRequest request)
        {
            var account = await _context.Accounts.FindAsync(accountId);
            if (account == null) return NotFound("Account not found.");

            StripeConfiguration.ApiKey = _config["Stripe:SecretKey"];

            var options = new SessionCreateOptions
            {
                PaymentMethodTypes = new List<string> { "card" },
                LineItems = new List<SessionLineItemOptions>
                {
                    new SessionLineItemOptions
                    {
                        PriceData = new SessionLineItemPriceDataOptions
                        {
                            UnitAmount = (long)(request.Amount * 100),
                            Currency = "zar",
                            ProductData = new SessionLineItemPriceDataProductDataOptions
                            {
                                Name = $"MuniClear: {request.PaymentMethod}",
                                Description = $"Acc: {account.AccountNumber}"
                            },
                        },
                        Quantity = 1,
                    },
                },
                Mode = "payment",
                Metadata = new Dictionary<string, string>
                {
                    { "AccountId",   accountId.ToString() },
                    { "PaymentType", request.PaymentMethod ?? "General" },
                    { "AmountPaid",  request.Amount.ToString(CultureInfo.InvariantCulture) },
                    { "MeterNumber", request.MeterNumber ?? "" },
                    { "PhoneNumber", request.PhoneNumber ?? "" },
                    { "Network",     request.Network ?? "" },
                },
                SuccessUrl = request.PaymentMethod == "Arrears-Unblock"
                    ? "http://localhost:4200/dashboard?success=true"
                    : $"http://localhost:4200/{request.PaymentMethod?.ToLower()}?success=true",
                CancelUrl = "http://localhost:4200/dashboard?canceled=true",
            };

            var service = new SessionService();
            Session session = await service.CreateAsync(options);
            return Ok(new { url = session.Url });
        }

        [AllowAnonymous]
        [HttpPost("webhook")]
        public async Task<IActionResult> StripeWebhook()
        {
            var json = await new StreamReader(HttpContext.Request.Body).ReadToEndAsync();
            var signature = Request.Headers["Stripe-Signature"];
            var secret = _config["Stripe:WebhookSecret"];

            try
            {
                var stripeEvent = EventUtility.ConstructEvent(json, signature, secret);

                if (stripeEvent.Type == EventTypes.CheckoutSessionCompleted)
                {
                    var session = stripeEvent.Data.Object as Session;
                    if (session == null) return BadRequest();

                    var accountIdStr = session.Metadata.GetValueOrDefault("AccountId");
                    var type = session.Metadata.GetValueOrDefault("PaymentType", "General");
                    var amountStr = session.Metadata.GetValueOrDefault("AmountPaid", "0");
                    var userPhone = session.Metadata.GetValueOrDefault("PhoneNumber");

                    if (!int.TryParse(accountIdStr, out int accountId)) return BadRequest("Invalid AccountId");
                    decimal amount = decimal.Parse(amountStr, CultureInfo.InvariantCulture);

                    var rnd = new Random();

                    _context.Payments.Add(new Payment
                    {
                        AccountID = accountId,
                        Amount = amount,
                        CreatedAt = DateTime.Now,
                        PaymentMethod = type
                    });

                    if (type.Equals("Electricity", StringComparison.OrdinalIgnoreCase))
                    {
                        var generatedToken = string.Join("-", Enumerable.Range(0, 5).Select(_ => rnd.Next(1000, 9999).ToString()));
                        _context.ElectricityPurchases.Add(new ElectricityPurchase
                        {
                            AccountID = accountId,
                            MeterNumber = session.Metadata.GetValueOrDefault("MeterNumber", "Unknown"),
                            Token = generatedToken,
                            Amount = amount,
                            CreatedAt = DateTime.Now
                        });
                    }
                    else if (type.Equals("Airtime", StringComparison.OrdinalIgnoreCase))
                    {
                        var generatedVoucher = string.Concat(Enumerable.Range(0, 13).Select(_ => rnd.Next(0, 9).ToString()));
                        _context.MobilePurchases.Add(new MobilePurchase
                        {
                            AccountID = accountId,
                            Amount = amount,
                            PhoneNumber = userPhone ?? "Unknown",
                            Network = session.Metadata.GetValueOrDefault("Network", "Unknown"),
                            Type = "Airtime",
                            VoucherCode = generatedVoucher,
                            CreatedAt = DateTime.Now
                        });
                    }
                    else if (type.Equals("Arrears-Unblock", StringComparison.OrdinalIgnoreCase))
                    {
                        var account = await _context.Accounts.FindAsync(accountId);
                        if (account != null)
                        {
                            account.ArrearsBalance -= amount;
                            if (account.ArrearsBalance <= 0)
                            {
                                account.ArrearsBalance = 0;
                                account.IsBlocked = false;
                            }

                            SendTwilioSms(userPhone, "✅ Payment Successful!\n\nYour payment has been processed successfully. Your arrears have been cleared, and your account is now active.\n\nIf your services were previously restricted, they will be restored shortly.\n\nThank you for using Municlear.");
                        }
                    }

                    await _context.SaveChangesAsync();
                    await _hubContext.Clients.All.SendAsync("ReceivePaymentUpdate", new { accountId = accountId, type = type });
                }
                return Ok();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[WEBHOOK ERROR] {ex.Message}");
                return BadRequest();
            }
        }

        private void SendTwilioSms(string? toPhone, string body)
        {
            if (string.IsNullOrEmpty(toPhone)) return;
            if (toPhone.StartsWith("0")) toPhone = "+27" + toPhone.Substring(1);

            try
            {
                TwilioClient.Init(_config["Twilio:AccountSid"], _config["Twilio:AuthToken"]);
                MessageResource.Create(
                    body: body,
                    from: new Twilio.Types.PhoneNumber(_config["Twilio:PhoneNumber"]),
                    to: new Twilio.Types.PhoneNumber(toPhone)
                );
            }
            catch (Exception ex) { Console.WriteLine("[SMS ERROR] " + ex.Message); }
        }
    }

    public class MockPaymentRequest
    {
        public decimal Amount { get; set; }
        public string? PaymentMethod { get; set; }
        public string? MeterNumber { get; set; }
        public string? PhoneNumber { get; set; }
        public string? Network { get; set; }
    }
}
