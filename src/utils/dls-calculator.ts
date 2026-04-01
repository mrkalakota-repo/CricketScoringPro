/**
 * DLS (Duckworth-Lewis-Stern) Calculator — Standard Edition
 *
 * Resource percentage tables adapted from the Standard Edition DLS method.
 * Rows = wickets lost (0–9); Columns = overs remaining (1–50).
 * Values represent the percentage of batting resources still available.
 *
 * Source: Standard Edition resource table (publicly documented).
 */

// Resource percentages indexed by [wicketsLost][oversRemaining - 1]
// Covers 1–50 overs remaining (index 0 = 1 over remaining, index 49 = 50 overs)
const RESOURCE_TABLE: number[][] = [
  // 0 wickets lost
  [3.6, 7.0, 10.2, 13.3, 16.3, 19.2, 21.9, 24.5, 27.0, 29.4, 31.7, 33.9, 36.0, 38.0, 39.9, 41.7, 43.5, 45.1, 46.7, 48.2, 49.6, 51.0, 52.3, 53.6, 54.8, 55.9, 57.0, 58.1, 59.1, 60.1, 61.1, 62.0, 62.9, 63.7, 64.6, 65.4, 66.1, 66.9, 67.6, 68.3, 68.9, 69.6, 70.2, 70.8, 71.4, 71.9, 72.5, 73.0, 73.5, 100.0],
  // 1 wicket lost
  [3.2, 6.3, 9.2, 12.0, 14.7, 17.3, 19.8, 22.1, 24.4, 26.6, 28.7, 30.7, 32.7, 34.5, 36.3, 38.0, 39.7, 41.3, 42.8, 44.3, 45.7, 47.1, 48.4, 49.7, 50.9, 52.1, 53.3, 54.4, 55.5, 56.5, 57.5, 58.5, 59.4, 60.3, 61.2, 62.0, 62.8, 63.6, 64.4, 65.2, 65.9, 66.6, 67.3, 68.0, 68.7, 69.3, 69.9, 70.6, 71.2, 93.4],
  // 2 wickets lost
  [2.8, 5.5, 8.0, 10.5, 12.9, 15.2, 17.4, 19.5, 21.6, 23.6, 25.5, 27.4, 29.2, 31.0, 32.7, 34.3, 35.9, 37.5, 39.0, 40.4, 41.8, 43.1, 44.4, 45.7, 46.9, 48.1, 49.3, 50.4, 51.5, 52.6, 53.6, 54.6, 55.5, 56.5, 57.4, 58.3, 59.2, 60.0, 60.9, 61.7, 62.5, 63.3, 64.0, 64.8, 65.5, 66.3, 67.0, 67.7, 68.4, 85.1],
  // 3 wickets lost
  [2.4, 4.7, 6.9, 9.1, 11.2, 13.2, 15.2, 17.1, 19.0, 20.8, 22.6, 24.3, 26.0, 27.7, 29.3, 30.9, 32.4, 33.9, 35.4, 36.8, 38.2, 39.5, 40.8, 42.1, 43.4, 44.6, 45.8, 47.0, 48.1, 49.2, 50.3, 51.4, 52.4, 53.4, 54.4, 55.3, 56.3, 57.2, 58.1, 58.9, 59.8, 60.7, 61.5, 62.3, 63.1, 63.9, 64.7, 65.5, 66.3, 75.1],
  // 4 wickets lost
  [2.0, 4.0, 5.9, 7.7, 9.5, 11.3, 13.1, 14.7, 16.4, 18.0, 19.6, 21.2, 22.7, 24.2, 25.7, 27.1, 28.5, 29.9, 31.3, 32.6, 33.9, 35.2, 36.4, 37.7, 38.9, 40.1, 41.2, 42.4, 43.5, 44.6, 45.7, 46.8, 47.8, 48.9, 49.9, 50.9, 51.9, 52.8, 53.8, 54.7, 55.7, 56.6, 57.5, 58.4, 59.3, 60.1, 61.0, 61.8, 62.7, 63.5],
  // 5 wickets lost
  [1.6, 3.2, 4.7, 6.2, 7.7, 9.2, 10.6, 12.0, 13.4, 14.8, 16.1, 17.5, 18.8, 20.1, 21.4, 22.7, 23.9, 25.2, 26.4, 27.6, 28.7, 29.9, 31.0, 32.1, 33.2, 34.3, 35.4, 36.4, 37.5, 38.5, 39.5, 40.5, 41.4, 42.4, 43.3, 44.3, 45.2, 46.1, 47.0, 47.9, 48.8, 49.7, 50.5, 51.4, 52.3, 53.1, 54.0, 54.8, 55.7, 56.5],
  // 6 wickets lost
  [1.2, 2.4, 3.6, 4.8, 6.0, 7.1, 8.3, 9.4, 10.5, 11.7, 12.8, 13.9, 14.9, 16.0, 17.0, 18.1, 19.1, 20.1, 21.1, 22.1, 23.1, 24.1, 25.0, 26.0, 26.9, 27.9, 28.8, 29.7, 30.7, 31.6, 32.5, 33.4, 34.2, 35.1, 36.0, 36.9, 37.7, 38.6, 39.4, 40.3, 41.1, 42.0, 42.8, 43.6, 44.4, 45.3, 46.1, 46.9, 47.7, 48.5],
  // 7 wickets lost
  [0.8, 1.7, 2.5, 3.4, 4.2, 5.0, 5.9, 6.7, 7.5, 8.4, 9.2, 10.0, 10.8, 11.6, 12.4, 13.2, 14.0, 14.8, 15.6, 16.4, 17.2, 18.0, 18.8, 19.5, 20.3, 21.1, 21.9, 22.6, 23.4, 24.2, 24.9, 25.7, 26.4, 27.2, 27.9, 28.7, 29.4, 30.2, 30.9, 31.6, 32.4, 33.1, 33.8, 34.5, 35.3, 36.0, 36.7, 37.4, 38.1, 38.9],
  // 8 wickets lost
  [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0, 9.5, 10.0, 10.5, 11.0, 11.5, 12.0, 12.5, 13.0, 13.5, 14.0, 14.5, 15.0, 15.5, 16.0, 16.5, 17.0, 17.5, 18.0, 18.5, 19.0, 19.5, 20.0, 20.5, 21.0, 21.5, 22.0, 22.5, 23.0, 23.5, 24.0, 24.5, 25.0],
  // 9 wickets lost
  [0.2, 0.5, 0.7, 1.0, 1.2, 1.5, 1.7, 2.0, 2.2, 2.5, 2.7, 3.0, 3.2, 3.5, 3.7, 4.0, 4.2, 4.5, 4.7, 5.0, 5.2, 5.5, 5.7, 6.0, 6.2, 6.5, 6.7, 7.0, 7.2, 7.5, 7.7, 8.0, 8.2, 8.5, 8.7, 9.0, 9.2, 9.5, 9.7, 10.0, 10.2, 10.5, 10.7, 11.0, 11.2, 11.5, 11.7, 12.0, 12.2, 12.5],
];

/** Look up the resource percentage remaining for a given wickets-lost and overs-remaining. */
export function getResourcePercentage(wicketsLost: number, oversRemaining: number): number {
  const wIdx = Math.min(Math.max(wicketsLost, 0), 9);
  const oIdx = Math.min(Math.max(Math.round(oversRemaining), 1), 50) - 1;
  return RESOURCE_TABLE[wIdx][oIdx];
}

/**
 * Calculate the DLS revised target for the 2nd innings.
 *
 * @param team1Runs       First innings total
 * @param fullOvers       Original overs per innings
 * @param newOvers        Revised overs quota after interruption
 * @param wicketsLost2    Wickets lost in 2nd innings BEFORE the interruption
 * @param oversUsed2      Overs used in 2nd innings before the interruption
 */
export function calculateDLSTarget(
  team1Runs: number,
  fullOvers: number,
  newOvers: number,
  wicketsLost2: number = 0,
  oversUsed2: number = 0,
): number {
  const r1 = getResourcePercentage(0, fullOvers); // Team 1 started with full resources
  const rUsed = getResourcePercentage(wicketsLost2, oversUsed2);
  const rNew = getResourcePercentage(wicketsLost2, newOvers - oversUsed2);
  const r2 = rUsed + rNew;

  const revisedTarget = Math.round(team1Runs * (r2 / r1)) + 1;
  return Math.max(revisedTarget, 1);
}

/**
 * Calculate the DLS par score at any point during the 2nd innings.
 * "Par" = the score the batting team needs to be at to be level on resources.
 *
 * @param revisedTarget   The DLS-revised target (from calculateDLSTarget)
 * @param team1Runs       First innings total
 * @param fullOvers       Original overs per innings
 * @param wicketsLost     Current wickets lost in 2nd innings
 * @param oversCompleted  Completed overs in 2nd innings
 * @param ballsInOver     Balls bowled in the current incomplete over
 */
export function calculateDLSParScore(
  revisedTarget: number,
  team1Runs: number,
  fullOvers: number,
  wicketsLost: number,
  oversCompleted: number,
  ballsInOver: number,
): number {
  const oversUsed = oversCompleted + ballsInOver / 6;
  const oversRemaining = Math.max(fullOvers - oversUsed, 0);
  const rRemaining = getResourcePercentage(wicketsLost, Math.ceil(oversRemaining));
  const rFull = getResourcePercentage(0, fullOvers);
  const parScore = Math.round(revisedTarget - 1 - team1Runs * (rRemaining / rFull));
  return Math.max(parScore, 0);
}

/**
 * Calculate a "Gully Mode" revised target using a simple runs-per-over multiplier.
 * Used when the league has its own custom rain rule instead of standard DLS.
 *
 * @param team1Runs       First innings total
 * @param fullOvers       Original overs per innings
 * @param newOvers        Revised overs quota
 * @param gullyRunsPerOver  Custom RPO rate agreed by the league
 */
export function calculateGullyTarget(
  team1Runs: number,
  fullOvers: number,
  newOvers: number,
  gullyRunsPerOver: number,
): number {
  const fullRate = team1Runs / fullOvers;
  const lostovers = fullOvers - newOvers;
  const adjustedTarget = Math.round(team1Runs - lostovers * gullyRunsPerOver) + 1;
  return Math.max(adjustedTarget, 1);
}
