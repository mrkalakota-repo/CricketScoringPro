/**
 * Engine Coverage Tests
 *
 * Covers the scenarios missing from the existing test suite:
 *  - Accessor/utility methods (getUndoStack, getCurrentInnings null, getNonStriker, isInningsComplete, isMatchComplete)
 *  - abandonMatch
 *  - applyDLS (standard and gully modes) + error guards
 *  - retireBatter (via engine method, both retired_hurt and retired_out, striker and non-striker)
 *  - swapStrike
 *  - Super over: startSuperOver, innings transitions, win by wickets, win by runs, tied
 *  - Test match completion: team1 wins, team2 wins, tie
 *  - canFollowOn
 *  - undo when match was completed (resets match status to in_progress)
 *  - startNextInnings error when max innings reached
 *  - declareInnings throws for non-test match
 *  - startSuperOver error guards
 */

import { MatchEngine, createNewMatch } from '../match-engine';
import type { Match, Team, Player, MatchConfig, BallInput } from '../types';
import { FORMAT_CONFIGS } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

function makePlayer(id: string, name: string): Player {
  return {
    id, name,
    battingStyle: 'right',
    bowlingStyle: 'Right-arm fast',
    isWicketKeeper: false,
    isAllRounder: false,
    isCaptain: false,
    isViceCaptain: false,
    jerseyNumber: null,
    photoUri: null,
  };
}

function makeTeam(id: string, name: string, shortName: string, playerCount = 11): Team {
  const players: Player[] = [];
  for (let i = 1; i <= playerCount; i++) {
    players.push(makePlayer(`${id}_p${i}`, `${name} P${i}`));
  }
  players[0].isWicketKeeper = true;
  return { id, name, shortName, adminPinHash: null, latitude: null, longitude: null, players, createdAt: 0, updatedAt: 0 };
}

function makeConfig(format: MatchConfig['format'], overs?: number, players?: number): MatchConfig {
  if (format === 'custom') {
    return { format: 'custom', oversPerInnings: overs!, maxInnings: 2, playersPerSide: players!, powerplays: [], followOnMinimum: null, wideRuns: 1, noBallRuns: 1 };
  }
  return { format, ...FORMAT_CONFIGS[format as Exclude<MatchConfig['format'], 'custom'>] };
}

function startMatch(
  t1: Team, t2: Team, config: MatchConfig,
  bat: string, bowl: string,
  opener1: string, opener2: string,
  bowler: string,
): MatchEngine {
  let e = new MatchEngine(createNewMatch('m1', config, t1, t2,
    t1.players.map(p => p.id), t2.players.map(p => p.id), 'Ground', 0));
  e = e.recordToss({ winnerId: bat, decision: 'bat' });
  e = e.startMatch(bat, bowl);
  e = e.setOpeners(opener1, opener2);
  e = e.setBowler(bowler);
  return e;
}

function pickNextBowler(engine: MatchEngine, bowlers: string[]): string {
  const inn = engine.getCurrentInnings()!;
  const config = engine.getMatch().config;
  const lastBowlerId = inn.overs.length > 0 ? inn.overs[inn.overs.length - 1].bowlerId : null;
  const maxOvers = config.oversPerInnings !== null ? Math.floor(config.oversPerInnings / 5) : Infinity;
  const eligible = bowlers
    .filter(b => {
      if (b === lastBowlerId) return false;
      const spell = inn.bowlers.find(s => s.playerId === b);
      return !spell || spell.overs < maxOvers;
    })
    .sort((a, b) => {
      const aOvers = inn.bowlers.find(s => s.playerId === a)?.overs ?? 0;
      const bOvers = inn.bowlers.find(s => s.playerId === b)?.overs ?? 0;
      return aOvers - bOvers;
    });
  if (eligible.length === 0) throw new Error(`No eligible bowler in [${bowlers.join(', ')}]`);
  return eligible[0];
}

function bowlDots(engine: MatchEngine, balls: number, bowlers: string[]): MatchEngine {
  let e = engine;
  for (let i = 0; i < balls; i++) {
    const inn = e.getCurrentInnings();
    if (!inn || inn.status !== 'in_progress') break;
    if (!inn.currentBowlerId) e = e.setBowler(pickNextBowler(e, bowlers));
    e = e.recordBall(DOT);
  }
  return e;
}

const DOT: BallInput = { runs: 0, isWide: false, isNoBall: false, isBye: false, isLegBye: false, dismissal: null, isBoundary: false };
const S1: BallInput  = { ...DOT, runs: 1 };
const S4: BallInput  = { ...DOT, runs: 4, isBoundary: true };
const S6: BallInput  = { ...DOT, runs: 6, isBoundary: true };
const BOWLED = (): BallInput => ({ ...DOT, dismissal: { type: 'bowled' } });

// Bowl a single over of 6 legal balls
function bowlOver(engine: MatchEngine, ball: BallInput = DOT): MatchEngine {
  let e = engine;
  for (let i = 0; i < 6; i++) e = e.recordBall(ball);
  return e;
}

// Build a T20 match with first innings complete (all dots, 0 runs)
function buildT20FirstInningsComplete(): MatchEngine {
  const t1 = makeTeam('t1', 'Alpha', 'ALP');
  const t2 = makeTeam('t2', 'Beta', 'BET');
  const bowlerPool = ['t2_p6', 't2_p7', 't2_p8', 't2_p9', 't2_p10'];
  let e = startMatch(t1, t2, makeConfig('t20'), 't1', 't2', 't1_p1', 't1_p2', 't2_p6');
  return bowlDots(e, 120, bowlerPool);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Accessor / utility methods
// ─────────────────────────────────────────────────────────────────────────────

describe('Accessor methods', () => {
  test('getUndoStack returns the current undo stack', () => {
    const { engine } = (() => {
      const t1 = makeTeam('t1', 'A', 'A');
      const t2 = makeTeam('t2', 'B', 'B');
      const e = startMatch(t1, t2, makeConfig('t20'), 't1', 't2', 't1_p1', 't1_p2', 't2_p6');
      return { engine: e };
    })();
    expect(engine.getUndoStack()).toHaveLength(0);
    const e2 = engine.recordBall(S1);
    expect(e2.getUndoStack()).toHaveLength(1);
  });

  test('getCurrentInnings returns null when currentInningsIndex is out of range', () => {
    const t1 = makeTeam('t1', 'A', 'A');
    const t2 = makeTeam('t2', 'B', 'B');
    const match = createNewMatch('m1', makeConfig('t20'), t1, t2, [], [], 'G', 0);
    const engine = new MatchEngine(match);
    // Before match starts, currentInningsIndex is -1
    expect(engine.getCurrentInnings()).toBeNull();
  });

  test('getNonStriker returns null when currentNonStrikerId is not set', () => {
    const t1 = makeTeam('t1', 'A', 'A');
    const t2 = makeTeam('t2', 'B', 'B');
    let e = new MatchEngine(createNewMatch('m1', makeConfig('t20'), t1, t2,
      t1.players.map(p => p.id), t2.players.map(p => p.id), 'G', 0));
    e = e.recordToss({ winnerId: 't1', decision: 'bat' });
    e = e.startMatch('t1', 't2');
    // Non-striker not set yet — only one batter set
    const matchState = e.getMatch();
    const innings = matchState.innings[0];
    // currentNonStrikerId is null at this point
    expect(e.getNonStriker()).toBeNull();
  });

  test('isInningsComplete returns true when innings is completed', () => {
    const e = buildT20FirstInningsComplete();
    expect(e.isInningsComplete()).toBe(true);
  });

  test('isInningsComplete returns false when innings is in_progress', () => {
    const t1 = makeTeam('t1', 'A', 'A');
    const t2 = makeTeam('t2', 'B', 'B');
    const e = startMatch(t1, t2, makeConfig('t20'), 't1', 't2', 't1_p1', 't1_p2', 't2_p6');
    expect(e.isInningsComplete()).toBe(false);
  });

  test('isMatchComplete returns false during match', () => {
    const t1 = makeTeam('t1', 'A', 'A');
    const t2 = makeTeam('t2', 'B', 'B');
    const e = startMatch(t1, t2, makeConfig('t20'), 't1', 't2', 't1_p1', 't1_p2', 't2_p6');
    expect(e.isMatchComplete()).toBe(false);
  });

  test('isMatchComplete returns true after match result', () => {
    // Complete first innings (0 runs), then second innings scores 1 = win immediately
    const e1 = buildT20FirstInningsComplete();
    let e = e1.startNextInnings();
    e = e.setOpeners('t2_p1', 't2_p2');
    e = e.setBowler('t1_p6');
    e = e.recordBall(S1); // scores 1, target was 1 → win
    expect(e.isMatchComplete()).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. abandonMatch
// ─────────────────────────────────────────────────────────────────────────────

describe('abandonMatch', () => {
  test('sets match status to abandoned and result to "Match abandoned"', () => {
    const t1 = makeTeam('t1', 'A', 'A');
    const t2 = makeTeam('t2', 'B', 'B');
    let e = startMatch(t1, t2, makeConfig('t20'), 't1', 't2', 't1_p1', 't1_p2', 't2_p6');
    e = e.recordBall(S4);
    e = e.abandonMatch();
    expect(e.getMatch().status).toBe('abandoned');
    expect(e.getMatch().result).toBe('Match abandoned');
  });

  test('marks current innings as completed', () => {
    const t1 = makeTeam('t1', 'A', 'A');
    const t2 = makeTeam('t2', 'B', 'B');
    let e = startMatch(t1, t2, makeConfig('t20'), 't1', 't2', 't1_p1', 't1_p2', 't2_p6');
    e = e.abandonMatch();
    expect(e.getCurrentInnings()!.status).toBe('completed');
  });

  test('clears batter and bowler IDs after abandon', () => {
    const t1 = makeTeam('t1', 'A', 'A');
    const t2 = makeTeam('t2', 'B', 'B');
    let e = startMatch(t1, t2, makeConfig('t20'), 't1', 't2', 't1_p1', 't1_p2', 't2_p6');
    e = e.abandonMatch();
    const inn = e.getCurrentInnings()!;
    expect(inn.currentStrikerId).toBeNull();
    expect(inn.currentNonStrikerId).toBeNull();
    expect(inn.currentBowlerId).toBeNull();
  });

  test('clears the undo stack after abandon', () => {
    const t1 = makeTeam('t1', 'A', 'A');
    const t2 = makeTeam('t2', 'B', 'B');
    let e = startMatch(t1, t2, makeConfig('t20'), 't1', 't2', 't1_p1', 't1_p2', 't2_p6');
    e = e.recordBall(S1);
    e = e.recordBall(S4);
    expect(e.canUndo()).toBe(true);
    e = e.abandonMatch();
    expect(e.canUndo()).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. applyDLS
// ─────────────────────────────────────────────────────────────────────────────

describe('applyDLS', () => {
  function setupSecondInnings(firstInningsRuns: number): MatchEngine {
    const t1 = makeTeam('t1', 'A', 'A');
    const t2 = makeTeam('t2', 'B', 'B');
    const bowlers = ['t2_p6', 't2_p7', 't2_p8', 't2_p9', 't2_p10'];
    let e = startMatch(t1, t2, makeConfig('t20'), 't1', 't2', 't1_p1', 't1_p2', 't2_p6');
    // Score firstInningsRuns in first innings, then exhaust overs
    let scored = 0;
    for (let over = 0; over < 20; over++) {
      for (let ball = 0; ball < 6; ball++) {
        if (scored < firstInningsRuns) { e = e.recordBall(S1); scored++; }
        else { e = e.recordBall(DOT); }
      }
      if (over < 19) e = e.setBowler(pickNextBowler(e, bowlers));
    }
    e = e.startNextInnings();
    e = e.setOpeners('t2_p1', 't2_p2');
    e = e.setBowler('t1_p6');
    return e;
  }

  test('standard DLS: revises target and updates innings revisedTarget', () => {
    const e = setupSecondInnings(200);
    const updated = e.applyDLS(10); // cut to 10 overs
    const inn = updated.getCurrentInnings()!;
    expect(inn.revisedTarget).toBeGreaterThan(0);
    expect(inn.revisedOvers).toBe(10);
    expect(inn.dlsMode).toBe('standard');
    // DLS target should be less than original (fewer resources)
    expect(inn.revisedTarget!).toBeLessThan(201);
  });

  test('standard DLS: updates the live target used for RRR', () => {
    const e = setupSecondInnings(100);
    const revised = e.applyDLS(5);
    const inn = revised.getCurrentInnings()!;
    expect(inn.target).toBe(inn.revisedTarget);
  });

  test('gully mode: uses runs-per-over multiplier to revise target', () => {
    const e = setupSecondInnings(100);
    // 100 runs in 20 overs, cut to 15 overs, gully RPO = 8
    // lostOvers = 5, adjustedTarget = 100 - 5*8 + 1 = 61
    const revised = e.applyDLS(15, 'gully', 8);
    const inn = revised.getCurrentInnings()!;
    expect(inn.dlsMode).toBe('gully');
    expect(inn.dlsGullyRunsPerOver).toBe(8);
    expect(inn.revisedTarget).toBe(61);
  });

  test('gully mode minimum target is 1', () => {
    const e = setupSecondInnings(10);
    // Extreme cut: target would go negative → clamped to 1
    const revised = e.applyDLS(1, 'gully', 100);
    expect(revised.getCurrentInnings()!.revisedTarget).toBe(1);
  });

  test('throws when applied to a Test match', () => {
    const t1 = makeTeam('t1', 'A', 'A');
    const t2 = makeTeam('t2', 'B', 'B');
    let e = startMatch(t1, t2, makeConfig('test'), 't1', 't2', 't1_p1', 't1_p2', 't2_p6');
    e = e.declareInnings();
    e = e.startNextInnings();
    e = e.setOpeners('t2_p1', 't2_p2');
    e = e.setBowler('t1_p6');
    expect(() => e.applyDLS(10)).toThrow('Test matches');
  });

  test('throws when applied to 1st innings', () => {
    const t1 = makeTeam('t1', 'A', 'A');
    const t2 = makeTeam('t2', 'B', 'B');
    const e = startMatch(t1, t2, makeConfig('t20'), 't1', 't2', 't1_p1', 't1_p2', 't2_p6');
    expect(() => e.applyDLS(10)).toThrow('2nd innings');
  });

  test('throws when gully mode is used without RPO', () => {
    const e = setupSecondInnings(100);
    expect(() => e.applyDLS(15, 'gully')).toThrow('runs-per-over');
  });

  test('throws when gully RPO is zero or negative', () => {
    const e = setupSecondInnings(100);
    expect(() => e.applyDLS(15, 'gully', 0)).toThrow('runs-per-over');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. retireBatter (engine method)
// ─────────────────────────────────────────────────────────────────────────────

describe('retireBatter (engine method)', () => {
  function setup() {
    const t1 = makeTeam('t1', 'A', 'A');
    const t2 = makeTeam('t2', 'B', 'B');
    return startMatch(t1, t2, makeConfig('t20'), 't1', 't2', 't1_p1', 't1_p2', 't2_p6');
  }

  test('retired_hurt: does NOT count as a wicket', () => {
    const e = setup().retireBatter('t1_p1', 'retired_hurt');
    expect(e.getCurrentInnings()!.totalWickets).toBe(0);
  });

  test('retired_hurt: batter is marked as dismissed with retired_hurt type', () => {
    const e = setup().retireBatter('t1_p1', 'retired_hurt');
    const batter = e.getCurrentInnings()!.batters.find(b => b.playerId === 't1_p1')!;
    expect(batter.dismissal?.type).toBe('retired_hurt');
  });

  test('retired_hurt: does NOT record a fall of wicket', () => {
    const e = setup().retireBatter('t1_p1', 'retired_hurt');
    expect(e.getCurrentInnings()!.fallOfWickets).toHaveLength(0);
  });

  test('retired_hurt: striker slot is cleared when striker retires', () => {
    const e = setup().retireBatter('t1_p1', 'retired_hurt');
    expect(e.getCurrentInnings()!.currentStrikerId).toBeNull();
  });

  test('retired_hurt: non-striker slot is cleared when non-striker retires', () => {
    const e = setup().retireBatter('t1_p2', 'retired_hurt');
    expect(e.getCurrentInnings()!.currentNonStrikerId).toBeNull();
  });

  test('retired_out: counts as a wicket', () => {
    const e = setup().retireBatter('t1_p1', 'retired_out');
    expect(e.getCurrentInnings()!.totalWickets).toBe(1);
  });

  test('retired_out: records a fall of wicket', () => {
    const e = setup().retireBatter('t1_p1', 'retired_out');
    const fow = e.getCurrentInnings()!.fallOfWickets;
    expect(fow).toHaveLength(1);
    expect(fow[0].playerId).toBe('t1_p1');
    expect(fow[0].dismissal.type).toBe('retired_out');
  });

  test('retired batter isOnStrike is cleared', () => {
    const e = setup().retireBatter('t1_p1', 'retired_hurt');
    const batter = e.getCurrentInnings()!.batters.find(b => b.playerId === 't1_p1')!;
    expect(batter.isOnStrike).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. swapStrike
// ─────────────────────────────────────────────────────────────────────────────

describe('swapStrike', () => {
  test('swapping makes non-striker the new striker', () => {
    const t1 = makeTeam('t1', 'A', 'A');
    const t2 = makeTeam('t2', 'B', 'B');
    let e = startMatch(t1, t2, makeConfig('t20'), 't1', 't2', 't1_p1', 't1_p2', 't2_p6');
    // p1 is striker, p2 is non-striker
    expect(e.getStriker()!.playerId).toBe('t1_p1');
    e = e.swapStrike();
    expect(e.getStriker()!.playerId).toBe('t1_p2');
    expect(e.getNonStriker()!.playerId).toBe('t1_p1');
  });

  test('swapping twice restores original strike positions', () => {
    const t1 = makeTeam('t1', 'A', 'A');
    const t2 = makeTeam('t2', 'B', 'B');
    let e = startMatch(t1, t2, makeConfig('t20'), 't1', 't2', 't1_p1', 't1_p2', 't2_p6');
    e = e.swapStrike();
    e = e.swapStrike();
    expect(e.getStriker()!.playerId).toBe('t1_p1');
  });

  test('batter isOnStrike flags updated after swap', () => {
    const t1 = makeTeam('t1', 'A', 'A');
    const t2 = makeTeam('t2', 'B', 'B');
    let e = startMatch(t1, t2, makeConfig('t20'), 't1', 't2', 't1_p1', 't1_p2', 't2_p6');
    e = e.swapStrike();
    const batters = e.getCurrentInnings()!.batters;
    const p1 = batters.find(b => b.playerId === 't1_p1')!;
    const p2 = batters.find(b => b.playerId === 't1_p2')!;
    expect(p1.isOnStrike).toBe(false);
    expect(p2.isOnStrike).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Super Over
// ─────────────────────────────────────────────────────────────────────────────

describe('Super Over', () => {
  /**
   * Create a tied 1-over custom match. Team1 bats first and scores `t1Runs`,
   * team2 chases and scores exactly `t1Runs` — tie.
   * Returns the engine after the tie is established.
   */
  function buildTiedMatch(t1Runs: number, t2Runs: number): MatchEngine {
    const t1 = makeTeam('t1', 'Alpha', 'ALP');
    const t2 = makeTeam('t2', 'Beta', 'BET');
    // 1-over format: both innings complete in 6 balls
    const config: MatchConfig = {
      format: 'custom', oversPerInnings: 1, maxInnings: 2, playersPerSide: 11,
      powerplays: [], followOnMinimum: null, wideRuns: 1, noBallRuns: 1,
    };
    // Inn1: team1 bats
    let e = startMatch(t1, t2, config, 't1', 't2', 't1_p1', 't1_p2', 't2_p6');
    let scored = 0;
    for (let i = 0; i < 6; i++) {
      if (scored < t1Runs) { e = e.recordBall(S1); scored++; }
      else { e = e.recordBall(DOT); }
    }
    // Inn2: team2 bats, target = t1Runs + 1
    e = e.startNextInnings();
    e = e.setOpeners('t2_p1', 't2_p2');
    e = e.setBowler('t1_p6');
    scored = 0;
    for (let i = 0; i < 6; i++) {
      if (scored < t2Runs) { e = e.recordBall(S1); scored++; }
      else { e = e.recordBall(DOT); }
    }
    return e;
  }

  // ── Setup helpers ──

  /**
   * Play a super over where SO1 scores `so1Score` singles then dots,
   * then returns engine ready for SO2 setup.
   */
  function playSO1(e: MatchEngine, so1Score: number): MatchEngine {
    // SO1: team2 bats (batted second in main), team1 bowls
    e = e.startSuperOver();
    e = e.setOpeners('t2_p1', 't2_p2');
    e = e.setBowler('t1_p7'); // different from the bowler used in main inn2
    let scored = 0;
    for (let i = 0; i < 6; i++) {
      if (scored < so1Score) { e = e.recordBall(S1); scored++; }
      else { e = e.recordBall(DOT); }
    }
    // After 6 balls, SO1 is complete (oversLimit = 1)
    return e;
  }

  test('startSuperOver creates a new super-over innings', () => {
    const e = buildTiedMatch(3, 3);
    expect(e.getMatch().result).toBe('Match Tied');
    const eSO = e.startSuperOver();
    const inn = eSO.getCurrentInnings()!;
    expect(inn.isSuperOver).toBe(true);
    expect(eSO.getMatch().superOver).toBe(true);
  });

  test('startSuperOver: team that batted second in main match bats first in super over', () => {
    // t1 batted first in main → t2 bats first in super over
    const e = buildTiedMatch(3, 3);
    const eSO = e.startSuperOver();
    expect(eSO.getCurrentInnings()!.battingTeamId).toBe('t2');
    expect(eSO.getCurrentInnings()!.bowlingTeamId).toBe('t1');
  });

  test('startSuperOver throws if match is not tied', () => {
    // If team2 chases and scores more, it's a win not a tie
    const t1 = makeTeam('t1', 'Alpha', 'ALP');
    const t2 = makeTeam('t2', 'Beta', 'BET');
    const config: MatchConfig = {
      format: 'custom', oversPerInnings: 1, maxInnings: 2, playersPerSide: 11,
      powerplays: [], followOnMinimum: null, wideRuns: 1, noBallRuns: 1,
    };
    let e = startMatch(t1, t2, config, 't1', 't2', 't1_p1', 't1_p2', 't2_p6');
    // Team1 scores 3, team2 will score 4 (win by wickets)
    for (let i = 0; i < 3; i++) e = e.recordBall(S1);
    for (let i = 0; i < 3; i++) e = e.recordBall(DOT);
    e = e.startNextInnings();
    e = e.setOpeners('t2_p1', 't2_p2');
    e = e.setBowler('t1_p6');
    for (let i = 0; i < 4; i++) e = e.recordBall(S1); // team2 wins
    expect(e.getMatch().result).toContain('won');
    expect(() => e.startSuperOver()).toThrow();
  });

  test('startSuperOver throws for a Test match (maxInnings !== 2)', () => {
    // Construct a MatchEngine whose match already has result='Match Tied'
    // but format is 'test' (maxInnings=4) so the LOI guard fires.
    const t1 = makeTeam('t1', 'A', 'A');
    const t2 = makeTeam('t2', 'B', 'B');
    const config: MatchConfig = {
      format: 'test', oversPerInnings: null, maxInnings: 4,
      playersPerSide: 11, powerplays: [], followOnMinimum: 200, wideRuns: 1, noBallRuns: 1,
    };
    const rawMatch = createNewMatch('m1', config, t1, t2,
      t1.players.map(p => p.id), t2.players.map(p => p.id), 'G', 0);
    const tiedMatch = { ...rawMatch, result: 'Match Tied' as const };
    const fakeEngine = new MatchEngine(tiedMatch);
    expect(() => fakeEngine.startSuperOver()).toThrow('limited overs');
  });

  test('super over innings 1 completes after 6 balls (1-over limit)', () => {
    const e = buildTiedMatch(3, 3);
    const eSO = playSO1(e, 3);
    // After 6 balls, SO1 must be completed
    const soInnings = eSO.getMatch().innings.filter(i => i.isSuperOver);
    expect(soInnings).toHaveLength(1);
    expect(soInnings[0].status).toBe('completed');
  });

  test('super over innings 1 completes after 2 wickets (wicket limit)', () => {
    const e = buildTiedMatch(3, 3);
    let eSO = e.startSuperOver();
    eSO = eSO.setOpeners('t2_p1', 't2_p2');
    eSO = eSO.setBowler('t1_p7');
    // Take 2 wickets — SO ends regardless of ball count
    eSO = eSO.recordBall(BOWLED());
    eSO = eSO.setNewBatter('t2_p3');
    eSO = eSO.recordBall(BOWLED());
    // 2 wickets = max for super over → completed
    expect(eSO.getCurrentInnings()!.status).toBe('completed');
  });

  test('startNextInnings sets correct target for SO innings 2', () => {
    const e = buildTiedMatch(3, 3);
    let eSO = playSO1(e, 4); // SO1 team2 scores 4
    eSO = eSO.startNextInnings();
    expect(eSO.getCurrentInnings()!.target).toBe(5); // 4 + 1
    expect(eSO.getCurrentInnings()!.battingTeamId).toBe('t1');
  });

  test('super over: SO2 team wins by wickets when target reached', () => {
    const e = buildTiedMatch(3, 3);
    // SO1: team2 scores 4
    let eSO = playSO1(e, 4);
    // SO2: team1 bats, target = 5, scores 5 (wins by wickets)
    eSO = eSO.startNextInnings();
    eSO = eSO.setOpeners('t1_p1', 't1_p2');
    eSO = eSO.setBowler('t2_p7');
    for (let i = 0; i < 5; i++) eSO = eSO.recordBall(S1);
    expect(eSO.getMatch().result).toContain('won Super Over');
    expect(eSO.getMatch().result).toContain('wicket');
    expect(eSO.getMatch().result).toContain('Alpha');
  });

  test('super over: SO1 team wins when SO2 does not reach target', () => {
    const e = buildTiedMatch(3, 3);
    // SO1: team2 scores 5
    let eSO = playSO1(e, 5);
    // SO2: team1 bats, target = 6, scores only 3 then dots → overs exhausted
    eSO = eSO.startNextInnings();
    eSO = eSO.setOpeners('t1_p1', 't1_p2');
    eSO = eSO.setBowler('t2_p7');
    let scored = 0;
    for (let i = 0; i < 6; i++) {
      if (scored < 3) { eSO = eSO.recordBall(S1); scored++; }
      else { eSO = eSO.recordBall(DOT); }
    }
    expect(eSO.getMatch().result).toContain('won Super Over by 2 runs');
    expect(eSO.getMatch().result).toContain('Beta'); // team2 (t2) batted in SO1
  });

  test('super over tied when both teams score equally', () => {
    const e = buildTiedMatch(3, 3);
    // SO1: team2 scores 3
    let eSO = playSO1(e, 3);
    // SO2: team1 bats, target = 4, scores 3 (tie)
    eSO = eSO.startNextInnings();
    eSO = eSO.setOpeners('t1_p1', 't1_p2');
    eSO = eSO.setBowler('t2_p7');
    let scored = 0;
    for (let i = 0; i < 6; i++) {
      if (scored < 3) { eSO = eSO.recordBall(S1); scored++; }
      else { eSO = eSO.recordBall(DOT); }
    }
    expect(eSO.getMatch().result).toBe('Super Over Tied');
  });

  test('startNextInnings throws if super over already has 2 innings', () => {
    const e = buildTiedMatch(3, 3);
    let eSO = playSO1(e, 3);
    eSO = eSO.startNextInnings();
    eSO = eSO.setOpeners('t1_p1', 't1_p2');
    eSO = eSO.setBowler('t2_p7');
    // Play SO2 to completion
    for (let i = 0; i < 6; i++) eSO = eSO.recordBall(DOT);
    // Both SO innings are complete — cannot start a third SO innings
    expect(() => eSO.startNextInnings()).toThrow('Super over already complete');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Test match completion
// ─────────────────────────────────────────────────────────────────────────────

describe('Test match completion', () => {
  /**
   * Play all 4 innings of a Test match using a 3-player squad (2 wickets = all out).
   * Innings 1-3 are declared at zero runs; innings 4 scores `inn4Runs` then goes all-out.
   * Pass optional run totals for each innings via the runs array: [inn1, inn2, inn3, inn4].
   *
   * All run totals must be ≤ 5 (one bowler can bowl the whole innings with < 6 legal balls,
   * so no over-rotation is needed).
   */
  function playTestMatch(inn1Runs: number, inn2Runs: number, inn3Runs: number, inn4Runs: number): MatchEngine {
    const t1 = makeTeam('t1', 'Alpha', 'ALP', 3); // p1, p2, p3
    const t2 = makeTeam('t2', 'Beta', 'BET', 3);
    const config: MatchConfig = {
      format: 'test', oversPerInnings: null, maxInnings: 4,
      playersPerSide: 3, powerplays: [], followOnMinimum: 2, wideRuns: 1, noBallRuns: 1,
    };

    // Helper: score N singles in current innings, then declare
    function scoreAndDeclare(e: MatchEngine, runs: number): MatchEngine {
      for (let i = 0; i < runs; i++) e = e.recordBall(S1);
      return e.declareInnings();
    }

    // Helper: score N singles, then take 2 wickets (all-out).
    // If the innings ends early (target reached during run-scoring), returns immediately.
    function scoreAndAllOut(e: MatchEngine, runs: number): MatchEngine {
      for (let i = 0; i < runs; i++) {
        if (e.getCurrentInnings()?.status !== 'in_progress') return e;
        e = e.recordBall(S1);
      }
      // Target may have been reached during run-scoring — check before taking wickets
      if (e.getCurrentInnings()?.status !== 'in_progress') return e;
      // Wicket 1: dismiss striker, bring in p3
      e = e.recordBall(BOWLED());
      const battingTeam = e.getMatch().innings[3].battingTeamId;
      e = e.setNewBatter(battingTeam === 't2' ? 't2_p3' : 't1_p3');
      // Wicket 2: all-out (innings completes automatically)
      if (e.getCurrentInnings()?.currentBowlerId === null) {
        const bowlingTeam = e.getMatch().innings[3].bowlingTeamId;
        e = e.setBowler(bowlingTeam === 't1' ? 't1_p1' : 't2_p1');
      }
      e = e.recordBall(BOWLED());
      return e;
    }

    // Inn 1: t1 bats, t2 bowls
    let e = startMatch(t1, t2, config, 't1', 't2', 't1_p1', 't1_p2', 't2_p1');
    e = scoreAndDeclare(e, inn1Runs);

    // Inn 2: t2 bats, t1 bowls
    e = e.startNextInnings();
    e = e.setOpeners('t2_p1', 't2_p2');
    e = e.setBowler('t1_p1');
    e = scoreAndDeclare(e, inn2Runs);

    // Inn 3: t1 bats, t2 bowls
    e = e.startNextInnings();
    e = e.setOpeners('t1_p1', 't1_p2');
    e = e.setBowler('t2_p1');
    e = scoreAndDeclare(e, inn3Runs);

    // Inn 4: t2 bats, t1 bowls — must complete via all-out to trigger checkMatchCompletion
    e = e.startNextInnings();
    e = e.setOpeners('t2_p1', 't2_p2');
    e = e.setBowler('t1_p1');
    e = scoreAndAllOut(e, inn4Runs);

    return e;
  }

  test('team1 wins when their aggregate runs exceed team2', () => {
    // t1 total: 5 + 3 = 8, t2 total: 1 + 2 = 3 → t1 wins
    const e = playTestMatch(5, 1, 3, 2);
    expect(e.getMatch().status).toBe('completed');
    expect(e.getMatch().result).toContain('Alpha won');
  });

  test('team2 wins when their aggregate runs exceed team1', () => {
    // t1 total: 1 + 0 = 1, t2 total: 3 + 2 = 5 → t2 wins
    const e = playTestMatch(1, 3, 0, 2);
    expect(e.getMatch().status).toBe('completed');
    expect(e.getMatch().result).toContain('Beta won');
  });

  test('match is tied when aggregate runs are equal', () => {
    // t1: 3 + 2 = 5, t2: 4 + 1 = 5 → tie
    const e = playTestMatch(3, 4, 2, 1);
    expect(e.getMatch().status).toBe('completed');
    expect(e.getMatch().result).toBe('Match Tied');
  });

  test('startNextInnings throws when max innings (4) already reached', () => {
    const e = playTestMatch(2, 1, 2, 1);
    expect(e.getMatch().innings).toHaveLength(4);
    expect(() => e.startNextInnings()).toThrow('Maximum innings reached');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. canFollowOn
// ─────────────────────────────────────────────────────────────────────────────

describe('canFollowOn', () => {
  test('returns true when team2 first innings deficit meets the follow-on threshold', () => {
    const t1 = makeTeam('t1', 'A', 'A');
    const t2 = makeTeam('t2', 'B', 'B');
    const bowlers1 = ['t2_p6', 't2_p7', 't2_p8', 't2_p9', 't2_p10'];
    const bowlers2 = ['t1_p6', 't1_p7', 't1_p8', 't1_p9', 't1_p10'];
    // Test match follow-on threshold = 200
    let e = startMatch(t1, t2, makeConfig('test'), 't1', 't2', 't1_p1', 't1_p2', 't2_p6');
    // Team1 scores 300, declares
    for (let i = 0; i < 300; i++) {
      if (!e.getCurrentInnings()!.currentBowlerId) e = e.setBowler(pickNextBowler(e, bowlers1));
      e = e.recordBall(S1);
    }
    e = e.declareInnings();
    // Team2 scores 50, declares (deficit = 250 ≥ 200 → follow-on)
    e = e.startNextInnings();
    e = e.setOpeners('t2_p1', 't2_p2');
    e = e.setBowler('t1_p6');
    for (let i = 0; i < 50; i++) {
      if (!e.getCurrentInnings()!.currentBowlerId) e = e.setBowler(pickNextBowler(e, bowlers2));
      e = e.recordBall(S1);
    }
    e = e.declareInnings();
    expect(e.canFollowOn()).toBe(true);
  });

  test('returns false when deficit is less than follow-on threshold', () => {
    const t1 = makeTeam('t1', 'A', 'A');
    const t2 = makeTeam('t2', 'B', 'B');
    const bowlers1 = ['t2_p6', 't2_p7', 't2_p8', 't2_p9', 't2_p10'];
    const bowlers2 = ['t1_p6', 't1_p7', 't1_p8', 't1_p9', 't1_p10'];
    let e = startMatch(t1, t2, makeConfig('test'), 't1', 't2', 't1_p1', 't1_p2', 't2_p6');
    // Team1 scores 200, team2 scores 100 → deficit = 100 < 200 → no follow-on
    for (let i = 0; i < 200; i++) {
      if (!e.getCurrentInnings()!.currentBowlerId) e = e.setBowler(pickNextBowler(e, bowlers1));
      e = e.recordBall(S1);
    }
    e = e.declareInnings();
    e = e.startNextInnings();
    e = e.setOpeners('t2_p1', 't2_p2');
    e = e.setBowler('t1_p6');
    for (let i = 0; i < 100; i++) {
      if (!e.getCurrentInnings()!.currentBowlerId) e = e.setBowler(pickNextBowler(e, bowlers2));
      e = e.recordBall(S1);
    }
    e = e.declareInnings();
    expect(e.canFollowOn()).toBe(false);
  });

  test('returns false for a LOI (non-test) match', () => {
    const e = buildT20FirstInningsComplete();
    expect(e.canFollowOn()).toBe(false);
  });

  test('returns false when second innings is still in_progress', () => {
    const t1 = makeTeam('t1', 'A', 'A');
    const t2 = makeTeam('t2', 'B', 'B');
    const bowlers1 = ['t2_p6', 't2_p7', 't2_p8', 't2_p9', 't2_p10'];
    let e = startMatch(t1, t2, makeConfig('test'), 't1', 't2', 't1_p1', 't1_p2', 't2_p6');
    for (let i = 0; i < 300; i++) {
      if (!e.getCurrentInnings()!.currentBowlerId) e = e.setBowler(pickNextBowler(e, bowlers1));
      e = e.recordBall(S1);
    }
    e = e.declareInnings();
    e = e.startNextInnings();
    e = e.setOpeners('t2_p1', 't2_p2');
    e = e.setBowler('t1_p6');
    e = e.recordBall(S1); // Inn2 in_progress
    expect(e.canFollowOn()).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. Undo when match was completed
// ─────────────────────────────────────────────────────────────────────────────

describe('Undo when match was completed', () => {
  test('undoing the last ball of a won match resets match status to in_progress', () => {
    // First innings: 0 runs in 20 overs. Second innings: score 1 → instant win.
    const e1 = buildT20FirstInningsComplete();
    let e = e1.startNextInnings();
    e = e.setOpeners('t2_p1', 't2_p2');
    e = e.setBowler('t1_p6');
    e = e.recordBall(S1); // target was 1 → win
    expect(e.getMatch().status).toBe('completed');

    const undone = e.undoLastBall();
    expect(undone.getMatch().status).toBe('in_progress');
    expect(undone.getMatch().result).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. startNextInnings error — LOI max innings
// ─────────────────────────────────────────────────────────────────────────────

describe('startNextInnings error guards', () => {
  test('throws when trying to start a 3rd innings in a T20 match', () => {
    const e1 = buildT20FirstInningsComplete();
    let e = e1.startNextInnings();
    e = e.setOpeners('t2_p1', 't2_p2');
    e = e.setBowler('t1_p6');
    // Bowl 20 overs (all dots, team2 loses)
    const t1Pool = ['t1_p6', 't1_p7', 't1_p8', 't1_p9', 't1_p10'];
    e = bowlDots(e, 120, t1Pool);
    expect(e.getMatch().status).toBe('completed');
    // Attempt a 3rd innings in a 2-innings format
    expect(() => e.startNextInnings()).toThrow('Maximum innings reached');
  });

  test('throws when current innings is still in_progress', () => {
    const t1 = makeTeam('t1', 'A', 'A');
    const t2 = makeTeam('t2', 'B', 'B');
    const e = startMatch(t1, t2, makeConfig('t20'), 't1', 't2', 't1_p1', 't1_p2', 't2_p6');
    expect(() => e.startNextInnings()).toThrow('still in progress');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. declareInnings error guard
// ─────────────────────────────────────────────────────────────────────────────

describe('declareInnings', () => {
  test('throws when called on a non-test match', () => {
    const t1 = makeTeam('t1', 'A', 'A');
    const t2 = makeTeam('t2', 'B', 'B');
    const e = startMatch(t1, t2, makeConfig('t20'), 't1', 't2', 't1_p1', 't1_p2', 't2_p6');
    expect(() => e.declareInnings()).toThrow('Test matches');
  });
});
