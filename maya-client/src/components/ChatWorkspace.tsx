import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Sparkles,
  PlusCircle,
  Mic,
  Volume2,
  VolumeX,
  Sliders,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api } from '../api/client';
import type { ChatMessage, DeviceStatus, PendingAction, MuteStatus } from '../types';
import { StepUpModal } from './StepUpModal';
import { useVoiceAssistant } from '../services/voice/useVoiceAssistant';
import { VoiceWaveIndicator } from './voice/VoiceWaveIndicator';
import { VoiceSettingsModal } from './voice/VoiceSettingsModal';

interface ChatWorkspaceProps {
  deviceStatus: DeviceStatus | null;
}

export const ChatWorkspace: React.FC<ChatWorkspaceProps> = ({ deviceStatus }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [muteStatus, setMuteStatus] = useState<MuteStatus | null>(null);
  const [showMuteMenu, setShowMuteMenu] = useState(false);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);

  // Step-Up Modal State
  const [stepUpTarget, setStepUpTarget] = useState<{
    commandId: string;
    commandName: string;
    description: string;
  } | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const conversationIdRef = useRef<string | null>(conversationId);

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  // Load initial mute status
  useEffect(() => {
    api.getMuteStatus().then(setMuteStatus).catch(() => {});
  }, []);

  const handleNewChat = () => {
    if (loading) return;
    voiceRef.current?.stopSpeaking();
    setConversationId(null);
    setMessages([]);
  };

  // Send Message (Textarea atau Voice Override)
  const handleSend = useCallback(async (overrideText?: string) => {
    const messageToSend = (overrideText ?? input).trim();
    if (!messageToSend || loading) return;

    if (!overrideText) {
      setInput('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      conversationId: conversationIdRef.current || 'default',
      role: 'user',
      content: messageToSend,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const res = await api.sendMessage(messageToSend, conversationIdRef.current || undefined, abortController.signal);

      if (res.conversationId) {
        setConversationId(res.conversationId);
      }

      const botMsg: ChatMessage = {
        id: `m-${Date.now()}`,
        conversationId: res.conversationId || conversationIdRef.current || 'default',
        role: 'model',
        content: res.reply,
        createdAt: new Date().toISOString(),
        pendingActions: res.pendingActions
          ? res.pendingActions.map((pa) => ({
              ...pa,
              status: 'Waiting',
            }))
          : null,
      };

      setMessages((prev) => [...prev, botMsg]);

      // Phase 6A: M.A.Y.A. membacakan balasan teks via TTS
      voiceRef.current?.speakResponse(res.reply);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            conversationId: conversationIdRef.current || 'default',
            role: 'model',
            content: '*Generasi pesan dihentikan.*',
            createdAt: new Date().toISOString(),
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            conversationId: conversationIdRef.current || 'default',
            role: 'model',
            content: `*Error:* ${err.message || 'Gagal menghubungi server.'}`,
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, [input, loading]);

  // Voice Assistant Hook
  const voice = useVoiceAssistant({
    onSendMessage: async (text: string) => {
      await handleSend(text);
    },
    isGenerating: loading,
  });

  const voiceRef = useRef(voice);
  useEffect(() => {
    voiceRef.current = voice;
  }, [voice]);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Handle Mute Action
  const handleMute = async (minutes: number) => {
    try {
      const res = await api.muteNotifications(minutes);
      setMuteStatus(res);
      setShowMuteMenu(false);
    } catch (err: any) {
      alert(`Gagal mute: ${err.message}`);
    }
  };

  const handleUnmute = async () => {
    try {
      await api.unmuteNotifications();
      setMuteStatus({ isMuted: false, mutedUntil: null, remainingMinutes: 0 });
      setShowMuteMenu(false);
    } catch (err: any) {
      alert(`Gagal unmute: ${err.message}`);
    }
  };

  // Stop Generation
  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    voice.stopSpeaking();
  };

  // Copy Message
  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Handle Command Confirmation (Trigger Step-Up)
  const handleConfirmAction = (action: PendingAction) => {
    setStepUpTarget({
      commandId: action.commandId,
      commandName: action.commandName,
      description: action.description,
    });
  };

  const handleStepUpSuccess = async (stepUpToken: string) => {
    if (!stepUpTarget) return;

    const cmdId = stepUpTarget.commandId;
    setStepUpTarget(null);

    // Update status to Executing
    setMessages((prev) =>
      prev.map((msg) => ({
        ...msg,
        pendingActions: msg.pendingActions?.map((pa) =>
          pa.commandId === cmdId ? { ...pa, status: 'Executing' } : pa
        ),
      }))
    );

    try {
      const res = await api.confirmCommand(cmdId, stepUpToken);

      setMessages((prev) =>
        prev.map((msg) => ({
          ...msg,
          pendingActions: msg.pendingActions?.map((pa) =>
            pa.commandId === cmdId
              ? {
                  ...pa,
                  status: res.success ? 'Completed' : 'Cancelled',
                  description: `${pa.description} → ${res.output || 'Selesai dieksekusi.'}`,
                }
              : pa
          ),
        }))
      );
    } catch (err: any) {
      alert(`Gagal mengeksekusi: ${err.message}`);
      setMessages((prev) =>
        prev.map((msg) => ({
          ...msg,
          pendingActions: msg.pendingActions?.map((pa) =>
            pa.commandId === cmdId ? { ...pa, status: 'Cancelled' } : pa
          ),
        }))
      );
    }
  };

  // Handle Command Cancellation
  const handleCancelAction = async (commandId: string) => {
    try {
      await api.cancelCommand(commandId);
      setMessages((prev) =>
        prev.map((msg) => ({
          ...msg,
          pendingActions: msg.pendingActions?.map((pa) =>
            pa.commandId === commandId
              ? { ...pa, status: 'Cancelled', description: `${pa.description} (Dibatalkan oleh Maxwell)` }
              : pa
          ),
        }))
      );
    } catch (err: any) {
      alert(`Gagal membatalkan aksi: ${err.message}`);
    }
  };

  const isOnline = deviceStatus?.isOnline ?? false;

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950 overflow-hidden">
      {/* Top Header */}
      <header className="min-h-12 sm:h-14 border-b border-zinc-800/80 px-3 sm:px-4 py-2 flex items-center justify-between gap-2 shrink-0 bg-zinc-950/80 backdrop-blur-md z-10">
        <div className="flex items-center space-x-2 min-w-0">
          {/* Mini Telemetry Pill */}
          <div className="flex items-center space-x-1.5 sm:space-x-2 px-2 sm:px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] sm:text-xs font-mono truncate">
            <span
              className={`h-2 w-2 rounded-full shrink-0 ${
                isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'
              }`}
            />
            <span className="text-zinc-300 font-medium">
              {isOnline ? 'Online' : 'Offline'}
            </span>
            {isOnline && (
              <>
                <span className="hidden sm:inline text-zinc-600">|</span>
                <span className="hidden sm:inline text-zinc-400">
                  CPU {deviceStatus?.cpuUsagePercent?.toFixed(0) ?? '—'}%
                </span>
                <span className="hidden md:inline text-zinc-600">|</span>
                <span className="hidden md:inline text-zinc-400">
                  RAM {deviceStatus?.ramUsagePercent?.toFixed(0) ?? '—'}%
                </span>
                <span className="text-zinc-600">|</span>
                <span className="text-zinc-400">
                  BAT {deviceStatus?.batteryPercent ?? '—'}%
                </span>
              </>
            )}
          </div>
        </div>

        {/* Header Action Controls */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
          {/* Sesi Baru Button */}
          <button
            onClick={handleNewChat}
            disabled={loading}
            title="Mulai Sesi Percakapan Baru"
            className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-100 hover:border-zinc-700 text-xs transition-colors disabled:opacity-50"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sesi Baru</span>
          </button>

          {/* Proactive Snooze Controls */}
          <div className="relative">
            <button
              onClick={() => setShowMuteMenu((prev) => !prev)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs transition-colors ${
                muteStatus?.isMuted
                  ? 'bg-amber-950/40 border-amber-800/60 text-amber-300'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
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
                  <span>Proaktif: Aktif</span>
                </>
              )}
            </button>

          {showMuteMenu && (
            <div className="absolute right-0 mt-2 w-48 rounded-2xl border border-zinc-800 bg-zinc-900/95 backdrop-blur-xl p-1.5 shadow-2xl z-20 text-xs">
              <div className="px-2.5 py-1.5 font-medium text-zinc-400 text-[11px] border-b border-zinc-800/80 mb-1">
                Snooze Notifikasi Proaktif
              </div>
              <button
                onClick={() => handleMute(30)}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 text-zinc-200 transition-colors"
              >
                Mute 30 Menit
              </button>
              <button
                onClick={() => handleMute(120)}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 text-zinc-200 transition-colors"
              >
                Mute 2 Jam
              </button>
              <button
                onClick={() => handleMute(1440)}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 text-zinc-200 transition-colors"
              >
                Mute Sampai Besok (24 Jam)
              </button>
              {muteStatus?.isMuted && (
                <button
                  onClick={handleUnmute}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-emerald-400 hover:bg-emerald-950/40 transition-colors mt-1 border-t border-zinc-800/80"
                >
                  Bunyikan Sekarang (Unmute)
                </button>
              )}
            </div>
          )}
        </div>

        {/* TTS Toggle Button */}
        <button
          onClick={voice.toggleTts}
          title={voice.settings.ttsEnabled ? 'Mute Suara TTS M.A.Y.A.' : 'Aktifkan Suara TTS M.A.Y.A.'}
          className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-xl border text-xs transition-colors ${
            voice.settings.ttsEnabled
              ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700'
              : 'bg-zinc-950 border-zinc-800/80 text-zinc-500 hover:text-zinc-400'
          }`}
        >
          {voice.settings.ttsEnabled ? (
            <Volume2 className="h-3.5 w-3.5 text-indigo-400" />
          ) : (
            <VolumeX className="h-3.5 w-3.5 text-zinc-500" />
          )}
        </button>

        {/* Voice Settings Button */}
        <button
          onClick={() => setShowVoiceSettings(true)}
          title="Pengaturan Suara M.A.Y.A. (Phase 6A)"
          className="flex items-center space-x-1 px-2 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-100 hover:border-zinc-700 text-xs transition-colors"
        >
          <Sliders className="h-3.5 w-3.5 text-zinc-400" />
        </button>
      </div>
    </header>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500">
            <div className="h-12 w-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-indigo-400 mb-3">
              <Sparkles className="h-6 w-6" />
            </div>
            <h2 className="text-sm font-medium text-zinc-300">M.A.Y.A. Siap Membantu</h2>
            <p className="text-xs max-w-sm mt-1 text-zinc-500">
              Ada yang mau dikerjakan hari ini, Max? Mau cek telemetri laptop, buka workspace ngoding, atau diskusi santai?
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`relative max-w-2xl rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-none shadow-sm'
                    : 'bg-zinc-900 border border-zinc-800/90 text-zinc-200 rounded-bl-none shadow-md'
                }`}
              >
                {/* Content with Markdown */}
                <div className="prose prose-invert prose-xs max-w-none break-words">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                </div>

                {/* Inline Confirmation Card (U1 & H5) */}
                {msg.pendingActions && msg.pendingActions.length > 0 && (
                  <div className="mt-3.5 space-y-2.5">
                    {msg.pendingActions.map((action) => (
                      <div
                        key={action.commandId}
                        className="rounded-xl border border-amber-500/30 bg-zinc-950/70 p-3 text-xs"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <ShieldAlert className="h-4 w-4 text-amber-400" />
                            <span className="font-semibold text-zinc-200 tracking-wide">
                              {action.commandName}
                            </span>
                          </div>
                          {/* Status Badge */}
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-mono flex items-center space-x-1 ${
                              action.status === 'Executing'
                                ? 'bg-blue-950 text-blue-400 border border-blue-900'
                                : action.status === 'Completed'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-900'
                                : action.status === 'Cancelled'
                                ? 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                                : 'bg-amber-950 text-amber-400 border border-amber-900'
                            }`}
                          >
                            {action.status === 'Executing' && <Loader2 className="h-3 w-3 animate-spin" />}
                            {action.status === 'Completed' && <CheckCircle2 className="h-3 w-3" />}
                            {action.status === 'Cancelled' && <XCircle className="h-3 w-3" />}
                            {action.status === 'Waiting' && <Clock className="h-3 w-3" />}
                            <span>{action.status || 'Waiting'}</span>
                          </span>
                        </div>

                        <p className="text-zinc-300 mb-2 leading-relaxed">{action.description}</p>

                        {/* H5 Email Preview */}
                        {action.emailPreview && (
                          <div className="mb-2.5 rounded-lg border border-zinc-800 bg-zinc-900/90 p-2.5 text-[11px] font-mono space-y-1">
                            <div className="flex items-center text-zinc-400">
                              <Mail className="h-3.5 w-3.5 mr-1.5 text-indigo-400" />
                              <span>To: {action.emailPreview.to}</span>
                            </div>
                            <div className="text-zinc-300 font-medium">
                              Subjek: {action.emailPreview.subject}
                            </div>
                            <div className="text-zinc-400 italic text-[10px] bg-zinc-950/80 p-1.5 rounded border border-zinc-800">
                              "{action.emailPreview.bodyPreview}"
                            </div>
                          </div>
                        )}

                        {/* Action Buttons (Only when Waiting) */}
                        {(!action.status || action.status === 'Waiting') && (
                          <div className="flex items-center space-x-2 pt-1">
                            <button
                              onClick={() => handleConfirmAction(action)}
                              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-medium text-white transition-colors"
                            >
                              Konfirmasi & Eksekusi
                            </button>
                            <button
                              onClick={() => handleCancelAction(action.commandId)}
                              className="px-3 py-1.5 rounded-lg border border-zinc-700 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                            >
                              Batal
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Copy Button (Model Only) */}
                {msg.role === 'model' && (
                  <button
                    onClick={() => handleCopy(msg.id, msg.content)}
                    className="absolute -right-7 top-2 text-zinc-600 hover:text-zinc-300 p-1 transition-colors"
                    title="Salin pesan"
                  >
                    {copiedId === msg.id ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                )}
              </div>
            </div>
          ))
        )}

        {loading && (
          <div className="flex items-center space-x-2 text-xs text-zinc-500 pl-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />
            <span>M.A.Y.A. sedang memproses...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <footer className="p-2.5 sm:p-4 border-t border-zinc-800/80 bg-zinc-950 shrink-0">
        {/* Phase 6A: Voice Waveform / Status Indicator */}
        <VoiceWaveIndicator
          state={voice.voiceState}
          transcript={voice.transcript}
          errorMessage={voice.errorMessage}
          onStop={voice.stopSpeaking}
          voiceMode={voice.settings.voiceMode}
        />

        <div className="max-w-3xl mx-auto flex items-end space-x-2 rounded-2xl border border-zinc-800 bg-zinc-900/90 p-2 focus-within:border-indigo-500/80 focus-within:ring-1 focus-within:ring-indigo-500/50 transition-all">
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
                handleSend();
              }
            }}
            placeholder="Tulis pesan untuk M.A.Y.A..."
            className="flex-1 max-h-32 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 resize-none outline-none px-2 py-1.5 leading-relaxed"
          />

          {/* Phase 6A: Voice Input (Mic Button) */}
          {voice.isSttSupported && (
            <button
              type="button"
              onClick={() => {
                if (voice.isListening) {
                  voice.stopListening();
                } else {
                  voice.startListening();
                }
              }}
              disabled={loading}
              title={
                voice.isListening
                  ? 'Klik untuk Selesai & Kirim'
                  : `Mulai Bicara (${voice.settings.voiceMode === 'hands_free' ? 'Hands-Free' : 'Push-to-Talk'})`
              }
              className={`p-2 rounded-xl transition-all ${
                voice.isListening
                  ? 'bg-emerald-600 text-white animate-pulse ring-2 ring-emerald-400/50 shadow-lg shadow-emerald-500/20'
                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700'
              } disabled:opacity-40 disabled:pointer-events-none`}
            >
              <Mic className="h-4 w-4" />
            </button>
          )}

          {loading ? (
            <button
              onClick={handleStop}
              className="p-2 rounded-xl bg-red-600/80 text-white hover:bg-red-500 transition-colors"
              title="Stop Generasi"
            >
              <Square className="h-4 w-4 fill-white" />
            </button>
          ) : (
            <button
              onClick={() => handleSend()}
              disabled={!input.trim()}
              className="p-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 transition-colors disabled:opacity-30 disabled:pointer-events-none"
              title="Kirim (Enter)"
            >
              <Send className="h-4 w-4" />
            </button>
          )}
        </div>
      </footer>

      {/* Voice Settings Modal (Phase 6A) */}
      {showVoiceSettings && (
        <VoiceSettingsModal
          settings={voice.settings}
          onUpdate={voice.updateSettings}
          onClose={() => setShowVoiceSettings(false)}
        />
      )}

      {/* Step-Up Confirmation Modal */}
      {stepUpTarget && (
        <StepUpModal
          title={stepUpTarget.commandName}
          description={stepUpTarget.description}
          targetId={stepUpTarget.commandId}
          onSuccess={handleStepUpSuccess}
          onClose={() => setStepUpTarget(null)}
        />
      )}
    </div>
  );
};
