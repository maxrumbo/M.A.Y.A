using System.Security.Cryptography;
using System.Text;

namespace Maya.Server.Services;

/// <summary>
/// Phase 8: Enkripsi/dekripsi secret kecil (mis. Google refresh token) dengan AES-256-GCM
/// memakai Maya:VaultMasterKey yang sama dengan Password Vault.
/// Format tersimpan: "enc:v1:" + Base64( nonce[12] || tag[16] || ciphertext ).
/// Nilai tanpa prefix dianggap legacy plaintext (otomatis bisa dimigrasi oleh pemanggil).
/// </summary>
public interface ISecretProtector
{
    string Protect(string plaintext);
    string Unprotect(string stored);
    bool IsProtected(string stored);
}

public sealed class SecretProtector : ISecretProtector
{
    private const string Prefix = "enc:v1:";
    private const int NonceSize = 12;
    private const int TagSize = 16;

    private readonly IConfiguration _config;
    private byte[]? _key;

    public SecretProtector(IConfiguration config)
    {
        _config = config;
    }

    public bool IsProtected(string stored) =>
        !string.IsNullOrEmpty(stored) && stored.StartsWith(Prefix, StringComparison.Ordinal);

    public string Protect(string plaintext)
    {
        var key = GetKey();
        var plain = Encoding.UTF8.GetBytes(plaintext);
        var nonce = RandomNumberGenerator.GetBytes(NonceSize);
        var cipher = new byte[plain.Length];
        var tag = new byte[TagSize];

        using var aes = new AesGcm(key, TagSize);
        aes.Encrypt(nonce, plain, cipher, tag);

        var blob = new byte[NonceSize + TagSize + cipher.Length];
        Buffer.BlockCopy(nonce, 0, blob, 0, NonceSize);
        Buffer.BlockCopy(tag, 0, blob, NonceSize, TagSize);
        Buffer.BlockCopy(cipher, 0, blob, NonceSize + TagSize, cipher.Length);

        return Prefix + Convert.ToBase64String(blob);
    }

    public string Unprotect(string stored)
    {
        if (!IsProtected(stored))
            return stored; // legacy plaintext

        var key = GetKey();
        var blob = Convert.FromBase64String(stored[Prefix.Length..]);
        if (blob.Length < NonceSize + TagSize)
            throw new CryptographicException("Payload terenkripsi tidak valid.");

        var nonce = blob.AsSpan(0, NonceSize);
        var tag = blob.AsSpan(NonceSize, TagSize);
        var cipher = blob.AsSpan(NonceSize + TagSize);
        var plain = new byte[cipher.Length];

        using var aes = new AesGcm(key, TagSize);
        aes.Decrypt(nonce, cipher, tag, plain);

        return Encoding.UTF8.GetString(plain);
    }

    private byte[] GetKey()
    {
        if (_key is not null) return _key;

        var base64 = _config["Maya:VaultMasterKey"];
        if (string.IsNullOrWhiteSpace(base64))
            throw new InvalidOperationException("Maya:VaultMasterKey belum dikonfigurasi.");

        var key = Convert.FromBase64String(base64);
        if (key.Length != 32)
            throw new InvalidOperationException($"Maya:VaultMasterKey harus 32 bytes (ditemukan {key.Length}).");

        _key = key;
        return key;
    }
}
