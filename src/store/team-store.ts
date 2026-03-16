import { create } from 'zustand';
import type { Team, Player, BowlingStyle } from '../engine/types';
import * as teamRepo from '../db/repositories/team-repo';
import * as cloudRepo from '../db/repositories/cloud-team-repo';

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
  // Cloud sync
  importCloudTeams: (cloudTeams: Team[], myTeamIds: string[]) => Promise<void>;
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
    // Publish to cloud (fire and forget)
    cloudRepo.publishTeam(team);
    return team;
  },

  updateTeam: async (id, name, shortName) => {
    await teamRepo.updateTeam(id, name, shortName);
    const updatedTeams = get().teams.map(t =>
      t.id === id ? { ...t, name, shortName, updatedAt: Date.now() } : t
    );
    set({ teams: updatedTeams });
    // Re-publish updated team to cloud
    const updated = updatedTeams.find(t => t.id === id);
    if (updated) cloudRepo.publishTeam(updated);
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
    // Remove from cloud
    cloudRepo.deleteCloudTeam(id);
  },

  addPlayer: async (teamId, name, battingStyle, bowlingStyle, isWicketKeeper, isAllRounder, isCaptain) => {
    const player = await teamRepo.addPlayer(teamId, name, battingStyle, bowlingStyle, isWicketKeeper, isAllRounder, isCaptain);
    const updatedTeams = get().teams.map(t =>
      t.id === teamId ? { ...t, players: [...t.players, player] } : t
    );
    set({ teams: updatedTeams });
    // Re-publish team with new player
    const updated = updatedTeams.find(t => t.id === teamId);
    if (updated) cloudRepo.publishTeam(updated);
    return player;
  },

  updatePlayer: async (id, name, battingStyle, bowlingStyle, isWicketKeeper, isAllRounder, isCaptain) => {
    await teamRepo.updatePlayer(id, name, battingStyle, bowlingStyle, isWicketKeeper, isAllRounder, isCaptain);
    const updatedTeams = get().teams.map(t => ({
      ...t,
      players: t.players.map(p =>
        p.id === id
          ? { ...p, name, battingStyle: battingStyle as Player['battingStyle'], bowlingStyle: bowlingStyle as BowlingStyle, isWicketKeeper, isAllRounder, isCaptain }
          : p
      ),
    }));
    set({ teams: updatedTeams });
    // Re-publish team with updated player
    const updated = updatedTeams.find(t => t.players.some(p => p.id === id));
    if (updated) cloudRepo.publishTeam(updated);
  },

  deletePlayer: async (playerId, teamId) => {
    await teamRepo.deletePlayer(playerId);
    const updatedTeams = get().teams.map(t =>
      t.id === teamId
        ? { ...t, players: t.players.filter(p => p.id !== playerId) }
        : t
    );
    set({ teams: updatedTeams });
    // Re-publish team without deleted player
    const updated = updatedTeams.find(t => t.id === teamId);
    if (updated) cloudRepo.publishTeam(updated);
  },

  importCloudTeams: async (cloudTeams, myTeamIds) => {
    // Only import teams we don't own locally — preserve our admin access
    const teamsToImport = cloudTeams.filter(ct => !myTeamIds.includes(ct.id));
    if (teamsToImport.length === 0) return;

    for (const team of teamsToImport) {
      await teamRepo.importCloudTeam(team);
    }
    // Refresh local state to include imported teams
    const teams = await teamRepo.getAllTeams();
    set({ teams });
  },
}));
