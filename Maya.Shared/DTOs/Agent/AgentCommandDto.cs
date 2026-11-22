namespace Maya.Shared.DTOs.Agent;

/// <summary>
/// Perintah yang dikirim dari Maya.Server ke Maya.Agent melalui SignalR.
/// PayloadJson berisi parameter perintah dalam format JSON.
/// </summary>
public record AgentCommandDto(
    Guid CommandId,
    string CommandName,
    string PayloadJson
);
