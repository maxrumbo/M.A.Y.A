import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api/client';
import { useVoiceAssistant } from '../services/voice/useVoiceAssistant';
import type { ChatMessage, ConversationSummary, MuteStatus, PendingAction } from '../types';

export interface StepUpTarget {
  commandId: string;
  commandName: string;
  description: string;
}

interface MayaSessionContextValue {
  messages: ChatMessage[];
  conversationId: string | null;
  conversations: ConversationSummary[];
  loadingConversations: boolean;
  loading: boolean;
  muteStatus: MuteStatus | null;
  stepUpTarget: StepUpTarget | null;
  showVoiceSettings: boolean;
  actionError: string | null;
  voice: ReturnType<typeof useVoiceAssistant>;
  sendMessage: (text: string) => Promise<void>;
  stopGeneration: () => void;
  startNewChat: () => void;
  loadConversation: (id: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  refreshConversations: () => Promise<void>;
  muteNotifications: (minutes: number) => Promise<void>;
  unmuteNotifications: () => Promise<void>;
  openStepUpForAction: (action: PendingAction) => void;
  closeStepUp: () => void;
  handleStepUpSuccess: (stepUpToken: string) => Promise<void>;
  cancelAction: (commandId: string) => Promise<void>;
  setShowVoiceSettings: (open: boolean) => void;
  clearActionError: () => void;
}

const MayaSessionContext = createContext<MayaSessionContextValue | null>(null);

export const MayaSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loadingConversations, setLoadingConversations] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [muteStatus, setMuteStatus] = useState<MuteStatus | null>(null);
  const [stepUpTarget, setStepUpTarget] = useState<StepUpTarget | null>(null);
  const [showVoiceSettings, setShowVoiceSettings] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const conversationIdRef = useRef<string | null>(conversationId);
  const loadingRef = useRef<boolean>(loading);

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  const refreshConversations = useCallback(async () => {
    setLoadingConversations(true);
    try {
      const list = await api.getConversations();
      setConversations(list);
    } catch {
      // ignore transient network errors on conversation list refresh
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  useEffect(() => {
    void api.getMuteStatus().then(setMuteStatus).catch(() => {});
    void refreshConversations();
  }, [refreshConversations]);

  const voiceRef = useRef<ReturnType<typeof useVoiceAssistant> | null>(null);

  const sendMessage = useCallback(
    async (text: string) => {
      const messageToSend = text.trim();
      if (!messageToSend || loadingRef.current) return;

      setActionError(null);
      const activeConvId = conversationIdRef.current;

      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        conversationId: activeConvId || 'default',
        role: 'user',
        content: messageToSend,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);
      loadingRef.current = true;

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const res = await api.sendMessage(
          messageToSend,
          activeConvId || undefined,
          abortController.signal
        );

        if (res.conversationId) {
          setConversationId(res.conversationId);
          conversationIdRef.current = res.conversationId;
        }

        const botMsg: ChatMessage = {
          id: `m-${Date.now()}`,
          conversationId: res.conversationId || activeConvId || 'default',
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
        voiceRef.current?.speakResponse(res.reply);
        void refreshConversations();
      } catch (err: any) {
        if (err?.name === 'AbortError') {
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
              content: `*Error:* ${err?.message || 'Gagal menghubungi server.'}`,
              createdAt: new Date().toISOString(),
            },
          ]);
        }
      } finally {
        setLoading(false);
        loadingRef.current = false;
        abortControllerRef.current = null;
      }
    },
    [refreshConversations]
  );

  const voice = useVoiceAssistant({
    onSendMessage: sendMessage,
    isGenerating: loading,
  });

  useEffect(() => {
    voiceRef.current = voice;
  }, [voice]);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    voiceRef.current?.stopSpeaking();
  }, []);

  const startNewChat = useCallback(() => {
    if (loadingRef.current) return;
    voiceRef.current?.stopSpeaking();
    setConversationId(null);
    conversationIdRef.current = null;
    setMessages([]);
    setActionError(null);
  }, []);

  const loadConversation = useCallback(async (id: string) => {
    if (loadingRef.current) return;
    voiceRef.current?.stopSpeaking();
    setActionError(null);
    try {
      const rawMessages = await api.getConversationMessages(id);
      const normalized: ChatMessage[] = rawMessages.map((m) => ({
        ...m,
        role: String(m.role).toLowerCase() === 'user' ? 'user' : 'model',
      }));
      setConversationId(id);
      conversationIdRef.current = id;
      setMessages(normalized);
    } catch (err: any) {
      setActionError(err?.message || 'Gagal memuat riwayat percakapan.');
    }
  }, []);

  const deleteConversation = useCallback(async (id: string) => {
    try {
      await api.deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (conversationIdRef.current === id) {
        setConversationId(null);
        conversationIdRef.current = null;
        setMessages([]);
      }
    } catch (err: any) {
      setActionError(err?.message || 'Gagal menghapus percakapan.');
    }
  }, []);

  const muteNotifications = useCallback(async (minutes: number) => {
    try {
      const res = await api.muteNotifications(minutes);
      setMuteStatus(res);
    } catch (err: any) {
      setActionError(err?.message || 'Gagal membisukan notifikasi.');
    }
  }, []);

  const unmuteNotifications = useCallback(async () => {
    try {
      await api.unmuteNotifications();
      setMuteStatus({ isMuted: false, mutedUntil: null, remainingMinutes: 0 });
    } catch (err: any) {
      setActionError(err?.message || 'Gagal mengaktifkan notifikasi.');
    }
  }, []);

  const openStepUpForAction = useCallback((action: PendingAction) => {
    setStepUpTarget({
      commandId: action.commandId,
      commandName: action.commandName,
      description: action.description,
    });
  }, []);

  const closeStepUp = useCallback(() => {
    setStepUpTarget(null);
  }, []);

  const handleStepUpSuccess = useCallback(
    async (stepUpToken: string) => {
      if (!stepUpTarget) return;
      const cmdId = stepUpTarget.commandId;
      setStepUpTarget(null);

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
                    description: `${pa.description} -> ${res.output || 'Selesai dieksekusi.'}`,
                  }
                : pa
            ),
          }))
        );
      } catch (err: any) {
        setActionError(err?.message || 'Gagal mengeksekusi perintah.');
        setMessages((prev) =>
          prev.map((msg) => ({
            ...msg,
            pendingActions: msg.pendingActions?.map((pa) =>
              pa.commandId === cmdId ? { ...pa, status: 'Cancelled' } : pa
            ),
          }))
        );
      }
    },
    [stepUpTarget]
  );

  const cancelAction = useCallback(async (commandId: string) => {
    try {
      await api.cancelCommand(commandId);
      setMessages((prev) =>
        prev.map((msg) => ({
          ...msg,
          pendingActions: msg.pendingActions?.map((pa) =>
            pa.commandId === commandId
              ? { ...pa, status: 'Cancelled', description: `${pa.description} (Dibatalkan)` }
              : pa
          ),
        }))
      );
    } catch (err: any) {
      setActionError(err?.message || 'Gagal membatalkan aksi.');
    }
  }, []);

  const clearActionError = useCallback(() => setActionError(null), []);

  return (
    <MayaSessionContext.Provider
      value={{
        messages,
        conversationId,
        conversations,
        loadingConversations,
        loading,
        muteStatus,
        stepUpTarget,
        showVoiceSettings,
        actionError,
        voice,
        sendMessage,
        stopGeneration,
        startNewChat,
        loadConversation,
        deleteConversation,
        refreshConversations,
        muteNotifications,
        unmuteNotifications,
        openStepUpForAction,
        closeStepUp,
        handleStepUpSuccess,
        cancelAction,
        setShowVoiceSettings,
        clearActionError,
      }}
    >
      {children}
    </MayaSessionContext.Provider>
  );
};

export function useMayaSession(): MayaSessionContextValue {
  const ctx = useContext(MayaSessionContext);
  if (!ctx) {
    throw new Error('useMayaSession harus digunakan di dalam MayaSessionProvider.');
  }
  return ctx;
}
