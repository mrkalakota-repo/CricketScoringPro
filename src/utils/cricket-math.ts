import { BALLS_PER_OVER } from './constants';

function totalBallsBowled(overs: number, balls: number): number {
  return overs * BALLS_PER_OVER + balls;
}

export function currentRunRate(runs: number, overs: number, balls: number): number {
  const totalBalls = totalBallsBowled(overs, balls);
  if (totalBalls === 0) return 0;
  return (runs / totalBalls) * BALLS_PER_OVER;
}

export function requiredRunRate(
  target: number,
  currentRuns: number,
  oversRemaining: number,
  ballsRemaining: number
): number {
  const runsNeeded = target - currentRuns;
  const totalBalls = totalBallsBowled(oversRemaining, ballsRemaining);
  if (totalBalls <= 0) return Infinity;
  return (runsNeeded / totalBalls) * BALLS_PER_OVER;
}

export function strikeRate(runs: number, ballsFaced: number): number {
  if (ballsFaced === 0) return 0;
  return (runs / ballsFaced) * 100;
}

export function economyRate(runsConceded: number, overs: number, balls: number): number {
  const totalBalls = totalBallsBowled(overs, balls);
  if (totalBalls === 0) return 0;
  return (runsConceded / totalBalls) * BALLS_PER_OVER;
}
