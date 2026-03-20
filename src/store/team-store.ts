import { create } from 'zustand';
import type { Team, Player, BowlingStyle } from '../engine/types';
import * as teamRepo from '../db/repositories/team-repo';
import * as cloudRepo from '../db/repositories/cloud-team-repo';
import { useUserAuth } from '../hooks/useUserAuth';
import { usePrefsStore } from './prefs-store';

function currentPhone(): string | null {
  return useUserAuth.getState().profile?.phone ?? null;
}

// Throttle cloud ownership sync to at most once per 60 s per phone number.
// Local SQLite load always runs; only the Supabase round-trip is gated.
const CLOUD_SYNC_COOLDOWN_MS = 60_000;
let _lastCloudSync = 0;
let _lastCloudSyncPhone = '';

interface TeamStore {
  teams: Team[];
  loading: boolean;
  loadTeams: () => Promise<void>;
  createTeam: (name: string, shortName: string, latitude?: number | null, longitude?: number | null) => Promise<Team>;
  updateTeam: (id: string, name: string, shortName: string) => Promise<void>;
  setTeamAdminPin: (id: string, pinHash: string | null) => Promise<void>;
  deleteTeam: (id: string) => Promise<void>;
  addPlayer: (teamId: string, name: string, phoneNumber?: string | null, battingStyle?: string, bowlingStyle?: string, isWicketKeeper?: boolean, isAllRounder?: boolean, isCaptain?: boolean, isViceCaptain?: boolean) => Promise<Player>;
  updatePlayer: (id: string, name: string, phoneNumber: string | null, battingStyle: string, bowlingStyle: BowlingStyle, isWicketKeeper: boolean, isAllRounder: boolean, isCaptain: boolean, isViceCaptain?: boolean) => Promise<void>;
  deletePlayer: (playerId: string, teamId: string) => Promise<void>;
  // Cloud sync
  importCloudTeams: (cloudTeams: Team[], myTeamIds: string[]) => Promise<void>;
}

export const useTeamStore = create<TeamStore>((set, get) => ({
  teams: [],
  loading: false,

  loadTeams: async () => {
    set({ loading: true });
    const localTeams = await teamRepo.getAllTeams();
    set({ teams: localTeams, loading: false });

    // Throttle Supabase ownership sync — local SQLite load above always runs,
    // but cloud round-trips are capped to once per 60 s per account.
    const phone = currentPhone();
    const prefsStore = usePrefsStore.getState();
    const now = Date.now();
    const cooldownActive =
      now - _lastCloudSync < CLOUD_SYNC_COOLDOWN_MS && _lastCloudSyncPhone === (phone ?? '');
    if (cooldownActive) return;

    // Restore myTeamIds from cloud — reset to exactly what the cloud says this
    // user owns. This prevents a previous user's myTeamIds persisting on the
    // same device after an account switch.
    if (phone) {
      _lastCloudSync = now;
      _lastCloudSyncPhone = phone;
      const ownedIds = await cloudRepo.fetchTeamIdsByOwner(phone);
      await prefsStore.setMyTeamIds(ownedIds);

      // Import any owned teams that don't exist locally yet (e.g. seeded via
      // script or created on another device before this device ever logged in).
      const localIds = new Set(localTeams.map(t => t.id));
      const missingIds = ownedIds.filter(id => !localIds.has(id));
      if (missingIds.length > 0) {
        const cloudTeams = await cloudRepo.fetchTeamsByIds(missingIds);
        for (const team of cloudTeams) {
          await teamRepo.importCloudTeam(team);
        }
        const refreshed = await teamRepo.getAllTeams();
        set({ teams: refreshed });
      }
    } else {
      // No logged-in user — clear any stale myTeamIds from a previous session.
      await prefsStore.setMyTeamIds([]);
    }
  },

  createTeam: async (name, shortName, latitude = null, longitude = null) => {
    const team = await teamRepo.createTeam(name, shortName, latitude, longitude);
    set({ teams: [...get().teams, team] });
    const phone = currentPhone();
    cloudRepo.publishTeam(team, phone).catch(err => {
      console.error('[team-store] createTeam cloud publish failed:', (err as Error).message);
    });
    return team;
  },

  updateTeam: async (id, name, shortName) => {
    await teamRepo.updateTeam(id, name, shortName);
    const updatedTeams = get().teams.map(t =>
      t.id === id ? { ...t, name, shortName, updatedAt: Date.now() } : t
    );
    set({ teams: updatedTeams });
    const updated = updatedTeams.find(t => t.id === id);
    if (updated) {
      const phone = currentPhone();
      cloudRepo.publishTeam(updated, phone).catch(err => {
        console.error('[team-store] updateTeam cloud publish failed:', (err as Error).message);
      });
    }
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
    cloudRepo.deleteCloudTeam(id).catch(err => {
      console.error('[team-store] deleteTeam cloud remove failed:', (err as Error).message);
    });
  },

  addPlayer: async (teamId, name, phoneNumber, battingStyle, bowlingStyle, isWicketKeeper, isAllRounder, isCaptain, isViceCaptain) => {
    const player = await teamRepo.addPlayer(teamId, name, phoneNumber, battingStyle, bowlingStyle, isWicketKeeper, isAllRounder, isCaptain, isViceCaptain);
    const updatedTeams = get().teams.map(t =>
      t.id === teamId ? { ...t, players: [...t.players, player] } : t
    );
    set({ teams: updatedTeams });
    const updated = updatedTeams.find(t => t.id === teamId);
    if (updated) {
      const phone = currentPhone();
      cloudRepo.publishTeam(updated, phone).catch(err => {
        console.error('[team-store] addPlayer cloud publish failed:', (err as Error).message);
      });
    }
    return player;
  },

  updatePlayer: async (id, name, phoneNumber, battingStyle, bowlingStyle, isWicketKeeper, isAllRounder, isCaptain, isViceCaptain = false) => {
    await teamRepo.updatePlayer(id, name, phoneNumber, battingStyle, bowlingStyle, isWicketKeeper, isAllRounder, isCaptain, isViceCaptain);
    const updatedTeams = get().teams.map(t => ({
      ...t,
      players: t.players.map(p =>
        p.id === id
          ? { ...p, name, phoneNumber, battingStyle: battingStyle as Player['battingStyle'], bowlingStyle: bowlingStyle as BowlingStyle, isWicketKeeper, isAllRounder, isCaptain, isViceCaptain }
          : p
      ),
    }));
    set({ teams: updatedTeams });
    const updated = updatedTeams.find(t => t.players.some(p => p.id === id));
    if (updated) {
      const phone = currentPhone();
      cloudRepo.publishTeam(updated as Team, phone).catch(err => {
        console.error('[team-store] updatePlayer cloud publish failed:', (err as Error).message);
      });
    }
  },

  deletePlayer: async (playerId, teamId) => {
    await teamRepo.deletePlayer(playerId);
    const updatedTeams = get().teams.map(t =>
      t.id === teamId
        ? { ...t, players: t.players.filter(p => p.id !== playerId) }
        : t
    );
    set({ teams: updatedTeams });
    const updated = updatedTeams.find(t => t.id === teamId);
    if (updated) {
      const phone = currentPhone();
      cloudRepo.publishTeam(updated, phone).catch(err => {
        console.error('[team-store] deletePlayer cloud publish failed:', (err as Error).message);
      });
    }
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
