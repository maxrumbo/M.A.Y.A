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

export const MemoryView: React.FC = () => {
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Add Memory Modal State
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
    fetchMemories();
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
      fetchMemories();
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
    <div className="flex-1 flex flex-col h-full bg-zinc-950 overflow-hidden">
      {/* Header */}
      <header className="h-14 border-b border-zinc-800/80 px-6 flex items-center justify-between shrink-0 bg-zinc-950/80 backdrop-blur-md">
        <div className="flex items-center space-x-3">
          <Brain className="h-5 w-5 text-indigo-400" />
          <h2 className="font-semibold text-sm text-zinc-100">Memory Engine</h2>
          <span className="text-[11px] font-mono text-zinc-500 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-full">
            {memories.length} Fakta Tersimpan
          </span>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          <span>Tambah Memori</span>
        </button>
      </header>

      {/* Filter & Search Bar */}
      <div className="p-4 border-b border-zinc-800/80 bg-zinc-950/50 flex flex-col md:flex-row gap-3 items-center justify-between shrink-0">
        <div className="flex items-center space-x-1.5 overflow-x-auto w-full md:w-auto">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-zinc-800 text-indigo-300 border border-zinc-700'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/60'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari memori..."
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900/90 pl-9 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
      </div>

      {/* Main Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="h-full flex items-center justify-center space-x-2 text-xs text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
            <span>Memuat memori M.A.Y.A...</span>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-900/60 bg-red-950/40 p-4 text-xs text-red-400 flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : filteredMemories.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500">
            <Brain className="h-10 w-10 text-zinc-600 mb-3" />
            <p className="text-sm font-medium text-zinc-300">Tidak Ada Memori Ditemukan</p>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm">
              M.A.Y.A. menyimpan fakta personal secara otomatis saat mengobrol, atau kamu bisa menambahkannya manual.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
            {filteredMemories.map((mem) => (
              <div
                key={mem.id}
                className="rounded-2xl border border-zinc-800/80 bg-zinc-900/70 p-4 shadow-sm hover:border-zinc-700/80 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-950 border border-zinc-800 text-indigo-300">
                      {mem.category}
                    </span>
                    <button
                      onClick={() => handleDelete(mem.id, mem.key)}
                      className="text-zinc-600 hover:text-red-400 p-1 transition-colors"
                      title="Hapus"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <h3 className="font-semibold text-zinc-200 text-xs font-mono mb-1.5 break-all">
                    {mem.key}
                  </h3>

                  <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-950/60 border border-zinc-800/80 p-2.5 rounded-xl">
                    {mem.value}
                  </p>
                </div>

                <div className="mt-4 pt-2.5 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-500">
                  <div className="flex items-center space-x-1 text-amber-400/90 font-mono">
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

      {/* Add Memory Modal */}
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
              <Brain className="h-4 w-4 text-indigo-400" />
              <span>Tambah Memori Baru</span>
            </h3>

            <form onSubmit={handleCreate} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-zinc-400 font-medium mb-1">Key (snake_case)</label>
                <input
                  type="text"
                  required
                  placeholder="misal: coding_ide, favorite_drink"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1">Fakta / Nilai</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Isi fakta yang ingin M.A.Y.A. ingat selamanya"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-indigo-500 resize-none leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Kategori</label>
                  <select
                    value={newCategory}
                    onChange={(e: any) => setNewCategory(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-indigo-500"
                  >
                    <option value="Identity">Identity</option>
                    <option value="Preference">Preference</option>
                    <option value="Routine">Routine</option>
                    <option value="Project">Project</option>
                    <option value="Personal">Personal</option>
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-400 font-medium mb-1">
                    Kepentingan (1–10): {newImportance}
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
                  className="w-1/2 rounded-xl border border-zinc-800 bg-zinc-950 py-2.5 font-medium text-zinc-400 hover:bg-zinc-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-1/2 flex items-center justify-center space-x-1.5 rounded-xl bg-indigo-600 py-2.5 font-medium text-white hover:bg-indigo-500 disabled:opacity-40"
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
