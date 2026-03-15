import { getDatabase } from '../database';
import type { Match, MatchConfig } from '../../engine/types';
import * as Crypto from 'expo-crypto';
const uuidv4 = () => Crypto.randomUUID();

export interface MatchRow {
  id: string;
  format: string;
  config_json: string;
  status: string;
  team1_id: string;
  team2_id: string;
  team1_playing_xi: string;
  team2_playing_xi: string;
  toss_json: string | null;
  venue: string;
  match_date: number;
  result: string | null;
  match_state_json: string | null;
  created_at: number;
  updated_at: number;
}

export async function getAllMatches(): Promise<MatchRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<MatchRow>('SELECT * FROM matches ORDER BY created_at DESC');
}

export async function getMatchById(id: string): Promise<MatchRow | null> {
  const db = await getDatabase();
  return db.getFirstAsync<MatchRow>('SELECT * FROM matches WHERE id = ?', id);
}

export async function createMatch(
  config: MatchConfig,
  team1Id: string,
  team2Id: string,
  team1PlayingXI: string[],
  team2PlayingXI: string[],
  venue: string,
  matchDate: number
): Promise<string> {
  const db = await getDatabase();
  const id = uuidv4();
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO matches (id, format, config_json, status, team1_id, team2_id, team1_playing_xi, team2_playing_xi, venue, match_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    config.format,
    JSON.stringify(config),
    'scheduled',
    team1Id,
    team2Id,
    JSON.stringify(team1PlayingXI),
    JSON.stringify(team2PlayingXI),
    venue,
    matchDate,
    now,
    now
  );
  return id;
}

export async function saveMatchState(id: string, match: Match): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE matches SET status = ?, match_state_json = ?, result = ?, toss_json = ?, updated_at = ? WHERE id = ?',
    match.status,
    JSON.stringify(match),
    match.result,
    match.toss ? JSON.stringify(match.toss) : null,
    Date.now(),
    id
  );
}

export async function deleteMatch(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM matches WHERE id = ?', id);
}
