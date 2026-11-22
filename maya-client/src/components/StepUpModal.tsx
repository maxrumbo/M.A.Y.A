import React, { useState } from 'react';
import { ShieldAlert, X, Loader2, AlertCircle } from 'lucide-react';
import { api } from '../api/client';

interface StepUpModalProps {
  title: string;
  description: string;
  targetId: string;
  onSuccess: (stepUpToken: string) => void;
  onClose: () => void;
}

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin) {
      setError('Masukkan PIN untuk konfirmasi.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.requestStepUp(pin, targetId);
      onSuccess(res.stepUpToken);
    } catch (err: any) {
      setError(err.message || 'Verifikasi PIN gagal atau expired.');
      setPin('');
    } finally {
      setLoading(false);
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Master PIN
            </label>
            <input
              type="password"
              maxLength={16}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••"
              autoFocus
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
