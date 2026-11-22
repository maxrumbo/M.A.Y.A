using Maya.Shared.DTOs.Agent;
using Maya.Shared.DTOs.Chat;

namespace Maya.Server.Services.Interfaces;

public interface IAgentDispatcherService
{
    /// <summary>
    /// Mengecek apakah Maya.Agent di laptop sedang online dan terhubung ke SignalR.
    /// </summary>
    Task<bool> IsAgentOnlineAsync(string deviceId = "maxwell-laptop");

    /// <summary>
    /// Dispatch command dari server ke Maya.Agent (atau membuat PendingAction jika High Risk).
    /// </summary>
    Task<(bool Dispatched, PendingActionDto? PendingAction, CommandResultDto? Result)> DispatchCommandAsync(
        string commandName,
        object payload,
        Guid? conversationId,
        bool requiresConfirmation,
        string description,
        EmailPreviewDto? emailPreview = null);

    /// <summary>
    /// Mengeksekusi command yang sebelumnya berstatus PendingConfirmation setelah Maxwell
    /// mengonfirmasi dengan verifikasi biometrik / Step-Up.
    /// </summary>
    Task<CommandResultDto> ConfirmAndDispatchAsync(Guid commandId);

    /// <summary>
    /// H2 Hardening: Membatalkan command yang masih berstatus PendingConfirmation.
    /// Throws KeyNotFoundException jika tidak ditemukan.
    /// Throws InvalidOperationException jika status bukan PendingConfirmation.
    /// </summary>
    Task CancelCommandAsync(Guid commandId);

    /// <summary>
    /// Callback saat Maya.Agent mengembalikan hasil eksekusi command via SignalR.
    /// </summary>
    void HandleResult(CommandResultDto result);
}

