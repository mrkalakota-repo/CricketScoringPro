import { create } from 'zustand';
import type { Team, Player } from '../engine/types';
import * as teamRepo from '../db/repositories/team-repo';

interface TeamStore {
  teams: Team[];
  loading: boolean;
  loadTeams: () => Promise<void>;
  createTeam: (name: string, shortName: string) => Promise<Team>;
  updateTeam: (id: string, name: string, shortName: string) => Promise<void>;
  deleteTeam: (id: string) => Promise<void>;
  addPlayer: (teamId: string, name: string, battingStyle?: string, bowlingStyle?: string, isWicketKeeper?: boolean, isAllRounder?: boolean) => Promise<Player>;
  updatePlayer: (id: string, name: string, battingStyle: string, bowlingStyle: string, isWicketKeeper: boolean, isAllRounder: boolean) => Promise<void>;
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

  createTeam: async (name, shortName) => {
    const team = await teamRepo.createTeam(name, shortName);
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

  deleteTeam: async (id) => {
    await teamRepo.deleteTeam(id);
    set({ teams: get().teams.filter(t => t.id !== id) });
  },

  addPlayer: async (teamId, name, battingStyle, bowlingStyle, isWicketKeeper, isAllRounder) => {
    const player = await teamRepo.addPlayer(teamId, name, battingStyle, bowlingStyle, isWicketKeeper, isAllRounder);
    set({
      teams: get().teams.map(t =>
        t.id === teamId ? { ...t, players: [...t.players, player] } : t
      ),
    });
    return player;
  },

  updatePlayer: async (id, name, battingStyle, bowlingStyle, isWicketKeeper, isAllRounder) => {
    await teamRepo.updatePlayer(id, name, battingStyle, bowlingStyle, isWicketKeeper, isAllRounder);
    set({
      teams: get().teams.map(t => ({
        ...t,
        players: t.players.map(p =>
          p.id === id
            ? { ...p, name, battingStyle: battingStyle as Player['battingStyle'], bowlingStyle, isWicketKeeper, isAllRounder }
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
