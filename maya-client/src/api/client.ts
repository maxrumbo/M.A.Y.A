import type {
  DeviceStatus,
  ChatMessage,
  VaultSummary,
  VaultRevealResponse,
  MemoryEntry,
  MuteStatus,
  AgentSettings,
  WakeWordStateResponse,
  MobileStatus,
} from '../types';
import { getApiBaseUrl } from '../services/serverConfig';

export { getApiBaseUrl };

const TOKEN_KEY = 'maya_access_token';

export const authStorage = {
  getToken: (): string | null => localStorage.getItem(TOKEN_KEY),
  setToken: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clearToken: () => localStorage.removeItem(TOKEN_KEY),
  hasToken: (): boolean => !!localStorage.getItem(TOKEN_KEY),
};

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = authStorage.getToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${getApiBaseUrl()}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && !endpoint.includes('/api/auth/login')) {
    // If unauthorized on protected routes (not Step-Up which also returns 401 on bad token)
    if (!headers.has('X-Step-Up-Token')) {
      authStorage.clearToken();
      window.dispatchEvent(new Event('maya_unauthorized'));
    }
  }

  if (!response.ok) {
    let errorDetail = `HTTP ${response.status}`;
    try {
      const errJson = await response.json();
      errorDetail = errJson.detail || errJson.error || errJson.message || errorDetail;
    } catch {
      // ignore JSON parse error
    }
    throw new Error(errorDetail);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const api = {
  // ─── Auth ───
  loginWithPin: async (pin: string) => {
    const res = await apiRequest<{ accessToken: string; expiresInSeconds: number }>(
      '/api/auth/login-pin',
      {
        method: 'POST',
        body: JSON.stringify({ pin }),
      }
    );
    authStorage.setToken(res.accessToken);
    return res;
  },

  setupPin: (pin: string, confirmPin: string) =>
    apiRequest<void>('/api/auth/setup-pin', {
      method: 'POST',
      body: JSON.stringify({ pin, confirmPin }),
    }),

  getMe: () =>
    apiRequest<{ user: string; role: string; message: string }>('/api/auth/me'),

  requestStepUp: (verificationToken: string, targetId: string) =>
    apiRequest<{ stepUpToken: string; expiresInSeconds: number; expiresAt: string }>(
      '/api/auth/step-up',
      {
        method: 'POST',
        body: JSON.stringify({ verificationToken, targetId }),
      }
    ),

  // ─── Chat ───
  sendMessage: (message: string, conversationId?: string, signal?: AbortSignal) =>
    apiRequest<{ reply: string; pendingActions: any[] | null; conversationId: string }>(
      '/api/chat',
      {
        method: 'POST',
        body: JSON.stringify({ message, conversationId }),
        signal,
      }
    ),

  getConversations: () =>
    apiRequest<Array<{ id: string; title: string; createdAt: string; updatedAt: string }>>(
      '/api/conversations'
    ),

  getConversationMessages: (conversationId: string) =>
    apiRequest<ChatMessage[]>(`/api/conversations/${conversationId}/messages`),

  // ─── Agent / Laptop ───
  getDeviceStatus: () =>
    apiRequest<DeviceStatus>('/api/agent/status'),

  confirmCommand: (commandId: string, stepUpToken: string) =>
    apiRequest<{ commandId: string; success: boolean; output: string }>(
      `/api/agent/commands/${commandId}/confirm`,
      {
        method: 'POST',
        headers: { 'X-Step-Up-Token': stepUpToken },
      }
    ),

  cancelCommand: (commandId: string) =>
    apiRequest<void>(`/api/agent/commands/${commandId}/cancel`, {
      method: 'POST',
    }),

  // ─── Phase 6B: Find-Me & Wake-Word ───
  findMyLaptop: (durationSeconds = 10, message?: string) =>
    apiRequest<{ commandId: string; isSuccess: boolean; output: string; completedAt: string }>(
      '/api/agent/find-me',
      {
        method: 'POST',
        body: JSON.stringify({ durationSeconds, message }),
      }
    ),

  stopFindMe: () =>
    apiRequest<{ commandId: string; isSuccess: boolean; output: string; completedAt: string }>(
      '/api/agent/find-me/stop',
      {
        method: 'POST',
      }
    ),

  getWakeWordState: () =>
    apiRequest<WakeWordStateResponse>('/api/agent/wake-word'),

  updateWakeWordSettings: (settings: AgentSettings) =>
    apiRequest<WakeWordStateResponse>('/api/agent/wake-word', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),

  // ─── Phase 7: Mobile (Find My Phone) ───
  getMobileStatus: () =>
    apiRequest<MobileStatus>('/api/mobile/status'),

  findMyPhone: (durationSeconds = 10, message?: string) =>
    apiRequest<{ deviceCount: number; message: string; sentAt: string }>(
      '/api/mobile/find-me',
      {
        method: 'POST',
        body: JSON.stringify({ durationSeconds, message }),
      }
    ),

  stopFindMyPhone: () =>
    apiRequest<MobileStatus>('/api/mobile/find-me/stop', {
      method: 'POST',
    }),

  // ─── Vault ───
  listVault: () =>
    apiRequest<VaultSummary[]>('/api/vault'),

  createVaultEntry: (data: { serviceName: string; username: string; plainSecret: string; notes?: string }) =>
    apiRequest<VaultSummary>('/api/vault', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  revealVaultEntry: (id: string, stepUpToken: string) =>
    apiRequest<VaultRevealResponse>(`/api/vault/${id}/reveal`, {
      method: 'GET',
      headers: { 'X-Step-Up-Token': stepUpToken },
    }),

  deleteVaultEntry: (id: string) =>
    apiRequest<void>(`/api/vault/${id}`, {
      method: 'DELETE',
    }),

  // ─── Memories ───
  listMemories: () =>
    apiRequest<MemoryEntry[]>('/api/memories'),

  upsertMemory: (data: { key: string; value: string; category: string; importance: number }) =>
    apiRequest<MemoryEntry>('/api/memories', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteMemory: (id: string) =>
    apiRequest<void>(`/api/memories/${id}`, {
      method: 'DELETE',
    }),

  // ─── Notifications (Mute) ───
  getMuteStatus: () =>
    apiRequest<MuteStatus>('/api/notifications/mute-status'),

  muteNotifications: (durationMinutes: number) =>
    apiRequest<MuteStatus>('/api/notifications/mute', {
      method: 'POST',
      body: JSON.stringify({ durationMinutes }),
    }),

  unmuteNotifications: () =>
    apiRequest<{ isMuted: boolean; message: string }>('/api/notifications/unmute', {
      method: 'POST',
    }),
};
