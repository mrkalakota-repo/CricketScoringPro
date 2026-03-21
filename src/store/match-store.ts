import { create } from 'zustand';
import type { Match, BallInput, Toss, ScoringAction } from '../engine/types';
import { MatchEngine, createNewMatch } from '../engine/match-engine';
import * as matchRepo from '../db/repositories/match-repo';
import type { MatchRow } from '../db/repositories/match-repo';
import * as cloudMatchRepo from '../db/repositories/cloud-match-repo';
import { useUserAuth } from '../hooks/useUserAuth';

interface MatchStore {
  // Active match state
  engine: MatchEngine | null;
  matchId: string | null;

  // Match list
  matches: MatchRow[];
  loading: boolean;
  pendingInvitationCount: number;

  // Actions
  loadMatches: () => Promise<void>;
  createAndStartMatch: (match: Match) => void;
  loadMatch: (id: string) => Promise<void>;
  acceptMatchInvitation: (matchId: string) => Promise<void>;
  declineMatchInvitation: (matchId: string) => Promise<void>;
  recordToss: (toss: Toss) => void;
  startMatch: (battingTeamId: string, bowlingTeamId: string) => void;
  setOpeners: (strikerId: string, nonStrikerId: string) => void;
  setBowler: (bowlerId: string) => void;
  recordBall: (input: BallInput) => void;
  undoLastBall: () => void;
  setNewBatter: (batterId: string) => void;
  startNextInnings: () => void;
  startSuperOver: () => void;
  declareInnings: () => void;
  saveMatch: () => Promise<void>;
  deleteMatch: (id: string) => Promise<void>;
  clearActiveMatch: () => void;
  setPendingInvitationCount: (count: number) => void;
}

export const useMatchStore = create<MatchStore>((set, get) => ({
  engine: null,
  matchId: null,
  matches: [],
  loading: false,
  pendingInvitationCount: 0,

  loadMatches: async () => {
    set({ loading: true });
    const matches = await matchRepo.getAllMatches();
    set({ matches, loading: false });
  },

  createAndStartMatch: (match) => {
    const engine = new MatchEngine(match);
    set({ engine, matchId: match.id });
  },

  loadMatch: async (id) => {
    const row = await matchRepo.getMatchById(id);
    if (row?.match_state_json) {
      try {
        const match: Match = JSON.parse(row.match_state_json);
        const engine = new MatchEngine(match);
        set({ engine, matchId: id });
      } catch (err) {
        console.error('[match-store] loadMatch: corrupted match_state_json for id', id, (err as Error).message);
        set({ engine: null, matchId: null });
      }
    }
  },

  recordToss: (toss) => {
    const { engine } = get();
    if (!engine) return;
    set({ engine: engine.recordToss(toss) });
  },

  startMatch: (battingTeamId, bowlingTeamId) => {
    const { engine } = get();
    if (!engine) return;
    const newEngine = engine.startMatch(battingTeamId, bowlingTeamId);
    set({ engine: newEngine });
    const _m0 = newEngine.getMatch();
    cloudMatchRepo.publishLiveMatch(_m0);
    cloudMatchRepo.publishMatchState(_m0, useUserAuth.getState().profile?.phone ?? undefined);
  },

  setOpeners: (strikerId, nonStrikerId) => {
    const { engine } = get();
    if (!engine) return;
    const newEngine = engine.setOpeners(strikerId, nonStrikerId);
    set({ engine: newEngine });
    const { matchId } = get();
    if (matchId) {
      matchRepo.saveMatchState(matchId, newEngine.getMatch()).catch(err => {
        console.error('[match-store] auto-save after setOpeners failed:', (err as Error).message);
      });
    }
  },

  setBowler: (bowlerId) => {
    const { engine } = get();
    if (!engine) return;
    const newEngine = engine.setBowler(bowlerId);
    set({ engine: newEngine });
    const { matchId } = get();
    if (matchId) {
      matchRepo.saveMatchState(matchId, newEngine.getMatch()).catch(err => {
        console.error('[match-store] auto-save after setBowler failed:', (err as Error).message);
      });
    }
  },

  recordBall: (input) => {
    const { engine } = get();
    if (!engine) return;
    const newEngine = engine.recordBall(input);
    set({ engine: newEngine });
    const state = get();
    if (state.matchId) {
      const m = newEngine.getMatch();
      matchRepo.saveMatchState(state.matchId, m).catch(err => {
        console.error('[match-store] auto-save after recordBall failed:', (err as Error).message);
      });
      cloudMatchRepo.publishLiveMatch(m);
      cloudMatchRepo.publishMatchState(m, useUserAuth.getState().profile?.phone ?? undefined);
    }
  },

  undoLastBall: () => {
    const { engine } = get();
    if (!engine || !engine.canUndo()) return;
    const newEngine = engine.undoLastBall();
    set({ engine: newEngine });
    const state = get();
    if (state.matchId) {
      const m = newEngine.getMatch();
      matchRepo.saveMatchState(state.matchId, m).catch(err => {
        console.error('[match-store] auto-save after undoLastBall failed:', (err as Error).message);
      });
      cloudMatchRepo.publishLiveMatch(m);
      cloudMatchRepo.publishMatchState(m, useUserAuth.getState().profile?.phone ?? undefined);
    }
  },

  setNewBatter: (batterId) => {
    const { engine } = get();
    if (!engine) return;
    const newEngine = engine.setNewBatter(batterId);
    set({ engine: newEngine });
    const { matchId } = get();
    if (matchId) {
      matchRepo.saveMatchState(matchId, newEngine.getMatch()).catch(err => {
        console.error('[match-store] auto-save after setNewBatter failed:', (err as Error).message);
      });
    }
  },

  startNextInnings: () => {
    const { engine } = get();
    if (!engine) return;
    const newEngine = engine.startNextInnings();
    set({ engine: newEngine });
    const _m1 = newEngine.getMatch();
    cloudMatchRepo.publishLiveMatch(_m1);
    cloudMatchRepo.publishMatchState(_m1, useUserAuth.getState().profile?.phone ?? undefined);
  },

  startSuperOver: () => {
    const { engine, matchId } = get();
    if (!engine || !matchId) return;
    const newEngine = engine.startSuperOver();
    set({ engine: newEngine });
    matchRepo.saveMatchState(matchId, newEngine.getMatch()).catch(err => {
      console.error('[match-store] auto-save after startSuperOver failed:', (err as Error).message);
    });
    const _m2 = newEngine.getMatch();
    cloudMatchRepo.publishLiveMatch(_m2);
    cloudMatchRepo.publishMatchState(_m2, useUserAuth.getState().profile?.phone ?? undefined);
  },

  declareInnings: () => {
    const { engine } = get();
    if (!engine) return;
    const newEngine = engine.declareInnings();
    set({ engine: newEngine });
    const _m3 = newEngine.getMatch();
    cloudMatchRepo.publishLiveMatch(_m3);
    cloudMatchRepo.publishMatchState(_m3, useUserAuth.getState().profile?.phone ?? undefined);
  },

  saveMatch: async () => {
    const { engine, matchId } = get();
    if (!engine || !matchId) return;
    await matchRepo.saveMatchState(matchId, engine.getMatch());
    // No need to reload all matches — useFocusEffect on home/matches tabs
    // refreshes the list whenever the user navigates back.
  },

  deleteMatch: async (id) => {
    await matchRepo.deleteMatch(id);
    cloudMatchRepo.removeLiveMatch(id);
    cloudMatchRepo.removeMatchState(id);
    set({ matches: get().matches.filter(m => m.id !== id) });
    if (get().matchId === id) {
      set({ engine: null, matchId: null });
    }
  },

  clearActiveMatch: () => {
    set({ engine: null, matchId: null });
  },

  setPendingInvitationCount: (count) => {
    set({ pendingInvitationCount: count });
  },

  acceptMatchInvitation: async (matchId) => {
    // Update cloud invitation status
    await cloudMatchRepo.respondToInvitation(matchId, 'accepted');
    // Update local match state to 'scheduled' so the toss becomes available
    const row = await matchRepo.getMatchById(matchId);
    if (row?.match_state_json) {
      try {
        const match: Match = JSON.parse(row.match_state_json);
        const updated: Match = { ...match, status: 'scheduled' };
        await matchRepo.saveMatchState(matchId, updated);
        // If this match is currently active in the store, update the engine
        if (get().matchId === matchId) {
          set({ engine: new MatchEngine(updated) });
        }
        // Refresh list
        const matches = await matchRepo.getAllMatches();
        set({ matches });
      } catch (err) {
        console.error('[match-store] acceptMatchInvitation: failed to update local state', (err as Error).message);
      }
    }
  },

  declineMatchInvitation: async (matchId) => {
    await cloudMatchRepo.respondToInvitation(matchId, 'declined');
  },
}));
