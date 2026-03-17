import { create } from 'zustand';
import type { ChatMessage, ChatIdentity } from '../engine/types';
import * as chatRepo from '../db/repositories/cloud-chat-repo';
import * as prefsRepo from '../db/repositories/prefs-repo';

interface ChatStore {
  messages: Record<string, ChatMessage[]>;
  identity: Record<string, ChatIdentity>;
  loading: boolean;
  loadMessages: (teamId: string) => Promise<void>;
  loadIdentity: (teamId: string) => Promise<void>;
  setIdentity: (teamId: string, playerId: string, playerName: string) => Promise<void>;
  sendMessage: (teamId: string, text: string) => Promise<void>;
  appendMessage: (teamId: string, msg: ChatMessage) => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: {},
  identity: {},
  loading: false,

  loadMessages: async (teamId) => {
    set({ loading: true });
    const msgs = await chatRepo.fetchRecentMessages(teamId);
    set({ messages: { ...get().messages, [teamId]: msgs }, loading: false });
  },

  loadIdentity: async (teamId) => {
    const identity = await prefsRepo.getChatIdentity(teamId);
    if (identity) {
      set({ identity: { ...get().identity, [teamId]: identity } });
    }
  },

  setIdentity: async (teamId, playerId, playerName) => {
    await prefsRepo.setChatIdentity(teamId, playerId, playerName);
    set({ identity: { ...get().identity, [teamId]: { playerId, playerName } } });
  },

  sendMessage: async (teamId, text) => {
    const identity = get().identity[teamId];
    if (!identity) return;
    // Optimistic append
    const optimistic: ChatMessage = {
      id: `opt_${Date.now()}`,
      teamId, playerId: identity.playerId, playerName: identity.playerName,
      text, createdAt: Date.now(),
    };
    get().appendMessage(teamId, optimistic);
    await chatRepo.sendMessage(teamId, identity.playerId, identity.playerName, text);
  },

  appendMessage: (teamId, msg) => {
    const existing = get().messages[teamId] ?? [];
    // Deduplicate by id (Realtime may echo our own insert)
    if (existing.some(m => m.id === msg.id)) return;
    set({ messages: { ...get().messages, [teamId]: [...existing, msg] } });
  },
}));
