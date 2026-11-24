import React, { useState, useEffect } from 'react';
import { ShieldAlert, X, Loader2, AlertCircle, Fingerprint } from 'lucide-react';
import { api } from '../api/client';
import {
  isNativeMobile,
  checkBiometricAvailability,
  authenticateBiometric,
} from '../services/mobileNative';

interface StepUpModalProps {
  title: string;
  description: string;
  targetId: string;
  onSuccess: (stepUpToken: string) => void;
  onClose: () => void;
}

const STEPUP_TIMEOUT_MS = 8000;

export const StepUpModal: React.FC<StepUpModalProps> = ({
  title,
  description,
  targetId,
  onSuccess,
  onClose,
}) => {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canUseBiometric, setCanUseBiometric] = useState(false);

  useEffect(() => {
    if (!isNativeMobile()) return;
    void checkBiometricAvailability().then((res) => {
      setCanUseBiometric(res.available && res.hasSavedPin);
    });
  }, []);

  const submitStepUp = async (verificationPin: string) => {
    setLoading(true);
    setError(null);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), STEPUP_TIMEOUT_MS);

    try {
      const res = await api.requestStepUp(verificationPin, targetId, controller.signal);
      onSuccess(res.stepUpToken);
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setError('Timeout (8 detik): Maya.Server tidak merespons.');
      } else {
        setError(err?.message || 'Verifikasi PIN gagal atau expired.');
      }
      setPin('');
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin) {
      setError('Masukkan PIN untuk konfirmasi.');
      return;
    }
    await submitStepUp(pin);
  };

  const handleBiometricStepUp = async () => {
    setError(null);
    try {
      const auth = await authenticateBiometric(
        `Konfirmasi: ${title}`,
        'Verifikasi Sidik Jari / Face Unlock untuk melanjutkan aksi sensitif'
      );
      if (auth.authenticated && auth.pin) {
        await submitStepUp(auth.pin);
      } else {
        setError('PIN Keystore tidak tersedia. Masukkan Master PIN manual.');
      }
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (
        !msg.toLowerCase().includes('cancel') &&
        !msg.toLowerCase().includes('gunakan pin') &&
        err?.code !== '13' &&
        err?.code !== '10'
      ) {
        setError(msg || 'Verifikasi biometrik dibatalkan.');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center space-x-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-zinc-100 text-sm">{title}</h3>
            <p className="text-xs text-zinc-400 mt-0.5">Konfirmasi Step-Up Diperlukan</p>
          </div>
        </div>

        <p className="text-xs text-zinc-300 mb-4 bg-zinc-950/60 border border-zinc-800/80 p-3 rounded-lg leading-relaxed">
          {description}
        </p>

        {error && (
          <div className="mb-4 flex items-center space-x-2 rounded-lg bg-red-950/40 border border-red-900/60 p-2.5 text-xs text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Phase 7B: One-tap Biometric Step-Up di Android */}
        {canUseBiometric && (
          <div className="mb-4">
            <button
              type="button"
              disabled={loading}
              onClick={handleBiometricStepUp}
              className="w-full flex items-center justify-center space-x-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-3 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-40"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Fingerprint className="h-4 w-4" />
                  <span>Konfirmasi dengan Sidik Jari / Biometrik</span>
                </>
              )}
            </button>
            <div className="relative flex items-center justify-center my-3">
              <div className="border-t border-zinc-800 w-full" />
              <span className="bg-zinc-900 px-2 text-[10px] font-mono text-zinc-500 uppercase">
                atau PIN
              </span>
              <div className="border-t border-zinc-800 w-full" />
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Master PIN
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={16}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••"
              autoFocus={!canUseBiometric}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-center text-lg tracking-widest text-zinc-100 placeholder-zinc-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
            />
          </div>

          <div className="flex space-x-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="w-1/2 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading || !pin}
              className="w-1/2 flex items-center justify-center space-x-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-medium text-white hover:bg-indigo-500 transition-colors disabled:opacity-40"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <span>Verifikasi</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
