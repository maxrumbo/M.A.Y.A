import * as signalR from '@microsoft/signalr';
import { authStorage, getApiBaseUrl } from '../api/client';
import { getOrCreateMobileDeviceId, isNativeMobile } from './mobileNative';
import type {
  DeviceStatus,
  WakeWordStatus,
  WakeWordHeardEvent,
  MobileStatus,
  FindMeRequest,
} from '../types';

class SignalRService {
  private connection: signalR.HubConnection | null = null;
  private listeners: {
    statusChange: Array<(status: DeviceStatus) => void>;
    commandStatus: Array<(data: { commandId: string; status: string; output?: string }) => void>;
    connected: Array<(isConnected: boolean) => void>;
    wakeWordStatus: Array<(status: WakeWordStatus) => void>;
    wakeWordHeard: Array<(event: WakeWordHeardEvent) => void>;
    mobileStatus: Array<(status: MobileStatus) => void>;
    findMyPhone: Array<(req: FindMeRequest) => void>;
    stopFindMyPhone: Array<() => void>;
  } = {
    statusChange: [],
    commandStatus: [],
    connected: [],
    wakeWordStatus: [],
    wakeWordHeard: [],
    mobileStatus: [],
    findMyPhone: [],
    stopFindMyPhone: [],
  };

  private async registerMobileIfNative(): Promise<void> {
    if (!isNativeMobile()) return;
    if (!this.connection || this.connection.state !== signalR.HubConnectionState.Connected) {
      return;
    }

    try {
      await this.connection.invoke('RegisterMobileDevice', getOrCreateMobileDeviceId());
    } catch {
      // ignore transient reconnect errors
    }
  }

  public async start(): Promise<void> {
    if (this.connection) return;

    const hubUrl = `${getApiBaseUrl()}/hubs/maya`;

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => authStorage.getToken() || '',
        skipNegotiation: false,
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    this.connection.on('AgentStatusChanged', (statusOrId: any, isOnlineParam?: boolean) => {
      let status: DeviceStatus;
      if (typeof statusOrId === 'object' && statusOrId !== null) {
        status = {
          deviceId: statusOrId.deviceId || 'maxwell-laptop',
          deviceType: statusOrId.deviceType || 'laptop',
          isOnline: !!statusOrId.isOnline,
          cpuUsagePercent: statusOrId.cpuUsagePercent ?? null,
          ramUsagePercent: statusOrId.ramUsagePercent ?? null,
          batteryPercent: statusOrId.batteryPercent ?? null,
          lastSeenAt: statusOrId.lastSeenAt || new Date().toISOString(),
        };
      } else {
        status = {
          deviceId: typeof statusOrId === 'string' ? statusOrId : 'maxwell-laptop',
          deviceType: 'laptop',
          isOnline: !!isOnlineParam,
          cpuUsagePercent: null,
          ramUsagePercent: null,
          batteryPercent: null,
          lastSeenAt: new Date().toISOString(),
        };
      }
      this.listeners.statusChange.forEach((cb) => cb(status));
    });

    this.connection.on('HardwareTelemetryUpdated', (stats: any) => {
      this.listeners.statusChange.forEach((cb) =>
        cb({
          deviceId: stats?.deviceId || 'maxwell-laptop',
          deviceType: 'laptop',
          isOnline: true,
          cpuUsagePercent: stats?.cpuUsagePercent ?? null,
          ramUsagePercent: stats?.ramUsagePercent ?? null,
          batteryPercent: stats?.batteryPercent ?? null,
          lastSeenAt: stats?.lastSeenAt || new Date().toISOString(),
        })
      );
    });

    this.connection.on('CommandStatusUpdated', (commandId: string, status: string, output?: string) => {
      this.listeners.commandStatus.forEach((cb) => cb({ commandId, status, output }));
    });

    this.connection.on('CommandStatusChanged', (commandId: string, status: string, output?: string) => {
      this.listeners.commandStatus.forEach((cb) => cb({ commandId, status, output }));
    });

    // Phase 6B: Wake-Word real-time status & heard events
    this.connection.on('WakeWordStatusChanged', (status: WakeWordStatus) => {
      this.listeners.wakeWordStatus.forEach((cb) => cb(status));
    });

    this.connection.on('WakeWordHeard', (phrase: string, timestamp: string) => {
      this.listeners.wakeWordHeard.forEach((cb) => cb({ phrase, timestamp }));
    });

    // Phase 7: Mobile status & Find My Phone events
    this.connection.on('MobileStatusChanged', (status: MobileStatus) => {
      this.listeners.mobileStatus.forEach((cb) => cb(status));
    });

    this.connection.on('FindMyPhoneRequested', (req: FindMeRequest) => {
      this.listeners.findMyPhone.forEach((cb) => cb(req || {}));
    });

    this.connection.on('StopFindMyPhone', () => {
      this.listeners.stopFindMyPhone.forEach((cb) => cb());
    });

    this.connection.onclose(() => {
      this.listeners.connected.forEach((cb) => cb(false));
    });

    this.connection.onreconnected(() => {
      this.listeners.connected.forEach((cb) => cb(true));
      void this.registerMobileIfNative();
    });

    try {
      await this.connection.start();
      this.listeners.connected.forEach((cb) => cb(true));
      await this.registerMobileIfNative();
    } catch {
      this.listeners.connected.forEach((cb) => cb(false));
    }
  }

  public stop(): void {
    if (this.connection) {
      void this.connection.stop();
      this.connection = null;
    }
  }

  public async restart(): Promise<void> {
    this.stop();
    await this.start();
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

  public onWakeWordStatus(callback: (status: WakeWordStatus) => void): () => void {
    this.listeners.wakeWordStatus.push(callback);
    return () => {
      this.listeners.wakeWordStatus = this.listeners.wakeWordStatus.filter((cb) => cb !== callback);
    };
  }

  public onWakeWordHeard(callback: (event: WakeWordHeardEvent) => void): () => void {
    this.listeners.wakeWordHeard.push(callback);
    return () => {
      this.listeners.wakeWordHeard = this.listeners.wakeWordHeard.filter((cb) => cb !== callback);
    };
  }

  public onMobileStatusChange(callback: (status: MobileStatus) => void): () => void {
    this.listeners.mobileStatus.push(callback);
    return () => {
      this.listeners.mobileStatus = this.listeners.mobileStatus.filter((cb) => cb !== callback);
    };
  }

  public onFindMyPhoneRequested(callback: (req: FindMeRequest) => void): () => void {
    this.listeners.findMyPhone.push(callback);
    return () => {
      this.listeners.findMyPhone = this.listeners.findMyPhone.filter((cb) => cb !== callback);
    };
  }

  public onStopFindMyPhone(callback: () => void): () => void {
    this.listeners.stopFindMyPhone.push(callback);
    return () => {
      this.listeners.stopFindMyPhone = this.listeners.stopFindMyPhone.filter((cb) => cb !== callback);
    };
  }
}

export const signalRService = new SignalRService();
