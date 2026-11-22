using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;

namespace Maya.Server.Middleware;

/// <summary>
/// Middleware global untuk menangkap semua unhandled exception dan
/// mengembalikan format RFC 7807 ProblemDetails yang konsisten.
/// TIDAK mencetak detail error internal ke response (keamanan).
/// </summary>
public class GlobalExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<GlobalExceptionMiddleware> _logger;
    private readonly IHostEnvironment _env;

    public GlobalExceptionMiddleware(
        RequestDelegate next,
        ILogger<GlobalExceptionMiddleware> logger,
        IHostEnvironment env)
    {
        _next = next;
        _logger = logger;
        _env = env;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            // Log dengan structured logging — JANGAN log secret atau payload sensitif
            _logger.LogError(ex,
                "Unhandled exception pada {Method} {Path}",
                context.Request.Method,
                context.Request.Path);

            await HandleExceptionAsync(context, ex);
        }
    }

    private async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        // Jangan timpa response yang sudah dimulai
        if (context.Response.HasStarted)
        {
            _logger.LogWarning("Response sudah dimulai saat exception terjadi, tidak dapat menulis ProblemDetails.");
            return;
        }

        context.Response.ContentType = "application/problem+json";
        context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;

        var problemDetails = new ProblemDetails
        {
            Status = (int)HttpStatusCode.InternalServerError,
            Title = "Internal Server Error",
            // Detail generik ke user, detail teknis hanya di Development
            Detail = _env.IsDevelopment()
                ? exception.Message
                : "Terjadi kesalahan pada server M.A.Y.A. Silakan coba lagi.",
            Instance = context.Request.Path
        };

        var options = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        await context.Response.WriteAsync(JsonSerializer.Serialize(problemDetails, options));
    }
}
