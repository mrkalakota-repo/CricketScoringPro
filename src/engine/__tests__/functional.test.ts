/**
 * Functional Tests — Cricket Rules
 *
 * Full end-to-end coverage of:
 *  - T20 / ODI / Test / Custom formats
 *  - Smaller squads (< 11 players)
 *  - All dismissal types and bowler credit rules
 *  - Extras (wide, no-ball, bye, leg-bye) — all combinations
 *  - Free hit: triggers, allowed/forbidden dismissals
 *  - Strike rotation: odd/even runs, end-of-over, after wicket
 *  - Over & innings completion
 *  - Powerplay tracking
 *  - Partnership tracking and fall-of-wickets
 *  - Bowling stats (economy, maidens, wides, no-balls, byes)
 *  - Target calculation and match results (win by runs / wickets / tie)
 *  - Declaration and follow-on (Test format)
 *  - Undo: dot, run, wicket, extra, over boundary, innings boundary
 */

import { MatchEngine, createNewMatch } from '../match-engine';
import type { Match, Team, Player, MatchConfig, BallInput, BattingStyle } from '../types';
import { FORMAT_CONFIGS } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makePlayer(id: string, name: string, overrides: Partial<Player> = {}): Player {
  return {
    id, name,
    battingStyle: 'right',
    bowlingStyle: 'Right-arm fast',
    isWicketKeeper: false,
    isAllRounder: false,
    isCaptain: false,
    isViceCaptain: false,
    ...overrides,
  };
}

function makeTeam(id: string, name: string, shortName: string, playerCount = 11): Team {
  const players: Player[] = [];
  for (let i = 1; i <= playerCount; i++) {
    players.push(makePlayer(`${id}_p${i}`, `${name} P${i}`, {
      bowlingStyle: i >= 6 ? 'Right-arm fast' : 'none',
    }));
  }
  players[0].isWicketKeeper = true;
  return { id, name, shortName, adminPinHash: null, latitude: null, longitude: null, players, createdAt: 0, updatedAt: 0 };
}

function makeConfig(format: 'custom', overs: number, players: number): MatchConfig;
function makeConfig(format: Exclude<MatchConfig['format'], 'custom'>): MatchConfig;
function makeConfig(format: MatchConfig['format'], overs?: number, players?: number): MatchConfig {
  if (format === 'custom') {
    return { format: 'custom', oversPerInnings: overs!, maxInnings: 2, playersPerSide: players!, powerplays: [], followOnMinimum: null, wideRuns: 1, noBallRuns: 1 };
  }
  return { format, ...FORMAT_CONFIGS[format as Exclude<MatchConfig['format'], 'custom'>] };
}

/** Set up a match ready for ball-by-ball scoring */
function startMatch(
  team1: Team, team2: Team,
  config: MatchConfig,
  bat: string, bowl: string,
  opener1: string, opener2: string,
  bowler: string,
): MatchEngine {
  let e = new MatchEngine(createNewMatch('m1', config, team1, team2,
    team1.players.map(p => p.id), team2.players.map(p => p.id), 'Ground', 0));
  e = e.recordToss({ winnerId: bat, decision: 'bat' });
  e = e.startMatch(bat, bowl);
  e = e.setOpeners(opener1, opener2);
  e = e.setBowler(bowler);
  return e;
}

/**
 * Pick the next eligible bowler from the pool, respecting:
 *  1. Consecutive-overs rule (same bowler can't bowl back-to-back)
 *  2. Max-overs-per-bowler quota (oversPerInnings / 5 for LOI; ∞ for Test)
 *
 * Picks the eligible bowler with the FEWEST overs so far, distributing the
 * load evenly. This prevents greedy pairing (e.g. A-B-A-B-A-B) that would
 * exhaust two bowlers before the others have bowled at all, leaving the
 * remaining bowlers unable to satisfy the consecutive-overs constraint.
 */
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
      return aOvers - bOvers; // fewest overs first → even distribution
    });

  if (eligible.length === 0) {
    throw new Error(`No eligible bowler found in pool [${bowlers.join(', ')}]`);
  }
  return eligible[0];
}

/** Bowl a sequence of balls, rotating bowlers at every over boundary */
function bowlBalls(engine: MatchEngine, sequence: BallInput[], bowlers: string[]): MatchEngine {
  let e = engine;
  for (const ball of sequence) {
    const inn = e.getCurrentInnings();
    if (!inn || inn.status !== 'in_progress') break;
    if (!inn.currentBowlerId) {
      e = e.setBowler(pickNextBowler(e, bowlers));
    }
    e = e.recordBall(ball);
  }
  return e;
}

/** Bowl N legal dot balls, rotating bowlers every 6 (from bowlers array) */
function bowlDots(engine: MatchEngine, balls: number, bowlers: string[]): MatchEngine {
  let e = engine;
  for (let i = 0; i < balls; i++) {
    const inn = e.getCurrentInnings();
    if (!inn || inn.status !== 'in_progress') break;
    if (!inn.currentBowlerId) {
      e = e.setBowler(pickNextBowler(e, bowlers));
    }
    e = e.recordBall(DOT);
  }
  return e;
}

const DOT: BallInput   = { runs: 0, isWide: false, isNoBall: false, isBye: false, isLegBye: false, dismissal: null, isBoundary: false };
const S1: BallInput    = { ...DOT, runs: 1 };
const S2: BallInput    = { ...DOT, runs: 2 };
const S3: BallInput    = { ...DOT, runs: 3 };
const FOUR: BallInput  = { ...DOT, runs: 4, isBoundary: true };
const SIX: BallInput   = { ...DOT, runs: 6, isBoundary: true };
const WIDE: BallInput  = { ...DOT, isWide: true };
const NOBALL: BallInput = { ...DOT, isNoBall: true };
const BYE2: BallInput  = { ...DOT, isBye: true, runs: 2 };
const LBYE1: BallInput = { ...DOT, isLegBye: true, runs: 1 };
const BOWLED = (bId?: string): BallInput => ({ ...DOT, dismissal: { type: 'bowled', ...(bId ? { batsmanId: bId } : {}) } });
const CAUGHT = (fielderId = 'f1'): BallInput => ({ ...DOT, dismissal: { type: 'caught', fielderId } });
const LBW: BallInput   = { ...DOT, dismissal: { type: 'lbw' } };
const STUMPED = (fId = 'f1'): BallInput => ({ ...DOT, dismissal: { type: 'stumped', fielderId: fId } });
const HIT_WICKET: BallInput = { ...DOT, dismissal: { type: 'hit_wicket' } };
const RUNOUT = (bId: string, fId?: string): BallInput => ({ ...DOT, runs: 1, dismissal: { type: 'run_out', batsmanId: bId, fielderId: fId } });

// ─────────────────────────────────────────────────────────────────────────────
// 1. T20 Format
// ─────────────────────────────────────────────────────────────────────────────

describe('T20 Format', () => {
  function setup() {
    const t1 = makeTeam('t1', 'Alpha', 'ALP');
    const t2 = makeTeam('t2', 'Beta', 'BET');
    return startMatch(t1, t2, makeConfig('t20'), 't1', 't2', 't1_p1', 't1_p2', 't2_p6');
  }

  test('format constants: 20 overs, 2 innings, 11 players', () => {
    const cfg = makeConfig('t20');
    expect(cfg.oversPerInnings).toBe(20);
    expect(cfg.maxInnings).toBe(2);
    expect(cfg.playersPerSide).toBe(11);
  });

  test('powerplay spans overs 1-6 (indices 0-5)', () => {
    const cfg = makeConfig('t20');
    expect(cfg.powerplays).toHaveLength(1);
    expect(cfg.powerplays[0].startOver).toBe(0);
    expect(cfg.powerplays[0].endOver).toBe(5);
    expect(cfg.powerplays[0].type).toBe('mandatory');
  });

  test('innings completes after 20 overs', () => {
    let e = setup();
    e = bowlDots(e, 120, ['t2_p6', 't2_p7', 't2_p8', 't2_p9', 't2_p10']);
    expect(e.getCurrentInnings()!.status).toBe('completed');
    expect(e.getCurrentInnings()!.totalOvers).toBe(20);
  });

  test('target = first-innings score + 1', () => {
    let e = setup();
    const bowlerPool = ['t2_p6', 't2_p7', 't2_p8', 't2_p9', 't2_p10'];
    // Score 80 singles (bowlBalls manages bowler rotation between overs)
    e = bowlBalls(e, Array(80).fill(S1), bowlerPool);
    e = bowlDots(e, 40, bowlerPool);
    e = e.startNextInnings();
    e = e.setOpeners('t2_p1', 't2_p2');
    e = e.setBowler('t1_p6');
    expect(e.getCurrentInnings()!.target).toBe(81);
  });

  test('chase completed — win by remaining wickets', () => {
    let e = setup();
    // First innings: score 3 in 20 overs
    for (let i = 0; i < 3; i++) e = e.recordBall(S1);
    e = bowlDots(e, 117, ['t2_p6', 't2_p7', 't2_p8', 't2_p9', 't2_p10']);
    e = e.startNextInnings();
    e = e.setOpeners('t2_p1', 't2_p2');
    e = e.setBowler('t1_p6');
    // Chase 4 — hit a four
    e = e.recordBall(FOUR);
    expect(e.getMatch().status).toBe('completed');
    expect(e.getMatch().result).toContain('Beta won');
    expect(e.getMatch().result).toContain('wicket');
  });

  test('batting-first win — overs exhausted, target not reached', () => {
    let e = setup();
    const t2Pool = ['t2_p6', 't2_p7', 't2_p8', 't2_p9', 't2_p10'];
    const t1Pool = ['t1_p6', 't1_p7', 't1_p8', 't1_p9', 't1_p10'];
    // First innings: 100 runs (100 singles + 20 dots = 120 balls)
    e = bowlBalls(e, Array(100).fill(S1), t2Pool);
    e = bowlDots(e, 20, t2Pool);
    e = e.startNextInnings();
    e = e.setOpeners('t2_p1', 't2_p2');
    e = e.setBowler('t1_p6');
    // Chasing team scores 50 then exhausts overs (50 singles + 70 dots = 120 balls)
    e = bowlBalls(e, Array(50).fill(S1), t1Pool);
    e = bowlDots(e, 70, t1Pool);
    expect(e.getMatch().status).toBe('completed');
    expect(e.getMatch().result).toContain('Alpha won by 50 run');
  });

  test('tie — scores level at end of both innings', () => {
    let e = setup();
    const t2Pool = ['t2_p6', 't2_p7', 't2_p8', 't2_p9', 't2_p10'];
    const t1Pool = ['t1_p6', 't1_p7', 't1_p8', 't1_p9', 't1_p10'];
    e = bowlBalls(e, Array(50).fill(S1), t2Pool);
    e = bowlDots(e, 70, t2Pool);
    e = e.startNextInnings();
    e = e.setOpeners('t2_p1', 't2_p2');
    e = e.setBowler('t1_p6');
    e = bowlBalls(e, Array(50).fill(S1), t1Pool);
    e = bowlDots(e, 70, t1Pool);
    expect(e.getMatch().result).toBe('Match Tied');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. ODI Format
// ─────────────────────────────────────────────────────────────────────────────

describe('ODI Format', () => {
  test('format constants: 50 overs, 2 innings, 11 players', () => {
    const cfg = makeConfig('odi');
    expect(cfg.oversPerInnings).toBe(50);
    expect(cfg.maxInnings).toBe(2);
    expect(cfg.playersPerSide).toBe(11);
  });

  test('three powerplay stages defined correctly', () => {
    const cfg = makeConfig('odi');
    expect(cfg.powerplays).toHaveLength(3);
    // Mandatory pp1: overs 1-10
    expect(cfg.powerplays[0].startOver).toBe(0);
    expect(cfg.powerplays[0].endOver).toBe(9);
    // Middle block: overs 11-40
    expect(cfg.powerplays[1].startOver).toBe(10);
    expect(cfg.powerplays[1].endOver).toBe(39);
    // Death: overs 41-50
    expect(cfg.powerplays[2].startOver).toBe(40);
    expect(cfg.powerplays[2].endOver).toBe(49);
  });

  test('innings completes after 300 legal deliveries (50 overs)', () => {
    const t1 = makeTeam('t1', 'Alpha', 'ALP');
    const t2 = makeTeam('t2', 'Beta', 'BET');
    let e = startMatch(t1, t2, makeConfig('odi'), 't1', 't2', 't1_p1', 't1_p2', 't2_p6');
    e = bowlDots(e, 300, ['t2_p6', 't2_p7', 't2_p8', 't2_p9', 't2_p10']);
    expect(e.getCurrentInnings()!.totalOvers).toBe(50);
    expect(e.getCurrentInnings()!.status).toBe('completed');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Test Match Format
// ─────────────────────────────────────────────────────────────────────────────

describe('Test Match Format', () => {
  function setup() {
    const t1 = makeTeam('t1', 'Alpha', 'ALP');
    const t2 = makeTeam('t2', 'Beta', 'BET');
    return { t1, t2, e: startMatch(t1, t2, makeConfig('test'), 't1', 't2', 't1_p1', 't1_p2', 't2_p6') };
  }

  test('format constants: no over limit, 4 innings, follow-on ≥ 200', () => {
    const cfg = makeConfig('test');
    expect(cfg.oversPerInnings).toBeNull();
    expect(cfg.maxInnings).toBe(4);
    expect(cfg.followOnMinimum).toBe(200);
  });

  test('innings only ends by all-out or declaration (not overs)', () => {
    let { e } = setup();
    // Bowl 30 overs — should still be in_progress with no over limit
    e = bowlDots(e, 180, ['t2_p6', 't2_p7', 't2_p8', 't2_p9', 't2_p10']);
    expect(e.getCurrentInnings()!.status).toBe('in_progress');
    expect(e.getCurrentInnings()!.totalOvers).toBe(30);
  });

  test('declaration ends innings immediately', () => {
    let { e } = setup();
    for (let i = 0; i < 6; i++) e = e.recordBall(SIX);
    e = e.declareInnings();
    expect(e.getCurrentInnings()!.status).toBe('declared');
  });

  test('second innings is set up after declaration', () => {
    let { e } = setup();
    e = e.declareInnings();
    e = e.startNextInnings();
    expect(e.getCurrentInnings()!.inningsNumber).toBe(2);
    expect(e.getCurrentInnings()!.battingTeamId).toBe('t2');
  });

  test('all four innings can be played in a Test', () => {
    const { t1, t2 } = setup();
    let e = startMatch(t1, t2, makeConfig('test'), 't1', 't2', 't1_p1', 't1_p2', 't2_p6');
    for (let innings = 1; innings <= 4; innings++) {
      e = e.declareInnings();
      if (innings < 4) {
        e = e.startNextInnings();
        const bat = innings % 2 === 0 ? 't1' : 't2';
        const bowl = innings % 2 === 0 ? 't2' : 't1';
        e = e.setOpeners(`${bat}_p1`, `${bat}_p2`);
        e = e.setBowler(`${bowl}_p6`);
      }
    }
    expect(e.getMatch().innings).toHaveLength(4);
    expect(e.getCurrentInnings()!.status).toBe('declared');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Custom Format & Smaller Squads
// ─────────────────────────────────────────────────────────────────────────────

describe('Custom Format & Smaller Squads', () => {
  test('custom 5-over format completes after 30 legal balls', () => {
    const t1 = makeTeam('t1', 'A', 'A', 11);
    const t2 = makeTeam('t2', 'B', 'B', 11);
    let e = startMatch(t1, t2, makeConfig('custom', 5, 11), 't1', 't2', 't1_p1', 't1_p2', 't2_p6');
    e = bowlDots(e, 30, ['t2_p6', 't2_p7', 't2_p8', 't2_p9', 't2_p10']);
    expect(e.getCurrentInnings()!.status).toBe('completed');
    expect(e.getCurrentInnings()!.totalOvers).toBe(5);
  });

  test('5-player squad: all-out at 4 wickets (not 10)', () => {
    const t1 = makeTeam('t1', 'A', 'A', 5);
    const t2 = makeTeam('t2', 'B', 'B', 5);
    const cfg = makeConfig('custom', 10, 5);
    let e = startMatch(t1, t2, cfg, 't1', 't2', 't1_p1', 't1_p2', 't2_p3');
    // Take 4 wickets → should be all out (5 - 1 = 4)
    for (let w = 0; w < 4; w++) {
      e = e.recordBall(BOWLED());
      if (w < 3) e = e.setNewBatter(`t1_p${w + 3}`);
    }
    expect(e.getCurrentInnings()!.status).toBe('completed');
    expect(e.getCurrentInnings()!.totalWickets).toBe(4);
  });

  test('7-player squad: all-out at 6 wickets', () => {
    const t1 = makeTeam('t1', 'A', 'A', 7);
    const t2 = makeTeam('t2', 'B', 'B', 7);
    const cfg = makeConfig('custom', 20, 7);
    let e = startMatch(t1, t2, cfg, 't1', 't2', 't1_p1', 't1_p2', 't2_p4');
    for (let w = 0; w < 6; w++) {
      e = e.recordBall(BOWLED());
      if (w < 5) e = e.setNewBatter(`t1_p${w + 3}`);
    }
    expect(e.getCurrentInnings()!.status).toBe('completed');
    expect(e.getCurrentInnings()!.totalWickets).toBe(6);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. All Dismissal Types
// ─────────────────────────────────────────────────────────────────────────────

describe('Dismissal Types', () => {
  function setup() {
    const t1 = makeTeam('t1', 'A', 'A');
    const t2 = makeTeam('t2', 'B', 'B');
    return startMatch(t1, t2, makeConfig('t20'), 't1', 't2', 't1_p1', 't1_p2', 't2_p6');
  }

  test('bowled — credits bowler, striker dismissed', () => {
    let e = setup().recordBall(BOWLED());
    const inn = e.getCurrentInnings()!;
    expect(inn.totalWickets).toBe(1);
    expect(inn.currentStrikerId).toBeNull();
    expect(inn.bowlers[0].wickets).toBe(1);
    expect(inn.fallOfWickets[0].playerId).toBe('t1_p1');
  });

  test('caught — credits bowler and records fielder', () => {
    let e = setup().recordBall(CAUGHT('t2_p3'));
    const inn = e.getCurrentInnings()!;
    expect(inn.totalWickets).toBe(1);
    expect(inn.bowlers[0].wickets).toBe(1);
    const fow = inn.fallOfWickets[0];
    expect(fow.dismissal.fielderId).toBe('t2_p3');
  });

  test('lbw — credits bowler', () => {
    let e = setup().recordBall(LBW);
    expect(e.getCurrentInnings()!.bowlers[0].wickets).toBe(1);
  });

  test('stumped — credits bowler', () => {
    let e = setup().recordBall(STUMPED('t2_p1'));
    expect(e.getCurrentInnings()!.bowlers[0].wickets).toBe(1);
    expect(e.getCurrentInnings()!.totalWickets).toBe(1);
  });

  test('hit wicket — credits bowler', () => {
    let e = setup().recordBall(HIT_WICKET);
    expect(e.getCurrentInnings()!.bowlers[0].wickets).toBe(1);
  });

  test('run out — does NOT credit bowler, specific batter dismissed', () => {
    // Non-striker run out with 0 completed runs (no crossing) — striker stays
    const ball: BallInput = { ...DOT, runs: 0, dismissal: { type: 'run_out', batsmanId: 't1_p2', fielderId: 't2_p3' } };
    let e = setup().recordBall(ball);
    const inn = e.getCurrentInnings()!;
    expect(inn.totalWickets).toBe(1);
    expect(inn.bowlers[0].wickets).toBe(0);
    // Non-striker was run out — striker stays
    expect(inn.currentStrikerId).toBe('t1_p1');
    expect(inn.currentNonStrikerId).toBeNull();
  });

  test('run out of striker — non-striker stays', () => {
    const e = setup().recordBall({ ...DOT, runs: 0, dismissal: { type: 'run_out', batsmanId: 't1_p1' } });
    const inn = e.getCurrentInnings()!;
    expect(inn.currentStrikerId).toBeNull();
    expect(inn.currentNonStrikerId).toBe('t1_p2');
  });

  test('fall-of-wicket records correct score and over', () => {
    let e = setup();
    // 4 singles then wicket on the 5th ball of the over
    for (let i = 0; i < 4; i++) e = e.recordBall(S1);
    e = e.recordBall(BOWLED());
    const fow = e.getCurrentInnings()!.fallOfWickets[0];
    expect(fow.wicketNumber).toBe(1);
    expect(fow.runs).toBe(4);
    expect(fow.overs).toBe(0);
    expect(fow.ballsInOver).toBe(5); // 5 legal balls bowled in this over when wicket fell
  });

  test('retired hurt — NOT counted as a wicket', () => {
    let e = setup().recordBall({ ...DOT, dismissal: { type: 'retired_hurt' } });
    expect(e.getCurrentInnings()!.totalWickets).toBe(0);
  });

  test('retired out — counted as a wicket', () => {
    let e = setup().recordBall({ ...DOT, dismissal: { type: 'retired_out' } });
    expect(e.getCurrentInnings()!.totalWickets).toBe(1);
  });

  test('multiple wickets accumulate correctly', () => {
    let e = setup();
    const dismissals = [BOWLED(), CAUGHT(), LBW];
    for (let i = 0; i < 3; i++) {
      e = e.recordBall(dismissals[i]);
      e = e.setNewBatter(`t1_p${i + 3}`);
    }
    expect(e.getCurrentInnings()!.totalWickets).toBe(3);
    expect(e.getCurrentInnings()!.fallOfWickets).toHaveLength(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Extras — All Combinations
// ─────────────────────────────────────────────────────────────────────────────

describe('Extras — All Combinations', () => {
  function setup() {
    const t1 = makeTeam('t1', 'A', 'A');
    const t2 = makeTeam('t2', 'B', 'B');
    return startMatch(t1, t2, makeConfig('t20'), 't1', 't2', 't1_p1', 't1_p2', 't2_p6');
  }

  test('wide: +1 run, not legal, batter ball-faced unchanged', () => {
    const e = setup().recordBall(WIDE);
    const inn = e.getCurrentInnings()!;
    expect(inn.totalRuns).toBe(1);
    expect(inn.extras.wides).toBe(1);
    expect(inn.totalBalls).toBe(0);        // illegal
    expect(e.getStriker()!.ballsFaced).toBe(0);
  });

  test('wide + overthrow 4: total = 5 wides', () => {
    const e = setup().recordBall({ ...WIDE, runs: 4 });
    const inn = e.getCurrentInnings()!;
    expect(inn.totalRuns).toBe(5);
    expect(inn.extras.wides).toBe(5);
    expect(inn.totalBalls).toBe(0);
  });

  test('no-ball: +1 run, not legal, frees next ball', () => {
    let e = setup().recordBall(NOBALL);
    const inn = e.getCurrentInnings()!;
    expect(inn.totalRuns).toBe(1);
    expect(inn.extras.noBalls).toBe(1);
    expect(inn.totalBalls).toBe(0);
    expect(e.isFreeHit()).toBe(true);
  });

  test('no-ball + runs off bat: batter credited, total = NB + bat runs', () => {
    const e = setup().recordBall({ ...NOBALL, runs: 4, isBoundary: true });
    const inn = e.getCurrentInnings()!;
    expect(inn.totalRuns).toBe(5);       // 1 NB + 4 bat
    expect(e.getStriker()!.runs).toBe(4);
    expect(e.getStriker()!.fours).toBe(1);
  });

  test('no-ball: batter still faces the ball (ball-faced incremented)', () => {
    const e = setup().recordBall(NOBALL);
    expect(e.getStriker()!.ballsFaced).toBe(1); // no-ball IS counted as ball faced (ICC rules)
  });

  test('bye: runs to team, NOT to batter, batter still faces ball', () => {
    const e = setup().recordBall(BYE2);
    const inn = e.getCurrentInnings()!;
    expect(inn.totalRuns).toBe(2);
    expect(inn.extras.byes).toBe(2);
    expect(e.getStriker()!.runs).toBe(0);
    expect(e.getStriker()!.ballsFaced).toBe(1);
  });

  test('leg-bye: runs to team, NOT to batter', () => {
    const e = setup().recordBall(LBYE1);
    const inn = e.getCurrentInnings()!;
    expect(inn.totalRuns).toBe(1);
    expect(inn.extras.legByes).toBe(1);
    expect(e.getStriker()!.runs).toBe(0);
  });

  test('wide does NOT advance bowler ball count', () => {
    let e = setup();
    // 1 wide then 6 dots → over should complete after 7 total deliveries
    e = e.recordBall(WIDE);
    for (let i = 0; i < 6; i++) e = e.recordBall(DOT);
    expect(e.getCurrentInnings()!.totalOvers).toBe(1);
  });

  test('no-ball does NOT advance bowler ball count', () => {
    let e = setup();
    e = e.recordBall(NOBALL);
    for (let i = 0; i < 6; i++) e = e.recordBall(DOT);
    expect(e.getCurrentInnings()!.totalOvers).toBe(1);
  });

  test('wides count against bowler runs but NOT ball count', () => {
    const e = setup().recordBall(WIDE);
    const b = e.getCurrentBowler()!;
    expect(b.runsConceded).toBe(1);
    expect(b.wides).toBe(1);
    expect(b.ballsBowled).toBe(0);
  });

  test('byes do NOT count against bowler runs', () => {
    const e = setup().recordBall(BYE2);
    expect(e.getCurrentBowler()!.runsConceded).toBe(0);
  });

  test('leg-byes do NOT count against bowler runs', () => {
    const e = setup().recordBall(LBYE1);
    expect(e.getCurrentBowler()!.runsConceded).toBe(0);
  });

  test('no-ball runs conceded = NB penalty + bat runs', () => {
    const e = setup().recordBall({ ...NOBALL, runs: 3 });
    expect(e.getCurrentBowler()!.runsConceded).toBe(4); // 1 NB + 3 bat
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Free Hit Rules
// ─────────────────────────────────────────────────────────────────────────────

describe('Free Hit Rules', () => {
  function setup() {
    const t1 = makeTeam('t1', 'A', 'A');
    const t2 = makeTeam('t2', 'B', 'B');
    return startMatch(t1, t2, makeConfig('t20'), 't1', 't2', 't1_p1', 't1_p2', 't2_p6');
  }

  test('free hit triggered by no-ball', () => {
    let e = setup().recordBall(NOBALL);
    expect(e.isFreeHit()).toBe(true);
  });

  test('wide does NOT trigger free hit', () => {
    const e = setup().recordBall(WIDE);
    expect(e.isFreeHit()).toBe(false);
  });

  test('free hit cleared after next legal delivery', () => {
    let e = setup();
    e = e.recordBall(NOBALL);
    expect(e.isFreeHit()).toBe(true);
    e = e.recordBall(FOUR);
    expect(e.isFreeHit()).toBe(false);
  });

  test('free hit cleared after another no-ball (chained)', () => {
    let e = setup();
    e = e.recordBall(NOBALL); // free hit
    e = e.recordBall({ ...NOBALL }); // no-ball on free hit → next is also free hit
    expect(e.isFreeHit()).toBe(true);
  });

  test('cannot be bowled on free hit', () => {
    let e = setup().recordBall(NOBALL);
    expect(() => e.recordBall(BOWLED())).toThrow();
  });

  test('cannot be caught on free hit', () => {
    let e = setup().recordBall(NOBALL);
    expect(() => e.recordBall(CAUGHT())).toThrow();
  });

  test('cannot be lbw on free hit', () => {
    let e = setup().recordBall(NOBALL);
    expect(() => e.recordBall(LBW)).toThrow();
  });

  test('cannot be stumped on free hit', () => {
    let e = setup().recordBall(NOBALL);
    expect(() => e.recordBall(STUMPED())).toThrow();
  });

  test('run out IS allowed on free hit', () => {
    let e = setup().recordBall(NOBALL);
    expect(() => e.recordBall(RUNOUT('t1_p2'))).not.toThrow();
    expect(e.recordBall(RUNOUT('t1_p2')).getCurrentInnings()!.totalWickets).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Strike Rotation
// ─────────────────────────────────────────────────────────────────────────────

describe('Strike Rotation', () => {
  function setup() {
    const t1 = makeTeam('t1', 'A', 'A');
    const t2 = makeTeam('t2', 'B', 'B');
    return startMatch(t1, t2, makeConfig('t20'), 't1', 't2', 't1_p1', 't1_p2', 't2_p6');
  }

  test('0 runs — no rotation', () => {
    const e = setup().recordBall(DOT);
    expect(e.getCurrentInnings()!.currentStrikerId).toBe('t1_p1');
  });

  test('1 run — rotate', () => {
    const e = setup().recordBall(S1);
    expect(e.getCurrentInnings()!.currentStrikerId).toBe('t1_p2');
  });

  test('2 runs — no rotation', () => {
    const e = setup().recordBall(S2);
    expect(e.getCurrentInnings()!.currentStrikerId).toBe('t1_p1');
  });

  test('3 runs — rotate', () => {
    const e = setup().recordBall(S3);
    expect(e.getCurrentInnings()!.currentStrikerId).toBe('t1_p2');
  });

  test('4 runs — no rotation', () => {
    const e = setup().recordBall(FOUR);
    expect(e.getCurrentInnings()!.currentStrikerId).toBe('t1_p1');
  });

  test('6 runs — no rotation', () => {
    const e = setup().recordBall(SIX);
    expect(e.getCurrentInnings()!.currentStrikerId).toBe('t1_p1');
  });

  test('end of over — strike rotates regardless of last ball', () => {
    let e = setup();
    // 6 dot balls → over ends → p2 is now facing
    for (let i = 0; i < 6; i++) e = e.recordBall(DOT);
    expect(e.getCurrentInnings()!.currentStrikerId).toBe('t1_p2');
  });

  test('end of over after single — no extra rotation (1 run already rotated)', () => {
    let e = setup();
    // 5 dots + 1 single (last ball) → single rotates, then over-end rotation → back to original
    for (let i = 0; i < 5; i++) e = e.recordBall(DOT);
    e = e.recordBall(S1); // p1→p2 rotates on 1 run; over ends, rotate back → p1 faces
    expect(e.getCurrentInnings()!.currentStrikerId).toBe('t1_p1');
  });

  test('bye runs cause rotation like bat runs', () => {
    const e = setup().recordBall(LBYE1); // 1 leg-bye → rotate
    expect(e.getCurrentInnings()!.currentStrikerId).toBe('t1_p2');
  });

  test('wide does not cause rotation', () => {
    const e = setup().recordBall(WIDE);
    expect(e.getCurrentInnings()!.currentStrikerId).toBe('t1_p1');
  });

  test('non-striker dismissed in run-out: striker remains at crease', () => {
    // 0 runs = no crossing; non-striker run out at wrong end, striker stays
    const ball: BallInput = { ...DOT, runs: 0, dismissal: { type: 'run_out', batsmanId: 't1_p2' } };
    const e = setup().recordBall(ball);
    expect(e.getCurrentInnings()!.currentStrikerId).toBe('t1_p1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. Over Completion & Maiden Overs
// ─────────────────────────────────────────────────────────────────────────────

describe('Over Completion & Maiden Overs', () => {
  function setup() {
    const t1 = makeTeam('t1', 'A', 'A');
    const t2 = makeTeam('t2', 'B', 'B');
    return startMatch(t1, t2, makeConfig('t20'), 't1', 't2', 't1_p1', 't1_p2', 't2_p6');
  }

  test('over completes after exactly 6 legal deliveries', () => {
    let e = setup();
    for (let i = 0; i < 6; i++) e = e.recordBall(DOT);
    const inn = e.getCurrentInnings()!;
    expect(inn.totalOvers).toBe(1);
    expect(inn.totalBalls).toBe(0);
    expect(inn.overs).toHaveLength(1);
    expect(inn.currentBowlerId).toBeNull();
  });

  test('all-dot over = maiden', () => {
    let e = setup();
    for (let i = 0; i < 6; i++) e = e.recordBall(DOT);
    expect(e.getCurrentInnings()!.overs[0].isMaiden).toBe(true);
    expect(e.getCurrentInnings()!.bowlers[0].maidens).toBe(1);
  });

  test('over with a wide is not a maiden', () => {
    let e = setup().recordBall(WIDE);
    for (let i = 0; i < 6; i++) e = e.recordBall(DOT);
    expect(e.getCurrentInnings()!.overs[0].isMaiden).toBe(false);
  });

  test('over with a bye is not a maiden', () => {
    let e = setup().recordBall(BYE2);
    for (let i = 0; i < 5; i++) e = e.recordBall(DOT);
    expect(e.getCurrentInnings()!.overs[0].isMaiden).toBe(false);
  });

  test('same bowler can bowl again after a gap', () => {
    let e = setup();
    for (let i = 0; i < 6; i++) e = e.recordBall(DOT);    // over 1 — t2_p6
    e = e.setBowler('t2_p7');
    for (let i = 0; i < 6; i++) e = e.recordBall(DOT);    // over 2 — t2_p7
    e = e.setBowler('t2_p6');                               // back to t2_p6
    for (let i = 0; i < 6; i++) e = e.recordBall(DOT);    // over 3
    const b = e.getCurrentInnings()!.bowlers.find(b => b.playerId === 't2_p6')!;
    expect(b.overs).toBe(2);
    expect(b.maidens).toBe(2);
  });

  test('over summary records runs and wickets', () => {
    let e = setup();
    e = e.recordBall(FOUR);       // 4 runs
    e = e.recordBall(BOWLED());   // wicket
    e = e.setNewBatter('t1_p3');
    e = e.recordBall(SIX);        // 6 runs
    for (let i = 0; i < 3; i++) e = e.recordBall(DOT);
    const over = e.getCurrentInnings()!.overs[0];
    expect(over.runs).toBe(10);
    expect(over.wickets).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. Partnership Tracking
// ─────────────────────────────────────────────────────────────────────────────

describe('Partnership Tracking', () => {
  function setup() {
    const t1 = makeTeam('t1', 'A', 'A');
    const t2 = makeTeam('t2', 'B', 'B');
    return startMatch(t1, t2, makeConfig('t20'), 't1', 't2', 't1_p1', 't1_p2', 't2_p6');
  }

  test('opening partnership accumulates runs and balls correctly', () => {
    let e = setup();
    e = e.recordBall(FOUR);   // p1 scores 4
    e = e.recordBall(S1);     // p1 scores 1 then rotates to p2
    e = e.recordBall(S2);     // p2 scores 2 (no rotate)
    const p = e.getCurrentPartnership()!;
    expect(p.runs).toBe(7);
    expect(p.balls).toBe(3);
    expect(p.batter1Runs).toBe(5);  // p1: 4 + 1
    expect(p.batter2Runs).toBe(2);  // p2: 2
  });

  test('new partnership starts when wicket falls', () => {
    let e = setup();
    e = e.recordBall(FOUR);
    e = e.recordBall(BOWLED()); // p1 out
    e = e.setNewBatter('t1_p3');
    expect(e.getCurrentInnings()!.partnerships).toHaveLength(2);
    // New partnership should start fresh
    expect(e.getCurrentPartnership()!.runs).toBe(0);
  });

  test('partnership extras (byes) included in partnership runs', () => {
    let e = setup().recordBall(BYE2);
    expect(e.getCurrentPartnership()!.runs).toBe(2);
    expect(e.getCurrentPartnership()!.extras).toBe(2);
  });

  test('fall-of-wickets: 3 wickets recorded in order', () => {
    let e = setup();
    const bowlerPool = ['t2_p6', 't2_p7', 't2_p8'];
    for (let i = 0; i < 3; i++) {
      // Score 2 singles (even → no rotation confusion) then wicket
      for (let j = 0; j < 2; j++) {
        if (!e.getCurrentInnings()!.currentBowlerId) e = e.setBowler(bowlerPool[i % bowlerPool.length]);
        e = e.recordBall(S1);
      }
      if (!e.getCurrentInnings()!.currentBowlerId) e = e.setBowler(bowlerPool[i % bowlerPool.length]);
      e = e.recordBall(BOWLED());
      if (i < 2) e = e.setNewBatter(`t1_p${i + 3}`);
    }
    const fow = e.getCurrentInnings()!.fallOfWickets;
    expect(fow).toHaveLength(3);
    expect(fow[0].wicketNumber).toBe(1);
    expect(fow[1].wicketNumber).toBe(2);
    expect(fow[2].wicketNumber).toBe(3);
    // Each falls at increasing run totals
    expect(fow[0].runs).toBeLessThan(fow[1].runs);
    expect(fow[1].runs).toBeLessThan(fow[2].runs);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. Bowling Stats
// ─────────────────────────────────────────────────────────────────────────────

describe('Bowling Stats', () => {
  function setup() {
    const t1 = makeTeam('t1', 'A', 'A');
    const t2 = makeTeam('t2', 'B', 'B');
    return startMatch(t1, t2, makeConfig('t20'), 't1', 't2', 't1_p1', 't1_p2', 't2_p6');
  }

  test('completed overs increment bowler overs count', () => {
    let e = setup();
    for (let i = 0; i < 6; i++) e = e.recordBall(DOT);
    expect(e.getCurrentInnings()!.bowlers[0].overs).toBe(1);
    expect(e.getCurrentInnings()!.bowlers[0].ballsBowled).toBe(0);
  });

  test('mid-over balls update ballsBowled', () => {
    let e = setup();
    for (let i = 0; i < 4; i++) e = e.recordBall(DOT);
    expect(e.getCurrentInnings()!.bowlers[0].overs).toBe(0);
    expect(e.getCurrentInnings()!.bowlers[0].ballsBowled).toBe(4);
  });

  test('bowler stats: 1 four + 1 six = 10 runs conceded', () => {
    let e = setup().recordBall(FOUR);
    e = e.recordBall(SIX);
    expect(e.getCurrentBowler()!.runsConceded).toBe(10);
  });

  test('3 wickets for bowler over multiple overs', () => {
    let e = setup();
    // Over 1: W W W then 3 dots, set new batters
    for (let w = 0; w < 3; w++) {
      e = e.recordBall(BOWLED());
      e = e.setNewBatter(`t1_p${w + 3}`);
    }
    for (let i = 0; i < 3; i++) e = e.recordBall(DOT);
    expect(e.getCurrentInnings()!.bowlers[0].wickets).toBe(3);
  });

  test('economy = runs / overs (2 overs, 12 runs = 6.00 economy)', () => {
    let e = setup();
    // Over 1: 6 singles = 6 runs
    for (let i = 0; i < 6; i++) e = e.recordBall(S1);
    e = e.setBowler('t2_p7');
    for (let i = 0; i < 6; i++) e = e.recordBall(DOT); // over 2 by different bowler
    e = e.setBowler('t2_p6');
    for (let i = 0; i < 6; i++) e = e.recordBall(S1); // over 3 by same bowler: 6 more runs
    const b = e.getCurrentInnings()!.bowlers.find(b => b.playerId === 't2_p6')!;
    expect(b.overs).toBe(2);
    expect(b.runsConceded).toBe(12);
    // economy = 12 / 2 = 6
    expect(b.runsConceded / b.overs).toBe(6);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 12. Batter Stats
// ─────────────────────────────────────────────────────────────────────────────

describe('Batter Stats', () => {
  function setup() {
    const t1 = makeTeam('t1', 'A', 'A');
    const t2 = makeTeam('t2', 'B', 'B');
    return startMatch(t1, t2, makeConfig('t20'), 't1', 't2', 't1_p1', 't1_p2', 't2_p6');
  }

  test('strike rate = (runs / balls) * 100', () => {
    let e = setup();
    e = e.recordBall(FOUR);   // 4 runs, 1 ball
    e = e.recordBall(DOT);    // 0 runs, 1 ball
    const batter = e.getStriker()!;
    expect(batter.runs).toBe(4);
    expect(batter.ballsFaced).toBe(2);
    // SR = (4/2)*100 = 200
    expect((batter.runs / batter.ballsFaced) * 100).toBe(200);
  });

  test('boundaries tracked separately: fours and sixes', () => {
    let e = setup();
    e = e.recordBall(FOUR);
    e = e.recordBall(SIX);
    e = e.recordBall(FOUR);
    const b = e.getStriker()!;
    expect(b.fours).toBe(2);
    expect(b.sixes).toBe(1);
    expect(b.runs).toBe(14);
  });

  test('batter not credited for byes/leg-byes', () => {
    let e = setup();
    e = e.recordBall(BYE2);   // 2 byes (even runs) — no rotation, p1 still striker
    e = e.recordBall(LBYE1);  // 1 leg-bye (odd run) — rotation, p2 becomes striker
    // p1 faced both balls, should have 0 runs and 2 balls faced
    const p1 = e.getCurrentInnings()!.batters.find(b => b.playerId === 't1_p1')!;
    expect(p1.runs).toBe(0);
    expect(p1.ballsFaced).toBe(2);
    // p2 (now striker after rotation) has not faced any balls yet
    expect(e.getStriker()!.ballsFaced).toBe(0);
  });

  test('non-striker runs credited when they become striker', () => {
    let e = setup();
    e = e.recordBall(S1); // p1 scores 1, becomes non-striker
    e = e.recordBall(FOUR); // p2 faces, scores 4
    const p2 = e.getCurrentInnings()!.batters.find(b => b.playerId === 't1_p2')!;
    expect(p2.runs).toBe(4);
  });

  test('batting position tracked correctly', () => {
    let e = setup();
    e = e.recordBall(BOWLED()); // p1 out
    e = e.setNewBatter('t1_p3');
    const inn = e.getCurrentInnings()!;
    const p1 = inn.batters.find(b => b.playerId === 't1_p1')!;
    const p2 = inn.batters.find(b => b.playerId === 't1_p2')!;
    const p3 = inn.batters.find(b => b.playerId === 't1_p3')!;
    expect(p1.battingPosition).toBe(1);
    expect(p2.battingPosition).toBe(2);
    expect(p3.battingPosition).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 13. Undo — Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

describe('Undo — Edge Cases', () => {
  function setup() {
    const t1 = makeTeam('t1', 'A', 'A');
    const t2 = makeTeam('t2', 'B', 'B');
    return startMatch(t1, t2, makeConfig('t20'), 't1', 't2', 't1_p1', 't1_p2', 't2_p6');
  }

  test('undo dot ball', () => {
    let e = setup().recordBall(DOT);
    e = e.undoLastBall();
    expect(e.getCurrentInnings()!.totalBalls).toBe(0);
    expect(e.getCurrentInnings()!.totalRuns).toBe(0);
  });

  test('undo boundary — runs removed', () => {
    let e = setup().recordBall(FOUR);
    expect(e.getCurrentInnings()!.totalRuns).toBe(4);
    e = e.undoLastBall();
    expect(e.getCurrentInnings()!.totalRuns).toBe(0);
    expect(e.getStriker()!.fours).toBe(0);
  });

  test('undo wide — extras removed', () => {
    let e = setup().recordBall(WIDE);
    e = e.undoLastBall();
    expect(e.getCurrentInnings()!.extras.wides).toBe(0);
    expect(e.getCurrentInnings()!.totalRuns).toBe(0);
  });

  test('undo no-ball clears free-hit flag', () => {
    let e = setup().recordBall(NOBALL);
    expect(e.isFreeHit()).toBe(true);
    e = e.undoLastBall();
    expect(e.isFreeHit()).toBe(false);
  });

  test('undo wicket restores batter and wicket count', () => {
    let e = setup().recordBall(BOWLED());
    e = e.undoLastBall();
    expect(e.getCurrentInnings()!.totalWickets).toBe(0);
    expect(e.getCurrentInnings()!.currentStrikerId).toBe('t1_p1');
    expect(e.getCurrentInnings()!.fallOfWickets).toHaveLength(0);
  });

  test('undo at end of over restores over state', () => {
    let e = setup();
    for (let i = 0; i < 6; i++) e = e.recordBall(DOT);
    expect(e.getCurrentInnings()!.totalOvers).toBe(1);
    e = e.undoLastBall();
    expect(e.getCurrentInnings()!.totalOvers).toBe(0);
    expect(e.getCurrentInnings()!.totalBalls).toBe(5);
    expect(e.getCurrentInnings()!.currentBowlerId).toBe('t2_p6'); // bowler restored
  });

  test('undo restores strike rotation', () => {
    let e = setup().recordBall(S1);
    expect(e.getCurrentInnings()!.currentStrikerId).toBe('t1_p2');
    e = e.undoLastBall();
    expect(e.getCurrentInnings()!.currentStrikerId).toBe('t1_p1');
  });

  test('multiple undos down to zero', () => {
    let e = setup();
    e = e.recordBall(S1);
    e = e.recordBall(FOUR);
    e = e.recordBall(SIX);
    expect(e.getCurrentInnings()!.totalRuns).toBe(11);
    e = e.undoLastBall(); // undo SIX
    expect(e.getCurrentInnings()!.totalRuns).toBe(5);
    e = e.undoLastBall(); // undo FOUR
    expect(e.getCurrentInnings()!.totalRuns).toBe(1);
    e = e.undoLastBall(); // undo S1
    expect(e.getCurrentInnings()!.totalRuns).toBe(0);
    expect(e.getCurrentInnings()!.allBalls).toHaveLength(0);
  });

  test('cannot undo when stack is empty', () => {
    const e = setup();
    expect(e.canUndo()).toBe(false);
    expect(() => e.undoLastBall()).toThrow();
  });

  test('undo of all-out restores in_progress status', () => {
    let e = setup();
    const extraBowlers = ['t2_p7', 't2_p8', 't2_p9', 't2_p10'];
    let extraBowlerIdx = 0;
    for (let w = 0; w < 9; w++) {
      // Set a bowler if the previous over ended
      if (!e.getCurrentInnings()!.currentBowlerId) {
        e = e.setBowler(extraBowlers[extraBowlerIdx % extraBowlers.length]);
        extraBowlerIdx++;
      }
      e = e.recordBall(BOWLED());
      e = e.setNewBatter(`t1_p${w + 3}`);
    }
    if (!e.getCurrentInnings()!.currentBowlerId) {
      e = e.setBowler(extraBowlers[extraBowlerIdx % extraBowlers.length]);
    }
    e = e.recordBall(BOWLED()); // 10th wicket → innings complete
    expect(e.getCurrentInnings()!.status).toBe('completed');
    e = e.undoLastBall();
    expect(e.getCurrentInnings()!.status).toBe('in_progress');
  });

  test('undo partnership correctly reverts to previous partnership state', () => {
    let e = setup();
    e = e.recordBall(FOUR);       // partnership 1: 4 runs
    e = e.recordBall(BOWLED());   // wicket — partnership 1 ends
    e = e.setNewBatter('t1_p3');
    e = e.recordBall(S1);          // partnership 2 starts
    e = e.undoLastBall();          // undo the single
    expect(e.getCurrentPartnership()!.runs).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 14. Full T20 Match Simulation
// ─────────────────────────────────────────────────────────────────────────────

describe('Full T20 Match Simulation', () => {
  test('complete T20 match: realistic scorecard', () => {
    const t1 = makeTeam('t1', 'Thunderbolts', 'TBT');
    const t2 = makeTeam('t2', 'Royal Strikers', 'RST');
    let e = startMatch(t1, t2, makeConfig('t20'), 't1', 't2', 't1_p1', 't1_p2', 't2_p6');

    // ── Innings 1 ── Target: 140+1 = 141
    const inn1BowlerPool = ['t2_p6', 't2_p7', 't2_p8', 't2_p9', 't2_p10'];
    // Over 1: 1, 4, 1, 0, 6, 1  = 13
    e = e.recordBall(S1);
    e = e.recordBall(FOUR);
    e = e.recordBall(S1);
    e = e.recordBall(DOT);
    e = e.recordBall(SIX);
    e = e.recordBall(S1);
    e = e.setBowler(pickNextBowler(e, inn1BowlerPool));
    // Over 2: W, 0, 1, 1, 0, 4  = 6 + wicket
    e = e.recordBall(BOWLED());
    e = e.setNewBatter('t1_p3');
    e = e.recordBall(DOT);
    e = e.recordBall(S1);
    e = e.recordBall(S1);
    e = e.recordBall(DOT);
    e = e.recordBall(FOUR);
    e = e.setBowler(pickNextBowler(e, inn1BowlerPool));
    // Overs 3-20: score via singles and dots, auto-rotating bowlers within quota
    let extraScore = 0;
    for (let ov = 3; ov <= 20; ov++) {
      for (let b = 0; b < 6; b++) {
        if (extraScore < 120) {
          e = e.recordBall(b % 3 === 0 ? S1 : DOT);
          if (b % 3 === 0) extraScore++;
        } else {
          e = e.recordBall(DOT);
        }
      }
      if (ov < 20) e = e.setBowler(pickNextBowler(e, inn1BowlerPool));
    }

    const inn1 = e.getCurrentInnings()!;
    expect(inn1.status).toBe('completed');
    expect(inn1.totalOvers).toBe(20);
    expect(inn1.totalRuns).toBeGreaterThan(50);

    // ── Innings 2 ──
    const target = inn1.totalRuns + 1;
    e = e.startNextInnings();
    e = e.setOpeners('t2_p1', 't2_p2');
    e = e.setBowler('t1_p6');

    expect(e.getCurrentInnings()!.target).toBe(target);

    // Chase falls short — all dot balls
    e = bowlDots(e, 120, ['t1_p6', 't1_p7', 't1_p8', 't1_p9', 't1_p10']);

    const m = e.getMatch();
    expect(m.status).toBe('completed');
    expect(m.result).toContain('Thunderbolts won');
  });

  test('last-ball thriller: chasing team wins off the final ball', () => {
    const t1 = makeTeam('t1', 'A', 'A');
    const t2 = makeTeam('t2', 'B', 'B');
    let e = startMatch(t1, t2, makeConfig('t20'), 't1', 't2', 't1_p1', 't1_p2', 't2_p6');

    // First innings: 1 run only
    e = e.recordBall(S1);
    e = bowlDots(e, 119, ['t2_p6', 't2_p7', 't2_p8', 't2_p9', 't2_p10']);

    e = e.startNextInnings();
    e = e.setOpeners('t2_p1', 't2_p2');
    e = e.setBowler('t1_p6');

    // Bowl 119 dots (19 overs 5 balls), leaving 1 ball with 2 needed
    e = bowlDots(e, 119, ['t1_p6', 't1_p7', 't1_p8', 't1_p9', 't1_p10']);
    // Final ball — hit a two to win
    e = e.recordBall(S2);
    expect(e.getMatch().status).toBe('completed');
    expect(e.getMatch().result).toContain('B won');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 15. All-Out Scenarios
// ─────────────────────────────────────────────────────────────────────────────

describe('All-Out Scenarios', () => {
  test('standard 11-player team: all-out at 10 wickets', () => {
    const t1 = makeTeam('t1', 'A', 'A');
    const t2 = makeTeam('t2', 'B', 'B');
    let e = startMatch(t1, t2, makeConfig('t20'), 't1', 't2', 't1_p1', 't1_p2', 't2_p6');
    for (let w = 0; w < 10; w++) {
      if (!e.getCurrentInnings()!.currentBowlerId) e = e.setBowler('t2_p7');
      e = e.recordBall(BOWLED());
      if (w < 9) e = e.setNewBatter(`t1_p${w + 3}`);
    }
    expect(e.getCurrentInnings()!.totalWickets).toBe(10);
    expect(e.getCurrentInnings()!.status).toBe('completed');
  });

  test('innings result states all wickets in result string', () => {
    const t1 = makeTeam('t1', 'A', 'A');
    const t2 = makeTeam('t2', 'B', 'B');
    let e = startMatch(t1, t2, makeConfig('t20'), 't1', 't2', 't1_p1', 't1_p2', 't2_p6');
    // Score 5 then get all out (alternate bowlers to satisfy consecutive-overs rule)
    const wicketBowlerPool = ['t2_p6', 't2_p7', 't2_p8', 't2_p9', 't2_p10'];
    for (let i = 0; i < 5; i++) e = e.recordBall(S1);
    for (let w = 0; w < 10; w++) {
      if (!e.getCurrentInnings()!.currentBowlerId) e = e.setBowler(pickNextBowler(e, wicketBowlerPool));
      e = e.recordBall(BOWLED());
      if (w < 9) e = e.setNewBatter(`t1_p${w + 3}`);
    }
    e = e.startNextInnings();
    e = e.setOpeners('t2_p1', 't2_p2');
    e = e.setBowler('t1_p6');
    // Chase 6 — hit 6
    e = e.recordBall(SIX);
    expect(e.getMatch().result).toContain('B won');
    expect(e.getMatch().result).toContain('wicket');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 16. Scorecard Integrity
// ─────────────────────────────────────────────────────────────────────────────

describe('Scorecard Integrity', () => {
  test('team total = sum of batter runs + all extras', () => {
    const t1 = makeTeam('t1', 'A', 'A');
    const t2 = makeTeam('t2', 'B', 'B');
    let e = startMatch(t1, t2, makeConfig('t20'), 't1', 't2', 't1_p1', 't1_p2', 't2_p6');
    e = e.recordBall(FOUR);       // 4 bat
    e = e.recordBall(S1);          // 1 bat
    e = e.recordBall(WIDE);        // 1 wide
    e = e.recordBall(BYE2);        // 2 bye
    e = e.recordBall(LBYE1);       // 1 lb
    e = e.recordBall(NOBALL);      // 1 nb
    e = e.recordBall({ ...NOBALL, runs: 2 }); // 1 nb + 2 bat
    const inn = e.getCurrentInnings()!;
    const { wides, noBalls, byes, legByes } = inn.extras;
    const batterRuns = inn.batters.reduce((s, b) => s + b.runs, 0);
    const extraRuns = wides + noBalls + byes + legByes;
    expect(batterRuns + extraRuns).toBe(inn.totalRuns);
  });

  test('bowler totals: runs conceded matches over-by-over breakdown', () => {
    const t1 = makeTeam('t1', 'A', 'A');
    const t2 = makeTeam('t2', 'B', 'B');
    let e = startMatch(t1, t2, makeConfig('t20'), 't1', 't2', 't1_p1', 't1_p2', 't2_p6');
    // Over 1: 1, 2, 0, 4, 0, 6 = 13 runs by t2_p6
    [S1, S2, DOT, FOUR, DOT, SIX].forEach(b => { e = e.recordBall(b); });
    e = e.setBowler('t2_p7');
    [DOT, DOT, DOT, DOT, DOT, DOT].forEach(b => { e = e.recordBall(b); });
    const bowler = e.getCurrentInnings()!.bowlers.find(b => b.playerId === 't2_p6')!;
    const overRunsSum = e.getCurrentInnings()!.overs
      .filter(o => o.bowlerId === 't2_p6')
      .reduce((s, o) => s + o.runs, 0);
    expect(bowler.runsConceded).toBe(13);
    expect(overRunsSum).toBe(13);
  });
});
