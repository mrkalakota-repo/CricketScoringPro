import { create } from 'zustand';
import type { Match, BallInput, Toss, ScoringAction } from '../engine/types';
import { MatchEngine, createNewMatch } from '../engine/match-engine';
import { migrateMatch } from '../engine/migration';
import * as matchRepo from '../db/repositories/match-repo';
import type { MatchRow } from '../db/repositories/match-repo';
import * as teamRepo from '../db/repositories/team-repo';
import * as cloudMatchRepo from '../db/repositories/cloud-match-repo';
import { useUserAuth } from '../hooks/useUserAuth';
import { useLeagueStore } from './league-store';
import { PLAN_LIMITS } from '../hooks/usePlan';

function canCloudSync(): boolean {
  const plan = useUserAuth.getState().profile?.plan ?? 'free';
  return PLAN_LIMITS[plan].cloudSync;
}

function publishToCloud(m: Match): void {
  if (!canCloudSync()) return;
  const phone = useUserAuth.getState().profile?.phone ?? undefined;
  cloudMatchRepo.publishLiveMatch(m);
  cloudMatchRepo.publishMatchState(m, phone);
}

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
  abandonMatch: () => Promise<void>;
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
        const match: Match = migrateMatch(JSON.parse(row.match_state_json));
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
    publishToCloud(newEngine.getMatch());
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
      publishToCloud(m);
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
      publishToCloud(m);
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
    publishToCloud(newEngine.getMatch());
  },

  startSuperOver: () => {
    const { engine, matchId } = get();
    if (!engine || !matchId) return;
    const newEngine = engine.startSuperOver();
    set({ engine: newEngine });
    matchRepo.saveMatchState(matchId, newEngine.getMatch()).catch(err => {
      console.error('[match-store] auto-save after startSuperOver failed:', (err as Error).message);
    });
    publishToCloud(newEngine.getMatch());
  },

  declareInnings: () => {
    const { engine } = get();
    if (!engine) return;
    const newEngine = engine.declareInnings();
    set({ engine: newEngine });
    publishToCloud(newEngine.getMatch());
  },

  abandonMatch: async () => {
    const { engine, matchId } = get();
    if (!engine) return;
    const newEngine = engine.abandonMatch();
    set({ engine: newEngine });
    const m = newEngine.getMatch();
    if (matchId) {
      await matchRepo.saveMatchState(matchId, m);
      publishToCloud(m);
    }
    const matches = await matchRepo.getAllMatches();
    set({ matches });
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
      publishToCloud(m);
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
    publishToCloud(m);
    // Auto-populate NRR on the linked league fixture (limited-overs completed matches only).
    if (m.status === 'completed' && m.config.oversPerInnings) {
      useLeagueStore.getState().autoPopulateFixtureNRR(matchId, m).catch((err: unknown) => {
        console.error('[match-store] autoPopulateFixtureNRR failed:', (err as Error).message);
      });
    }
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
        match = migrateMatch(JSON.parse(row.match_state_json));
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
        const match: Match = migrateMatch(JSON.parse(row.match_state_json));
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
