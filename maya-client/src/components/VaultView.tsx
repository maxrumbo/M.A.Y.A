import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Copy,
  Check,
  Loader2,
  Lock,
  Clock,
  AlertCircle,
  X,
} from 'lucide-react';
import { api } from '../api/client';
import type { VaultSummary, VaultRevealResponse } from '../types';
import { StepUpModal } from './StepUpModal';

export const VaultView: React.FC = () => {
  const [vaults, setVaults] = useState<VaultSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add Secret Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newServiceName, setNewServiceName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPlainSecret, setNewPlainSecret] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [savingSecret, setSavingSecret] = useState(false);

  // Reveal State
  const [stepUpVaultId, setStepUpVaultId] = useState<string | null>(null);
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, VaultRevealResponse>>({});
  const [countdownTimers, setCountdownTimers] = useState<Record<string, number>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchVaults = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listVault();
      setVaults(data);
    } catch (err: any) {
      setError(err.message || 'Gagal mengambil data vault.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVaults();
  }, []);

  // Countdown timer effect for auto-hide (U2)
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdownTimers((prev) => {
        const next: Record<string, number> = {};
        let changed = false;

        Object.entries(prev).forEach(([id, seconds]) => {
          if (seconds > 1) {
            next[id] = seconds - 1;
            changed = true;
          } else {
            // Expired -> remove revealed secret
            setRevealedSecrets((r) => {
              const updated = { ...r };
              delete updated[id];
              return updated;
            });
            changed = true;
          }
        });

        return changed ? next : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleRevealClick = (vaultId: string) => {
    if (revealedSecrets[vaultId]) {
      // Hide immediately if already revealed
      setRevealedSecrets((prev) => {
        const next = { ...prev };
        delete next[vaultId];
        return next;
      });
      setCountdownTimers((prev) => {
        const next = { ...prev };
        delete next[vaultId];
        return next;
      });
    } else {
      // Trigger Step-Up Verification
      setStepUpVaultId(vaultId);
    }
  };

  const handleStepUpSuccess = async (stepUpToken: string) => {
    if (!stepUpVaultId) return;
    const vId = stepUpVaultId;
    setStepUpVaultId(null);

    try {
      const res = await api.revealVaultEntry(vId, stepUpToken);
      setRevealedSecrets((prev) => ({ ...prev, [vId]: res }));
      setCountdownTimers((prev) => ({ ...prev, [vId]: 15 })); // Auto-hide 15s (U2)
    } catch (err: any) {
      alert(`Gagal mengungkap password: ${err.message}`);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServiceName || !newUsername || !newPlainSecret) return;

    setSavingSecret(true);
    try {
      await api.createVaultEntry({
        serviceName: newServiceName,
        username: newUsername,
        plainSecret: newPlainSecret,
        notes: newNotes || undefined,
      });
      setShowAddModal(false);
      setNewServiceName('');
      setNewUsername('');
      setNewPlainSecret('');
      setNewNotes('');
      fetchVaults();
    } catch (err: any) {
      alert(`Gagal menyimpan: ${err.message}`);
    } finally {
      setSavingSecret(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Hapus kredensial '${name}' dari Vault? Tindakan ini permanen.`)) return;
    try {
      await api.deleteVaultEntry(id);
      setVaults((prev) => prev.filter((v) => v.id !== id));
    } catch (err: any) {
      alert(`Gagal menghapus: ${err.message}`);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950 overflow-hidden">
      {/* Header */}
      <header className="h-14 border-b border-zinc-800/80 px-6 flex items-center justify-between shrink-0 bg-zinc-950/80 backdrop-blur-md">
        <div className="flex items-center space-x-3">
          <KeyRound className="h-5 w-5 text-indigo-400" />
          <h2 className="font-semibold text-sm text-zinc-100">Password Vault</h2>
          <span className="text-[11px] font-mono text-zinc-500 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-full">
            AES-256-GCM Encrypted
          </span>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          <span>Tambah Secret</span>
        </button>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="h-full flex items-center justify-center space-x-2 text-xs text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
            <span>Memuat password vault...</span>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-900/60 bg-red-950/40 p-4 text-xs text-red-400 flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : vaults.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500">
            <Lock className="h-10 w-10 text-zinc-600 mb-3" />
            <p className="text-sm font-medium text-zinc-300">Vault Masih Kosong</p>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm">
              Simpan password layanan kerja atau akun penting di sini. Semua data terenkripsi AES-256-GCM dan tidak pernah dikirim ke AI.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
            {vaults.map((vault) => {
              const revealed = revealedSecrets[vault.id];
              const secondsLeft = countdownTimers[vault.id] || 0;

              return (
                <div
                  key={vault.id}
                  className="rounded-2xl border border-zinc-800/80 bg-zinc-900/70 p-4 shadow-sm hover:border-zinc-700/80 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-zinc-100 text-sm">{vault.serviceName}</h3>
                      <button
                        onClick={() => handleDelete(vault.id, vault.serviceName)}
                        className="text-zinc-600 hover:text-red-400 p-1 transition-colors"
                        title="Hapus"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <p className="text-xs font-mono text-zinc-400 truncate mb-1">
                      {vault.username}
                    </p>

                    {vault.notes && (
                      <p className="text-[11px] text-zinc-500 italic line-clamp-2 mb-3">
                        {vault.notes}
                      </p>
                    )}
                  </div>

                  {/* Secret Display & Countdown (U2) */}
                  <div className="mt-4 pt-3 border-t border-zinc-800/80">
                    <div className="flex items-center justify-between bg-zinc-950/80 border border-zinc-800 rounded-xl px-3 py-2 font-mono text-xs">
                      <span className="truncate mr-2 text-zinc-200">
                        {revealed ? revealed.plainSecret : '••••••••••••'}
                      </span>

                      <div className="flex items-center space-x-1 shrink-0">
                        {revealed && (
                          <button
                            onClick={() => handleCopy(vault.id, revealed.plainSecret)}
                            className="p-1 text-zinc-400 hover:text-zinc-200"
                            title="Salin password"
                          >
                            {copiedId === vault.id ? (
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}

                        <button
                          onClick={() => handleRevealClick(vault.id)}
                          className="p-1 text-zinc-400 hover:text-zinc-200 transition-colors"
                          title={revealed ? 'Sembunyikan' : 'Buka rahasia (Step-Up)'}
                        >
                          {revealed ? (
                            <EyeOff className="h-4 w-4 text-amber-400" />
                          ) : (
                            <Eye className="h-4 w-4 text-zinc-500 hover:text-zinc-300" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Auto-Hide Countdown Progress Bar (U2) */}
                    {revealed && secondsLeft > 0 && (
                      <div className="mt-2 space-y-1">
                        <div className="flex justify-between items-center text-[10px] font-mono text-amber-400/90">
                          <span className="flex items-center space-x-1">
                            <Clock className="h-3 w-3" />
                            <span>Auto-Hide dalam {secondsLeft} detik</span>
                          </span>
                        </div>
                        <div className="w-full bg-zinc-800 rounded-full h-1 overflow-hidden">
                          <div
                            className="bg-amber-400 h-1 rounded-full transition-all duration-1000"
                            style={{ width: `${(secondsLeft / 15) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Secret Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="font-semibold text-zinc-100 text-sm mb-4 flex items-center space-x-2">
              <KeyRound className="h-4 w-4 text-indigo-400" />
              <span>Simpan Kredensial Baru</span>
            </h3>

            <form onSubmit={handleCreate} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-zinc-400 font-medium mb-1">Nama Layanan</label>
                <input
                  type="text"
                  required
                  placeholder="Misal: GitHub, Supabase, Google"
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1">Username / Email</label>
                <input
                  type="text"
                  required
                  placeholder="maxwell@example.com"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1">Password / Plain Secret</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={newPlainSecret}
                  onChange={(e) => setNewPlainSecret(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1">Catatan Tambahan (Opsional)</label>
                <textarea
                  rows={2}
                  placeholder="Deskripsi singkat mengenai akun ini"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="w-1/2 rounded-xl border border-zinc-800 bg-zinc-950 py-2.5 font-medium text-zinc-400 hover:bg-zinc-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingSecret}
                  className="w-1/2 flex items-center justify-center space-x-1.5 rounded-xl bg-indigo-600 py-2.5 font-medium text-white hover:bg-indigo-500 disabled:opacity-40"
                >
                  {savingSecret ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <span>Enkripsi & Simpan</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Step-Up Verification Modal */}
      {stepUpVaultId && (
        <StepUpModal
          title="Verifikasi Password Vault"
          description="Masukkan Master PIN untuk mendekripsi password plaintext selama 15 detik."
          targetId={stepUpVaultId}
          onSuccess={handleStepUpSuccess}
          onClose={() => setStepUpVaultId(null)}
        />
      )}
    </div>
  );
};
