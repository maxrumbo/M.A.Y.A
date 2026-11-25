import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Square,
  Copy,
  Check,
  BellOff,
  Bell,
  Mail,
  ShieldAlert,
  Loader2,
  XCircle,
  CheckCircle2,
  Clock,
  PlusCircle,
  Mic,
  Volume2,
  History,
  Trash2,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useMayaSession } from '../context/MayaSessionContext';
import type { DeviceStatus } from '../types';
import { VoiceWaveIndicator } from './voice/VoiceWaveIndicator';
import { MayaLogo } from './ui/MayaLogo';

interface ChatWorkspaceProps {
  deviceStatus: DeviceStatus | null;
  autoFocusInput?: boolean;
  onInputFocused?: () => void;
}

export const ChatWorkspace: React.FC<ChatWorkspaceProps> = ({
  autoFocusInput = false,
  onInputFocused,
}) => {
  const {
    messages,
    conversationId,
    conversations,
    loading,
    muteStatus,
    voice,
    actionError,
    sendMessage,
    stopGeneration,
    startNewChat,
    loadConversation,
    deleteConversation,
    muteNotifications,
    unmuteNotifications,
    openStepUpForAction,
    cancelAction,
    clearActionError,
  } = useMayaSession();

  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showMuteMenu, setShowMuteMenu] = useState(false);
  const [showHistoryMenu, setShowHistoryMenu] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocusInput) {
      setTimeout(() => {
        textareaRef.current?.focus();
        onInputFocused?.();
      }, 80);
    }
  }, [autoFocusInput, onInputFocused]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSendClick = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    await sendMessage(text);
  };

  const handleCopy = (id: string, text: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8F9FA] dark:bg-[#0F1014] overflow-hidden transition-colors">
      {/* Minimal 3-Control Header */}
      <header className="h-12 sm:h-14 border-b border-zinc-200/80 dark:border-zinc-800/80 px-3 sm:px-5 flex items-center justify-between gap-2 shrink-0 bg-white/80 dark:bg-[#14151A]/90 backdrop-blur-md z-10">
        <div className="flex items-center space-x-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowHistoryMenu((prev) => !prev);
                setShowMuteMenu(false);
              }}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700 text-xs font-medium transition-colors cursor-pointer"
            >
              <History className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Riwayat</span>
            </button>

            {showHistoryMenu && (
              <div className="absolute left-0 mt-2 w-72 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#17191F] p-2 shadow-xl z-30 text-xs">
                <div className="px-2.5 py-1.5 font-semibold text-zinc-500 dark:text-zinc-400 text-[11px] border-b border-zinc-200/80 dark:border-zinc-800/80 mb-1 flex items-center justify-between">
                  <span>Riwayat Obrolan</span>
                  <span>{conversations.length} sesi</span>
                </div>
                <div className="max-h-64 overflow-y-auto space-y-1">
                  {conversations.length === 0 ? (
                    <p className="px-2.5 py-4 text-center text-zinc-400 dark:text-zinc-500 text-[11px]">
                      Belum ada sesi tersimpan.
                    </p>
                  ) : (
                    conversations.map((c) => (
                      <div
                        key={c.id}
                        className={`flex items-center justify-between rounded-xl px-2 py-1.5 transition-colors ${
                          conversationId === c.id
                            ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium'
                            : 'hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setShowHistoryMenu(false);
                            void loadConversation(c.id);
                          }}
                          className="flex-1 text-left truncate pr-2 text-xs cursor-pointer"
                        >
                          {c.title}
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteConversation(c.id)}
                          title="Hapus percakapan"
                          className="p-1 text-zinc-400 hover:text-rose-500 dark:text-zinc-500 dark:hover:text-rose-400 shrink-0 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={startNewChat}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            <span>Sesi Baru</span>
          </button>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowMuteMenu((prev) => !prev);
              setShowHistoryMenu(false);
            }}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs transition-colors cursor-pointer ${
              muteStatus?.isMuted
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800/60 text-amber-700 dark:text-amber-300'
                : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            {muteStatus?.isMuted ? (
              <>
                <BellOff className="h-3.5 w-3.5" />
                <span>Muted ({muteStatus.remainingMinutes}m)</span>
              </>
            ) : (
              <>
                <Bell className="h-3.5 w-3.5" />
                <span>Proaktif</span>
              </>
            )}
          </button>

          {showMuteMenu && (
            <div className="absolute right-0 mt-2 w-48 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#17191F] p-1.5 shadow-xl z-30 text-xs">
              <div className="px-2.5 py-1.5 font-medium text-zinc-500 dark:text-zinc-400 text-[11px] border-b border-zinc-200/80 dark:border-zinc-800/80 mb-1">
                Jeda Notifikasi Proaktif
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowMuteMenu(false);
                  void muteNotifications(30);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 transition-colors cursor-pointer"
              >
                Mute 30 Menit
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMuteMenu(false);
                  void muteNotifications(120);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 transition-colors cursor-pointer"
              >
                Mute 2 Jam
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMuteMenu(false);
                  void muteNotifications(1440);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 transition-colors cursor-pointer"
              >
                Mute 24 Jam
              </button>
              {muteStatus?.isMuted && (
                <button
                  type="button"
                  onClick={() => {
                    setShowMuteMenu(false);
                    void unmuteNotifications();
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors mt-1 border-t border-zinc-200/80 dark:border-zinc-800/80 cursor-pointer"
                >
                  Aktifkan Lagi
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Inline Error Banner */}
      {actionError && (
        <div className="mx-4 mt-2 px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between">
          <span>{actionError}</span>
          <button
            type="button"
            onClick={clearActionError}
            className="ml-3 text-[11px] font-medium underline cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-3.5 sm:px-6 py-4 sm:py-6 space-y-5">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 max-w-sm mx-auto">
            <MayaLogo size={48} framed />
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mt-4">
              Belum ada pesan di sesi ini
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
              Ketik pesan di bawah atau tekan tombol mikrofon untuk mulai mengobrol.
            </p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-5">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`flex items-end gap-2.5 max-w-[92%] sm:max-w-[85%] ${
                    msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                  }`}
                >
                  {msg.role === 'model' && (
                    <div className="shrink-0 mb-1 hidden sm:block">
                      <MayaLogo size={24} framed />
                    </div>
                  )}

                  <div
                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-zinc-900 dark:bg-indigo-600 text-white rounded-br-md'
                        : 'bg-white dark:bg-[#17191F] border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-100 rounded-bl-md'
                    }`}
                  >
                    <div className="maya-markdown break-words">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>

                    {/* Inline Step-Up Confirmation Cards */}
                    {msg.pendingActions && msg.pendingActions.length > 0 && (
                      <div className="mt-3.5 space-y-2.5">
                        {msg.pendingActions.map((action) => (
                          <div
                            key={action.commandId}
                            className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0F1014] p-3 text-xs"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-2">
                                <ShieldAlert className="h-4 w-4 text-amber-500" />
                                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                                  {action.commandName}
                                </span>
                              </div>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-mono flex items-center space-x-1 ${
                                  action.status === 'Executing'
                                    ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400'
                                    : action.status === 'Completed'
                                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400'
                                    : action.status === 'Cancelled'
                                    ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                                    : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-400'
                                }`}
                              >
                                {action.status === 'Executing' && <Loader2 className="h-3 w-3 animate-spin" />}
                                {action.status === 'Completed' && <CheckCircle2 className="h-3 w-3" />}
                                {action.status === 'Cancelled' && <XCircle className="h-3 w-3" />}
                                {(!action.status || action.status === 'Waiting') && (
                                  <Clock className="h-3 w-3" />
                                )}
                                <span>{action.status || 'Waiting'}</span>
                              </span>
                            </div>

                            <p className="text-zinc-700 dark:text-zinc-300 mb-2 leading-relaxed">
                              {action.description}
                            </p>

                            {action.emailPreview && (
                              <div className="mb-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2.5 text-[11px] font-mono space-y-1">
                                <div className="flex items-center text-zinc-500 dark:text-zinc-400">
                                  <Mail className="h-3.5 w-3.5 mr-1.5 text-indigo-500" />
                                  <span>To: {action.emailPreview.to}</span>
                                </div>
                                <div className="text-zinc-800 dark:text-zinc-200 font-medium">
                                  Subjek: {action.emailPreview.subject}
                                </div>
                                <div className="text-zinc-500 dark:text-zinc-400 italic text-[10px] bg-zinc-50 dark:bg-zinc-950 p-1.5 rounded border border-zinc-200 dark:border-zinc-800">
                                  &ldquo;{action.emailPreview.bodyPreview}&rdquo;
                                </div>
                              </div>
                            )}

                            {(!action.status || action.status === 'Waiting') && (
                              <div className="flex items-center space-x-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => openStepUpForAction(action)}
                                  className="px-3 py-1.5 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 font-medium transition-colors cursor-pointer"
                                >
                                  Konfirmasi &amp; Eksekusi
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void cancelAction(action.commandId)}
                                  className="px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors cursor-pointer"
                                >
                                  Batal
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {msg.role === 'model' && (
                  <div className="flex items-center space-x-1 mt-1.5 sm:pl-9">
                    <button
                      type="button"
                      onClick={() => handleCopy(msg.id, msg.content)}
                      className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg text-[11px] text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
                    >
                      {copiedId === msg.id ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-500" />
                          <span className="text-emerald-600 dark:text-emerald-400">Disalin</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>Salin</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => voice.speakResponse(msg.content)}
                      className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg text-[11px] text-zinc-400 dark:text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
                    >
                      <Volume2 className="h-3 w-3" />
                      <span>Dengar</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {loading && (
          <div className="max-w-3xl mx-auto flex items-center space-x-2 text-xs text-zinc-500 dark:text-zinc-400 pl-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />
            <span>M.A.Y.A. sedang memproses...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Input Bar */}
      <footer className="p-2.5 sm:p-4 border-t border-zinc-200/80 dark:border-zinc-800/80 bg-[#F8F9FA] dark:bg-[#0F1014] shrink-0">
        <VoiceWaveIndicator
          state={voice.voiceState}
          transcript={voice.transcript}
          errorMessage={voice.errorMessage}
          onStop={voice.stopSpeaking}
          voiceMode={voice.settings.voiceMode}
        />

        <div className="max-w-3xl mx-auto flex items-end space-x-2 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#17191F] p-1.5 sm:p-2 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500/30 transition-all">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSendClick();
              }
            }}
            placeholder="Ketik pesan..."
            className="flex-1 max-h-32 bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 resize-none outline-none px-2.5 py-1.5 leading-relaxed"
          />

          {loading ? (
            <button
              type="button"
              onClick={stopGeneration}
              title="Hentikan"
              className="h-9 w-9 shrink-0 rounded-xl bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <Square className="h-4 w-4 fill-current" />
            </button>
          ) : input.trim().length > 0 ? (
            <button
              type="button"
              onClick={() => void handleSendClick()}
              title="Kirim Pesan"
              className="h-9 w-9 shrink-0 rounded-xl bg-zinc-900 dark:bg-indigo-600 text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <Send className="h-4 w-4" />
            </button>
          ) : voice.isSttSupported ? (
            <button
              type="button"
              onClick={() => {
                if (voice.isListening) {
                  voice.stopListening();
                } else {
                  voice.startListening();
                }
              }}
              title={voice.isListening ? 'Selesai & Kirim Suara' : 'Ketuk untuk Bicara'}
              className={`h-9 px-3.5 shrink-0 rounded-xl flex items-center space-x-1.5 text-xs font-medium transition-colors cursor-pointer ${
                voice.isListening
                  ? 'bg-indigo-600 text-white animate-pulse'
                  : 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950'
              }`}
            >
              <Mic className="h-4 w-4" />
              <span className="hidden xs:inline sm:inline">
                {voice.isListening ? 'Kirim' : 'Bicara'}
              </span>
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="h-9 w-9 shrink-0 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 flex items-center justify-center"
            >
              <Send className="h-4 w-4" />
            </button>
          )}
        </div>
      </footer>
    </div>
  );
};
