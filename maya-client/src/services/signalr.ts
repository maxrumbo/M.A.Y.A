import * as signalR from '@microsoft/signalr';
import { API_BASE_URL, authStorage } from '../api/client';
import type { DeviceStatus } from '../types';

class SignalRService {
  private connection: signalR.HubConnection | null = null;
  private listeners: {
    statusChange: Array<(status: DeviceStatus) => void>;
    commandStatus: Array<(data: { commandId: string; status: string; output?: string }) => void>;
    connected: Array<(isConnected: boolean) => void>;
  } = {
    statusChange: [],
    commandStatus: [],
    connected: [],
  };

  public async start(): Promise<void> {
    if (this.connection) return;

    const hubUrl = `${API_BASE_URL}/hubs/maya`;

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => authStorage.getToken() || '',
        skipNegotiation: false,
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    this.connection.on('AgentStatusChanged', (deviceId: string, isOnline: boolean) => {
      this.listeners.statusChange.forEach((cb) =>
        cb({
          deviceId,
          deviceType: 'laptop',
          isOnline,
          cpuUsagePercent: null,
          ramUsagePercent: null,
          batteryPercent: null,
          lastSeenAt: new Date().toISOString(),
        })
      );
    });

    this.connection.on('HardwareTelemetryUpdated', (stats: any) => {
      this.listeners.statusChange.forEach((cb) =>
        cb({
          deviceId: stats.deviceId || 'maxwell-laptop',
          deviceType: 'laptop',
          isOnline: true,
          cpuUsagePercent: stats.cpuUsagePercent ?? null,
          ramUsagePercent: stats.ramUsagePercent ?? null,
          batteryPercent: stats.batteryPercent ?? null,
          lastSeenAt: stats.lastSeenAt || new Date().toISOString(),
        })
      );
    });

    this.connection.on('CommandStatusChanged', (commandId: string, status: string, output?: string) => {
      this.listeners.commandStatus.forEach((cb) => cb({ commandId, status, output }));
    });

    this.connection.onclose(() => {
      this.listeners.connected.forEach((cb) => cb(false));
    });

    this.connection.onreconnected(() => {
      this.listeners.connected.forEach((cb) => cb(true));
    });

    try {
      await this.connection.start();
      this.listeners.connected.forEach((cb) => cb(true));
    } catch (err) {
      this.listeners.connected.forEach((cb) => cb(false));
    }
  }

  public stop(): void {
    if (this.connection) {
      this.connection.stop();
      this.connection = null;
    }
  }

  public onStatusChange(callback: (status: DeviceStatus) => void): () => void {
    this.listeners.statusChange.push(callback);
    return () => {
      this.listeners.statusChange = this.listeners.statusChange.filter((cb) => cb !== callback);
    };
  }

  public onCommandStatus(
    callback: (data: { commandId: string; status: string; output?: string }) => void
  ): () => void {
    this.listeners.commandStatus.push(callback);
    return () => {
      this.listeners.commandStatus = this.listeners.commandStatus.filter((cb) => cb !== callback);
    };
  }

  public onConnectionChange(callback: (isConnected: boolean) => void): () => void {
    this.listeners.connected.push(callback);
    return () => {
      this.listeners.connected = this.listeners.connected.filter((cb) => cb !== callback);
    };
  }
}

export const signalRService = new SignalRService();
