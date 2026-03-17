import { create } from 'zustand';
import type { Match, BallInput, Toss, ScoringAction } from '../engine/types';
import { MatchEngine, createNewMatch } from '../engine/match-engine';
import * as matchRepo from '../db/repositories/match-repo';
import type { MatchRow } from '../db/repositories/match-repo';

interface MatchStore {
  // Active match state
  engine: MatchEngine | null;
  matchId: string | null;

  // Match list
  matches: MatchRow[];
  loading: boolean;

  // Actions
  loadMatches: () => Promise<void>;
  createAndStartMatch: (match: Match) => void;
  loadMatch: (id: string) => Promise<void>;
  recordToss: (toss: Toss) => void;
  startMatch: (battingTeamId: string, bowlingTeamId: string) => void;
  setOpeners: (strikerId: string, nonStrikerId: string) => void;
  setBowler: (bowlerId: string) => void;
  recordBall: (input: BallInput) => void;
  undoLastBall: () => void;
  setNewBatter: (batterId: string) => void;
  startNextInnings: () => void;
  declareInnings: () => void;
  saveMatch: () => Promise<void>;
  deleteMatch: (id: string) => Promise<void>;
  clearActiveMatch: () => void;
}

export const useMatchStore = create<MatchStore>((set, get) => ({
  engine: null,
  matchId: null,
  matches: [],
  loading: false,

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
      const match: Match = JSON.parse(row.match_state_json);
      const engine = new MatchEngine(match);
      set({ engine, matchId: id });
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
    set({ engine: engine.startMatch(battingTeamId, bowlingTeamId) });
  },

  setOpeners: (strikerId, nonStrikerId) => {
    const { engine } = get();
    if (!engine) return;
    const newEngine = engine.setOpeners(strikerId, nonStrikerId);
    set({ engine: newEngine });
    const { matchId } = get();
    if (matchId) {
      matchRepo.saveMatchState(matchId, newEngine.getMatch()).catch(err => {
        console.error('[match-store] auto-save after setOpeners failed:', err);
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
        console.error('[match-store] auto-save after setBowler failed:', err);
      });
    }
  },

  recordBall: (input) => {
    const { engine } = get();
    if (!engine) return;
    const newEngine = engine.recordBall(input);
    set({ engine: newEngine });
    // Auto-save after each ball
    const state = get();
    if (state.matchId) {
      matchRepo.saveMatchState(state.matchId, newEngine.getMatch()).catch(err => {
        console.error('[match-store] auto-save after recordBall failed:', err);
      });
    }
  },

  undoLastBall: () => {
    const { engine } = get();
    if (!engine || !engine.canUndo()) return;
    const newEngine = engine.undoLastBall();
    set({ engine: newEngine });
    const state = get();
    if (state.matchId) {
      matchRepo.saveMatchState(state.matchId, newEngine.getMatch()).catch(err => {
        console.error('[match-store] auto-save after undoLastBall failed:', err);
      });
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
        console.error('[match-store] auto-save after setNewBatter failed:', err);
      });
    }
  },

  startNextInnings: () => {
    const { engine } = get();
    if (!engine) return;
    set({ engine: engine.startNextInnings() });
  },

  declareInnings: () => {
    const { engine } = get();
    if (!engine) return;
    set({ engine: engine.declareInnings() });
  },

  saveMatch: async () => {
    const { engine, matchId } = get();
    if (!engine || !matchId) return;
    await matchRepo.saveMatchState(matchId, engine.getMatch());
    await get().loadMatches();
  },

  deleteMatch: async (id) => {
    await matchRepo.deleteMatch(id);
    set({ matches: get().matches.filter(m => m.id !== id) });
    if (get().matchId === id) {
      set({ engine: null, matchId: null });
    }
  },

  clearActiveMatch: () => {
    set({ engine: null, matchId: null });
  },
}));
