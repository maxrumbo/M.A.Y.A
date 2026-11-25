import React, { useState, useEffect } from 'react';
import {
  Brain,
  Search,
  Plus,
  Trash2,
  Star,
  Loader2,
  AlertCircle,
  X,
} from 'lucide-react';
import { api } from '../api/client';
import type { MemoryEntry } from '../types';

const CATEGORIES = ['All', 'Identity', 'Preference', 'Routine', 'Project', 'Personal'] as const;

interface MemoryViewProps {
  embedded?: boolean;
}

export const MemoryView: React.FC<MemoryViewProps> = ({ embedded = false }) => {
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const [showAddModal, setShowAddModal] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newCategory, setNewCategory] = useState<'Identity' | 'Preference' | 'Routine' | 'Project' | 'Personal'>('Personal');
  const [newImportance, setNewImportance] = useState(5);
  const [saving, setSaving] = useState(false);

  const fetchMemories = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listMemories();
      setMemories(data);
    } catch (err: any) {
      setError(err.message || 'Gagal mengambil data memori.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchMemories();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey || !newValue) return;

    setSaving(true);
    try {
      await api.upsertMemory({
        key: newKey,
        value: newValue,
        category: newCategory,
        importance: newImportance,
      });
      setShowAddModal(false);
      setNewKey('');
      setNewValue('');
      setNewImportance(5);
      void fetchMemories();
    } catch (err: any) {
      alert(`Gagal menyimpan: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, key: string) => {
    if (!confirm(`Hapus memori '${key}'?`)) return;
    try {
      await api.deleteMemory(id);
      setMemories((prev) => prev.filter((m) => m.id !== id));
    } catch (err: any) {
      alert(`Gagal menghapus: ${err.message}`);
    }
  };

  const filteredMemories = memories.filter((m) => {
    const matchesCategory =
      selectedCategory === 'All' || m.category.toLowerCase() === selectedCategory.toLowerCase();
    const matchesSearch =
      m.key.toLowerCase().includes(search.toLowerCase()) ||
      m.value.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8F9FA] dark:bg-[#0F1014] overflow-hidden transition-colors">
      {!embedded && (
        <header className="h-14 border-b border-zinc-200/80 dark:border-zinc-800/80 px-6 flex items-center justify-between shrink-0 bg-white/80 dark:bg-[#14151A]/90 backdrop-blur-md">
          <div className="flex items-center space-x-3">
            <Brain className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">Memory Engine</h2>
            <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2 py-0.5 rounded-full">
              {memories.length} Fakta Tersimpan
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-medium transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Tambah Memori</span>
          </button>
        </header>
      )}

      <div className="px-4 sm:px-6 py-3.5 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white/50 dark:bg-[#14151A]/50 shrink-0">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="flex items-center space-x-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950'
                    : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari memori..."
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 pl-9 pr-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            {embedded && (
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="shrink-0 flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-medium transition-colors cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Tambah</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {loading ? (
          <div className="h-full flex items-center justify-center space-x-2 text-xs text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
            <span>Memuat memori M.A.Y.A...</span>
          </div>
        ) : error ? (
          <div className="max-w-4xl mx-auto rounded-2xl border border-rose-200 dark:border-red-900/60 bg-rose-50 dark:bg-red-950/40 p-4 text-xs text-rose-700 dark:text-red-400 flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : filteredMemories.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500">
            <Brain className="h-10 w-10 text-zinc-400 dark:text-zinc-600 mb-3" />
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-300">
              Tidak Ada Memori Ditemukan
            </p>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm">
              M.A.Y.A. menyimpan fakta personal secara otomatis saat mengobrol, atau kamu bisa menambahkannya manual.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {filteredMemories.map((mem) => (
              <div
                key={mem.id}
                className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#17191F] p-4 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-indigo-700 dark:text-indigo-300">
                      {mem.category}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleDelete(mem.id, mem.key)}
                      className="text-zinc-400 dark:text-zinc-500 hover:text-rose-500 dark:hover:text-red-400 p-1 transition-colors cursor-pointer"
                      title="Hapus"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-200 text-xs font-mono mb-1.5 break-all">
                    {mem.key}
                  </h3>

                  <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed bg-zinc-50 dark:bg-zinc-900/70 border border-zinc-200/80 dark:border-zinc-800/80 p-2.5 rounded-xl">
                    {mem.value}
                  </p>
                </div>

                <div className="mt-4 pt-2.5 border-t border-zinc-200/80 dark:border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-500">
                  <div className="flex items-center space-x-1 text-amber-600 dark:text-amber-400/90 font-mono">
                    <Star className="h-3.5 w-3.5 fill-amber-400/20" />
                    <span>Penting: {mem.importance}/10</span>
                  </div>
                  <span className="font-mono text-[10px]">
                    {new Date(mem.updatedAt).toLocaleDateString('id-ID')}
                  </span>
                </div>
              </div>
            ))}
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
              <Brain className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <span>Tambah Memori Baru</span>
            </h3>

            <form onSubmit={handleCreate} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">
                  Key (snake_case)
                </label>
                <input
                  type="text"
                  required
                  placeholder="misal: coding_ide, favorite_drink"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3 py-2 text-zinc-900 dark:text-zinc-100 outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">
                  Fakta / Nilai
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Isi fakta yang ingin M.A.Y.A. ingat"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3 py-2 text-zinc-900 dark:text-zinc-100 outline-none focus:border-indigo-500 resize-none leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">
                    Kategori
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e: any) => setNewCategory(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3 py-2 text-zinc-900 dark:text-zinc-100 outline-none focus:border-indigo-500"
                  >
                    <option value="Identity">Identity</option>
                    <option value="Preference">Preference</option>
                    <option value="Routine">Routine</option>
                    <option value="Project">Project</option>
                    <option value="Personal">Personal</option>
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">
                    Kepentingan (1-10): {newImportance}
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={newImportance}
                    onChange={(e) => setNewImportance(Number(e.target.value))}
                    className="w-full accent-indigo-500 mt-2"
                  />
                </div>
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
                  disabled={saving}
                  className="w-1/2 flex items-center justify-center space-x-1.5 rounded-xl bg-zinc-900 dark:bg-zinc-100 py-2.5 font-medium text-white dark:text-zinc-950 disabled:opacity-40 cursor-pointer"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <span>Simpan Memori</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
