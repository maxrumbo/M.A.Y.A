using Maya.Agent;
using Maya.Agent.Audio;
using Maya.Agent.Commands;
using Maya.Agent.Services;
using Maya.Agent.WakeWord;

var builder = Host.CreateApplicationBuilder(args);

// Memuat user-secrets Maya.Agent
builder.Configuration.AddUserSecrets<Program>(optional: true);

// ─── Layanan Telemetri, Pengaturan, Audio & SignalR ───────────────────────────
builder.Services.AddSingleton<SystemMonitorService>();
builder.Services.AddSingleton<AgentSettingsStore>();
builder.Services.AddSingleton<AudioAlertService>();
builder.Services.AddSingleton<IWakeWordEngine, WindowsSpeechWakeWordEngine>();
builder.Services.AddSingleton<WakeWordListenerService>();
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
builder.Services.AddSingleton<ILocalCommand, FindMyDeviceCommand>();
builder.Services.AddSingleton<ILocalCommand, StopFindMeCommand>();

// ─── Background Worker Services ───────────────────────────────────────────────
builder.Services.AddHostedService<Worker>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<WakeWordListenerService>());

var host = builder.Build();
host.Run();
