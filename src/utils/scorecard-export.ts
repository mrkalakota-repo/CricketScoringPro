import type { Match, Innings, BatterInnings, BowlerSpell } from '../engine/types';
import { formatOvers } from './formatters';
import { strikeRate, economyRate } from './cricket-math';

// ─── helpers ────────────────────────────────────────────────────────────────

function pad(s: string, width: number, right = false): string {
  const str = String(s);
  if (str.length >= width) return str.substring(0, width);
  const spaces = ' '.repeat(width - str.length);
  return right ? spaces + str : str + spaces;
}

function line(char = '─', width = 46): string {
  return char.repeat(width);
}

function playerName(match: Match, playerId: string): string {
  return (
    [...match.team1.players, ...match.team2.players].find(p => p.id === playerId)?.name ?? '?'
  );
}

function dismissalLine(match: Match, batter: BatterInnings): string {
  const d = batter.dismissal;
  if (!d) return 'not out';
  const map: Record<string, string> = {
    bowled: 'b', caught: 'c', lbw: 'lbw', run_out: 'run out',
    stumped: 'st', hit_wicket: 'hit wkt', handled_ball: 'handled ball',
    obstructing_field: 'obstruct', timed_out: 'timed out',
    hit_twice: 'hit twice', retired_hurt: 'retired hurt', retired_out: 'retired out',
  };
  const short = map[d.type] ?? d.type;
  if (d.type === 'run_out') {
    return d.fielderId ? `run out (${playerName(match, d.fielderId)})` : 'run out';
  }
  if (d.type === 'stumped') {
    return `st ${d.fielderId ? playerName(match, d.fielderId) : '?'} b ${playerName(match, d.bowlerId)}`;
  }
  if (d.type === 'caught') {
    const fielder = d.fielderId ? playerName(match, d.fielderId) : '?';
    const bowler = playerName(match, d.bowlerId);
    return fielder === bowler ? `c&b ${bowler}` : `c ${fielder} b ${bowler}`;
  }
  if (['bowled', 'lbw', 'hit_wicket'].includes(d.type)) {
    return `${short} ${playerName(match, d.bowlerId)}`;
  }
  return short;
}

// ─── innings section ─────────────────────────────────────────────────────────

function formatInnings(match: Match, inn: Innings, label: string): string {
  const lines: string[] = [];
  const battingTeam = inn.battingTeamId === match.team1.id ? match.team1.name : match.team2.name;
  const totalExtras = inn.extras.wides + inn.extras.noBalls + inn.extras.byes + inn.extras.legByes + inn.extras.penalties;

  lines.push('');
  lines.push(`${label} — ${inn.isSuperOver ? '⚡ SUPER OVER — ' : ''}${battingTeam}`);
  lines.push(`Total: ${inn.totalRuns}/${inn.totalWickets} (${formatOvers(inn.totalOvers, inn.totalBalls)} ov)${inn.target ? `  Target: ${inn.target}` : ''}`);
  lines.push('');

  // ── Batting ──
  lines.push('BATTING');
  lines.push(`${pad('Batter', 22)} ${pad('R', 4, true)} ${pad('B', 4, true)} ${pad('4s', 3, true)} ${pad('6s', 3, true)} ${pad('SR', 6, true)}`);
  lines.push(line('─', 46));

  for (const b of inn.batters) {
    const name = pad(playerName(match, b.playerId) + (b.dismissal ? '' : '*'), 22);
    const r = pad(String(b.runs), 4, true);
    const balls = pad(String(b.ballsFaced), 4, true);
    const fours = pad(String(b.fours), 3, true);
    const sixes = pad(String(b.sixes), 3, true);
    const sr = pad(strikeRate(b.runs, b.ballsFaced).toFixed(1), 6, true);
    lines.push(`${name} ${r} ${balls} ${fours} ${sixes} ${sr}`);
    lines.push(`  ${dismissalLine(match, b)}`);
  }

  lines.push(line('─', 46));
  lines.push(`Extras: ${totalExtras}  (w ${inn.extras.wides}, nb ${inn.extras.noBalls}, b ${inn.extras.byes}, lb ${inn.extras.legByes})`);
  lines.push(`TOTAL:  ${inn.totalRuns}/${inn.totalWickets}  (${formatOvers(inn.totalOvers, inn.totalBalls)} ov)`);
  lines.push('');

  // ── Fall of Wickets ──
  if (inn.fallOfWickets.length > 0) {
    const fowStr = inn.fallOfWickets
      .map(f => `${f.runs}/${f.wicketNumber} (${playerName(match, f.playerId)}, ${formatOvers(f.overs, f.ballsInOver)})`)
      .join('  ');
    lines.push(`FOW: ${fowStr}`);
    lines.push('');
  }

  // ── Bowling ──
  lines.push('BOWLING');
  lines.push(`${pad('Bowler', 22)} ${pad('O', 5, true)} ${pad('M', 3, true)} ${pad('R', 4, true)} ${pad('W', 3, true)} ${pad('Econ', 5, true)}`);
  lines.push(line('─', 46));

  for (const b of inn.bowlers) {
    const name = pad(playerName(match, b.playerId), 22);
    const overs = pad(formatOvers(b.overs, b.ballsBowled), 5, true);
    const maidens = pad(String(b.maidens), 3, true);
    const runs = pad(String(b.runsConceded), 4, true);
    const wkts = pad(String(b.wickets), 3, true);
    const econ = pad(economyRate(b.runsConceded, b.overs, b.ballsBowled).toFixed(1), 5, true);
    lines.push(`${name} ${overs} ${maidens} ${runs} ${wkts} ${econ}`);
  }

  return lines.join('\n');
}

// ─── public API ──────────────────────────────────────────────────────────────

export function buildScorecardText(match: Match): string {
  const lines: string[] = [];
  const dateStr = new Date(match.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });

  lines.push(line('═', 46));
  lines.push('🏏  INNINGSLY');
  lines.push(line('═', 46));
  lines.push(`${match.team1.name} vs ${match.team2.name}`);
  lines.push(`${match.config.format.toUpperCase()}${match.config.oversPerInnings ? ` · ${match.config.oversPerInnings} overs` : ''} · ${dateStr}`);
  if (match.venue) lines.push(`📍 ${match.venue}`);
  lines.push('');
  if (match.result) {
    lines.push(`🏆 ${match.result}`);
  }
  lines.push(line('─', 46));

  const regularInnings = match.innings.filter(i => !i.isSuperOver);
  const superOverInnings = match.innings.filter(i => i.isSuperOver);

  regularInnings.forEach((inn, idx) => {
    lines.push(formatInnings(match, inn, `${idx + 1}${['st', 'nd', 'rd', 'th'][Math.min(idx, 3)]} INNINGS`));
    lines.push(line('─', 46));
  });

  if (superOverInnings.length > 0) {
    lines.push('');
    lines.push(line('═', 46));
    lines.push('⚡  SUPER OVER');
    lines.push(line('═', 46));
    superOverInnings.forEach((inn, idx) => {
      lines.push(formatInnings(match, inn, `SO Innings ${idx + 1}`));
      lines.push(line('─', 46));
    });
  }

  lines.push('');
  lines.push('Shared via Inningsly 🏏');

  return lines.join('\n');
}
