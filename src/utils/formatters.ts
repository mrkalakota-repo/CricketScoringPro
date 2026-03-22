import { BALLS_PER_OVER } from './constants';
import type { BallOutcome, DismissalType } from '../engine/types';

export function formatOvers(overs: number, balls: number): string {
  return balls === 0 ? `${overs}` : `${overs}.${balls}`;
}

export function formatScore(runs: number, wickets: number): string {
  return `${runs}/${wickets}`;
}

export function formatBatterScore(runs: number, balls: number, isNotOut: boolean): string {
  const notOutMarker = isNotOut ? '*' : '';
  return `${runs}${notOutMarker} (${balls})`;
}

export function formatBowlerFigures(wickets: number, runs: number): string {
  return `${wickets}/${runs}`;
}

export function formatBallOutcome(ball: BallOutcome): string {
  if (ball.dismissal) return 'W';
  if (!ball.isLegal) {
    const extra = ball.extras[0];
    if (extra?.type === 'wide') {
      // extra.runs = base wide penalty (1) + additional runs entered by scorer
      const additionalRuns = extra.runs - 1;
      return `Wd${additionalRuns > 0 ? `+${additionalRuns}` : ''}`;
    }
    if (extra?.type === 'no_ball') return `Nb${ball.runs > 0 ? `+${ball.runs}` : ''}`;
  }
  if (ball.extras.some(e => e.type === 'bye')) return `${ball.extras[0].runs}b`;
  if (ball.extras.some(e => e.type === 'leg_bye')) return `${ball.extras[0].runs}lb`;
  if (ball.runs === 0) return '.';
  return `${ball.runs}`;
}

export function dismissalDescription(type: DismissalType): string {
  const descriptions: Record<DismissalType, string> = {
    bowled: 'Bowled',
    caught: 'Caught',
    lbw: 'LBW',
    run_out: 'Run Out',
    stumped: 'Stumped',
    hit_wicket: 'Hit Wicket',
    handled_ball: 'Handled Ball',
    obstructing_field: 'Obstructing the Field',
    timed_out: 'Timed Out',
    hit_twice: 'Hit the Ball Twice',
    retired_hurt: 'Retired Hurt',
    retired_out: 'Retired Out',
  };
  return descriptions[type];
}

export function remainingBalls(totalOvers: number | null, completedOvers: number, currentBalls: number): number | null {
  if (totalOvers === null) return null;
  return totalOvers * BALLS_PER_OVER - (completedOvers * BALLS_PER_OVER + currentBalls);
}
