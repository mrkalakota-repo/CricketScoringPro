import { getDatabase } from '../database';
import type { League, LeagueFixture, LeagueFixtureStatus, FixtureNRRData, LeagueFormat } from '../../engine/types';
import * as Crypto from 'expo-crypto';

const uuidv4 = () => Crypto.randomUUID();

type LeagueRow = {
  id: string; name: string; short_name: string;
  team_ids: string; format: string | null; created_at: number; updated_at: number;
};

type FixtureRow = {
  id: string; league_id: string; team1_id: string; team2_id: string;
  match_id: string | null; venue: string; scheduled_date: number;
  status: string; result: string | null; team1_score: string | null;
  team2_score: string | null; winner_team_id: string | null;
  nrr_data_json: string | null;
  round: number | null; bracket_slot: number | null;
  created_at: number; updated_at: number;
};

function rowToLeague(row: LeagueRow): League {
  return {
    id: row.id, name: row.name, shortName: row.short_name,
    teamIds: JSON.parse(row.team_ids || '[]'),
    format: (row.format as LeagueFormat) ?? 'round_robin',
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function rowToFixture(row: FixtureRow): LeagueFixture {
  return {
    id: row.id, leagueId: row.league_id,
    team1Id: row.team1_id, team2Id: row.team2_id,
    matchId: row.match_id ?? null, venue: row.venue,
    scheduledDate: row.scheduled_date,
    status: row.status as LeagueFixtureStatus,
    result: row.result ?? null, team1Score: row.team1_score ?? null,
    team2Score: row.team2_score ?? null, winnerTeamId: row.winner_team_id ?? null,
    nrrData: row.nrr_data_json ? JSON.parse(row.nrr_data_json) as FixtureNRRData : null,
    round: row.round ?? null, bracketSlot: row.bracket_slot ?? null,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export async function upsertLeague(league: League): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO leagues (id, name, short_name, team_ids, format, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name, short_name = excluded.short_name,
       team_ids = excluded.team_ids, format = excluded.format,
       updated_at = excluded.updated_at`,
    league.id, league.name, league.shortName,
    JSON.stringify(league.teamIds), league.format,
    league.createdAt, league.updatedAt,
  );
}

export async function upsertFixture(fixture: LeagueFixture): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO league_fixtures
       (id, league_id, team1_id, team2_id, match_id, venue, scheduled_date,
        status, result, team1_score, team2_score, winner_team_id,
        nrr_data_json, round, bracket_slot, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       status = excluded.status, result = excluded.result,
       team1_score = excluded.team1_score, team2_score = excluded.team2_score,
       winner_team_id = excluded.winner_team_id, nrr_data_json = excluded.nrr_data_json,
       match_id = excluded.match_id, updated_at = excluded.updated_at`,
    fixture.id, fixture.leagueId, fixture.team1Id, fixture.team2Id,
    fixture.matchId ?? null, fixture.venue, fixture.scheduledDate,
    fixture.status, fixture.result ?? null, fixture.team1Score ?? null,
    fixture.team2Score ?? null, fixture.winnerTeamId ?? null,
    fixture.nrrData ? JSON.stringify(fixture.nrrData) : null,
    fixture.round ?? null, fixture.bracketSlot ?? null,
    fixture.createdAt, fixture.updatedAt,
  );
}

export async function getAllLeagues(): Promise<League[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<LeagueRow>('SELECT * FROM leagues ORDER BY name');
  return rows.map(rowToLeague);
}

export async function getLeagueById(id: string): Promise<League | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<LeagueRow>('SELECT * FROM leagues WHERE id = ?', id);
  return row ? rowToLeague(row) : null;
}

export async function createLeague(name: string, shortName: string, format: LeagueFormat = 'round_robin'): Promise<League> {
  const db = await getDatabase();
  const id = uuidv4();
  const now = Date.now();
  await db.runAsync(
    'INSERT INTO leagues (id, name, short_name, team_ids, format, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    id, name, shortName, '[]', format, now, now,
  );
  return { id, name, shortName, teamIds: [], format, createdAt: now, updatedAt: now };
}

export async function updateLeague(id: string, name: string, shortName: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE leagues SET name = ?, short_name = ?, updated_at = ? WHERE id = ?',
    name, shortName, Date.now(), id,
  );
}

export async function deleteLeague(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM league_fixtures WHERE league_id = ?', id);
  await db.runAsync('DELETE FROM leagues WHERE id = ?', id);
}

export async function addTeamToLeague(leagueId: string, teamId: string): Promise<void> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<LeagueRow>('SELECT * FROM leagues WHERE id = ?', leagueId);
  if (!row) return;
  const ids: string[] = JSON.parse(row.team_ids || '[]');
  if (ids.includes(teamId)) return;
  await db.runAsync(
    'UPDATE leagues SET team_ids = ?, updated_at = ? WHERE id = ?',
    JSON.stringify([...ids, teamId]), Date.now(), leagueId,
  );
}

export async function removeTeamFromLeague(leagueId: string, teamId: string): Promise<void> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<LeagueRow>('SELECT * FROM leagues WHERE id = ?', leagueId);
  if (!row) return;
  const ids: string[] = JSON.parse(row.team_ids || '[]');
  await db.runAsync(
    'UPDATE leagues SET team_ids = ?, updated_at = ? WHERE id = ?',
    JSON.stringify(ids.filter(id => id !== teamId)), Date.now(), leagueId,
  );
}

export async function getFixturesForLeague(leagueId: string): Promise<LeagueFixture[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<FixtureRow>(
    'SELECT * FROM league_fixtures WHERE league_id = ? ORDER BY scheduled_date', leagueId,
  );
  return rows.map(rowToFixture);
}

export async function createFixture(
  leagueId: string, team1Id: string, team2Id: string, venue: string, scheduledDate: number,
  round: number | null = null, bracketSlot: number | null = null,
): Promise<LeagueFixture> {
  const db = await getDatabase();
  const id = uuidv4();
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO league_fixtures
       (id, league_id, team1_id, team2_id, match_id, venue, scheduled_date, status, result, team1_score, team2_score, winner_team_id, nrr_data_json, round, bracket_slot, created_at, updated_at)
     VALUES (?, ?, ?, ?, NULL, ?, ?, 'scheduled', NULL, NULL, NULL, NULL, NULL, ?, ?, ?, ?)`,
    id, leagueId, team1Id, team2Id, venue, scheduledDate, round, bracketSlot, now, now,
  );
  return {
    id, leagueId, team1Id, team2Id, matchId: null, venue, scheduledDate,
    status: 'scheduled', result: null, team1Score: null, team2Score: null,
    winnerTeamId: null, nrrData: null, round, bracketSlot, createdAt: now, updatedAt: now,
  };
}

export async function updateFixtureResult(
  id: string, result: string, winnerTeamId: string | null,
  team1Score: string | null, team2Score: string | null,
  nrrData: FixtureNRRData | null,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE league_fixtures SET status = 'completed', result = ?, winner_team_id = ?, team1_score = ?, team2_score = ?, nrr_data_json = ?, updated_at = ? WHERE id = ?`,
    result, winnerTeamId, team1Score, team2Score,
    nrrData ? JSON.stringify(nrrData) : null,
    Date.now(), id,
  );
}

export async function deleteFixture(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM league_fixtures WHERE id = ?', id);
}

export async function linkFixtureToMatch(fixtureId: string, matchId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE league_fixtures SET match_id = ?, updated_at = ? WHERE id = ?',
    matchId, Date.now(), fixtureId,
  );
}
