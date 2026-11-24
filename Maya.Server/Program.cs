using Maya.Server.Data;
using Maya.Server.Hubs;
using Maya.Server.Middleware;
using Maya.Server.Services;
using Maya.Server.Services.Interfaces;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
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

// ─── Phase 4/8: Google Integration & Secret Protector (AES-256-GCM) ──────────
builder.Services.AddSingleton<ISecretProtector, SecretProtector>();
builder.Services.AddSingleton<OAuthStateStore>();
builder.Services.AddScoped<IGoogleIntegrationService, GoogleIntegrationService>();

// ─── Phase 4/8: FCM Notification (opsional — fallback ke log jika tidak ada) ──
// Singleton: dipakai juga oleh MobileDeviceService (singleton) untuk Find-Me via FCM push.
builder.Services.AddSingleton<IFcmNotificationService, FcmNotificationService>();

// ─── Phase 4 & 5: Notification Mute & Proactive Background Scheduler ──────────
builder.Services.AddSingleton<INotificationMuteService, NotificationMuteService>();
builder.Services.AddHostedService<ProactiveSchedulerService>();

// ─── Real-Time SignalR Bridge & Agent Dispatcher (Phase 3 & 6B) ──────────────
builder.Services.AddSignalR();
builder.Services.AddSingleton<IAgentDispatcherService, AgentDispatcherService>();
builder.Services.AddSingleton<IAgentSettingsService, AgentSettingsService>();
builder.Services.AddSingleton<IMobileDeviceService, MobileDeviceService>();

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

// ─── Phase 8: Cloud / Reverse Proxy (Render, Koyeb, Azure Container Apps) ────
// Di balik proxy TLS, IP klien asli & skema https datang via X-Forwarded-*.
// Aktifkan dengan Maya:TrustForwardedHeaders=true (diset otomatis di Dockerfile).
var trustForwardedHeaders = builder.Configuration.GetValue<bool>("Maya:TrustForwardedHeaders");
if (trustForwardedHeaders)
{
    builder.Services.Configure<ForwardedHeadersOptions>(options =>
    {
        options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
        // Platform PaaS memakai IP proxy internal yang dinamis → percaya semua hop (server tidak terekspos langsung).
        options.KnownIPNetworks.Clear();
        options.KnownProxies.Clear();
    });
}

// Origin tambahan yang diizinkan CORS (comma-separated), mis. domain web terpisah. Same-origin tidak butuh ini.
var extraAllowedOrigins = (builder.Configuration["Maya:AllowedOrigins"] ?? string.Empty)
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
    .Select(o => o.TrimEnd('/'))
    .ToHashSet(StringComparer.OrdinalIgnoreCase);

// ─── CORS (Localhost, Capacitor, Wi-Fi LAN RFC1918 & Maya:AllowedOrigins) ─────
builder.Services.AddCors(options =>
{
    options.AddPolicy("MayaCorsPolicy", policy =>
    {
        policy
            .SetIsOriginAllowed(origin =>
            {
                if (string.IsNullOrWhiteSpace(origin)) return false;
                if (extraAllowedOrigins.Contains(origin.TrimEnd('/'))) return true;
                if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri)) return false;

                var host = uri.Host;

                // Izinkan localhost & Capacitor/Ionic mobile app
                if (host.Equals("localhost", StringComparison.OrdinalIgnoreCase) ||
                    host.Equals("127.0.0.1", StringComparison.OrdinalIgnoreCase) ||
                    uri.Scheme.Equals("capacitor", StringComparison.OrdinalIgnoreCase) ||
                    uri.Scheme.Equals("ionic", StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }

                // Izinkan akses dari perangkat HP/laptop lain di jaringan Wi-Fi LAN lokal (RFC1918)
                if (System.Net.IPAddress.TryParse(host, out var ip) &&
                    ip.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork)
                {
                    var bytes = ip.GetAddressBytes();
                    if (bytes[0] == 10) return true;
                    if (bytes[0] == 172 && bytes[1] >= 16 && bytes[1] <= 31) return true;
                    if (bytes[0] == 192 && bytes[1] == 168) return true;
                    // Tailscale / CGNAT (100.64.0.0/10)
                    if (bytes[0] == 100 && bytes[1] >= 64 && bytes[1] <= 127) return true;
                }

                return false;
            })
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

// ─── Seed Initial Memories (Phase 2 — Resilient Non-Blocking Startup) ────────
// Dijalankan asinkron setelah server mulai berjalan dan dibungkus try-catch agar
// jika Supabase sedang timeout/offline, Maya.Server langsung aktif di port 5063
// (endpoint /health, SignalR, dan Find-Me tetap berjalan tanpa crash atau delay).
app.Lifetime.ApplicationStarted.Register(() =>
{
    _ = Task.Run(async () =>
    {
        using var scope = app.Services.CreateScope();
        var startupLogger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
        try
        {
            var memoryService = scope.ServiceProvider.GetRequiredService<IMemoryService>();
            await memoryService.SeedInitialMemoriesAsync();
        }
        catch (Exception ex)
        {
            startupLogger.LogWarning(
                ex,
                "Gagal menjalankan SeedInitialMemoriesAsync saat startup (kemungkinan database sedang timeout/offline). " +
                "Server tetap berjalan — cek /health untuk status koneksi DB.");
        }
    });
});

// ─── Middleware Pipeline ───────────────────────────────────────────────────────
// Forwarded headers WAJIB pertama agar scheme/IP klien benar untuk semua middleware berikutnya.
if (trustForwardedHeaders)
{
    app.UseForwardedHeaders();
}

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

// Di balik proxy cloud, TLS sudah di-terminate proxy → jangan paksa redirect HTTPS di server.
if (!trustForwardedHeaders)
{
    app.UseHttpsRedirection();
}

// Phase 8: Layani maya-client (hasil `npm run build`) sebagai static files dari wwwroot (1 domain: web + API + SignalR).
// Hanya aktif jika wwwroot/index.html ada (di Docker image); saat dev lokal dilewati.
var webRoot = app.Environment.WebRootPath;
var hasWebClient = !string.IsNullOrEmpty(webRoot) && File.Exists(Path.Combine(webRoot, "index.html"));
if (hasWebClient)
{
    app.UseDefaultFiles();
    app.UseStaticFiles();
}

app.UseRouting();
app.UseCors("MayaCorsPolicy");

// H3 Hardening: Rate Limiting aktif
app.UseRateLimiter();

// Phase 4: Authentication & Authorization aktif
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<MayaHub>("/hubs/maya");

// Phase 8: SPA fallback — rute React (mis. /vault) dikembalikan ke index.html,
// kecuali namespace server (/api, /hubs, /swagger, /health) agar 404 API tetap jujur.
if (hasWebClient)
{
    app.MapFallbackToFile(
        "/{*path:regex(^(?!(api|hubs|swagger)(/|$)|health$).*$)}",
        "index.html");
}

// ─── Health Check Endpoint ─────────────────────────────────────────────────────
// GET /health → mengecek konektivitas database secara aktif. PUBLIK (tanpa auth).
app.MapGet("/health", async (MayaDbContext db, ILogger<Program> logger) =>
{
    try
    {
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(3));
        var canConnect = await db.Database.CanConnectAsync(cts.Token);

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
    catch (OperationCanceledException)
    {
        logger.LogWarning("Health check: timeout (>3 detik) saat memeriksa koneksi database.");
        return Results.Ok(new
        {
            status    = "Degraded",
            database  = "Timeout",
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
