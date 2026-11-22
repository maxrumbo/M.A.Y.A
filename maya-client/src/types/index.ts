export interface DeviceStatus {
  deviceId: string;
  deviceType: string;
  isOnline: boolean;
  cpuUsagePercent: number | null;
  ramUsagePercent: number | null;
  batteryPercent: number | null;
  lastSeenAt: string;
}

export interface EmailPreview {
  to: string;
  subject: string;
  bodyPreview: string;
}

export interface PendingAction {
  commandId: string;
  commandName: string;
  description: string;
  requiresBiometricConfirmation: boolean;
  emailPreview?: EmailPreview | null;
  status?: 'Waiting' | 'Executing' | 'Completed' | 'Cancelled';
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'model';
  content: string;
  createdAt: string;
  pendingActions?: PendingAction[] | null;
}

export interface VaultSummary {
  id: string;
  serviceName: string;
  username: string;
  notes?: string | null;
  updatedAt: string;
}

export interface VaultRevealResponse {
  id: string;
  serviceName: string;
  username: string;
  plainSecret: string;
  notes?: string | null;
  revealedAt: string;
  expiresAt: string;
}

export interface MemoryEntry {
  id: string;
  key: string;
  value: string;
  category: 'Identity' | 'Preference' | 'Routine' | 'Project' | 'Personal';
  importance: number;
  createdAt: string;
  updatedAt: string;
}

export interface MuteStatus {
  isMuted: boolean;
  mutedUntil: string | null;
  remainingMinutes: number;
}
