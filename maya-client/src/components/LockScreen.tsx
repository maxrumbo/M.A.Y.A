import React, { useState } from 'react';
import { Shield, KeyRound, Fingerprint, Loader2, AlertCircle } from 'lucide-react';
import { api } from '../api/client';

interface LockScreenProps {
  onUnlocked: () => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({ onUnlocked }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleKeyPress = (num: string) => {
    if (pin.length < 8) {
      const nextPin = pin + num;
      setPin(nextPin);
      setError(null);
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  };

  const handleClear = () => {
    setPin('');
    setError(null);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (pin.length < 4) {
      setError('PIN minimal 4 digit.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.loginWithPin(pin);
      onUnlocked();
    } catch (err: any) {
      setError(err.message || 'PIN salah. Akses ditolak.');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const handleWebAuthn = async () => {
    // Windows Hello / WebAuthn Passkey mock/trigger
    setError('Windows Hello: Gunakan Master PIN untuk browser saat ini.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950 p-4 select-none">
      <div className="w-full max-w-sm flex flex-col items-center">
        {/* Logo & Branding */}
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-900 border border-zinc-800 text-indigo-400 shadow-xl shadow-black/40 mb-4">
          <Shield className="h-8 w-8 text-indigo-400" />
        </div>

        <h1 className="text-xl font-semibold tracking-wider text-zinc-100">M.A.Y.A.</h1>
        <p className="text-xs font-mono text-zinc-500 mt-1 mb-8 tracking-widest uppercase">
          Maxwell Admires, Yet Awaits
        </p>

        {/* PIN Indicators */}
        <div className="flex justify-center space-x-3 mb-6">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className={`h-3 w-3 rounded-full transition-all duration-200 ${
                idx < pin.length
                  ? 'bg-indigo-400 scale-110 shadow-sm shadow-indigo-500/50'
                  : 'bg-zinc-800 border border-zinc-700'
              }`}
            />
          ))}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 flex items-center space-x-2 rounded-lg bg-red-950/40 border border-red-900/60 px-3 py-2 text-xs text-red-400 animate-shake">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-3 w-64 mb-6">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              disabled={loading}
              onClick={() => handleKeyPress(digit)}
              className="flex h-14 w-full items-center justify-center rounded-xl bg-zinc-900/80 border border-zinc-800/80 text-xl font-medium text-zinc-200 transition-all hover:bg-zinc-800 hover:text-white active:scale-95 disabled:opacity-50"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            disabled={loading || pin.length === 0}
            onClick={handleClear}
            className="flex h-14 w-full items-center justify-center rounded-xl bg-zinc-900/30 text-xs font-medium text-zinc-500 transition-all hover:text-zinc-300 disabled:opacity-20"
          >
            CLEAR
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => handleKeyPress('0')}
            className="flex h-14 w-full items-center justify-center rounded-xl bg-zinc-900/80 border border-zinc-800/80 text-xl font-medium text-zinc-200 transition-all hover:bg-zinc-800 hover:text-white active:scale-95 disabled:opacity-50"
          >
            0
          </button>
          <button
            type="button"
            disabled={loading || pin.length === 0}
            onClick={handleDelete}
            className="flex h-14 w-full items-center justify-center rounded-xl bg-zinc-900/30 text-xs font-medium text-zinc-400 transition-all hover:text-zinc-200 disabled:opacity-20"
          >
            DEL
          </button>
        </div>

        {/* Submit & Biometric Buttons */}
        <div className="flex flex-col space-y-2 w-64">
          <button
            type="button"
            disabled={loading || pin.length < 4}
            onClick={() => handleSubmit()}
            className="flex h-11 w-full items-center justify-center space-x-2 rounded-xl bg-indigo-600 font-medium text-sm text-white shadow-lg shadow-indigo-600/20 transition-all hover:bg-indigo-500 active:scale-98 disabled:opacity-40 disabled:pointer-events-none"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <KeyRound className="h-4 w-4" />
                <span>Buka M.A.Y.A.</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleWebAuthn}
            className="flex h-10 w-full items-center justify-center space-x-2 rounded-xl border border-zinc-800 bg-zinc-900/40 text-xs text-zinc-400 transition-all hover:bg-zinc-800 hover:text-zinc-200"
          >
            <Fingerprint className="h-4 w-4 text-indigo-400" />
            <span>Windows Hello / Passkey</span>
          </button>
        </div>
      </div>
    </div>
  );
};
