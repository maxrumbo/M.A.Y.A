using Maya.Server.Services.Interfaces;
using Maya.Shared.DTOs.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Maya.Server.Controllers;

/// <summary>
/// Google OAuth 2.0 Integration + FCM Token Registration.
///
/// Google Calendar &amp; Gmail (opsional — butuh Google:ClientId &amp; Google:ClientSecret):
///   GET  /api/integrations/google/authorize   — Redirect ke Google OAuth consent screen
///   GET  /api/integrations/google/callback    — Callback dari Google, simpan refresh token
///   GET  /api/integrations/google/status      — Cek apakah Google sudah terkoneksi
///
/// FCM (opsional — butuh Firebase:ServiceAccountJson):
///   POST /api/agent/register-fcm              — Daftarkan FCM token dari Android app
/// </summary>
[ApiController]
[Route("api/integrations")]
[Produces("application/json")]
[Authorize]
public class IntegrationsController : ControllerBase
{
    private readonly IGoogleIntegrationService _googleService;
    private readonly IFcmNotificationService _fcmService;
    private readonly ILogger<IntegrationsController> _logger;

    public IntegrationsController(
        IGoogleIntegrationService googleService,
        IFcmNotificationService fcmService,
        ILogger<IntegrationsController> logger)
    {
        _googleService = googleService;
        _fcmService    = fcmService;
        _logger        = logger;
    }

    // ─── Google OAuth ─────────────────────────────────────────────────────────

    /// <summary>
    /// Cek status koneksi Google (apakah OAuth sudah dilakukan dan token tersedia).
    /// Jika Google:ClientId belum dikonfigurasi → 501 Not Implemented.
    /// </summary>
    [HttpGet("google/status")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status501NotImplemented)]
    public IActionResult GetGoogleStatus()
    {
        if (!_googleService.IsConfigured)
            return StatusCode(501, new
            {
                configured = false,
                message    = "Google integration belum dikonfigurasi. " +
                             "Set Google:ClientId dan Google:ClientSecret via dotnet user-secrets untuk mengaktifkan."
            });

        return Ok(new
        {
            configured = true,
            message    = "Google integration aktif. Gunakan /authorize untuk memulai OAuth flow."
        });
    }

    /// <summary>
    /// Mulai Google OAuth2 flow — redirect ke Google consent screen.
    /// Setelah user approve, Google akan redirect ke /api/integrations/google/callback.
    /// </summary>
    [HttpGet("google/authorize")]
    [ProducesResponseType(StatusCodes.Status302Found)]
    [ProducesResponseType(StatusCodes.Status501NotImplemented)]
    public IActionResult AuthorizeGoogle()
    {
        if (!_googleService.IsConfigured)
            return StatusCode(501, new
            {
                error   = "Google integration belum dikonfigurasi.",
                message = "Set Google:ClientId dan Google:ClientSecret via dotnet user-secrets."
            });

        var state       = Guid.NewGuid().ToString("N");
        var redirectUrl = _googleService.GetAuthorizationUrl(state);
        return Redirect(redirectUrl);
    }

    /// <summary>
    /// Callback Google OAuth2 — exchange code untuk token, simpan ke DB.
    /// Jangan panggil endpoint ini secara manual — Google yang akan redirect ke sini.
    /// </summary>
    [HttpGet("google/callback")]
    [AllowAnonymous] // Google redirect tidak bawa JWT
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> HandleGoogleCallback(
        [FromQuery] string code,
        [FromQuery] string state)
    {
        if (string.IsNullOrEmpty(code))
            return BadRequest(new { error = "Authorization code tidak ditemukan dalam callback." });

        try
        {
            await _googleService.HandleCallbackAsync(code, state);
            return Ok(new
            {
                success = true,
                message = "Google Calendar &amp; Gmail berhasil terkoneksi! Kamu bisa menutup tab ini."
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Google OAuth callback gagal.");
            return BadRequest(new { error = "OAuth flow gagal: " + ex.Message });
        }
    }

    // ─── FCM Token Registration ───────────────────────────────────────────────

    /// <summary>
    /// Daftarkan FCM token dari Android M.A.Y.A. App ke server.
    ///
    /// FCM token diperlukan agar server bisa mengirim push notification ke HP.
    /// Panggil endpoint ini setiap kali app mobile startup atau token di-refresh Firebase.
    ///
    /// FCM:
    /// - Jika Firebase:ServiceAccountJson belum dikonfigurasi → token tetap tersimpan ke DB,
    ///   notifikasi akan di-log saja (tidak ada push notification nyata).
    /// </summary>
    [HttpPost("register-fcm")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> RegisterFcmToken([FromBody] RegisterFcmTokenDto req)
    {
        if (string.IsNullOrWhiteSpace(req.DeviceId) || string.IsNullOrWhiteSpace(req.FcmToken))
            return BadRequest(new { error = "DeviceId dan FcmToken wajib diisi." });

        await _fcmService.RegisterFcmTokenAsync(req.DeviceId, req.FcmToken);

        _logger.LogInformation(
            "FCM token terdaftar untuk device '{DeviceId}'. Firebase configured: {Configured}",
            req.DeviceId, _fcmService.IsConfigured);

        return NoContent();
    }
}
