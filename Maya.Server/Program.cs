using Maya.Server.Data;
using Maya.Server.Hubs;
using Maya.Server.Middleware;
using Maya.Server.Services;
using Maya.Server.Services.Interfaces;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.Text;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

// Pastikan user-secrets selalu dimuat jika tersedia (baik lewat launchSettings maupun direct run)
builder.Configuration.AddUserSecrets<Program>(optional: true);

// ─── JWT Authentication (Phase 4) ─────────────────────────────────────────────
// Baca Maya:JwtSecret dari user-secrets — WAJIB ada untuk proteksi seluruh /api/*
var jwtSecret = builder.Configuration["Maya:JwtSecret"]
    ?? throw new InvalidOperationException(
        "Maya:JwtSecret belum dikonfigurasi. " +
        "Jalankan: dotnet user-secrets set \"Maya:JwtSecret\" \"<min-32-char-secret>\" --project Maya.Server");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer           = true,
            ValidIssuer              = "maya-server",
            ValidateAudience         = true,
            ValidAudience            = "maya-client",
            ValidateLifetime         = true,
            ClockSkew                = TimeSpan.FromSeconds(30),
            IssuerSigningKey         = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
            ValidateIssuerSigningKey = true
        };
        // SignalR menggunakan query param untuk token (browser tidak bisa set header custom)
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = ctx =>
            {
                var token = ctx.Request.Query["access_token"];
                if (!string.IsNullOrEmpty(token) &&
                    ctx.HttpContext.Request.Path.StartsWithSegments("/hubs/maya"))
                {
                    ctx.Token = token;
                }
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();

// ─── H3 Hardening: Rate Limiting di /api/auth/* ──────────────────────────────
// Policy "AuthLimit"   : maks 5 req/menit per IP untuk seluruh /api/auth/*
// Policy "StepUpLimit" : maks 3 req/menit per IP khusus /api/auth/step-up (cegah PIN brute-force)
builder.Services.AddRateLimiter(options =>
{
    // General auth endpoints: 5 req/min/IP
    options.AddFixedWindowLimiter("AuthLimit", limiterOptions =>
    {
        limiterOptions.PermitLimit         = 5;
        limiterOptions.Window              = TimeSpan.FromMinutes(1);
        limiterOptions.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        limiterOptions.QueueLimit           = 0; // Tolak langsung jika penuh
    });

    // Step-up endpoint: 3 req/min/IP (lebih ketat karena verifikasi PIN)
    options.AddFixedWindowLimiter("StepUpLimit", limiterOptions =>
    {
        limiterOptions.PermitLimit         = 3;
        limiterOptions.Window              = TimeSpan.FromMinutes(1);
        limiterOptions.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        limiterOptions.QueueLimit           = 0;
    });

    // Respons 429 dengan Retry-After header
    options.OnRejected = async (context, token) =>
    {
        context.HttpContext.Response.StatusCode = 429;
        context.HttpContext.Response.Headers["Retry-After"] = "60";
        await context.HttpContext.Response.WriteAsJsonAsync(new
        {
            error  = "Terlalu banyak percobaan.",
            detail = "Batas permintaan autentikasi terlampaui. Coba lagi dalam 60 detik.",
            retryAfterSeconds = 60
        }, token);
    };
});

// ─── Database ────────────────────────────────────────────────────────────────
builder.Services.AddDbContext<MayaDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// ─── HTTP Client & Services (Phase 2: Gemini Brain, Memory, Vault) ───────────
builder.Services.AddHttpClient("Gemini");
builder.Services.AddScoped<IMemoryService, MemoryService>();
builder.Services.AddScoped<IVaultService, VaultService>();
builder.Services.AddScoped<IGeminiService, GeminiService>();

// ─── Phase 4: Auth Service ────────────────────────────────────────────────────
builder.Services.AddScoped<IAuthService, AuthService>();

// ─── Phase 4: Google Integration (opsional — fallback jika creds tidak ada) ──
builder.Services.AddScoped<IGoogleIntegrationService, GoogleIntegrationService>();

// ─── Phase 4: FCM Notification (opsional — fallback ke log jika tidak ada) ───
builder.Services.AddScoped<IFcmNotificationService, FcmNotificationService>();

// ─── Phase 4: Proactive Background Scheduler ─────────────────────────────────
builder.Services.AddHostedService<ProactiveSchedulerService>();

// ─── Real-Time SignalR Bridge & Agent Dispatcher (Phase 3) ───────────────────
builder.Services.AddSignalR();
builder.Services.AddSingleton<IAgentDispatcherService, AgentDispatcherService>();

// ─── Controllers ─────────────────────────────────────────────────────────────
builder.Services.AddControllers();

// ─── Swagger / OpenAPI (dengan Bearer Auth + X-Step-Up-Token) ────────────────
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "M.A.Y.A. API",
        Version = "v1",
        Description = "Maxwell Admires, Yet Awaits — Personal AI Assistant Backend API"
    });

    // ─── Bearer JWT Auth ───────────────────────────────────────────────────
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name         = "Authorization",
        Type         = SecuritySchemeType.Http,
        Scheme       = "bearer",
        BearerFormat = "JWT",
        In           = ParameterLocation.Header,
        Description  = "JWT Bearer token. Login via POST /api/auth/login-pin → gunakan token di sini.\nFormat: Bearer {token}"
    });

    // ─── X-Step-Up-Token Header ────────────────────────────────────────────
    c.AddSecurityDefinition("StepUpToken", new OpenApiSecurityScheme
    {
        Name        = "X-Step-Up-Token",
        Type        = SecuritySchemeType.ApiKey,
        In          = ParameterLocation.Header,
        Description = "Step-Up Token (JWT 60 detik) untuk aksi sensitif.\n" +
                      "Minta via POST /api/auth/step-up dengan PIN terbaru.\n" +
                      "Diperlukan untuk: GET /api/vault/{id}/reveal dan POST /api/agent/commands/{id}/confirm"
    });

    // Apply keduanya sebagai global security requirement (Swagger UI akan tampilkan keduanya)
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            Array.Empty<string>()
        }
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "StepUpToken" }
            },
            Array.Empty<string>()
        }
    });
});

// ─── CORS ─────────────────────────────────────────────────────────────────────
builder.Services.AddCors(options =>
{
    options.AddPolicy("MayaCorsPolicy", policy =>
    {
        policy
            .WithOrigins(
                "http://localhost:5173",    // maya-web (Vite dev server)
                "capacitor://localhost"     // maya-mobile (Capacitor Android)
            )
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();            // Diperlukan untuk SignalR WebSocket
    });
});

// ─── Logging ──────────────────────────────────────────────────────────────────
// NEVER LOG SECRETS — ILogger<T> terstruktur digunakan di seluruh service.
builder.Logging.ClearProviders();
builder.Logging.AddConsole();

var app = builder.Build();

// ─── Seed Initial Memories (Phase 2) ──────────────────────────────────────────
using (var scope = app.Services.CreateScope())
{
    var memoryService = scope.ServiceProvider.GetRequiredService<IMemoryService>();
    await memoryService.SeedInitialMemoriesAsync();
}

// ─── Middleware Pipeline ───────────────────────────────────────────────────────
// GlobalExceptionMiddleware WAJIB paling awal agar menangkap semua exception.
app.UseMiddleware<GlobalExceptionMiddleware>();

// Swagger UI hanya di Development
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "M.A.Y.A. API v1");
        c.RoutePrefix = "swagger"; // Swagger tersedia di /swagger
        c.DocumentTitle = "M.A.Y.A. API";
    });
}

app.UseHttpsRedirection();
app.UseRouting();
app.UseCors("MayaCorsPolicy");

// H3 Hardening: Rate Limiting aktif
app.UseRateLimiter();

// Phase 4: Authentication & Authorization aktif
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<MayaHub>("/hubs/maya");

// ─── Health Check Endpoint ─────────────────────────────────────────────────────
// GET /health → mengecek konektivitas database secara aktif. PUBLIK (tanpa auth).
app.MapGet("/health", async (MayaDbContext db, ILogger<Program> logger) =>
{
    try
    {
        var canConnect = await db.Database.CanConnectAsync();

        if (canConnect)
        {
            return Results.Ok(new
            {
                status    = "Healthy",
                database  = "Connected",
                timestamp = DateTimeOffset.UtcNow
            });
        }

        logger.LogWarning("Health check: database tidak dapat dijangkau.");
        return Results.Ok(new
        {
            status    = "Degraded",
            database  = "Disconnected",
            timestamp = DateTimeOffset.UtcNow
        });
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Health check: exception saat memeriksa koneksi database.");
        return Results.Ok(new
        {
            status    = "Degraded",
            database  = "Error",
            message   = "Database tidak dapat dijangkau.",
            timestamp = DateTimeOffset.UtcNow
        });
    }
})
.WithName("HealthCheck")
.WithTags("Infrastructure")
.ExcludeFromDescription(); // Sembunyikan dari Swagger (endpoint publik tanpa auth)

app.Run();
