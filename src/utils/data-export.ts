import type { Match } from '../engine/types';
import { computePlayerStats, formatBestFigures } from './player-stats';

// ── helpers ───────────────────────────────────────────────────────────────────

function csvRow(...fields: (string | number)[]): string {
  return fields.map(f => `"${String(f).replace(/"/g, '""')}"`).join(',');
}

// ── public API ────────────────────────────────────────────────────────────────

/**
 * Builds a multi-section CSV string from completed matches.
 * Sections: Match Results · Batting Stats · Bowling Stats
 */
export function buildDataExportCSV(matches: Match[]): string {
  const completed = matches.filter(m => m.status === 'completed');

  if (completed.length === 0) {
    return 'No completed matches to export.';
  }

  const lines: string[] = [];

  // ── Match Results ──────────────────────────────────────────────────────────
  lines.push('MATCH RESULTS');
  lines.push(['Date', 'Format', 'Team 1', 'Team 2', 'Team 1 Score', 'Team 2 Score', 'Result'].join(','));

  for (const match of completed) {
    const date = new Date(match.createdAt).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
    let team1Score = '';
    let team2Score = '';
    for (const inn of match.innings) {
      const score = `${inn.totalRuns}/${inn.totalWickets} (${inn.totalOvers}.${inn.totalBalls}ov)`;
      if (inn.battingTeamId === match.team1.id) team1Score = score;
      else team2Score = score;
    }
    lines.push(csvRow(date, match.config.format, match.team1.name, match.team2.name, team1Score, team2Score, match.result ?? ''));
  }

  lines.push('');

  // Collect all unique players (first occurrence wins for team name)
  const playerMap = new Map<string, { name: string; teamName: string }>();
  for (const match of completed) {
    for (const p of match.team1.players) {
      if (!playerMap.has(p.id)) playerMap.set(p.id, { name: p.name, teamName: match.team1.name });
    }
    for (const p of match.team2.players) {
      if (!playerMap.has(p.id)) playerMap.set(p.id, { name: p.name, teamName: match.team2.name });
    }
  }

  // ── Batting Stats ──────────────────────────────────────────────────────────
  lines.push('BATTING STATS');
  lines.push(['Player', 'Team', 'Matches', 'Innings', 'Runs', 'Highest', 'Average', 'Strike Rate', '50s', '100s', '4s', '6s'].join(','));

  for (const [playerId, { name, teamName }] of playerMap) {
    const { matchesPlayed, batting: b } = computePlayerStats(playerId, completed);
    if (b.innings === 0) continue;
    lines.push(csvRow(
      name, teamName, matchesPlayed, b.innings, b.runs, b.highest,
      b.average.toFixed(2), b.strikeRate.toFixed(1),
      b.fifties, b.hundreds, b.fours, b.sixes,
    ));
  }

  lines.push('');

  // ── Bowling Stats ──────────────────────────────────────────────────────────
  lines.push('BOWLING STATS');
  lines.push(['Player', 'Team', 'Innings', 'Wickets', 'Runs Conceded', 'Economy', 'Average', 'Best Figures'].join(','));

  for (const [playerId, { name, teamName }] of playerMap) {
    const { bowling: bw } = computePlayerStats(playerId, completed);
    if (bw.innings === 0) continue;
    lines.push(csvRow(
      name, teamName, bw.innings, bw.wickets, bw.runsConceded,
      bw.economy.toFixed(2),
      bw.average > 0 ? bw.average.toFixed(2) : '-',
      formatBestFigures(bw),
    ));
  }

  lines.push('');
  lines.push('Exported via Inningsly');

  return lines.join('\n');
}
