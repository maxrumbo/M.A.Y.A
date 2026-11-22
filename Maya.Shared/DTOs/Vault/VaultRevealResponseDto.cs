namespace Maya.Shared.DTOs.Vault;

/// <summary>
/// Response berisi password plaintext setelah verifikasi Step-Up biometrik berhasil.
/// ExpiresAt menentukan kapan UI harus otomatis menyembunyikan password (default: 15 detik).
/// Password TIDAK PERNAH melewati LLM — hanya dikembalikan langsung ke client setelah biometrik sukses.
/// </summary>
public record VaultRevealResponseDto(
    Guid Id,
    string ServiceName,
    string Username,
    string PlainSecret,
    DateTimeOffset ExpiresAt
);
