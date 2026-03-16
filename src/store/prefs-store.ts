import { create } from 'zustand';
import * as prefsRepo from '../db/repositories/prefs-repo';

interface PrefsStore {
  myTeamIds: string[];
  delegateTeamIds: string[];
  loadPrefs: () => Promise<void>;
  addMyTeam: (teamId: string) => Promise<void>;
  removeMyTeam: (teamId: string) => Promise<void>;
  addDelegateTeam: (teamId: string) => Promise<void>;
  removeDelegateTeam: (teamId: string) => Promise<void>;
}

export const usePrefsStore = create<PrefsStore>((set, get) => ({
  myTeamIds: [],
  delegateTeamIds: [],

  loadPrefs: async () => {
    try {
      const [myTeamIds, delegateTeamIds] = await Promise.all([
        prefsRepo.getMyTeamIds(),
        prefsRepo.getDelegateTeamIds(),
      ]);
      set({ myTeamIds, delegateTeamIds });
    } catch {
      set({ myTeamIds: [], delegateTeamIds: [] });
    }
  },

  addMyTeam: async (teamId) => {
    try {
      await prefsRepo.addMyTeamId(teamId);
      const ids = get().myTeamIds;
      if (!ids.includes(teamId)) set({ myTeamIds: [...ids, teamId] });
    } catch { /* ignore */ }
  },

  removeMyTeam: async (teamId) => {
    try {
      await prefsRepo.removeMyTeamId(teamId);
      set({ myTeamIds: get().myTeamIds.filter(id => id !== teamId) });
    } catch { /* ignore */ }
  },

  addDelegateTeam: async (teamId) => {
    try {
      await prefsRepo.addDelegateTeamId(teamId);
      const ids = get().delegateTeamIds;
      if (!ids.includes(teamId)) set({ delegateTeamIds: [...ids, teamId] });
    } catch { /* ignore */ }
  },

  removeDelegateTeam: async (teamId) => {
    try {
      await prefsRepo.removeDelegateTeamId(teamId);
      set({ delegateTeamIds: get().delegateTeamIds.filter(id => id !== teamId) });
    } catch { /* ignore */ }
  },
}));
