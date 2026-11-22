using Maya.Shared.DTOs.Agent;

namespace Maya.Agent.Commands;

public interface ILocalCommand
{
    string CommandName { get; }
    Task<CommandResultDto> ExecuteAsync(Guid commandId, string payloadJson);
}
