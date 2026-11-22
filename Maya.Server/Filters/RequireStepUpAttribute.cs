using Maya.Server.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Maya.Server.Filters;

/// <summary>
/// [RequireStepUp] — Action filter yang memvalidasi X-Step-Up-Token header.
///
/// H1 Hardening:
/// - Token terikat ke resource ID spesifik (target_id claim = {id} route param)
/// - Single-use: setelah divalidasi berhasil, JTI ditandai consumed dan tidak bisa dipakai lagi
///
/// Digunakan pada endpoint sensitif:
///   - GET  /api/vault/{id}/reveal
///   - POST /api/agent/commands/{id}/confirm
///
/// Alur:
/// 1. Client minta POST /api/auth/step-up dengan PIN terbaru + targetId
/// 2. Server return StepUpToken (JWT 60 detik, berisi target_id claim)
/// 3. Client kirim request sensitif dengan header: X-Step-Up-Token: {token}
/// 4. Filter ini memvalidasi token: purpose, lifetime, targetId, dan single-use
///
/// Jika token tidak ada / tidak valid / expired / salah targetId / sudah dipakai → 401 Unauthorized
/// </summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class)]
public class RequireStepUpAttribute : Attribute, IAsyncActionFilter
{
    public const string HeaderName = "X-Step-Up-Token";

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        // Ambil IAuthService dari DI
        var authService = context.HttpContext.RequestServices.GetService<IAuthService>();
        if (authService is null)
        {
            context.Result = new StatusCodeResult(500);
            return;
        }

        // Cek header X-Step-Up-Token
        if (!context.HttpContext.Request.Headers.TryGetValue(HeaderName, out var tokenValues)
            || string.IsNullOrWhiteSpace(tokenValues))
        {
            context.Result = new UnauthorizedObjectResult(new
            {
                error  = "Step-Up Token diperlukan untuk aksi ini.",
                detail = $"Minta Step-Up Token terlebih dahulu via POST /api/auth/step-up dengan TargetId yang sesuai, " +
                         $"kemudian sertakan di header: {HeaderName}: {{token}}"
            });
            return;
        }

        // H1: Ambil {id} dari route untuk validasi targetId
        if (!context.RouteData.Values.TryGetValue("id", out var routeIdObj)
            || !Guid.TryParse(routeIdObj?.ToString(), out var routeId))
        {
            context.Result = new BadRequestObjectResult(new
            {
                error = "Route parameter {id} tidak ditemukan atau bukan Guid valid."
            });
            return;
        }

        var token = tokenValues.ToString();

        // H1: Validasi token dengan targetId binding + single-use
        if (!authService.ValidateStepUpToken(token, routeId))
        {
            context.Result = new UnauthorizedObjectResult(new
            {
                error  = "Step-Up Token tidak valid, sudah expired, sudah dipakai, atau tidak sesuai resource.",
                detail = "Step-Up Token berlaku 60 detik dan hanya bisa dipakai sekali untuk resource spesifik. " +
                         "Minta token baru via POST /api/auth/step-up dengan TargetId yang sesuai."
            });
            return;
        }

        await next();
    }
}
