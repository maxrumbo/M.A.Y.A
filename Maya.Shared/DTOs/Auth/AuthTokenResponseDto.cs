namespace Maya.Shared.DTOs.Auth;

/// <summary>
/// Response berisi JWT access token setelah autentikasi berhasil.
/// </summary>
public record AuthTokenResponseDto(
    string AccessToken,
    string TokenType,
    int ExpiresInSeconds,
    DateTimeOffset ExpiresAt
);
