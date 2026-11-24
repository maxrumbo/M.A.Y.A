import React, { useState, useEffect } from 'react';
import { Shield, KeyRound, Fingerprint, Loader2, AlertCircle, Settings, Server } from 'lucide-react';
import { api } from '../api/client';
import { getApiBaseUrl } from '../services/serverConfig';
import {
  isNativeMobile,
  checkBiometricAvailability,
  authenticateBiometric,
  saveBiometricPin,
  clearBiometricPin,
} from '../services/mobileNative';
import { ServerSettingsModal } from './ServerSettingsModal';

interface LockScreenProps {
  onUnlocked: () => void;
}

const LOGIN_TIMEOUT_MS = 8000;

export const LockScreen: React.FC<LockScreenProps> = ({ onUnlocked }) => {
  const [pin, setPin] = useState('');
  const [setupFirstPin, setSetupFirstPin] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [serverUrl, setServerUrl] = useState<string>(getApiBaseUrl());

  // Phase 7B: Native Android Biometric state
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [hasSavedBiometricPin, setHasSavedBiometricPin] = useState(false);
  const [enableBiometricOnLogin, setEnableBiometricOnLogin] = useState(true);

  useEffect(() => {
    if (!isNativeMobile()) return;
    void checkBiometricAvailability().then((res) => {
      setBiometricAvailable(res.available);
      setHasSavedBiometricPin(res.hasSavedPin);
    });
  }, []);

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

  const performPinLogin = async (pinToSubmit: string, fromBiometric = false) => {
    setLoading(true);
    setError(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LOGIN_TIMEOUT_MS);

    try {
      if (setupFirstPin !== null) {
        if (pinToSubmit !== setupFirstPin) {
          setSetupFirstPin(null);
          setError('Konfirmasi PIN tidak cocok. Silakan ketik Master PIN baru dari awal.');
          setPin('');
          return;
        }
        await api.setupPin(pinToSubmit, pinToSubmit);
        setSetupFirstPin(null);
      }

      await api.loginWithPin(pinToSubmit, controller.signal);

      // Simpan PIN terenkripsi di Android Keystore bila pengguna mengaktifkan biometrik
      if (isNativeMobile() && biometricAvailable && enableBiometricOnLogin && !fromBiometric) {
        await saveBiometricPin(pinToSubmit).catch(() => {});
        setHasSavedBiometricPin(true);
      }

      onUnlocked();
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (err?.name === 'AbortError') {
        setError(
          'Timeout (8 detik): Maya.Server tidak merespons. Cek alamat Server (ikon gear) atau koneksi jaringan.'
        );
      } else if (err?.status === 401 && msg.toLowerCase().includes('belum dikonfigurasi')) {
        setSetupFirstPin(pinToSubmit);
        setError(null);
      } else if (err?.status === 401) {
        setError(msg || 'PIN salah. Akses ditolak.');
        if (fromBiometric) {
          await clearBiometricPin().catch(() => {});
          setHasSavedBiometricPin(false);
        }
      } else {
        setError(msg || 'Gagal menghubungi server.');
      }
      // Auto-clear PIN agar pengguna tidak stuck dan bisa langsung input ulang
      setPin('');
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (pin.length < 4) {
      setError('PIN minimal 4 digit.');
      return;
    }
    await performPinLogin(pin, false);
  };

  const handleBiometricUnlock = async () => {
    if (!isNativeMobile()) {
      setError('Windows Hello: Gunakan Master PIN untuk browser saat ini.');
      return;
    }

    if (!biometricAvailable) {
      setError('Sidik Jari / Biometrik belum aktif di pengaturan keamanan Android Anda.');
      return;
    }

    if (!hasSavedBiometricPin) {
      setError('Login sekali dengan Master PIN terlebih dahulu untuk mengaktifkan Sidik Jari.');
      return;
    }

    setError(null);
    try {
      const auth = await authenticateBiometric(
        'Buka M.A.Y.A.',
        'Verifikasi Sidik Jari atau Face Unlock untuk masuk'
      );
      if (auth.authenticated && auth.pin) {
        await performPinLogin(auth.pin, true);
      } else {
        setError('Data PIN Keystore tidak ditemukan. Silakan masuk dengan Master PIN.');
        setHasSavedBiometricPin(false);
      }
    } catch (err: any) {
      const msg = String(err?.message || '');
      // Abaikan pesan error jika user sengaja menekan tombol "Gunakan PIN" / Cancel
      if (
        !msg.toLowerCase().includes('cancel') &&
        !msg.toLowerCase().includes('gunakan pin') &&
        err?.code !== '13' &&
        err?.code !== '10'
      ) {
        setError(msg || 'Autentikasi biometrik dibatalkan.');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-zinc-950 px-4 py-6 safe-top safe-bottom overflow-y-auto select-none">
      {/* Phase 7: Pengaturan Server Endpoint URL */}
      <button
        type="button"
        onClick={() => setShowServerSettings(true)}
        title="Pengaturan Server Endpoint URL"
        className="fixed top-4 right-4 safe-top-offset flex items-center space-x-1.5 px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900/90 text-xs text-zinc-400 hover:text-zinc-100 hover:border-zinc-700 transition-colors"
      >
        <Settings className="h-4 w-4 text-indigo-400" />
        <span className="hidden sm:inline">Server</span>
      </button>

      <div className="w-full max-w-sm flex flex-col items-center my-auto">
        {/* Logo & Branding */}
        <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-zinc-900 border border-zinc-800 text-indigo-400 shadow-xl shadow-black/40 mb-3">
          <Shield className="h-7 w-7 sm:h-8 sm:w-8 text-indigo-400" />
        </div>

        <h1 className="text-xl font-semibold tracking-wider text-zinc-100">M.A.Y.A.</h1>
        <p className="text-xs font-mono text-zinc-500 mt-1 mb-6 tracking-widest uppercase">
          Maxwell Admires, Yet Awaits
        </p>

        {/* PIN Indicators */}
        <div className="flex justify-center space-x-3 mb-5">
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

        {/* Setup Master PIN Prompt (muncul otomatis saat DB baru belum memiliki PIN) */}
        {setupFirstPin !== null && !error && (
          <div className="mb-4 w-64 rounded-lg bg-indigo-950/50 border border-indigo-800/70 px-3 py-2 text-xs text-indigo-200 text-center">
            PIN belum terdaftar di database. Ketik ulang PIN yang sama sekali lagi untuk mengunci Master PIN baru.
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-4 w-64 flex items-start space-x-2 rounded-lg bg-red-950/40 border border-red-900/60 px-3 py-2 text-xs text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-2.5 w-64 mb-5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              disabled={loading}
              onClick={() => handleKeyPress(digit)}
              className="flex h-13 sm:h-14 w-full items-center justify-center rounded-xl bg-zinc-900/80 border border-zinc-800/80 text-xl font-medium text-zinc-200 transition-all hover:bg-zinc-800 hover:text-white active:scale-95 disabled:opacity-50"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            disabled={loading || pin.length === 0}
            onClick={handleClear}
            className="flex h-13 sm:h-14 w-full items-center justify-center rounded-xl bg-zinc-900/30 text-xs font-medium text-zinc-500 transition-all hover:text-zinc-300 disabled:opacity-20"
          >
            CLEAR
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => handleKeyPress('0')}
            className="flex h-13 sm:h-14 w-full items-center justify-center rounded-xl bg-zinc-900/80 border border-zinc-800/80 text-xl font-medium text-zinc-200 transition-all hover:bg-zinc-800 hover:text-white active:scale-95 disabled:opacity-50"
          >
            0
          </button>
          <button
            type="button"
            disabled={loading || pin.length === 0}
            onClick={handleDelete}
            className="flex h-13 sm:h-14 w-full items-center justify-center rounded-xl bg-zinc-900/30 text-xs font-medium text-zinc-400 transition-all hover:text-zinc-200 disabled:opacity-20"
          >
            DEL
          </button>
        </div>

        {/* Android Biometric Opt-in Checkbox (saat pertama kali sebelum PIN disimpan) */}
        {isNativeMobile() && biometricAvailable && !hasSavedBiometricPin && (
          <label className="mb-3 w-64 flex items-center space-x-2 text-[11px] text-zinc-400 cursor-pointer">
            <input
              type="checkbox"
              checked={enableBiometricOnLogin}
              onChange={(e) => setEnableBiometricOnLogin(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-800 text-indigo-600 focus:ring-0"
            />
            <span>Aktifkan Sidik Jari setelah login ini</span>
          </label>
        )}

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
            disabled={loading}
            onClick={handleBiometricUnlock}
            className={`flex h-10 w-full items-center justify-center space-x-2 rounded-xl border text-xs transition-all disabled:opacity-40 ${
              isNativeMobile() && biometricAvailable && hasSavedBiometricPin
                ? 'border-indigo-700/70 bg-indigo-950/40 text-indigo-200 hover:bg-indigo-950/70'
                : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
            }`}
          >
            <Fingerprint className="h-4 w-4 text-indigo-400" />
            <span>
              {isNativeMobile()
                ? hasSavedBiometricPin
                  ? 'Buka dengan Sidik Jari / Biometrik'
                  : 'Sidik Jari / Face Unlock'
                : 'Windows Hello / Passkey'}
            </span>
          </button>
        </div>

        {/* Active Server URL Indicator */}
        <button
          type="button"
          onClick={() => setShowServerSettings(true)}
          className="mt-5 flex items-center space-x-1.5 text-[11px] font-mono text-zinc-500 hover:text-zinc-300 transition-colors"
          title="Ketuk untuk mengubah alamat server"
        >
          <Server className="h-3 w-3 text-zinc-600" />
          <span className="truncate max-w-[260px]">{serverUrl}</span>
        </button>
      </div>

      {showServerSettings && (
        <ServerSettingsModal
          onClose={() => setShowServerSettings(false)}
          onSaved={(newUrl) => {
            setServerUrl(newUrl);
            setError(null);
          }}
        />
      )}
    </div>
  );
};
