import { create } from 'zustand';
import type { Match, BallInput, Toss, ScoringAction } from '../engine/types';
import { MatchEngine, createNewMatch } from '../engine/match-engine';
import * as matchRepo from '../db/repositories/match-repo';
import type { MatchRow } from '../db/repositories/match-repo';
import * as teamRepo from '../db/repositories/team-repo';
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

  // Whether the current match's linked fixture is verified (locks scoring)
  isVerified: boolean;

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
  retireBatter: (batsmanId: string, type: 'retired_hurt' | 'retired_out') => void;
  swapStrike: () => void;
  startNextInnings: () => void;
  startSuperOver: () => void;
  declareInnings: () => void;
  applyDLS: (newOvers: number, mode?: 'standard' | 'gully', gullyRPO?: number) => void;
  setMatchVerified: (verified: boolean) => void;
  saveMatch: () => Promise<void>;
  deleteMatch: (id: string) => Promise<void>;
  clearActiveMatch: () => void;
  setPendingInvitationCount: (count: number) => void;
  markMatchScheduled: (matchId: string) => Promise<void>;
  syncMatchFromCloud: (matchId: string) => Promise<void>;
}

export const useMatchStore = create<MatchStore>((set, get) => ({
  engine: null,
  matchId: null,
  matches: [],
  loading: false,
  pendingInvitationCount: 0,
  isVerified: false,

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
        // If local state is stale (in_progress/toss), check if cloud has completed.
        // This handles the "app restarted after match finished on another device" case.
        if (match.status === 'in_progress' || match.status === 'toss') {
          cloudMatchRepo.fetchCloudMatchState(id).then(async (cloudMatch) => {
            if (cloudMatch && cloudMatch.status === 'completed') {
              await matchRepo.saveMatchState(id, cloudMatch);
              set({ engine: new MatchEngine(cloudMatch), matchId: id });
              const matches = await matchRepo.getAllMatches();
              set({ matches });
            }
          }).catch(() => {});
        }
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
    const { engine, isVerified } = get();
    if (!engine) return;
    if (isVerified) throw new Error('This match is verified and locked.');
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
    const { engine, isVerified } = get();
    if (!engine || !engine.canUndo()) return;
    if (isVerified) throw new Error('This match is verified and locked.');
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

  retireBatter: (batsmanId, type) => {
    const { engine, matchId } = get();
    if (!engine) return;
    const newEngine = engine.retireBatter(batsmanId, type);
    set({ engine: newEngine });
    if (matchId) {
      matchRepo.saveMatchState(matchId, newEngine.getMatch()).catch(err => {
        console.error('[match-store] auto-save after retireBatter failed:', (err as Error).message);
      });
    }
  },

  swapStrike: () => {
    const { engine, matchId } = get();
    if (!engine) return;
    const newEngine = engine.swapStrike();
    set({ engine: newEngine });
    if (matchId) {
      matchRepo.saveMatchState(matchId, newEngine.getMatch()).catch(err => {
        console.error('[match-store] auto-save after swapStrike failed:', (err as Error).message);
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

  applyDLS: (newOvers, mode = 'standard', gullyRPO) => {
    const { engine, matchId } = get();
    if (!engine) return;
    const newEngine = engine.applyDLS(newOvers, mode, gullyRPO);
    set({ engine: newEngine });
    if (matchId) {
      const m = newEngine.getMatch();
      matchRepo.saveMatchState(matchId, m).catch(err => {
        console.error('[match-store] auto-save after applyDLS failed:', (err as Error).message);
      });
      cloudMatchRepo.publishLiveMatch(m);
      cloudMatchRepo.publishMatchState(m, useUserAuth.getState().profile?.phone ?? undefined);
    }
  },

  setMatchVerified: (verified) => {
    set({ isVerified: verified });
  },

  saveMatch: async () => {
    const { engine, matchId } = get();
    if (!engine || !matchId) return;
    const m = engine.getMatch();
    await matchRepo.saveMatchState(matchId, m);
    // Re-publish final state to cloud so completed matches are visible on other devices.
    cloudMatchRepo.publishLiveMatch(m);
    cloudMatchRepo.publishMatchState(m, useUserAuth.getState().profile?.phone ?? undefined);
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
    try {
      // Check if match already exists locally (creator's device); fall back to cloud fetch
      let match: Match | null = null;
      const row = await matchRepo.getMatchById(matchId);
      if (row?.match_state_json) {
        match = JSON.parse(row.match_state_json) as Match;
      } else {
        // Acceptor's device: fetch match from cloud_match_states, then fall back
        // to the invitation row (which carries the full match JSON since the fix).
        match = await cloudMatchRepo.fetchCloudMatchState(matchId);
        if (!match) {
          match = await cloudMatchRepo.fetchMatchFromInvitation(matchId);
        }
        if (match) {
          // Ensure both teams exist locally — the matches table has FK constraints
          // on team1_id and team2_id referencing teams(id). Without this the
          // INSERT below fails with a FK violation on the acceptor's device.
          await teamRepo.importCloudTeam(match.team1);
          await teamRepo.importCloudTeam(match.team2);
          try {
            await matchRepo.createMatch(
              match.id,
              match.config,
              match.team1.id,
              match.team2.id,
              match.team1PlayingXI,
              match.team2PlayingXI,
              match.venue ?? '',
              match.date ?? Date.now(),
            );
          } catch {
            // Row may already exist (UNIQUE constraint from a prior accept attempt) —
            // that is fine; saveMatchState below will update it.
          }
        }
      }
      if (match) {
        const updated: Match = { ...match, status: 'scheduled' };
        await matchRepo.saveMatchState(matchId, updated);
        // Load into engine so toss screen can read it immediately
        set({ engine: new MatchEngine(updated), matchId });
        // Refresh list
        const matches = await matchRepo.getAllMatches();
        set({ matches });
      } else {
        console.error('[match-store] acceptMatchInvitation: match not found locally or in cloud for', matchId);
      }
    } catch (err) {
      console.error('[match-store] acceptMatchInvitation: failed to update local state', (err as Error).message);
    }
  },

  declineMatchInvitation: async (matchId) => {
    await cloudMatchRepo.respondToInvitation(matchId, 'declined');
  },

  // Called on creator's device when team2 accepts — flips local status from
  // pending_acceptance → scheduled so the "Go to Toss" button appears.
  markMatchScheduled: async (matchId) => {
    try {
      const row = await matchRepo.getMatchById(matchId);
      if (row?.match_state_json) {
        const match: Match = JSON.parse(row.match_state_json);
        const updated: Match = { ...match, status: 'scheduled' };
        await matchRepo.saveMatchState(matchId, updated);
        set({ engine: new MatchEngine(updated), matchId });
        const matches = await matchRepo.getAllMatches();
        set({ matches });
      }
    } catch (err) {
      console.error('[match-store] markMatchScheduled failed:', (err as Error).message);
    }
  },

  // Fetch the latest match state from cloud (after the creator starts the match)
  // and update local SQLite + engine. Used by the observer on the toss screen.
  syncMatchFromCloud: async (matchId) => {
    try {
      const match = await cloudMatchRepo.fetchCloudMatchState(matchId);
      if (match) {
        await matchRepo.saveMatchState(matchId, match);
        set({ engine: new MatchEngine(match), matchId });
      }
    } catch (err) {
      console.error('[match-store] syncMatchFromCloud failed:', (err as Error).message);
    }
  },
}));
