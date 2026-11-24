import React, { useState, useEffect } from 'react';
import {
  X,
  Server,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RotateCcw,
  Wifi,
  Clock,
} from 'lucide-react';
import {
  DEFAULT_API_BASE_URL,
  getApiBaseUrl,
  getUrlHistory,
  setApiBaseUrl,
  resetApiBaseUrl,
  testServerConnection,
} from '../services/serverConfig';

interface ServerSettingsModalProps {
  onClose: () => void;
  onSaved?: (newUrl: string) => void;
}

export const ServerSettingsModal: React.FC<ServerSettingsModalProps> = ({
  onClose,
  onSaved,
}) => {
  const [urlInput, setUrlInput] = useState<string>(getApiBaseUrl());
  const [history, setHistory] = useState<string[]>(getUrlHistory());
  const [testing, setTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setHistory(getUrlHistory());
  }, []);

  const handleTest = async () => {
    setTesting(true);
    setError(null);
    setTestResult(null);

    const res = await testServerConnection(urlInput);
    setTestResult({ ok: res.ok, text: res.statusText });
    setTesting(false);
  };

  const handleSave = () => {
    setError(null);
    try {
      const saved = setApiBaseUrl(urlInput);
      setHistory(getUrlHistory());
      onSaved?.(saved);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan URL server.');
    }
  };

  const handleReset = () => {
    const def = resetApiBaseUrl();
    setUrlInput(def);
    setTestResult(null);
    setError(null);
    onSaved?.(def);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/95 shadow-2xl p-5 text-zinc-100 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-950/60 border border-indigo-800/60 text-indigo-400">
              <Server className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-semibold text-sm">Server Endpoint URL</h2>
              <p className="text-[11px] text-zinc-400 font-mono">
                Ganti IP Wi-Fi / Hotspot / Tailscale tanpa rebuild APK
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Input URL */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-zinc-300 block">
            Alamat Maya.Server
          </label>
          <input
            type="url"
            value={urlInput}
            onChange={(e) => {
              setUrlInput(e.target.value);
              setError(null);
              setTestResult(null);
            }}
            placeholder="http://10.139.30.105:5063"
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-xs font-mono text-zinc-100 placeholder-zinc-600 outline-none focus:border-indigo-500"
          />
          <p className="text-[10px] text-zinc-500 leading-relaxed">
            Default build: <span className="font-mono text-zinc-400">{DEFAULT_API_BASE_URL}</span>.
            Prioritaskan IP Tailscale (<span className="font-mono">100.x.x.x</span>) di jaringan publik agar lalu lintas terenkripsi.
          </p>
        </div>

        {/* Test Koneksi Button + Result */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={handleTest}
            disabled={testing || !urlInput.trim()}
            className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-xl border border-zinc-700/80 bg-zinc-800 hover:bg-zinc-750 text-xs font-medium text-zinc-200 transition-colors disabled:opacity-50"
          >
            {testing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />
                <span>Menguji koneksi /health...</span>
              </>
            ) : (
              <>
                <Wifi className="h-3.5 w-3.5 text-indigo-400" />
                <span>Test Koneksi</span>
              </>
            )}
          </button>

          {testResult && (
            <div
              className={`flex items-start space-x-2 rounded-xl border px-3 py-2 text-xs ${
                testResult.ok
                  ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                  : 'bg-red-950/40 border-red-900/60 text-red-300'
              }`}
            >
              {testResult.ok ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-400" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
              )}
              <span>{testResult.text}</span>
            </div>
          )}

          {error && (
            <div className="flex items-start space-x-2 rounded-xl border bg-red-950/40 border-red-900/60 px-3 py-2 text-xs text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Recent URL History */}
        {history.length > 0 && (
          <div className="space-y-1.5 pt-1 border-t border-zinc-800/80">
            <div className="text-[11px] font-medium text-zinc-400 flex items-center space-x-1.5">
              <Clock className="h-3 w-3" />
              <span>Riwayat Server (tap untuk pilih)</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {history.map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => {
                    setUrlInput(u);
                    setTestResult(null);
                    setError(null);
                  }}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-mono transition-colors ${
                    urlInput.trim().replace(/\/+$/, '') === u
                      ? 'bg-indigo-950/60 border-indigo-600/70 text-indigo-300'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Default</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl border border-zinc-800 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white transition-colors"
            >
              Simpan &amp; Terapkan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
