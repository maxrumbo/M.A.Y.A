const STORAGE_KEY = 'maya_server_url';
const HISTORY_KEY = 'maya_server_url_history';
const MAX_HISTORY = 5;

export const DEFAULT_API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5063'
)
  .trim()
  .replace(/\/+$/, '');

export function normalizeServerUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) {
    throw new Error('URL server tidak boleh kosong.');
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Format URL tidak valid. Gunakan format seperti http://10.139.30.105:5063');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('URL server harus diawali http:// atau https://');
  }

  return `${parsed.protocol}//${parsed.host}${parsed.pathname}`.replace(/\/+$/, '');
}

export function getApiBaseUrl(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return normalizeServerUrl(saved);
    }
  } catch {
    // fallback ke default
  }
  return DEFAULT_API_BASE_URL;
}

export function getUrlHistory(): string[] {
  const list: string[] = [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (typeof item === 'string' && item.trim() && !list.includes(item)) {
            list.push(item);
          }
        }
      }
    }
  } catch {
    // ignore
  }

  if (!list.includes(DEFAULT_API_BASE_URL)) {
    list.push(DEFAULT_API_BASE_URL);
  }

  return list.slice(0, MAX_HISTORY);
}

export function setApiBaseUrl(rawUrl: string): string {
  const normalized = normalizeServerUrl(rawUrl);
  localStorage.setItem(STORAGE_KEY, normalized);

  const history = [normalized, ...getUrlHistory().filter((u) => u !== normalized)].slice(
    0,
    MAX_HISTORY
  );
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));

  window.dispatchEvent(new CustomEvent('maya_server_url_changed', { detail: normalized }));
  return normalized;
}

export function resetApiBaseUrl(): string {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(
    new CustomEvent('maya_server_url_changed', { detail: DEFAULT_API_BASE_URL })
  );
  return DEFAULT_API_BASE_URL;
}

export async function testServerConnection(
  rawUrl: string
): Promise<{ ok: boolean; latencyMs?: number; statusText: string }> {
  let normalized: string;
  try {
    normalized = normalizeServerUrl(rawUrl);
  } catch (err: any) {
    return { ok: false, statusText: err.message || 'URL tidak valid.' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  const start = performance.now();

  try {
    const res = await fetch(`${normalized}/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    const latencyMs = Math.round(performance.now() - start);

    if (!res.ok) {
      return {
        ok: false,
        latencyMs,
        statusText: `Server merespons HTTP ${res.status}.`,
      };
    }

    let dbInfo = '';
    try {
      const data = await res.json();
      if (data?.database) dbInfo = ` (DB: ${data.database})`;
    } catch {
      // ignore non-json
    }

    return {
      ok: true,
      latencyMs,
      statusText: `Terhubung (${latencyMs} ms)${dbInfo}`,
    };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return {
        ok: false,
        statusText: 'Timeout (4 detik). Cek IP laptop, Wi-Fi/Tailscale, dan Windows Firewall port 5063.',
      };
    }
    return {
      ok: false,
      statusText: `Gagal terhubung: ${err?.message || 'Network error'}`,
    };
  } finally {
    clearTimeout(timer);
  }
}
