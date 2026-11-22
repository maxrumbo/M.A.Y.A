using System.Collections.Concurrent;
using System.Text.Json;
using Maya.Server.Data;
using Maya.Server.Data.Entities;
using Maya.Server.Hubs;
using Maya.Server.Services.Interfaces;
using Maya.Shared.DTOs.Agent;
using Maya.Shared.DTOs.Chat;
using Maya.Shared.Interfaces;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
namespace Maya.Server.Services;

/// <summary>
/// Singleton service untuk mendispatch command ke Maya.Agent (Windows laptop) melalui SignalR,
/// mengelola timeout 15 detik, dan memproteksi aksi HIGH_RISK dengan status PendingConfirmation.
/// </summary>
public class AgentDispatcherService : IAgentDispatcherService
{
    private readonly IHubContext<MayaHub, IMayaHubClient> _hubContext;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<AgentDispatcherService> _logger;

    private readonly ConcurrentDictionary<Guid, TaskCompletionSource<CommandResultDto>> _pendingCommands = new();
    private const string LaptopGroup = "LaptopAgent";
    private const string DefaultLaptopDeviceId = "maxwell-laptop";
    private static readonly TimeSpan CommandTimeout = TimeSpan.FromSeconds(15);

    public AgentDispatcherService(
        IHubContext<MayaHub, IMayaHubClient> hubContext,
        IServiceScopeFactory scopeFactory,
        ILogger<AgentDispatcherService> logger)
    {
        _hubContext = hubContext;
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    public async Task<bool> IsAgentOnlineAsync(string deviceId = "maxwell-laptop")
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<MayaDbContext>();

        var device = await db.DeviceStatuses
            .AsNoTracking()
            .FirstOrDefaultAsync(d => d.DeviceId == deviceId);

        return device?.IsOnline ?? false;
    }

    public async Task<(bool Dispatched, PendingActionDto? PendingAction, CommandResultDto? Result)> DispatchCommandAsync(
        string commandName,
        object payload,
        Guid? conversationId,
        bool requiresConfirmation,
        string description,
        EmailPreviewDto? emailPreview = null)
    {
        var commandId = Guid.NewGuid();
        var payloadJson = payload is string s ? s : JsonSerializer.Serialize(payload);

        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<MayaDbContext>();

        var commandLog = new CommandLog
        {
            Id = commandId,
            ConversationId = conversationId,
            CommandName = commandName,
            PayloadJson = payloadJson,
            RequiresConfirmation = requiresConfirmation,
            Status = requiresConfirmation ? "PendingConfirmation" : "Dispatched",
            CreatedAt = DateTimeOffset.UtcNow
        };

        db.CommandLogs.Add(commandLog);
        await db.SaveChangesAsync();

        if (requiresConfirmation)
        {
            _logger.LogInformation(
                "Aksi {CommandName} (ID: {CommandId}) dikategorikan HIGH_RISK. Menunggu konfirmasi biometrik/PIN.",
                commandName, commandId);

            var pendingAction = new PendingActionDto(
                CommandId: commandId,
                CommandName: commandName,
                Description: description,
                RequiresBiometricConfirmation: true,
                EmailPreview: emailPreview  // H5: sertakan email preview jika ada
            );

            return (Dispatched: false, PendingAction: pendingAction, Result: null);
        }

        // Cek koneksi laptop sebelum dispatch
        var isOnline = await IsAgentOnlineAsync(DefaultLaptopDeviceId);
        if (!isOnline)
        {
            commandLog.Status = "Failed";
            commandLog.ResultOutput = "Laptop agent is currently offline";
            commandLog.CompletedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync();

            return (
                Dispatched: false,
                PendingAction: null,
                Result: new CommandResultDto(commandId, false, "Laptop agent is currently offline", DateTimeOffset.UtcNow)
            );
        }

        // Dispatch langsung ke agent dan tunggu hasil
        var result = await SendAndAwaitResultAsync(commandId, commandName, payloadJson);
        return (Dispatched: true, PendingAction: null, Result: result);
    }

    public async Task<CommandResultDto> ConfirmAndDispatchAsync(Guid commandId)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<MayaDbContext>();

        var log = await db.CommandLogs.FindAsync(commandId)
            ?? throw new KeyNotFoundException($"Command dengan ID '{commandId}' tidak ditemukan.");

        if (log.Status != "PendingConfirmation")
        {
            throw new InvalidOperationException(
                $"Command '{commandId}' tidak dalam status PendingConfirmation (status saat ini: {log.Status}).");
        }

        // H5 Hardening & Google Integration: Eksekusi pengiriman email via server (bukan daemon laptop)
        if (log.CommandName == "gmail_send_email")
        {
            var googleService = scope.ServiceProvider.GetRequiredService<IGoogleIntegrationService>();
            if (!googleService.IsConfigured)
            {
                log.Status = "Failed";
                log.ResultOutput = "Google integration belum dikonfigurasi.";
                log.CompletedAt = DateTimeOffset.UtcNow;
                await db.SaveChangesAsync();
                return new CommandResultDto(commandId, false, "Google integration belum dikonfigurasi.", DateTimeOffset.UtcNow);
            }

            try
            {
                using var doc = JsonDocument.Parse(log.PayloadJson);
                var root = doc.RootElement;
                var to = root.GetProperty("to").GetString() ?? "";
                var subject = root.GetProperty("subject").GetString() ?? "";
                var body = root.GetProperty("body").GetString() ?? "";

                await googleService.SendEmailAsync(to, subject, body);

                log.Status = "Completed";
                log.ResultOutput = $"Email berhasil dikirim ke {to}.";
                log.CompletedAt = DateTimeOffset.UtcNow;
                await db.SaveChangesAsync();

                return new CommandResultDto(commandId, true, $"Email berhasil dikirim ke {to}.", DateTimeOffset.UtcNow);
            }
            catch (Exception ex)
            {
                log.Status = "Failed";
                log.ResultOutput = $"Gagal mengirim email: {ex.Message}";
                log.CompletedAt = DateTimeOffset.UtcNow;
                await db.SaveChangesAsync();
                return new CommandResultDto(commandId, false, $"Gagal mengirim email: {ex.Message}", DateTimeOffset.UtcNow);
            }
        }

        var isOnline = await IsAgentOnlineAsync(DefaultLaptopDeviceId);
        if (!isOnline)
        {
            log.Status = "Failed";
            log.ResultOutput = "Laptop agent is currently offline";
            log.CompletedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync();

            return new CommandResultDto(commandId, false, "Laptop agent is currently offline", DateTimeOffset.UtcNow);
        }

        log.Status = "Dispatched";
        await db.SaveChangesAsync();

        return await SendAndAwaitResultAsync(commandId, log.CommandName, log.PayloadJson);
    }

    public void HandleResult(CommandResultDto result)
    {
        if (_pendingCommands.TryRemove(result.CommandId, out var tcs))
        {
            tcs.TrySetResult(result);
        }
        else
        {
            _logger.LogWarning("Menerima result untuk CommandId {Id} yang tidak ada di daftar pending.", result.CommandId);
        }
    }

    // H2 Hardening: Cancel PendingConfirmation command
    public async Task CancelCommandAsync(Guid commandId)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<MayaDbContext>();

        var log = await db.CommandLogs.FindAsync(commandId)
            ?? throw new KeyNotFoundException($"Command dengan ID '{commandId}' tidak ditemukan.");

        if (log.Status != "PendingConfirmation")
            throw new InvalidOperationException(
                $"Command '{commandId}' tidak bisa dibatalkan — status saat ini: {log.Status}. " +
                "Hanya command dengan status PendingConfirmation yang bisa dibatalkan.");

        log.Status      = "Cancelled";
        log.CompletedAt = DateTimeOffset.UtcNow;
        log.ResultOutput = "Dibatalkan oleh Maxwell.";
        await db.SaveChangesAsync();

        // Jika ada TCS untuk command ini (seharusnya tidak ada karena pending = belum dispatch),
        // pastikan dibersihkan agar tidak ada resource leak
        if (_pendingCommands.TryRemove(commandId, out var tcs))
            tcs.TrySetCanceled();

        _logger.LogInformation("Command {CommandId} ({CommandName}) berhasil dibatalkan.", commandId, log.CommandName);
    }

    private async Task<CommandResultDto> SendAndAwaitResultAsync(
        Guid commandId,
        string commandName,
        string payloadJson)
    {
        var tcs = new TaskCompletionSource<CommandResultDto>(TaskCreationOptions.RunContinuationsAsynchronously);
        _pendingCommands[commandId] = tcs;

        try
        {
            _logger.LogInformation("Mengirim command {CommandName} (ID: {CommandId}) ke LaptopAgent...",
                commandName, commandId);

            await _hubContext.Clients.Group(LaptopGroup).ExecuteCommand(new AgentCommandDto(
                CommandId: commandId,
                CommandName: commandName,
                PayloadJson: payloadJson
            ));

            // Tunggu dengan timeout 15 detik
            using var cts = new CancellationTokenSource(CommandTimeout);
            using (cts.Token.Register(() => tcs.TrySetCanceled()))
            {
                return await tcs.Task;
            }
        }
        catch (OperationCanceledException)
        {
            _logger.LogWarning("Command {CommandName} (ID: {CommandId}) timeout setelah {Sec} detik.",
                commandName, commandId, CommandTimeout.TotalSeconds);

            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<MayaDbContext>();

            var log = await db.CommandLogs.FindAsync(commandId);
            if (log is not null)
            {
                log.Status = "Timeout";
                log.ResultOutput = $"Perintah timeout setelah {CommandTimeout.TotalSeconds} detik.";
                log.CompletedAt = DateTimeOffset.UtcNow;
                await db.SaveChangesAsync();
            }

            return new CommandResultDto(commandId, false, "Perintah ke laptop mengalami timeout (15 detik).", DateTimeOffset.UtcNow);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saat dispatching command {CommandName} (ID: {CommandId})", commandName, commandId);

            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<MayaDbContext>();

            var log = await db.CommandLogs.FindAsync(commandId);
            if (log is not null)
            {
                log.Status = "Failed";
                log.ResultOutput = ex.Message;
                log.CompletedAt = DateTimeOffset.UtcNow;
                await db.SaveChangesAsync();
            }

            return new CommandResultDto(commandId, false, $"Error dispatching command: {ex.Message}", DateTimeOffset.UtcNow);
        }
        finally
        {
            _pendingCommands.TryRemove(commandId, out _);
        }
    }
}
