using Maya.Agent;
using Maya.Agent.Commands;
using Maya.Agent.Services;

var builder = Host.CreateApplicationBuilder(args);

// Memuat user-secrets Maya.Agent
builder.Configuration.AddUserSecrets<Program>(optional: true);

// ─── Layanan Telemetri & SignalR ──────────────────────────────────────────────
builder.Services.AddSingleton<SystemMonitorService>();
builder.Services.AddSingleton<CommandExecutorService>();
builder.Services.AddSingleton<SignalRClientService>();

// ─── Perintah Lokal ───────────────────────────────────────────────────────────
builder.Services.AddSingleton<ILocalCommand, OpenApplicationCommand>();
builder.Services.AddSingleton<ILocalCommand, OpenUrlCommand>();
builder.Services.AddSingleton<ILocalCommand, GitWorkflowCommand>();
builder.Services.AddSingleton<ILocalCommand, PowerControlCommand>();
builder.Services.AddSingleton<ILocalCommand, MediaControlCommand>();
builder.Services.AddSingleton<ILocalCommand, GetSystemStatsCommand>();
builder.Services.AddSingleton<ILocalCommand, WriteNotepadCommand>();

// ─── Background Worker Service ────────────────────────────────────────────────
builder.Services.AddHostedService<Worker>();

var host = builder.Build();
host.Run();
