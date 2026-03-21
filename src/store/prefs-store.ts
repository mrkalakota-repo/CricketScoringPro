import { create } from 'zustand';
import * as prefsRepo from '../db/repositories/prefs-repo';

interface PrefsStore {
  myTeamIds: string[];
  playerTeamIds: string[];
  delegateTeamIds: string[];
  myLeagueIds: string[];
  loadPrefs: () => Promise<void>;
  addMyTeam: (teamId: string) => Promise<void>;
  removeMyTeam: (teamId: string) => Promise<void>;
  setMyTeamIds: (teamIds: string[]) => Promise<void>;
  setPlayerTeamIds: (teamIds: string[]) => Promise<void>;
  addDelegateTeam: (teamId: string) => Promise<void>;
  removeDelegateTeam: (teamId: string) => Promise<void>;
  addMyLeague: (leagueId: string) => Promise<void>;
  removeMyLeague: (leagueId: string) => Promise<void>;
  setMyLeagueIds: (leagueIds: string[]) => Promise<void>;
}

export const usePrefsStore = create<PrefsStore>((set, get) => ({
  myTeamIds: [],
  playerTeamIds: [],
  delegateTeamIds: [],
  myLeagueIds: [],

  loadPrefs: async () => {
    try {
      const [myTeamIds, playerTeamIds, delegateTeamIds, myLeagueIds] = await Promise.all([
        prefsRepo.getMyTeamIds(),
        prefsRepo.getPlayerTeamIds(),
        prefsRepo.getDelegateTeamIds(),
        prefsRepo.getMyLeagueIds(),
      ]);
      set({ myTeamIds, playerTeamIds, delegateTeamIds, myLeagueIds });
    } catch {
      set({ myTeamIds: [], playerTeamIds: [], delegateTeamIds: [], myLeagueIds: [] });
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

  setMyTeamIds: async (teamIds) => {
    try {
      await prefsRepo.setMyTeamIds(teamIds);
      set({ myTeamIds: teamIds });
    } catch { /* ignore */ }
  },

  setPlayerTeamIds: async (teamIds) => {
    try {
      await prefsRepo.setPlayerTeamIds(teamIds);
      set({ playerTeamIds: teamIds });
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

  addMyLeague: async (leagueId) => {
    try {
      await prefsRepo.addMyLeagueId(leagueId);
      const ids = get().myLeagueIds;
      if (!ids.includes(leagueId)) set({ myLeagueIds: [...ids, leagueId] });
    } catch { /* ignore */ }
  },

  removeMyLeague: async (leagueId) => {
    try {
      await prefsRepo.removeMyLeagueId(leagueId);
      set({ myLeagueIds: get().myLeagueIds.filter(id => id !== leagueId) });
    } catch { /* ignore */ }
  },

  setMyLeagueIds: async (leagueIds) => {
    try {
      await prefsRepo.setMyLeagueIds(leagueIds);
      set({ myLeagueIds: leagueIds });
    } catch { /* ignore */ }
  },
}));
