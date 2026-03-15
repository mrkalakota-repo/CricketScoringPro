/**
 * Player career statistics computed from completed match state JSON.
 * Pass the full Match objects (parsed from match_state_json) for each completed match.
 */
import type { Match } from '../engine/types';

export interface BattingCareer {
  innings: number;
  notOuts: number;
  runs: number;
  ballsFaced: number;
  highest: number;
  average: number;   // runs / dismissals
  strikeRate: number; // (runs / ballsFaced) * 100
  fifties: number;
  hundreds: number;
  fours: number;
  sixes: number;
}

export interface BowlingCareer {
  innings: number;    // innings where bowled at least 1 ball
  balls: number;
  wickets: number;
  runsConceded: number;
  maidens: number;
  economy: number;    // runs per over
  average: number;    // runs per wicket
  bestWickets: number;
  bestRuns: number;   // runs conceded in best spell
}

export interface PlayerCareerStats {
  matchesPlayed: number;
  batting: BattingCareer;
  bowling: BowlingCareer;
}

export function computePlayerStats(playerId: string, matches: Match[]): PlayerCareerStats {
  const batting: BattingCareer = {
    innings: 0, notOuts: 0, runs: 0, ballsFaced: 0,
    highest: 0, average: 0, strikeRate: 0,
    fifties: 0, hundreds: 0, fours: 0, sixes: 0,
  };
  const bowling: BowlingCareer = {
    innings: 0, balls: 0, wickets: 0, runsConceded: 0, maidens: 0,
    economy: 0, average: 0, bestWickets: 0, bestRuns: Infinity,
  };

  const matchSet = new Set<string>();

  for (const match of matches) {
    if (match.status !== 'completed') continue;

    for (const innings of match.innings) {
      const bat = innings.batters.find(b => b.playerId === playerId);
      if (bat) {
        matchSet.add(match.id);
        batting.innings++;
        batting.runs += bat.runs;
        batting.ballsFaced += bat.ballsFaced;
        batting.fours += bat.fours;
        batting.sixes += bat.sixes;
        if (bat.runs > batting.highest) batting.highest = bat.runs;
        if (bat.runs >= 100) batting.hundreds++;
        else if (bat.runs >= 50) batting.fifties++;
        if (!bat.dismissal) batting.notOuts++;
      }

      const bowl = innings.bowlers.find(b => b.playerId === playerId);
      if (bowl && (bowl.overs > 0 || bowl.ballsBowled > 0)) {
        matchSet.add(match.id);
        bowling.innings++;
        const totalBalls = bowl.overs * 6 + bowl.ballsBowled;
        bowling.balls += totalBalls;
        bowling.wickets += bowl.wickets;
        bowling.runsConceded += bowl.runsConceded;
        bowling.maidens += bowl.maidens;

        // Track best figures
        if (
          bowl.wickets > bowling.bestWickets ||
          (bowl.wickets === bowling.bestWickets && bowl.runsConceded < bowling.bestRuns)
        ) {
          bowling.bestWickets = bowl.wickets;
          bowling.bestRuns = bowl.runsConceded;
        }
      }
    }
  }

  // Derived batting
  const dismissals = batting.innings - batting.notOuts;
  batting.average = dismissals > 0 ? batting.runs / dismissals : batting.runs > 0 ? batting.runs : 0;
  batting.strikeRate = batting.ballsFaced > 0 ? (batting.runs / batting.ballsFaced) * 100 : 0;

  // Derived bowling
  bowling.economy = bowling.balls > 0 ? (bowling.runsConceded / bowling.balls) * 6 : 0;
  bowling.average = bowling.wickets > 0 ? bowling.runsConceded / bowling.wickets : 0;
  if (bowling.bestRuns === Infinity) bowling.bestRuns = 0;

  return { matchesPlayed: matchSet.size, batting, bowling };
}

/** Format bowling best figures as "W/R" */
export function formatBestFigures(stats: BowlingCareer): string {
  if (stats.bestWickets === 0) return '-';
  return `${stats.bestWickets}/${stats.bestRuns}`;
}

/** Format overs as "O.B" */
export function formatBowlingOvers(balls: number): string {
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}
