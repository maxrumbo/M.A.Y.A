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

interface VaultViewProps {
  embedded?: boolean;
}

export const VaultView: React.FC<VaultViewProps> = ({ embedded = false }) => {
  const [vaults, setVaults] = useState<VaultSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newServiceName, setNewServiceName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPlainSecret, setNewPlainSecret] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [savingSecret, setSavingSecret] = useState(false);

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
    void fetchVaults();
  }, []);

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
      setCountdownTimers((prev) => ({ ...prev, [vId]: 15 }));
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
      void fetchVaults();
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
    void navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8F9FA] dark:bg-[#0F1014] overflow-hidden transition-colors">
      {!embedded ? (
        <header className="h-14 border-b border-zinc-200/80 dark:border-zinc-800/80 px-6 flex items-center justify-between shrink-0 bg-white/80 dark:bg-[#14151A]/90 backdrop-blur-md">
          <div className="flex items-center space-x-3">
            <KeyRound className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">Password Vault</h2>
            <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2 py-0.5 rounded-full">
              AES-256-GCM
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-medium transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Tambah Secret</span>
          </button>
        </header>
      ) : (
        <div className="px-4 sm:px-6 pt-4 pb-1 shrink-0">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                {vaults.length} Kredensial
              </span>
              <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2 py-0.5 rounded-full">
                AES-256-GCM
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-medium transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Tambah Secret</span>
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {loading ? (
          <div className="h-full flex items-center justify-center space-x-2 text-xs text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
            <span>Memuat password vault...</span>
          </div>
        ) : error ? (
          <div className="max-w-4xl mx-auto rounded-2xl border border-rose-200 dark:border-red-900/60 bg-rose-50 dark:bg-red-950/40 p-4 text-xs text-rose-700 dark:text-red-400 flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : vaults.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500">
            <Lock className="h-10 w-10 text-zinc-400 dark:text-zinc-600 mb-3" />
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-300">Vault Masih Kosong</p>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm">
              Simpan password layanan kerja atau akun penting di sini. Semua data terenkripsi AES-256-GCM.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {vaults.map((vault) => {
              const revealed = revealedSecrets[vault.id];
              const secondsLeft = countdownTimers[vault.id] || 0;

              return (
                <div
                  key={vault.id}
                  className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#17191F] p-4 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">
                        {vault.serviceName}
                      </h3>
                      <button
                        type="button"
                        onClick={() => void handleDelete(vault.id, vault.serviceName)}
                        className="text-zinc-400 dark:text-zinc-500 hover:text-rose-500 dark:hover:text-red-400 p-1 transition-colors cursor-pointer"
                        title="Hapus"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400 truncate mb-1">
                      {vault.username}
                    </p>

                    {vault.notes && (
                      <p className="text-[11px] text-zinc-500 italic line-clamp-2 mb-3">
                        {vault.notes}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-zinc-200/80 dark:border-zinc-800/80">
                    <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 font-mono text-xs">
                      <span className="truncate mr-2 text-zinc-800 dark:text-zinc-200">
                        {revealed ? revealed.plainSecret : '••••••••••••'}
                      </span>

                      <div className="flex items-center space-x-1 shrink-0">
                        {revealed && (
                          <button
                            type="button"
                            onClick={() => handleCopy(vault.id, revealed.plainSecret)}
                            className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                            title="Salin password"
                          >
                            {copiedId === vault.id ? (
                              <Check className="h-3.5 w-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleRevealClick(vault.id)}
                          className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                          title={revealed ? 'Sembunyikan' : 'Buka rahasia (Step-Up)'}
                        >
                          {revealed ? (
                            <EyeOff className="h-4 w-4 text-amber-500" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {revealed && secondsLeft > 0 && (
                      <div className="mt-2 space-y-1">
                        <div className="flex justify-between items-center text-[10px] font-mono text-amber-600 dark:text-amber-400/90">
                          <span className="flex items-center space-x-1">
                            <Clock className="h-3 w-3" />
                            <span>Auto-Hide dalam {secondsLeft} detik</span>
                          </span>
                        </div>
                        <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-1 overflow-hidden">
                          <div
                            className="bg-amber-500 h-1 rounded-full transition-all duration-1000"
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

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#17191F] p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm mb-4 flex items-center space-x-2">
              <KeyRound className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <span>Simpan Kredensial Baru</span>
            </h3>

            <form onSubmit={handleCreate} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">
                  Nama Layanan
                </label>
                <input
                  type="text"
                  required
                  placeholder="Misal: GitHub, Supabase, Google"
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3 py-2 text-zinc-900 dark:text-zinc-100 outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">
                  Username / Email
                </label>
                <input
                  type="text"
                  required
                  placeholder="maxwell@example.com"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3 py-2 text-zinc-900 dark:text-zinc-100 outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">
                  Password / Plain Secret
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={newPlainSecret}
                  onChange={(e) => setNewPlainSecret(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3 py-2 text-zinc-900 dark:text-zinc-100 outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">
                  Catatan Tambahan (Opsional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Deskripsi singkat mengenai akun ini"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3 py-2 text-zinc-900 dark:text-zinc-100 outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="w-1/2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 py-2.5 font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingSecret}
                  className="w-1/2 flex items-center justify-center space-x-1.5 rounded-xl bg-zinc-900 dark:bg-zinc-100 py-2.5 font-medium text-white dark:text-zinc-950 disabled:opacity-40 cursor-pointer"
                >
                  {savingSecret ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <span>Enkripsi &amp; Simpan</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
