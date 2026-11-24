using System.Collections.Concurrent;
using System.Security.Cryptography;

namespace Maya.Server.Services;

/// <summary>
/// Phase 8: Penyimpan sementara parameter `state` OAuth (anti-CSRF).
/// Single-use, berlaku 10 menit, in-memory (cukup untuk 1 instance server single-owner).
/// Menyimpan juga redirect URI yang dipakai saat authorize agar token exchange memakai URI identik.
/// </summary>
public sealed class OAuthStateStore
{
    private static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(10);

    private readonly ConcurrentDictionary<string, (DateTimeOffset ExpiresAt, string CallbackUrl)> _states = new();

    public string Create(string callbackUrl)
    {
        Purge();
        var state = Convert.ToHexString(RandomNumberGenerator.GetBytes(24)).ToLowerInvariant();
        _states[state] = (DateTimeOffset.UtcNow.Add(Lifetime), callbackUrl);
        return state;
    }

    /// <summary>Mengonsumsi state (sekali pakai). Mengembalikan callbackUrl jika valid, null jika tidak.</summary>
    public string? TryConsume(string? state)
    {
        if (string.IsNullOrWhiteSpace(state)) return null;
        if (!_states.TryRemove(state, out var entry)) return null;
        return entry.ExpiresAt >= DateTimeOffset.UtcNow ? entry.CallbackUrl : null;
    }

    private void Purge()
    {
        var now = DateTimeOffset.UtcNow;
        foreach (var kv in _states)
        {
            if (kv.Value.ExpiresAt < now)
                _states.TryRemove(kv.Key, out _);
        }
    }
}
