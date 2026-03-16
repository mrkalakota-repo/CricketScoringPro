import { create } from 'zustand';
import * as prefsRepo from '../db/repositories/prefs-repo';

interface PrefsStore {
  myTeamIds: string[];
  loadPrefs: () => Promise<void>;
  addMyTeam: (teamId: string) => Promise<void>;
  removeMyTeam: (teamId: string) => Promise<void>;
}

export const usePrefsStore = create<PrefsStore>((set, get) => ({
  myTeamIds: [],

  loadPrefs: async () => {
    try {
      const myTeamIds = await prefsRepo.getMyTeamIds();
      set({ myTeamIds });
    } catch {
      set({ myTeamIds: [] });
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
}));
