using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using MuniClear.Data;
using MuniClear.Data.Models;
using MuniClear.Hubs;
using System.Text;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

// ── 1. Database Configuration ──────────────────────────────────────────
builder.Services.AddDbContext<MuniClearContext>(options =>
    options.UseSqlite(
        builder.Configuration.GetConnectionString("DefaultConnection") ?? "Data Source=muni.db",
        x => x.MigrationsAssembly("MuniClear")
    ));

// ── 2. CORS Policy ─────────────────────────────────────────────────────
builder.Services.AddCors(options =>
{
    options.AddPolicy("MuniClearPolicy", policy =>
        policy.SetIsOriginAllowed(_ => true)
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials());
});

// ── 3. JWT Authentication ──────────────────────────────────────────────
var jwtKey = builder.Configuration["Jwt:Key"] ?? "YourDefaultSecretKeyForDev123!";
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "MuniClear";
var jwtAud = builder.Configuration["Jwt:Audience"] ?? "MuniClearUsers";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtAud,
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(jwtKey))
        };

        // SignalR Token Support
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = ctx =>
            {
                var token = ctx.Request.Query["access_token"];
                var path = ctx.HttpContext.Request.Path;

                if (!string.IsNullOrEmpty(token) &&
                    path.StartsWithSegments("/paymentHub"))
                {
                    ctx.Token = token;
                }

                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();

// ── 4. Controllers, SignalR, & Swagger ─────────────────────────────────
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler =
            ReferenceHandler.IgnoreCycles;

        options.JsonSerializerOptions.WriteIndented = false;
    });

builder.Services.AddSignalR();

builder.Services.AddEndpointsApiExplorer();

builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new()
    {
        Title = "MuniClear API",
        Version = "v1"
    });

    c.AddSecurityDefinition("Bearer",
        new Microsoft.OpenApi.Models.OpenApiSecurityScheme
        {
            Name = "Authorization",
            Type = Microsoft.OpenApi.Models.SecuritySchemeType.Http,
            Scheme = "Bearer",
            BearerFormat = "JWT",
            In = Microsoft.OpenApi.Models.ParameterLocation.Header,
            Description = "Enter JWT token"
        });

    c.AddSecurityRequirement(
        new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
        {
            {
                new Microsoft.OpenApi.Models.OpenApiSecurityScheme
                {
                    Reference =
                        new Microsoft.OpenApi.Models.OpenApiReference
                        {
                            Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                            Id = "Bearer"
                        }
                },
                Array.Empty<string>()
            }
        });
});

var app = builder.Build();

// ── 5. Middleware Pipeline ─────────────────────────────────────────────
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("MuniClearPolicy");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.MapHub<PaymentHub>("/paymentHub");

// ── SEED ───────────────────────────────────────────────────────────────
using (var scope = app.Services.CreateScope())
{
    var context =
        scope.ServiceProvider.GetRequiredService<MuniClearContext>();

    context.Database.EnsureCreated();

    // ── Admin Seed ─────────────────────────────────────────────────────
    if (!context.AdminUsers.Any())
    {
        var admins = new List<AdminUser>();

        var adminData = new[]
        {
            ("Sipho Dlamini",      "sipho.dlamini@municlear.gov.za"),
            ("Nomvula Zulu",       "nomvula.zulu@municlear.gov.za"),
            ("Thabo Nkosi",        "thabo.nkosi@municlear.gov.za"),
            ("Lindiwe Mthembu",    "lindiwe.mthembu@municlear.gov.za"),
            ("Bongani Cele",       "bongani.cele@municlear.gov.za"),
            ("Ayanda Shabalala",   "ayanda.shabalala@municlear.gov.za"),
            ("Nokwanda Buthelezi", "nokwanda.buthelezi@municlear.gov.za"),
            ("Lungelo Ngubane",    "lungelo.ngubane@municlear.gov.za"),
            ("Zanele Majola",      "zanele.majola@municlear.gov.za"),
            ("MuniClear System",   "admin@municlear.gov.za"),
        };

        foreach (var (name, email) in adminData)
        {
            admins.Add(new AdminUser
            {
                FullName = name,
                Email = email,
                PasswordHash =
                    BCrypt.Net.BCrypt.HashPassword("admin123"),
                Role = "Admin"
            });
        }

        context.AdminUsers.AddRange(admins);

        await context.SaveChangesAsync();

        Console.WriteLine(
            $"[SEED] {admins.Count} admin users created.");
    }

    // ── Resident Seed ──────────────────────────────────────────────────
    if (!context.Residents.Any())
    {
        var residentData = new[]
        {
            ("Nhlanhla Msweli",    "nhlanhla.msweli@gmail.com",    "0821234567", "9001015800082"),
            ("Precious Dube",      "precious.dube@gmail.com",      "0832345678", "9203026100083"),
            ("Mandla Khumalo",     "mandla.khumalo@gmail.com",     "0843456789", "8807035400084"),
            ("Thandeka Ntuli",     "thandeka.ntuli@gmail.com",     "0764567890", "9505044700085"),
            ("Siyanda Mhlongo",    "siyanda.mhlongo@gmail.com",    "0715678901", "9104056200086"),
            ("Busisiwe Gumede",    "busisiwe.gumede@gmail.com",    "0726789012", "8802065400087"),
            ("Mlungisi Hlongwane", "mlungisi.hlongwane@gmail.com", "0737890123", "9306074800088"),
            ("Nokuthula Mnguni",   "nokuthula.mnguni@gmail.com",   "0748901234", "9608081200089"),
            ("Sthembiso Majola",   "sthembiso.majola@gmail.com",   "0759012345", "8904092600090"),
            ("Zanele Hadebe",      "zanele.hadebe@gmail.com",      "0760123456", "9010101400091"),
            ("Lwazi Ndlovu",       "lwazi.ndlovu@gmail.com",       "0771234567", "9212115800092"),
            ("Ntombifuthi Zondo",  "ntombifuthi.zondo@gmail.com",  "0782345678", "8806122600093"),
            ("Sibusiso Nxumalo",   "sibusiso.nxumalo@gmail.com",   "0793456789", "9109131800094"),
            ("Khanyisile Mbatha",  "khanyisile.mbatha@gmail.com",  "0804567890", "9403144200095"),
            ("Phiwayinkosi Mthwa", "phiwayinkosi.mthwa@gmail.com", "0815678901", "8811153600096"),
            ("Nomalanga Mthethwa", "nomalanga.mthethwa@gmail.com", "0826789012", "9207162400097"),
            ("Nkosinathi Mkhize",  "nkosinathi.mkhize@gmail.com",  "0837890123", "8803175800098"),
            ("Duduzile Cele",      "duduzile.cele@gmail.com",      "0848901234", "9508181200099"),
            ("Mthokozisi Nkosi",   "mthokozisi.nkosi@gmail.com",   "0759012346", "9001192600100"),
            ("Hlengiwe Ngcobo",    "hlengiwe.ngcobo@gmail.com",    "0760123457", "9704201400101"),
        };

        var residents = new List<Resident>();

        foreach (var (name, email, phone, saId) in residentData)
        {
            residents.Add(new Resident
            {
                FullName = name,
                Email = email,
                Phone = phone,
                SA_IDNumber = saId,
                PasswordHash =
                    BCrypt.Net.BCrypt.HashPassword(saId),
                CreatedAt = DateTime.UtcNow
            });
        }

        context.Residents.AddRange(residents);

        await context.SaveChangesAsync();

        Console.WriteLine(
            $"[SEED] {residents.Count} residents created.");

        // ── Properties ────────────────────────────────────────────────
        var streets = new[]
        {
            "14 King Cetshwayo St",
            "7 Bhambatha Rd",
            "22 Shaka Ave",
            "3 Dingane Cres",
            "45 Mandela Dr",
            "11 Sobukwe Ln",
            "88 Luthuli Park",
            "19 Sisulu Rd",
            "56 Tambo St",
            "31 Biko Ave",
            "62 Richards Bay Rd",
            "5 Empangeni Ln",
            "77 Nseleni Cres",
            "9 Ngwelezana Dr",
            "40 Felixton Ave",
            "16 Esikhawini St",
            "29 Alton Rd",
            "8 Arboretum Cres",
            "53 Meerensee Dr",
            "37 CBD West"
        };

        var suburbs = new[]
        {
            "Richards Bay CBD",
            "Empangeni",
            "Nseleni",
            "Ngwelezana",
            "Felixton",
            "Esikhawini",
            "Alton",
            "Arboretum",
            "Meerensee",
            "Hillside"
        };

        var categories = new[]
        {
            "Residential",
            "Residential",
            "Residential",
            "Commercial"
        };

        var properties = new List<Property>();

        for (int i = 0; i < residents.Count; i++)
        {
            properties.Add(new Property
            {
                ResidentID = residents[i].ResidentID,
                Address = streets[i],
                Suburb = suburbs[i % suburbs.Length],
                Category = categories[i % categories.Length],
                MeterNumber = $"MTR{100 + i:D3}"
            });
        }

        context.Properties.AddRange(properties);

        await context.SaveChangesAsync();

        Console.WriteLine(
            $"[SEED] {properties.Count} properties created.");

        // ── Accounts ─────────────────────────────────────────────────
        var rng = new Random(42);

        var accounts = new List<Account>();

        for (int i = 0; i < residents.Count; i++)
        {
            var arrears =
                i % 4 == 0
                    ? Math.Round(
                        (decimal)(rng.NextDouble() * 2000 + 200),
                        2)
                    : 0m;

            var current =
                Math.Round(
                    (decimal)(rng.NextDouble() * 1500 + 100),
                    2);

            var blocked = arrears > 1000;

            accounts.Add(new Account
            {
                ResidentID = residents[i].ResidentID,
                PropertyID = properties[i].PropertyID,
                AccountNumber = $"MUNI-{7000 + i:D4}-ZA",
                ArrearsBalance = arrears,
                OutstandingBalance = current,
                IsBlocked = blocked,
                CreatedAt = DateTime.UtcNow
            });
        }

        accounts[0].AccountNumber = "MUNI-7788-ZA";
        accounts[0].ArrearsBalance = 650.00m;
        accounts[0].IsBlocked = true;

        context.Accounts.AddRange(accounts);

        await context.SaveChangesAsync();

        Console.WriteLine(
            $"[SEED] {accounts.Count} accounts created.");
    }
}

app.Run();
