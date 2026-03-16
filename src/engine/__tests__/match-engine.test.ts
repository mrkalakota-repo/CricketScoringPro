import { MatchEngine, createNewMatch } from '../match-engine';
import type { Match, Team, Player, MatchConfig, BallInput } from '../types';
import { FORMAT_CONFIGS } from '../types';

// ===== Test Helpers =====

function createTestPlayer(id: string, name: string, overrides: Partial<Player> = {}): Player {
  return {
    id,
    name,
    battingStyle: 'right',
    bowlingStyle: 'Right-arm fast',
    isWicketKeeper: false,
    isAllRounder: false,
    isCaptain: false,
    isViceCaptain: false,
    ...overrides,
  };
}

function createTestTeam(id: string, name: string, shortName: string): Team {
  const players: Player[] = [];
  for (let i = 1; i <= 11; i++) {
    players.push(createTestPlayer(`${id}_p${i}`, `${name} Player ${i}`));
  }
  players[0].isWicketKeeper = true;
  return { id, name, shortName, adminPinHash: null, latitude: null, longitude: null, players, createdAt: Date.now(), updatedAt: Date.now() };
}

function setupT20Match(): { engine: MatchEngine; team1: Team; team2: Team } {
  const team1 = createTestTeam('t1', 'Team Alpha', 'ALP');
  const team2 = createTestTeam('t2', 'Team Beta', 'BET');
  const config: MatchConfig = { format: 't20', ...FORMAT_CONFIGS.t20 };
  const match = createNewMatch(
    'm1', config, team1, team2,
    team1.players.map(p => p.id),
    team2.players.map(p => p.id),
    'Test Ground', Date.now()
  );
  let engine = new MatchEngine(match);
  engine = engine.recordToss({ winnerId: 't1', decision: 'bat' });
  engine = engine.startMatch('t1', 't2');
  engine = engine.setOpeners('t1_p1', 't1_p2');
  engine = engine.setBowler('t2_p10');
  return { engine, team1, team2 };
}

const DOT_BALL: BallInput = {
  runs: 0, isWide: false, isNoBall: false, isBye: false, isLegBye: false,
  dismissal: null, isBoundary: false,
};

const SINGLE: BallInput = { ...DOT_BALL, runs: 1 };
const FOUR: BallInput = { ...DOT_BALL, runs: 4, isBoundary: true };
const SIX: BallInput = { ...DOT_BALL, runs: 6, isBoundary: true };

// ===== Tests =====

describe('MatchEngine', () => {
  describe('Match Setup', () => {
    test('creates a match in scheduled status', () => {
      const team1 = createTestTeam('t1', 'Team Alpha', 'ALP');
      const team2 = createTestTeam('t2', 'Team Beta', 'BET');
      const config: MatchConfig = { format: 't20', ...FORMAT_CONFIGS.t20 };
      const match = createNewMatch('m1', config, team1, team2, [], [], 'Ground', Date.now());
      expect(match.status).toBe('scheduled');
      expect(match.innings).toHaveLength(0);
    });

    test('records toss correctly', () => {
      const { engine } = setupT20Match();
      expect(engine.getMatch().toss?.winnerId).toBe('t1');
      expect(engine.getMatch().toss?.decision).toBe('bat');
    });

    test('starts match with first innings', () => {
      const { engine } = setupT20Match();
      expect(engine.getMatch().status).toBe('in_progress');
      expect(engine.getMatch().innings).toHaveLength(1);
      expect(engine.getCurrentInnings()?.inningsNumber).toBe(1);
      expect(engine.getCurrentInnings()?.battingTeamId).toBe('t1');
    });

    test('sets openers correctly', () => {
      const { engine } = setupT20Match();
      const innings = engine.getCurrentInnings()!;
      expect(innings.currentStrikerId).toBe('t1_p1');
      expect(innings.currentNonStrikerId).toBe('t1_p2');
      expect(innings.batters).toHaveLength(2);
      expect(innings.partnerships).toHaveLength(1);
    });

    test('sets bowler correctly', () => {
      const { engine } = setupT20Match();
      const innings = engine.getCurrentInnings()!;
      expect(innings.currentBowlerId).toBe('t2_p10');
      expect(innings.bowlers).toHaveLength(1);
    });
  });

  describe('Basic Scoring', () => {
    test('records a dot ball', () => {
      const { engine } = setupT20Match();
      const e = engine.recordBall(DOT_BALL);
      const innings = e.getCurrentInnings()!;
      expect(innings.totalRuns).toBe(0);
      expect(innings.totalBalls).toBe(1);
      expect(e.getStriker()?.ballsFaced).toBe(1);
      expect(e.getStriker()?.runs).toBe(0);
    });

    test('records a single and rotates strike', () => {
      const { engine } = setupT20Match();
      const e = engine.recordBall(SINGLE);
      const innings = e.getCurrentInnings()!;
      expect(innings.totalRuns).toBe(1);
      expect(innings.currentStrikerId).toBe('t1_p2');
      expect(innings.currentNonStrikerId).toBe('t1_p1');
    });

    test('records a four', () => {
      const { engine } = setupT20Match();
      const e = engine.recordBall(FOUR);
      const batter = e.getStriker()!;
      expect(batter.runs).toBe(4);
      expect(batter.fours).toBe(1);
      expect(batter.ballsFaced).toBe(1);
      expect(e.getCurrentInnings()!.totalRuns).toBe(4);
      // Even runs, no strike rotation
      expect(e.getCurrentInnings()!.currentStrikerId).toBe('t1_p1');
    });

    test('records a six', () => {
      const { engine } = setupT20Match();
      const e = engine.recordBall(SIX);
      expect(e.getStriker()!.sixes).toBe(1);
      expect(e.getCurrentInnings()!.totalRuns).toBe(6);
    });

    test('records 2 runs without rotation', () => {
      const { engine } = setupT20Match();
      const e = engine.recordBall({ ...DOT_BALL, runs: 2 });
      expect(e.getCurrentInnings()!.currentStrikerId).toBe('t1_p1');
    });

    test('records 3 runs with rotation', () => {
      const { engine } = setupT20Match();
      const e = engine.recordBall({ ...DOT_BALL, runs: 3 });
      expect(e.getCurrentInnings()!.currentStrikerId).toBe('t1_p2');
    });
  });

  describe('Extras', () => {
    test('wide adds 1 run and is not legal', () => {
      const { engine } = setupT20Match();
      const e = engine.recordBall({
        ...DOT_BALL, isWide: true, runs: 0,
      });
      const innings = e.getCurrentInnings()!;
      expect(innings.totalRuns).toBe(1);
      expect(innings.extras.wides).toBe(1);
      expect(innings.totalBalls).toBe(0); // Not a legal delivery
      expect(e.getStriker()!.ballsFaced).toBe(0); // Wide doesn't count as ball faced
    });

    test('wide + runs (e.g., wide to boundary)', () => {
      const { engine } = setupT20Match();
      const e = engine.recordBall({
        ...DOT_BALL, isWide: true, runs: 4,
      });
      const innings = e.getCurrentInnings()!;
      expect(innings.totalRuns).toBe(5); // 1 wide + 4 runs
      expect(innings.extras.wides).toBe(5);
    });

    test('no-ball adds 1 run', () => {
      const { engine } = setupT20Match();
      const e = engine.recordBall({
        ...DOT_BALL, isNoBall: true, runs: 0,
      });
      const innings = e.getCurrentInnings()!;
      expect(innings.totalRuns).toBe(1);
      expect(innings.extras.noBalls).toBe(1);
      expect(innings.totalBalls).toBe(0); // Not legal
    });

    test('no-ball + runs off bat', () => {
      const { engine } = setupT20Match();
      const e = engine.recordBall({
        ...DOT_BALL, isNoBall: true, runs: 4, isBoundary: true,
      });
      const innings = e.getCurrentInnings()!;
      expect(innings.totalRuns).toBe(5); // 1 NB + 4 off bat
      // NB(1) + 4 = 5 total (odd), so strike rotates. Original striker is now non-striker.
      const originalStriker = innings.batters.find(b => b.playerId === 't1_p1')!;
      expect(originalStriker.runs).toBe(4);
      expect(originalStriker.fours).toBe(1);
    });

    test('bye records runs as extras, not to batter', () => {
      const { engine } = setupT20Match();
      const e = engine.recordBall({
        ...DOT_BALL, isBye: true, runs: 2,
      });
      const innings = e.getCurrentInnings()!;
      expect(innings.totalRuns).toBe(2);
      expect(innings.extras.byes).toBe(2);
      expect(e.getStriker()!.runs).toBe(0);
      expect(e.getStriker()!.ballsFaced).toBe(1);
    });

    test('leg-bye records runs as extras', () => {
      const { engine } = setupT20Match();
      const e = engine.recordBall({
        ...DOT_BALL, isLegBye: true, runs: 1,
      });
      const innings = e.getCurrentInnings()!;
      expect(innings.totalRuns).toBe(1);
      expect(innings.extras.legByes).toBe(1);
      expect(e.getStriker()!.runs).toBe(0);
    });

    test('no-ball triggers free hit on next ball', () => {
      const { engine } = setupT20Match();
      const e1 = engine.recordBall({ ...DOT_BALL, isNoBall: true });
      expect(e1.isFreeHit()).toBe(true);
      const e2 = e1.recordBall(SINGLE);
      expect(e2.isFreeHit()).toBe(false);
    });

    test('cannot be bowled on free hit', () => {
      const { engine } = setupT20Match();
      const e1 = engine.recordBall({ ...DOT_BALL, isNoBall: true });
      expect(() => {
        e1.recordBall({
          ...DOT_BALL,
          dismissal: { type: 'bowled' },
        });
      }).toThrow('Cannot dismiss batter with bowled on a free hit');
    });

    test('can be run out on free hit', () => {
      const { engine } = setupT20Match();
      const e1 = engine.recordBall({ ...DOT_BALL, isNoBall: true });
      const e2 = e1.recordBall({
        ...DOT_BALL,
        dismissal: { type: 'run_out', batsmanId: 't1_p1' },
      });
      expect(e2.getCurrentInnings()!.totalWickets).toBe(1);
    });
  });

  describe('Wickets', () => {
    test('bowled dismissal', () => {
      const { engine } = setupT20Match();
      const e = engine.recordBall({
        ...DOT_BALL,
        dismissal: { type: 'bowled' },
      });
      const innings = e.getCurrentInnings()!;
      expect(innings.totalWickets).toBe(1);
      expect(innings.currentStrikerId).toBeNull(); // Need new batter
      expect(innings.fallOfWickets).toHaveLength(1);
      expect(innings.fallOfWickets[0].runs).toBe(0);
    });

    test('caught dismissal credits bowler', () => {
      const { engine } = setupT20Match();
      const e = engine.recordBall({
        ...DOT_BALL,
        dismissal: { type: 'caught', fielderId: 't2_p5' },
      });
      const bowler = e.getCurrentBowler()!;
      expect(bowler.wickets).toBe(1);
    });

    test('run out does not credit bowler', () => {
      const { engine } = setupT20Match();
      const e = engine.recordBall({
        ...DOT_BALL, runs: 1,
        dismissal: { type: 'run_out', batsmanId: 't1_p2', fielderId: 't2_p3' },
      });
      const bowler = e.getCurrentBowler();
      // Bowler might be null if over completed, check via bowlers array
      const innings = e.getCurrentInnings()!;
      const bowlerSpell = innings.bowlers.find(b => b.playerId === 't2_p10')!;
      expect(bowlerSpell.wickets).toBe(0);
    });

    test('new batter can be set after wicket', () => {
      const { engine } = setupT20Match();
      let e = engine.recordBall({
        ...DOT_BALL,
        dismissal: { type: 'bowled' },
      });
      e = e.setNewBatter('t1_p3');
      const innings = e.getCurrentInnings()!;
      expect(innings.currentStrikerId).toBe('t1_p3');
      expect(innings.batters).toHaveLength(3);
    });

    test('all out ends innings (10 wickets for 11 players)', () => {
      let { engine } = setupT20Match();
      // Take 10 wickets, resetting bowler after each over completes
      for (let w = 0; w < 10; w++) {
        // If bowler is null (over just completed), set a new one
        if (!engine.getCurrentInnings()!.currentBowlerId) {
          engine = engine.setBowler('t2_p9');
        }
        engine = engine.recordBall({
          ...DOT_BALL,
          dismissal: { type: 'bowled' },
        });
        if (w < 9) {
          engine = engine.setNewBatter(`t1_p${w + 3}`);
        }
      }
      expect(engine.getCurrentInnings()!.status).toBe('completed');
      expect(engine.getCurrentInnings()!.totalWickets).toBe(10);
    });
  });

  describe('Over Completion', () => {
    test('completes over after 6 legal deliveries', () => {
      let { engine } = setupT20Match();
      for (let i = 0; i < 6; i++) {
        engine = engine.recordBall(DOT_BALL);
      }
      const innings = engine.getCurrentInnings()!;
      expect(innings.totalOvers).toBe(1);
      expect(innings.totalBalls).toBe(0);
      expect(innings.overs).toHaveLength(1);
      expect(innings.currentBowlerId).toBeNull(); // Must select new bowler
    });

    test('maiden over is detected', () => {
      let { engine } = setupT20Match();
      for (let i = 0; i < 6; i++) {
        engine = engine.recordBall(DOT_BALL);
      }
      const innings = engine.getCurrentInnings()!;
      expect(innings.overs[0].isMaiden).toBe(true);
      const bowler = innings.bowlers.find(b => b.playerId === 't2_p10')!;
      expect(bowler.maidens).toBe(1);
    });

    test('strike rotates at end of over', () => {
      let { engine } = setupT20Match();
      // 6 dot balls - striker stays same within over
      for (let i = 0; i < 6; i++) {
        engine = engine.recordBall(DOT_BALL);
      }
      // After over, strike should rotate
      expect(engine.getCurrentInnings()!.currentStrikerId).toBe('t1_p2');
    });

    test('wides do not count as legal deliveries', () => {
      let { engine } = setupT20Match();
      // Bowl a wide then 6 dots
      engine = engine.recordBall({ ...DOT_BALL, isWide: true });
      for (let i = 0; i < 6; i++) {
        engine = engine.recordBall(DOT_BALL);
      }
      const innings = engine.getCurrentInnings()!;
      expect(innings.totalOvers).toBe(1);
      expect(innings.totalBalls).toBe(0);
    });

    test('bowler stats update correctly over multiple overs', () => {
      let { engine } = setupT20Match();
      // First over: 6 dots
      for (let i = 0; i < 6; i++) {
        engine = engine.recordBall(DOT_BALL);
      }
      engine = engine.setBowler('t2_p9');
      // Second over
      for (let i = 0; i < 6; i++) {
        engine = engine.recordBall(SINGLE);
      }
      engine = engine.setBowler('t2_p10');
      // Third over: 6 dots again by original bowler
      for (let i = 0; i < 6; i++) {
        engine = engine.recordBall(DOT_BALL);
      }
      const innings = engine.getCurrentInnings()!;
      const bowler = innings.bowlers.find(b => b.playerId === 't2_p10')!;
      expect(bowler.overs).toBe(2);
      expect(bowler.maidens).toBe(2);
      expect(bowler.runsConceded).toBe(0);
    });
  });

  describe('Innings Completion', () => {
    test('overs exhausted completes innings in T20', () => {
      let { engine } = setupT20Match();
      // Bowl 20 overs of dots
      for (let over = 0; over < 20; over++) {
        for (let ball = 0; ball < 6; ball++) {
          engine = engine.recordBall(DOT_BALL);
        }
        if (over < 19) {
          engine = engine.setBowler(over % 2 === 0 ? 't2_p9' : 't2_p10');
        }
      }
      expect(engine.getCurrentInnings()!.status).toBe('completed');
    });
  });

  describe('Second Innings & Match Result', () => {
    function completeFirstInnings(engine: MatchEngine, runs: number): MatchEngine {
      // Score the runs then exhaust overs
      let e = engine;
      let scored = 0;
      for (let over = 0; over < 20; over++) {
        for (let ball = 0; ball < 6; ball++) {
          if (scored < runs) {
            e = e.recordBall(SINGLE);
            scored++;
          } else {
            e = e.recordBall(DOT_BALL);
          }
        }
        if (over < 19) {
          e = e.setBowler(over % 2 === 0 ? 't2_p9' : 't2_p10');
        }
      }
      return e;
    }

    test('target is set for second innings', () => {
      let { engine } = setupT20Match();
      // Score 100 in first innings
      engine = completeFirstInnings(engine, 100);
      engine = engine.startNextInnings();
      engine = engine.setOpeners('t2_p1', 't2_p2');
      engine = engine.setBowler('t1_p10');
      expect(engine.getCurrentInnings()!.target).toBe(101);
    });

    test('chasing team wins when target reached', () => {
      let { engine } = setupT20Match();
      // First innings: 5 runs
      engine = completeFirstInnings(engine, 5);
      engine = engine.startNextInnings();
      engine = engine.setOpeners('t2_p1', 't2_p2');
      engine = engine.setBowler('t1_p10');

      // Chase: score 6 runs (target is 6)
      for (let i = 0; i < 6; i++) {
        engine = engine.recordBall(SINGLE);
      }
      expect(engine.getMatch().status).toBe('completed');
      expect(engine.getMatch().result).toContain('Team Beta won');
      expect(engine.getMatch().result).toContain('wicket');
    });

    test('batting first team wins when target not reached', () => {
      let { engine } = setupT20Match();
      engine = completeFirstInnings(engine, 100);
      engine = engine.startNextInnings();
      engine = engine.setOpeners('t2_p1', 't2_p2');
      engine = engine.setBowler('t1_p10');

      // Bowl 20 overs of dots (score 0)
      for (let over = 0; over < 20; over++) {
        for (let ball = 0; ball < 6; ball++) {
          engine = engine.recordBall(DOT_BALL);
        }
        if (over < 19) {
          engine = engine.setBowler(over % 2 === 0 ? 't1_p9' : 't1_p10');
        }
      }
      expect(engine.getMatch().status).toBe('completed');
      expect(engine.getMatch().result).toContain('Team Alpha won by 100 run');
    });

    test('tie when scores are level', () => {
      let { engine } = setupT20Match();
      engine = completeFirstInnings(engine, 5);
      engine = engine.startNextInnings();
      engine = engine.setOpeners('t2_p1', 't2_p2');
      engine = engine.setBowler('t1_p10');

      // Score exactly 5 then exhaust overs
      for (let i = 0; i < 5; i++) {
        engine = engine.recordBall(SINGLE);
      }
      // Exhaust remaining overs
      const ballsRemaining = 20 * 6 - 5;
      let bowlerToggle = false;
      let currentBalls = 5;
      for (let i = 0; i < ballsRemaining; i++) {
        engine = engine.recordBall(DOT_BALL);
        currentBalls++;
        if (currentBalls % 6 === 0 && currentBalls < 120) {
          bowlerToggle = !bowlerToggle;
          engine = engine.setBowler(bowlerToggle ? 't1_p9' : 't1_p10');
        }
      }
      expect(engine.getMatch().result).toBe('Match Tied');
    });
  });

  describe('Undo', () => {
    test('undoes the last ball', () => {
      const { engine } = setupT20Match();
      const e1 = engine.recordBall(FOUR);
      expect(e1.getCurrentInnings()!.totalRuns).toBe(4);
      const e2 = e1.undoLastBall();
      expect(e2.getCurrentInnings()!.totalRuns).toBe(0);
      expect(e2.getCurrentInnings()!.totalBalls).toBe(0);
    });

    test('undo restores strike rotation', () => {
      const { engine } = setupT20Match();
      const e1 = engine.recordBall(SINGLE);
      expect(e1.getCurrentInnings()!.currentStrikerId).toBe('t1_p2');
      const e2 = e1.undoLastBall();
      expect(e2.getCurrentInnings()!.currentStrikerId).toBe('t1_p1');
    });

    test('undo restores wicket', () => {
      const { engine } = setupT20Match();
      let e = engine.recordBall({
        ...DOT_BALL,
        dismissal: { type: 'bowled' },
      });
      expect(e.getCurrentInnings()!.totalWickets).toBe(1);
      e = e.undoLastBall();
      expect(e.getCurrentInnings()!.totalWickets).toBe(0);
      expect(e.getCurrentInnings()!.currentStrikerId).toBe('t1_p1');
    });

    test('multiple undos work correctly', () => {
      let { engine } = setupT20Match();
      engine = engine.recordBall(SINGLE);
      engine = engine.recordBall(FOUR);
      engine = engine.recordBall(SIX);
      expect(engine.getCurrentInnings()!.totalRuns).toBe(11);
      engine = engine.undoLastBall();
      expect(engine.getCurrentInnings()!.totalRuns).toBe(5);
      engine = engine.undoLastBall();
      expect(engine.getCurrentInnings()!.totalRuns).toBe(1);
      engine = engine.undoLastBall();
      expect(engine.getCurrentInnings()!.totalRuns).toBe(0);
    });

    test('cannot undo when stack is empty', () => {
      const { engine } = setupT20Match();
      expect(() => engine.undoLastBall()).toThrow('Nothing to undo');
    });

    test('undo after match completion restores in_progress', () => {
      let { engine } = setupT20Match();
      // Take 10 wickets, resetting bowler after over completion
      for (let w = 0; w < 10; w++) {
        if (!engine.getCurrentInnings()!.currentBowlerId) {
          engine = engine.setBowler('t2_p9');
        }
        engine = engine.recordBall({ ...DOT_BALL, dismissal: { type: 'bowled' } });
        if (w < 9) engine = engine.setNewBatter(`t1_p${w + 3}`);
      }
      expect(engine.getCurrentInnings()!.status).toBe('completed');
      engine = engine.undoLastBall();
      expect(engine.getCurrentInnings()!.status).toBe('in_progress');
      expect(engine.getMatch().status).toBe('in_progress');
    });
  });

  describe('Partnership', () => {
    test('partnership tracks runs correctly', () => {
      const { engine } = setupT20Match();
      let e = engine.recordBall(FOUR);
      e = e.recordBall(SINGLE);
      const partnership = e.getCurrentPartnership()!;
      expect(partnership.runs).toBe(5);
      // batter1 (t1_p1) scored 4 + 1 = 5 (both balls faced by striker before rotation)
      expect(partnership.batter1Runs).toBe(5);
      expect(partnership.balls).toBe(2);
    });

    test('new partnership starts after wicket', () => {
      const { engine } = setupT20Match();
      let e = engine.recordBall(FOUR);
      e = e.recordBall({ ...DOT_BALL, dismissal: { type: 'bowled' } });
      e = e.setNewBatter('t1_p3');
      expect(e.getCurrentInnings()!.partnerships).toHaveLength(2);
    });
  });

  describe('Bowler Stats', () => {
    test('wide counts against bowler', () => {
      const { engine } = setupT20Match();
      const e = engine.recordBall({ ...DOT_BALL, isWide: true });
      const bowler = e.getCurrentBowler()!;
      expect(bowler.runsConceded).toBe(1);
      expect(bowler.wides).toBe(1);
    });

    test('byes do not count against bowler', () => {
      const { engine } = setupT20Match();
      const e = engine.recordBall({ ...DOT_BALL, isBye: true, runs: 4 });
      const bowler = e.getCurrentBowler()!;
      expect(bowler.runsConceded).toBe(0);
    });

    test('no-ball + runs counts NB + bat runs against bowler', () => {
      const { engine } = setupT20Match();
      const e = engine.recordBall({ ...DOT_BALL, isNoBall: true, runs: 4, isBoundary: true });
      const bowler = e.getCurrentBowler()!;
      expect(bowler.runsConceded).toBe(5); // 1 NB + 4 off bat
      expect(bowler.noBalls).toBe(1);
    });
  });
});

// ===== Synthetic Data Tests =====

describe('Synthetic Data — Player Roles', () => {
  test('allrounder player has isAllRounder flag set', () => {
    const ar = createTestPlayer('ar1', 'Arjun Patel', {
      battingStyle: 'left',
      bowlingStyle: 'Left-arm orthodox',
      isAllRounder: true,
    });
    expect(ar.isAllRounder).toBe(true);
    expect(ar.bowlingStyle).toBe('Left-arm orthodox');
    expect(ar.battingStyle).toBe('left');
  });

  test('wicket keeper has isWicketKeeper flag and can be allrounder', () => {
    const wkAR = createTestPlayer('wk1', 'Sam Wilson', {
      isWicketKeeper: true,
      isAllRounder: true,
      bowlingStyle: 'Right-arm medium',
    });
    expect(wkAR.isWicketKeeper).toBe(true);
    expect(wkAR.isAllRounder).toBe(true);
  });

  test('specialist batter has no bowling style and is not allrounder', () => {
    const batter = createTestPlayer('b1', 'Riley Brown', {
      bowlingStyle: 'none',
      isAllRounder: false,
    });
    expect(batter.bowlingStyle).toBe('none');
    expect(batter.isAllRounder).toBe(false);
  });
});

describe('Synthetic Data — Full Match Simulation', () => {
  function buildSyntheticTeam(id: string, name: string, shortName: string): Team {
    const players: Player[] = [
      createTestPlayer(`${id}_p1`, 'Opener One', { battingStyle: 'right', bowlingStyle: 'none' }),
      createTestPlayer(`${id}_p2`, 'Opener Two', { battingStyle: 'left', bowlingStyle: 'none' }),
      createTestPlayer(`${id}_p3`, 'No. 3', { battingStyle: 'right', bowlingStyle: 'Right-arm medium', isAllRounder: true }),
      createTestPlayer(`${id}_p4`, 'No. 4', { battingStyle: 'right', bowlingStyle: 'none' }),
      createTestPlayer(`${id}_p5`, 'No. 5', { battingStyle: 'left', bowlingStyle: 'Left-arm orthodox', isAllRounder: true }),
      createTestPlayer(`${id}_p6`, 'All-Rounder', { battingStyle: 'right', bowlingStyle: 'Right-arm fast', isAllRounder: true }),
      createTestPlayer(`${id}_p7`, 'Keeper', { battingStyle: 'right', bowlingStyle: 'none', isWicketKeeper: true }),
      createTestPlayer(`${id}_p8`, 'Bowler One', { battingStyle: 'right', bowlingStyle: 'Right-arm fast' }),
      createTestPlayer(`${id}_p9`, 'Bowler Two', { battingStyle: 'right', bowlingStyle: 'Right-arm leg-break' }),
      createTestPlayer(`${id}_p10`, 'Bowler Three', { battingStyle: 'right', bowlingStyle: 'Left-arm orthodox' }),
      createTestPlayer(`${id}_p11`, 'Tail Ender', { battingStyle: 'right', bowlingStyle: 'Right-arm fast' }),
    ];
    return { id, name, shortName, adminPinHash: null, latitude: null, longitude: null, players, createdAt: Date.now(), updatedAt: Date.now() };
  }

  test('simulates a full T20 over with mixed deliveries', () => {
    const team1 = buildSyntheticTeam('s1', 'Thunderbolts', 'TBT');
    const team2 = buildSyntheticTeam('s2', 'Royal Strikers', 'RST');
    const config: MatchConfig = { format: 't20', ...FORMAT_CONFIGS.t20 };
    const match = createNewMatch('sm1', config, team1, team2,
      team1.players.map(p => p.id), team2.players.map(p => p.id),
      'Main Ground', Date.now()
    );
    let engine = new MatchEngine(match);
    engine = engine.recordToss({ winnerId: 's1', decision: 'bat' });
    engine = engine.startMatch('s1', 's2');
    engine = engine.setOpeners('s1_p1', 's1_p2');
    engine = engine.setBowler('s2_p8');

    // Over 1: 1, 4, W, 0, 6, 2
    engine = engine.recordBall(SINGLE);
    engine = engine.recordBall(FOUR);
    engine = engine.recordBall({
      ...DOT_BALL, dismissal: {
        type: 'bowled', batsmanId: 's1_p1',
      },
    });
    engine = engine.setNewBatter('s1_p3');
    engine = engine.recordBall(DOT_BALL);
    engine = engine.recordBall(SIX);
    engine = engine.recordBall({ ...DOT_BALL, runs: 2 });

    const inn = engine.getCurrentInnings()!;
    expect(inn.totalRuns).toBe(13);
    expect(inn.totalWickets).toBe(1);
    expect(inn.totalOvers).toBe(1);
    expect(inn.totalBalls).toBe(0);
  });

  test('all-rounder can bat and bowl in same match', () => {
    const team1 = buildSyntheticTeam('s1', 'Thunderbolts', 'TBT');
    const team2 = buildSyntheticTeam('s2', 'Royal Strikers', 'RST');
    const config: MatchConfig = { format: 't20', ...FORMAT_CONFIGS.t20 };
    const match = createNewMatch('sm2', config, team1, team2,
      team1.players.map(p => p.id), team2.players.map(p => p.id),
      'Main Ground', Date.now()
    );
    let engine = new MatchEngine(match);
    engine = engine.recordToss({ winnerId: 's1', decision: 'bat' });
    engine = engine.startMatch('s1', 's2');
    // s1_p3 is the all-rounder — open batting
    engine = engine.setOpeners('s1_p3', 's1_p2');
    // s2_p3 (allrounder) bowls
    engine = engine.setBowler('s2_p3');

    for (let i = 0; i < 6; i++) engine = engine.recordBall(SINGLE);

    const inn = engine.getCurrentInnings()!;
    expect(inn.totalRuns).toBe(6);
    // Verify the all-rounder batsman scored
    const arBatter = inn.batters.find(b => b.playerId === 's1_p3');
    expect(arBatter).toBeDefined();
    expect(arBatter!.runs).toBe(3); // struck alternate singles (starts as striker)
    // Verify the all-rounder bowler conceded
    const arBowler = inn.bowlers.find(b => b.playerId === 's2_p3');
    expect(arBowler).toBeDefined();
    expect(arBowler!.overs).toBe(1);
  });
});
