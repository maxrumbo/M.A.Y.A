using Maya.Agent.Services;

namespace Maya.Agent;

public class Worker : BackgroundService
{
    private readonly SignalRClientService _signalRClient;
    private readonly ILogger<Worker> _logger;

    public Worker(SignalRClientService signalRClient, ILogger<Worker> logger)
    {
        _signalRClient = signalRClient;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("M.A.Y.A. Windows Local Daemon starting at: {time}", DateTimeOffset.Now);

        await _signalRClient.StartAsync(stoppingToken);

        // Pertahankan worker tetap aktif sampai aplikasi dihentikan
        try
        {
            await Task.Delay(Timeout.Infinite, stoppingToken);
        }
        catch (OperationCanceledException)
        {
            _logger.LogInformation("M.A.Y.A. Windows Local Daemon stopping...");
        }
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        await _signalRClient.StopAsync(cancellationToken);
        await base.StopAsync(cancellationToken);
    }
}
