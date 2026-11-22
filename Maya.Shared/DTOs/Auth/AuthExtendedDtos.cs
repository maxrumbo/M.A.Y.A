namespace Maya.Shared.DTOs.Auth;

/// <summary>
/// Response untuk setup PIN pertama kali.
/// </summary>
public record PinSetupRequestDto(
    string Pin,
    string ConfirmPin
);

/// <summary>
/// Response berisi Step-Up Token (JWT pendek 60 detik, purpose = "step_up").
/// Diperlukan sebelum akses: Vault Reveal &amp; Command Confirm.
/// </summary>
public record StepUpTokenResponseDto(
    string StepUpToken,
    int ExpiresInSeconds,
    DateTimeOffset ExpiresAt
);

/// <summary>
/// Options untuk registrasi / login WebAuthn/Passkey.
/// Challenge di-encode Base64Url.
/// </summary>
public record WebAuthnOptionsDto(
    string Challenge,
    string RpId,
    string RpName,
    string UserId,
    string UserName,
    string UserDisplayName,
    DateTimeOffset ExpiresAt
);

/// <summary>
/// Payload verifikasi credential WebAuthn dari browser.
/// </summary>
public record WebAuthnVerifyDto(
    string CredentialId,
    string ClientDataJson,
    string AuthenticatorData,
    string Signature,
    string? UserHandle = null
);

/// <summary>
/// Request untuk registrasi FCM Token dari Android app.
/// </summary>
public record RegisterFcmTokenDto(
    string DeviceId,
    string FcmToken
);
