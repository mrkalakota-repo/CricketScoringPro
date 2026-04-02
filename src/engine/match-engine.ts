import { produce } from 'immer';

// Default UUID factory: uses the platform-provided crypto.randomUUID() (available in
// React Native / Expo via the global polyfill, and in modern Node.js for tests).
// Callers can inject a custom factory via the constructor for testing or non-Expo envs.
const defaultUuidFactory = (): string => {
  if (typeof globalThis !== 'undefined' && typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  // RFC 4122 v4 fallback (no external deps)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
};
import type {
  Match,
  Innings,
  BallOutcome,
  BallInput,
  BatterInnings,
  BowlerSpell,
  Partnership,
  Extra,
  Dismissal,
  OverSummary,
  ScoringAction,
  Toss,
  MatchConfig,
  FallOfWicket,
} from './types';
import { BALLS_PER_OVER, MAX_WICKETS_PER_INNINGS, DISMISSALS_NOT_CREDITED_TO_BOWLER, DISMISSALS_INVALID_ON_FREE_HIT } from '../utils/constants';
import { calculateDLSTarget, calculateGullyTarget } from '../utils/dls-calculator';

export class MatchEngine {
  private match: Match;
  private undoStack: ScoringAction[];
  private uuidFactory: () => string;

  constructor(match: Match, undoStack: ScoringAction[] = [], uuidFactory: () => string = defaultUuidFactory) {
    this.match = match;
    this.undoStack = undoStack;
    this.uuidFactory = uuidFactory;
  }

  getMatch(): Match {
    return this.match;
  }

  getUndoStack(): ScoringAction[] {
    return this.undoStack;
  }

  getCurrentInnings(): Innings | null {
    if (this.match.currentInningsIndex < 0 || this.match.currentInningsIndex >= this.match.innings.length) {
      return null;
    }
    return this.match.innings[this.match.currentInningsIndex];
  }

  getStriker(): BatterInnings | null {
    const innings = this.getCurrentInnings();
    if (!innings?.currentStrikerId) return null;
    return innings.batters.find(b => b.playerId === innings.currentStrikerId) ?? null;
  }

  getNonStriker(): BatterInnings | null {
    const innings = this.getCurrentInnings();
    if (!innings?.currentNonStrikerId) return null;
    return innings.batters.find(b => b.playerId === innings.currentNonStrikerId) ?? null;
  }

  getCurrentBowler(): BowlerSpell | null {
    const innings = this.getCurrentInnings();
    if (!innings?.currentBowlerId) return null;
    return innings.bowlers.find(b => b.playerId === innings.currentBowlerId) ?? null;
  }

  getCurrentPartnership(): Partnership | null {
    const innings = this.getCurrentInnings();
    if (!innings) return null;
    return innings.partnerships[innings.partnerships.length - 1] ?? null;
  }

  isFreeHit(): boolean {
    const innings = this.getCurrentInnings();
    if (!innings || innings.allBalls.length === 0) return false;
    const lastBall = innings.allBalls[innings.allBalls.length - 1];
    return !lastBall.isLegal && lastBall.extras.some(e => e.type === 'no_ball');
  }

  isInningsComplete(): boolean {
    const innings = this.getCurrentInnings();
    if (!innings) return true;
    return innings.status === 'completed' || innings.status === 'declared';
  }

  isMatchComplete(): boolean {
    return this.match.status === 'completed' || this.match.status === 'abandoned';
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  // ===== Match Lifecycle =====

  recordToss(toss: Toss): MatchEngine {
    const newMatch = produce(this.match, draft => {
      draft.toss = toss;
      draft.status = 'toss';
      draft.updatedAt = Date.now();
    });
    return new MatchEngine(newMatch, this.undoStack, this.uuidFactory);
  }

  startMatch(battingTeamId: string, bowlingTeamId: string): MatchEngine {
    const newMatch = produce(this.match, draft => {
      draft.status = 'in_progress';
      const innings = createInnings(
        this.uuidFactory(),
        1,
        battingTeamId,
        bowlingTeamId,
        draft.config
      );
      draft.innings = [innings];
      draft.currentInningsIndex = 0;
      draft.updatedAt = Date.now();
    });
    return new MatchEngine(newMatch, [], this.uuidFactory);
  }

  setOpeners(strikerId: string, nonStrikerId: string): MatchEngine {
    const newMatch = produce(this.match, draft => {
      const innings = draft.innings[draft.currentInningsIndex];
      innings.currentStrikerId = strikerId;
      innings.currentNonStrikerId = nonStrikerId;
      innings.batters = [
        createBatterInnings(strikerId, true, 1),
        createBatterInnings(nonStrikerId, false, 2),
      ];
      innings.partnerships = [createPartnership(strikerId, nonStrikerId)];
      draft.updatedAt = Date.now();
    });
    return new MatchEngine(newMatch, this.undoStack, this.uuidFactory);
  }

  setBowler(bowlerId: string): MatchEngine {
    const innings = this.getCurrentInnings();
    if (!innings) throw new Error('No active innings');

    // Consecutive overs rule: same bowler cannot bowl back-to-back overs
    if (innings.overs.length > 0) {
      const lastOver = innings.overs[innings.overs.length - 1];
      if (lastOver.bowlerId === bowlerId) {
        throw new Error('Same bowler cannot bowl consecutive overs');
      }
    }

    // Max overs per bowler rule (LOI only — Test has no limit)
    const { oversPerInnings } = this.match.config;
    if (oversPerInnings !== null) {
      const maxOversPerBowler = Math.floor(oversPerInnings / 5);
      const existingBowler = innings.bowlers.find(b => b.playerId === bowlerId);
      if (existingBowler && existingBowler.overs >= maxOversPerBowler) {
        throw new Error(`Bowler has already bowled the maximum ${maxOversPerBowler} overs`);
      }
    }

    const newMatch = produce(this.match, draft => {
      const inn = draft.innings[draft.currentInningsIndex];
      inn.currentBowlerId = bowlerId;
      const existingBowler = inn.bowlers.find(b => b.playerId === bowlerId);
      if (!existingBowler) {
        inn.bowlers.push(createBowlerSpell(bowlerId));
      }
      draft.updatedAt = Date.now();
    });
    return new MatchEngine(newMatch, this.undoStack, this.uuidFactory);
  }

  // ===== Core Scoring =====

  recordBall(input: BallInput): MatchEngine {
    const innings = this.getCurrentInnings();
    if (!innings || innings.status !== 'in_progress') {
      throw new Error('No active innings');
    }
    if (!innings.currentStrikerId || !innings.currentNonStrikerId || !innings.currentBowlerId) {
      throw new Error('Striker, non-striker, and bowler must be set');
    }

    // Validate free hit
    const freeHit = this.isFreeHit();
    if (freeHit && input.dismissal && DISMISSALS_INVALID_ON_FREE_HIT.has(input.dismissal.type)) {
      throw new Error(`Cannot dismiss batter with ${input.dismissal.type} on a free hit`);
    }

    // Snapshot for undo
    const previousSnapshot = structuredClone(innings);

    const isWide = input.isWide;
    const isNoBall = input.isNoBall;
    const isLegal = !isWide && !isNoBall;

    // Build extras
    const extras: Extra[] = [];
    let totalExtras = 0;
    if (isWide) {
      const wideRuns = this.match.config.wideRuns + input.runs;
      extras.push({ type: 'wide', runs: wideRuns });
      totalExtras += wideRuns;
    }
    if (isNoBall) {
      extras.push({ type: 'no_ball', runs: this.match.config.noBallRuns });
      totalExtras += this.match.config.noBallRuns;
    }
    if (input.isBye && !isWide) {
      extras.push({ type: 'bye', runs: input.runs });
      totalExtras += input.runs;
    }
    if (input.isLegBye && !isWide) {
      extras.push({ type: 'leg_bye', runs: input.runs });
      totalExtras += input.runs;
    }

    // Runs off bat (only if not bye/leg-bye/wide)
    const runsOffBat = (input.isBye || input.isLegBye || isWide) ? 0 : input.runs;
    const totalRuns = isNoBall
      ? this.match.config.noBallRuns + input.runs
      : isWide
        ? this.match.config.wideRuns + input.runs
        : (input.isBye || input.isLegBye)
          ? input.runs
          : input.runs;

    // Build dismissal
    let dismissal: Dismissal | null = null;
    if (input.dismissal) {
      dismissal = {
        type: input.dismissal.type,
        batsmanId: input.dismissal.batsmanId ?? innings.currentStrikerId,
        bowlerId: innings.currentBowlerId,
        fielderId: input.dismissal.fielderId ?? null,
      };
    }

    const ballOutcome: BallOutcome = {
      id: this.uuidFactory(),
      overNumber: innings.totalOvers,
      ballInOver: isLegal ? innings.totalBalls : innings.totalBalls,
      batsmanId: innings.currentStrikerId,
      nonStrikerId: innings.currentNonStrikerId,
      bowlerId: innings.currentBowlerId,
      runs: runsOffBat,
      extras,
      isLegal,
      isBoundary: input.isBoundary && runsOffBat >= 4,
      dismissal,
      isFreeHit: freeHit,
      timestamp: Date.now(),
      ...(input.scoringZone !== undefined ? { scoringZone: input.scoringZone } : {}),
    };

    const newMatch = produce(this.match, draft => {
      const inn = draft.innings[draft.currentInningsIndex];

      // Add ball to history
      inn.allBalls.push(ballOutcome);

      // Update innings totals
      inn.totalRuns += totalRuns;

      // Update extras breakdown
      if (isWide) inn.extras.wides += this.match.config.wideRuns + input.runs;
      if (isNoBall) inn.extras.noBalls += this.match.config.noBallRuns;
      if (input.isBye && !isWide) inn.extras.byes += input.runs;
      if (input.isLegBye && !isWide) inn.extras.legByes += input.runs;

      // Update batter stats
      const batter = inn.batters.find(b => b.playerId === inn.currentStrikerId);
      if (batter) {
        if (!isWide) {
          batter.ballsFaced += 1;
        }
        batter.runs += runsOffBat;
        if (input.isBoundary && runsOffBat === 4) batter.fours += 1;
        if (input.isBoundary && runsOffBat === 6) batter.sixes += 1;
      }

      // Update bowler stats
      const bowler = inn.bowlers.find(b => b.playerId === inn.currentBowlerId);
      if (bowler) {
        if (isLegal) bowler.ballsBowled += 1;
        if (isWide) {
          bowler.wides += 1;
          bowler.runsConceded += this.match.config.wideRuns + input.runs;
        } else if (isNoBall) {
          bowler.noBalls += 1;
          bowler.runsConceded += this.match.config.noBallRuns + runsOffBat;
        } else if (input.isBye || input.isLegBye) {
          // Byes/leg-byes don't count against bowler
        } else {
          bowler.runsConceded += runsOffBat;
        }
        if (dismissal && !DISMISSALS_NOT_CREDITED_TO_BOWLER.has(dismissal.type)) {
          bowler.wickets += 1;
        }
      }

      // Update partnership
      const partnership = inn.partnerships[inn.partnerships.length - 1];
      if (partnership) {
        partnership.runs += totalRuns;
        if (!isWide) partnership.balls += 1;
        if (inn.currentStrikerId === partnership.batter1Id) {
          partnership.batter1Runs += runsOffBat;
        } else {
          partnership.batter2Runs += runsOffBat;
        }
        if (isWide || isNoBall || input.isBye || input.isLegBye) {
          partnership.extras += totalExtras;
        }
      }

      // ── Strike rotation on odd runs (always, before over-completion swap) ──
      // For no-ball: only bat runs count (NB penalty doesn't cross batsmen)
      // For wide: no bat runs, no rotation
      {
        const runsForRotation = isWide ? 0 : (isNoBall ? runsOffBat : totalRuns);
        if (runsForRotation % 2 === 1) {
          const temp = inn.currentStrikerId;
          inn.currentStrikerId = inn.currentNonStrikerId;
          inn.currentNonStrikerId = temp;
          inn.batters.forEach(b => {
            b.isOnStrike = b.playerId === inn.currentStrikerId;
          });
        }
      }

      // ── Legal ball count and over completion ──
      if (isLegal) {
        inn.totalBalls += 1;

        // Check over completion
        if (inn.totalBalls === BALLS_PER_OVER) {
          // Complete the over
          if (bowler) {
            bowler.overs += 1;
            // Check maiden
            const currentOverBalls = inn.allBalls.filter(
              b => b.overNumber === inn.totalOvers && b.bowlerId === inn.currentBowlerId
            );
            const overRuns = currentOverBalls.reduce((sum, b) => {
              return sum + b.runs + b.extras.reduce((es, e) => es + e.runs, 0);
            }, 0);
            if (overRuns === 0) bowler.maidens += 1;
            bowler.ballsBowled = 0;
          }

          // Create over summary
          const overBalls = inn.allBalls.filter(b => b.overNumber === inn.totalOvers);
          const overRuns = overBalls.reduce((sum, b) => sum + b.runs + b.extras.reduce((es, e) => es + e.runs, 0), 0);
          const overWickets = overBalls.filter(b => b.dismissal !== null).length;
          inn.overs.push({
            number: inn.totalOvers,
            bowlerId: inn.currentBowlerId!,
            balls: overBalls,
            runs: overRuns,
            wickets: overWickets,
            isMaiden: overRuns === 0,
          });

          inn.totalOvers += 1;
          inn.totalBalls = 0;
          inn.currentBowlerId = null; // Must be set for next over

          // Rotate strike at end of over (separate from odd-run rotation)
          const temp = inn.currentStrikerId;
          inn.currentStrikerId = inn.currentNonStrikerId;
          inn.currentNonStrikerId = temp;
          inn.batters.forEach(b => {
            b.isOnStrike = b.playerId === inn.currentStrikerId;
          });
        }
      }

      // Handle wicket
      if (dismissal) {
        // retired_hurt is NOT a wicket (batter retires but can return; doesn't count against 10)
        if (dismissal.type !== 'retired_hurt') {
          inn.totalWickets += 1;

          // Record fall of wicket
          inn.fallOfWickets.push({
            wicketNumber: inn.totalWickets,
            runs: inn.totalRuns,
            overs: inn.totalOvers,
            ballsInOver: inn.totalBalls,
            playerId: dismissal.batsmanId,
            dismissal,
          });
        }

        // Mark batter as dismissed (always, including retired_hurt)
        const dismissedBatter = inn.batters.find(b => b.playerId === dismissal!.batsmanId);
        if (dismissedBatter) {
          dismissedBatter.dismissal = dismissal;
          dismissedBatter.isOnStrike = false;
        }

        // If dismissed batter was the original striker (before this ball), new batter takes strike
        if (dismissal.batsmanId === ballOutcome.batsmanId) {
          inn.currentStrikerId = null; // Must be set by caller
        } else {
          // Non-striker dismissed (e.g. run out)
          inn.currentNonStrikerId = null;
        }
      }

      // Check innings completion (super over: max 2 wickets, 1 over)
      const maxWickets = inn.isSuperOver ? 2 : MAX_WICKETS_PER_INNINGS(this.match.config.playersPerSide);
      const oversLimit = inn.isSuperOver ? 1 : this.match.config.oversPerInnings;
      const isAllOut = inn.totalWickets >= maxWickets;
      const isOversComplete = oversLimit !== null &&
        inn.totalOvers >= oversLimit && inn.totalBalls === 0;
      const isTargetReached = inn.target !== null && inn.totalRuns >= inn.target;

      if (isAllOut || isOversComplete || isTargetReached) {
        inn.status = 'completed';
        inn.currentStrikerId = null;
        inn.currentNonStrikerId = null;
        inn.currentBowlerId = null;

        // Check if match is complete
        this.checkMatchCompletion(draft);
      }

      draft.updatedAt = Date.now();
    });

    const newUndoStack = [...this.undoStack, {
      ballOutcome,
      previousInningsSnapshot: previousSnapshot,
      timestamp: Date.now(),
    }];

    return new MatchEngine(newMatch, newUndoStack, this.uuidFactory);
  }

  undoLastBall(): MatchEngine {
    if (this.undoStack.length === 0) {
      throw new Error('Nothing to undo');
    }

    const lastAction = this.undoStack[this.undoStack.length - 1];
    const newMatch = produce(this.match, draft => {
      draft.innings[draft.currentInningsIndex] = structuredClone(lastAction.previousInningsSnapshot);
      draft.updatedAt = Date.now();
      // Reset match status if innings was just completed
      if (draft.status === 'completed') {
        draft.status = 'in_progress';
        draft.result = null;
      }
    });

    return new MatchEngine(newMatch, this.undoStack.slice(0, -1), this.uuidFactory);
  }

  // ===== Innings Transitions =====

  startSuperOver(): MatchEngine {
    if (this.match.result !== 'Match Tied') {
      throw new Error('Super over can only be started after a tie');
    }
    if (this.match.config.maxInnings !== 2) {
      throw new Error('Super over only available for limited overs matches');
    }
    // Team that batted second in main match bats first in super over
    const mainInnings2 = this.match.innings[1];
    const soInn1BattingTeamId = mainInnings2.battingTeamId;
    const soInn1BowlingTeamId = mainInnings2.bowlingTeamId;

    const newMatch = produce(this.match, draft => {
      draft.status = 'in_progress';
      draft.result = null;
      draft.superOver = true;
      const soInnings = createInnings(this.uuidFactory(), draft.innings.length + 1, soInn1BattingTeamId, soInn1BowlingTeamId, draft.config);
      soInnings.isSuperOver = true;
      draft.innings.push(soInnings);
      draft.currentInningsIndex = draft.innings.length - 1;
      draft.updatedAt = Date.now();
    });
    return new MatchEngine(newMatch, this.undoStack, this.uuidFactory);
  }

  startNextInnings(): MatchEngine {
    const currentInnings = this.getCurrentInnings();
    if (!currentInnings || currentInnings.status === 'in_progress') {
      throw new Error('Current innings is still in progress');
    }

    // Super over: transition from SO innings 1 → SO innings 2
    if (currentInnings.isSuperOver) {
      const soInnings = this.match.innings.filter(i => i.isSuperOver);
      if (soInnings.length >= 2) throw new Error('Super over already complete');
      const battingTeamId = currentInnings.bowlingTeamId;
      const bowlingTeamId = currentInnings.battingTeamId;
      const target = currentInnings.totalRuns + 1;
      const newMatch = produce(this.match, draft => {
        const soInn2 = createInnings(this.uuidFactory(), draft.innings.length + 1, battingTeamId, bowlingTeamId, draft.config);
        soInn2.isSuperOver = true;
        soInn2.target = target;
        draft.innings.push(soInn2);
        draft.currentInningsIndex = draft.innings.length - 1;
        draft.updatedAt = Date.now();
      });
      return new MatchEngine(newMatch, this.undoStack, this.uuidFactory);
    }

    const nextInningsNumber = currentInnings.inningsNumber + 1;
    if (nextInningsNumber > this.match.config.maxInnings) {
      throw new Error('Maximum innings reached');
    }

    // Determine batting/bowling teams
    const battingTeamId = currentInnings.bowlingTeamId;
    const bowlingTeamId = currentInnings.battingTeamId;

    // Calculate target for 2nd innings in LOI
    let target: number | null = null;
    if (this.match.config.maxInnings === 2 && nextInningsNumber === 2) {
      target = currentInnings.totalRuns + 1;
    }
    // For Tests, target is set in 4th innings
    if (this.match.config.maxInnings === 4 && nextInningsNumber === 4) {
      const team1Runs = this.match.innings
        .filter(i => i.battingTeamId === battingTeamId)
        .reduce((sum, i) => sum + i.totalRuns, 0);
      const team2Runs = this.match.innings
        .filter(i => i.battingTeamId === bowlingTeamId)
        .reduce((sum, i) => sum + i.totalRuns, 0);
      target = team2Runs - team1Runs + 1;
    }

    const newMatch = produce(this.match, draft => {
      const newInnings = createInnings(
        this.uuidFactory(),
        nextInningsNumber,
        battingTeamId,
        bowlingTeamId,
        draft.config
      );
      newInnings.target = target;
      draft.innings.push(newInnings);
      draft.currentInningsIndex = draft.innings.length - 1;
      draft.updatedAt = Date.now();
    });

    return new MatchEngine(newMatch, [], this.uuidFactory);
  }

  declareInnings(): MatchEngine {
    if (this.match.config.format !== 'test') {
      throw new Error('Can only declare in Test matches');
    }
    const newMatch = produce(this.match, draft => {
      const inn = draft.innings[draft.currentInningsIndex];
      inn.status = 'declared';
      inn.currentStrikerId = null;
      inn.currentNonStrikerId = null;
      inn.currentBowlerId = null;
      draft.updatedAt = Date.now();
    });
    return new MatchEngine(newMatch, this.undoStack, this.uuidFactory);
  }

  /** Mark the match as abandoned (rain, no result, etc). Closes the active innings. */
  abandonMatch(): MatchEngine {
    const newMatch = produce(this.match, draft => {
      const inn = draft.innings[draft.currentInningsIndex];
      if (inn && inn.status === 'in_progress') {
        inn.status = 'completed';
        inn.currentStrikerId = null;
        inn.currentNonStrikerId = null;
        inn.currentBowlerId = null;
      }
      draft.status = 'abandoned';
      draft.result = 'Match abandoned';
      draft.updatedAt = Date.now();
    });
    return new MatchEngine(newMatch, [], this.uuidFactory);
  }

  /**
   * Apply a DLS or Gully-mode rain interruption ruling to the current (2nd) innings.
   * Updates revisedTarget, revisedOvers, dlsMode, and dlsGullyRunsPerOver on the innings.
   *
   * @param newOvers      Revised overs quota after the interruption
   * @param mode          'standard' for DLS table calculation, 'gully' for custom RPO rule
   * @param gullyRPO      Required when mode === 'gully' — custom runs-per-over rate
   */
  applyDLS(newOvers: number, mode: 'standard' | 'gully' = 'standard', gullyRPO?: number): MatchEngine {
    const innings = this.getCurrentInnings();
    if (!innings || innings.inningsNumber !== 2) {
      throw new Error('DLS can only be applied to the 2nd innings');
    }
    const { oversPerInnings } = this.match.config;
    if (!oversPerInnings) throw new Error('DLS is not applicable to Test matches');

    const firstInningsRuns = this.match.innings[0]?.totalRuns ?? 0;

    let revisedTarget: number;
    if (mode === 'gully') {
      if (gullyRPO === undefined || gullyRPO <= 0) throw new Error('Gully mode requires a positive runs-per-over value');
      revisedTarget = calculateGullyTarget(firstInningsRuns, oversPerInnings, newOvers, gullyRPO);
    } else {
      revisedTarget = calculateDLSTarget(
        firstInningsRuns,
        oversPerInnings,
        newOvers,
        innings.totalWickets,
        innings.totalOvers + innings.totalBalls / 6,
      );
    }

    const newMatch = produce(this.match, draft => {
      const inn = draft.innings[draft.currentInningsIndex];
      inn.revisedTarget = revisedTarget;
      inn.revisedOvers = newOvers;
      inn.dlsMode = mode;
      inn.dlsGullyRunsPerOver = mode === 'gully' ? gullyRPO : undefined;
      inn.target = revisedTarget; // update the live target so RRR is calculated correctly
      draft.updatedAt = Date.now();
    });
    return new MatchEngine(newMatch, this.undoStack, this.uuidFactory);
  }

  canFollowOn(): boolean {
    if (this.match.config.format !== 'test' || this.match.config.followOnMinimum === null) {
      return false;
    }
    if (this.match.innings.length < 2) return false;
    const firstInnings = this.match.innings[0];
    const secondInnings = this.match.innings[1];
    if (secondInnings.status === 'in_progress') return false;
    return firstInnings.totalRuns - secondInnings.totalRuns >= this.match.config.followOnMinimum;
  }

  // ===== New Batter =====

  setNewBatter(batterId: string): MatchEngine {
    const newMatch = produce(this.match, draft => {
      const inn = draft.innings[draft.currentInningsIndex];
      const nextPosition = inn.batters.length + 1;
      const newBatter = createBatterInnings(batterId, false, nextPosition);

      if (inn.currentStrikerId === null) {
        inn.currentStrikerId = batterId;
        newBatter.isOnStrike = true;
      } else {
        inn.currentNonStrikerId = batterId;
      }

      inn.batters.push(newBatter);

      // Start new partnership
      if (inn.currentStrikerId && inn.currentNonStrikerId) {
        inn.partnerships.push(
          createPartnership(inn.currentStrikerId, inn.currentNonStrikerId)
        );
      }

      draft.updatedAt = Date.now();
    });
    return new MatchEngine(newMatch, this.undoStack, this.uuidFactory);
  }

  // Retire a batter mid-innings (retired hurt or retired out).
  // Does NOT consume a ball delivery — this happens between balls.
  // retired_hurt: NOT a wicket (batter may return later)
  // retired_out:  IS a wicket
  retireBatter(batsmanId: string, type: 'retired_hurt' | 'retired_out'): MatchEngine {
    const newMatch = produce(this.match, draft => {
      const inn = draft.innings[draft.currentInningsIndex];

      const dismissal: Dismissal = { type, batsmanId, bowlerId: '', fielderId: null };

      // Mark batter as dismissed with the retirement type
      const batter = inn.batters.find(b => b.playerId === batsmanId);
      if (batter) {
        batter.dismissal = dismissal;
        batter.isOnStrike = false;
      }

      // retired_out counts as a wicket; retired_hurt does not
      if (type === 'retired_out') {
        inn.totalWickets += 1;
        inn.fallOfWickets.push({
          wicketNumber: inn.totalWickets,
          runs: inn.totalRuns,
          overs: inn.totalOvers,
          ballsInOver: inn.totalBalls,
          playerId: batsmanId,
          dismissal,
        });
      }

      // Clear the crease slot
      if (inn.currentStrikerId === batsmanId) {
        inn.currentStrikerId = null;
      } else if (inn.currentNonStrikerId === batsmanId) {
        inn.currentNonStrikerId = null;
      }

      draft.updatedAt = Date.now();
    });
    return new MatchEngine(newMatch, this.undoStack, this.uuidFactory);
  }

  swapStrike(): MatchEngine {
    const newMatch = produce(this.match, draft => {
      const inn = draft.innings[draft.currentInningsIndex];
      if (!inn.currentStrikerId || !inn.currentNonStrikerId) return;
      const temp = inn.currentStrikerId;
      inn.currentStrikerId = inn.currentNonStrikerId;
      inn.currentNonStrikerId = temp;
      for (const b of inn.batters) {
        b.isOnStrike = b.playerId === inn.currentStrikerId;
      }
      draft.updatedAt = Date.now();
    });
    return new MatchEngine(newMatch, this.undoStack, this.uuidFactory);
  }

  // ===== Private Helpers =====

  private checkMatchCompletion(draft: Match): void {
    const config = draft.config;
    const innings = draft.innings;
    const currentInnings = innings[draft.currentInningsIndex];

    // Super over completion
    if (draft.superOver && currentInnings.isSuperOver) {
      const soInnings = innings.filter(i => i.isSuperOver);
      if (soInnings.length === 2 && soInnings[1].status === 'completed') {
        draft.status = 'completed';
        const so1 = soInnings[0];
        const so2 = soInnings[1];
        if (so2.totalRuns >= so2.target!) {
          const wicketsRemaining = 2 - so2.totalWickets;
          draft.result = `${this.getBattingTeamName(so2.battingTeamId)} won Super Over by ${wicketsRemaining} wicket${wicketsRemaining !== 1 ? 's' : ''}`;
        } else if (so2.totalRuns === so1.totalRuns) {
          draft.result = 'Super Over Tied';
        } else {
          const runDiff = so1.totalRuns - so2.totalRuns;
          draft.result = `${this.getBattingTeamName(so1.battingTeamId)} won Super Over by ${runDiff} run${runDiff !== 1 ? 's' : ''}`;
        }
      }
      return;
    }

    if (config.maxInnings === 2) {
      // Limited overs: match is complete after 2nd innings or if target is reached
      if (draft.currentInningsIndex === 1 && currentInnings.status === 'completed') {
        draft.status = 'completed';
        const firstInnings = innings[0];
        const secondInnings = innings[1];

        if (secondInnings.totalRuns >= firstInnings.totalRuns + 1) {
          const wicketsRemaining = config.playersPerSide - 1 - secondInnings.totalWickets;
          const battingTeam = this.getBattingTeamName(secondInnings.battingTeamId);
          draft.result = `${battingTeam} won by ${wicketsRemaining} wicket${wicketsRemaining !== 1 ? 's' : ''}`;
        } else if (secondInnings.totalRuns === firstInnings.totalRuns) {
          draft.result = 'Match Tied';
        } else {
          const runDiff = firstInnings.totalRuns - secondInnings.totalRuns;
          const bowlingTeam = this.getBattingTeamName(firstInnings.battingTeamId);
          draft.result = `${bowlingTeam} won by ${runDiff} run${runDiff !== 1 ? 's' : ''}`;
        }
      }
    } else if (config.maxInnings === 4) {
      // Test match completion logic
      if (draft.currentInningsIndex === 3 && currentInnings.status === 'completed') {
        draft.status = 'completed';
        // Calculate total runs for each team
        const team1Id = innings[0].battingTeamId;
        const team1Runs = innings.filter(i => i.battingTeamId === team1Id).reduce((s, i) => s + i.totalRuns, 0);
        const team2Runs = innings.filter(i => i.battingTeamId !== team1Id).reduce((s, i) => s + i.totalRuns, 0);

        if (team1Runs > team2Runs) {
          draft.result = `${this.getBattingTeamName(team1Id)} won`;
        } else if (team2Runs > team1Runs) {
          const team2Id = innings[1].battingTeamId;
          draft.result = `${this.getBattingTeamName(team2Id)} won`;
        } else {
          draft.result = 'Match Tied';
        }
      }
    }
  }

  private getBattingTeamName(teamId: string): string {
    if (this.match.team1.id === teamId) return this.match.team1.name;
    if (this.match.team2.id === teamId) return this.match.team2.name;
    return teamId;
  }
}

// ===== Factory Functions =====

function createInnings(
  id: string,
  inningsNumber: number,
  battingTeamId: string,
  bowlingTeamId: string,
  config: MatchConfig
): Innings {
  return {
    id,
    inningsNumber,
    battingTeamId,
    bowlingTeamId,
    status: 'in_progress',
    totalRuns: 0,
    totalWickets: 0,
    totalOvers: 0,
    totalBalls: 0,
    extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalties: 0 },
    batters: [],
    bowlers: [],
    partnerships: [],
    overs: [],
    allBalls: [],
    currentStrikerId: null,
    currentNonStrikerId: null,
    currentBowlerId: null,
    fallOfWickets: [],
    powerplays: config.powerplays,
    target: null,
    isSuperOver: false,
  };
}

function createBatterInnings(
  playerId: string,
  isOnStrike: boolean,
  position: number
): BatterInnings {
  return {
    playerId,
    runs: 0,
    ballsFaced: 0,
    fours: 0,
    sixes: 0,
    dismissal: null,
    isOnStrike,
    battingPosition: position,
  };
}

function createBowlerSpell(playerId: string): BowlerSpell {
  return {
    playerId,
    overs: 0,
    ballsBowled: 0,
    maidens: 0,
    runsConceded: 0,
    wickets: 0,
    wides: 0,
    noBalls: 0,
  };
}

function createPartnership(batter1Id: string, batter2Id: string): Partnership {
  return {
    batter1Id,
    batter2Id,
    runs: 0,
    balls: 0,
    batter1Runs: 0,
    batter2Runs: 0,
    extras: 0,
  };
}

// ===== Match Factory =====

export function createNewMatch(
  id: string,
  config: MatchConfig,
  team1: Match['team1'],
  team2: Match['team2'],
  team1PlayingXI: string[],
  team2PlayingXI: string[],
  venue: string,
  date: number
): Match {
  return {
    id,
    config: { ...config, format: config.format },
    status: 'scheduled',
    team1,
    team2,
    team1PlayingXI,
    team2PlayingXI,
    toss: null,
    innings: [],
    currentInningsIndex: -1,
    venue,
    date,
    result: null,
    superOver: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
