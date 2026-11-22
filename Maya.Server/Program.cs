using Maya.Server.Data;
using Maya.Server.Middleware;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// ─── Database ────────────────────────────────────────────────────────────────
// Koneksi dibaca dari IConfiguration (dotnet user-secrets / Environment Variable).
// TIDAK ADA hardcoded connection string di sini.
builder.Services.AddDbContext<MayaDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// ─── Controllers ─────────────────────────────────────────────────────────────
builder.Services.AddControllers();

// ─── Swagger / OpenAPI (dengan Bearer Auth support) ──────────────────────────
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "M.A.Y.A. API",
        Version = "v1",
        Description = "Maxwell Admires, Yet Awaits — Personal AI Assistant Backend API"
    });

    // Konfigurasi Bearer Auth header di Swagger UI
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name         = "Authorization",
        Type         = SecuritySchemeType.Http,
        Scheme       = "bearer",
        BearerFormat = "JWT",
        In           = ParameterLocation.Header,
        Description  = "Masukkan JWT token. Format: Bearer {token}"
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id   = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Mengizinkan Laptop Web App (Vite dev) dan Android Mobile App (Capacitor).
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

// Authentication & Authorization akan dikonfigurasi di Phase 4
// app.UseAuthentication();
// app.UseAuthorization();

app.MapControllers();

// ─── Health Check Endpoint ─────────────────────────────────────────────────────
// GET /health → mengecek konektivitas database secara aktif.
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
