import { create } from 'zustand';
import type { Team, Player, BowlingStyle } from '../engine/types';
import * as teamRepo from '../db/repositories/team-repo';

interface TeamStore {
  teams: Team[];
  loading: boolean;
  loadTeams: () => Promise<void>;
  createTeam: (name: string, shortName: string, latitude?: number | null, longitude?: number | null) => Promise<Team>;
  updateTeam: (id: string, name: string, shortName: string) => Promise<void>;
  setTeamAdminPin: (id: string, pinHash: string | null) => Promise<void>;
  deleteTeam: (id: string) => Promise<void>;
  addPlayer: (teamId: string, name: string, battingStyle?: string, bowlingStyle?: string, isWicketKeeper?: boolean, isAllRounder?: boolean, isCaptain?: boolean) => Promise<Player>;
  updatePlayer: (id: string, name: string, battingStyle: string, bowlingStyle: BowlingStyle, isWicketKeeper: boolean, isAllRounder: boolean, isCaptain: boolean) => Promise<void>;
  deletePlayer: (playerId: string, teamId: string) => Promise<void>;
}

export const useTeamStore = create<TeamStore>((set, get) => ({
  teams: [],
  loading: false,

  loadTeams: async () => {
    set({ loading: true });
    const teams = await teamRepo.getAllTeams();
    set({ teams, loading: false });
  },

  createTeam: async (name, shortName, latitude = null, longitude = null) => {
    const team = await teamRepo.createTeam(name, shortName, latitude, longitude);
    set({ teams: [...get().teams, team] });
    return team;
  },

  updateTeam: async (id, name, shortName) => {
    await teamRepo.updateTeam(id, name, shortName);
    set({
      teams: get().teams.map(t =>
        t.id === id ? { ...t, name, shortName, updatedAt: Date.now() } : t
      ),
    });
  },

  setTeamAdminPin: async (id, pinHash) => {
    await teamRepo.setTeamAdminPin(id, pinHash);
    set({
      teams: get().teams.map(t =>
        t.id === id ? { ...t, adminPinHash: pinHash, updatedAt: Date.now() } : t
      ),
    });
  },

  deleteTeam: async (id) => {
    await teamRepo.deleteTeam(id);
    set({ teams: get().teams.filter(t => t.id !== id) });
  },

  addPlayer: async (teamId, name, battingStyle, bowlingStyle, isWicketKeeper, isAllRounder, isCaptain) => {
    const player = await teamRepo.addPlayer(teamId, name, battingStyle, bowlingStyle, isWicketKeeper, isAllRounder, isCaptain);
    set({
      teams: get().teams.map(t =>
        t.id === teamId ? { ...t, players: [...t.players, player] } : t
      ),
    });
    return player;
  },

  updatePlayer: async (id, name, battingStyle, bowlingStyle, isWicketKeeper, isAllRounder, isCaptain) => {
    await teamRepo.updatePlayer(id, name, battingStyle, bowlingStyle, isWicketKeeper, isAllRounder, isCaptain);
    set({
      teams: get().teams.map(t => ({
        ...t,
        players: t.players.map(p =>
          p.id === id
            ? { ...p, name, battingStyle: battingStyle as Player['battingStyle'], bowlingStyle: bowlingStyle as BowlingStyle, isWicketKeeper, isAllRounder, isCaptain }
            : p
        ),
      })),
    });
  },

  deletePlayer: async (playerId, teamId) => {
    await teamRepo.deletePlayer(playerId);
    set({
      teams: get().teams.map(t =>
        t.id === teamId
          ? { ...t, players: t.players.filter(p => p.id !== playerId) }
          : t
      ),
    });
  },
}));
