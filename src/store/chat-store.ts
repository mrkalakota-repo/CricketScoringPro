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
    // Insert and immediately append the returned row (which has the real server ID).
    // When the Realtime echo arrives, appendMessage deduplicates by ID so no double.
    const sent = await chatRepo.sendMessage(teamId, identity.playerId, identity.playerName, text);
    if (sent) get().appendMessage(teamId, sent);
  },

  appendMessage: (teamId, msg) => {
    const existing = get().messages[teamId] ?? [];
    // Deduplicate by id (Realtime may echo our own insert)
    if (existing.some(m => m.id === msg.id)) return;
    set({ messages: { ...get().messages, [teamId]: [...existing, msg] } });
  },
}));
