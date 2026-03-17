import { getDatabase } from '../database';
import type { Team, Player, BowlingStyle } from '../../engine/types';
import * as Crypto from 'expo-crypto';

const uuidv4 = () => Crypto.randomUUID();

type TeamRow = {
  id: string; name: string; short_name: string; admin_pin_hash: string | null;
  latitude: number | null; longitude: number | null;
  created_at: number; updated_at: number;
};

function rowToTeam(row: TeamRow, players: Player[]): Team {
  return {
    id: row.id,
    name: row.name,
    shortName: row.short_name,
    adminPinHash: row.admin_pin_hash ?? null,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    players,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getAllTeams(): Promise<Team[]> {
  const db = await getDatabase();
  const teamRows = await db.getAllAsync<TeamRow>('SELECT * FROM teams ORDER BY name');
  const teams: Team[] = [];
  for (const row of teamRows) {
    teams.push(rowToTeam(row, await getPlayersForTeam(row.id)));
  }
  return teams;
}

export async function getTeamById(id: string): Promise<Team | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<TeamRow>('SELECT * FROM teams WHERE id = ?', id);
  if (!row) return null;
  return rowToTeam(row, await getPlayersForTeam(row.id));
}

export async function isTeamNameTaken(name: string, excludeTeamId?: string): Promise<boolean> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM teams WHERE LOWER(name) = LOWER(?) AND id != ?',
    name, excludeTeamId ?? '',
  );
  return !!row;
}

export async function createTeam(
  name: string,
  shortName: string,
  latitude: number | null = null,
  longitude: number | null = null,
): Promise<Team> {
  const db = await getDatabase();
  const id = uuidv4();
  const now = Date.now();
  await db.runAsync(
    'INSERT INTO teams (id, name, short_name, admin_pin_hash, latitude, longitude, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    id, name, shortName, null, latitude, longitude, now, now
  );
  return { id, name, shortName, adminPinHash: null, latitude, longitude, players: [], createdAt: now, updatedAt: now };
}

export async function updateTeam(id: string, name: string, shortName: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE teams SET name = ?, short_name = ?, updated_at = ? WHERE id = ?',
    name, shortName, Date.now(), id
  );
}

export async function setTeamAdminPin(id: string, pinHash: string | null): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE teams SET admin_pin_hash = ?, updated_at = ? WHERE id = ?',
    pinHash, Date.now(), id
  );
}

export async function deleteTeam(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM teams WHERE id = ?', id);
}

export async function getPlayersForTeam(teamId: string): Promise<Player[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: string; name: string; phone_number: string | null; batting_style: string; bowling_style: string;
    is_wicket_keeper: number; is_all_rounder: number; is_captain: number; is_vice_captain: number;
  }>('SELECT * FROM players WHERE team_id = ? ORDER BY name', teamId);

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    phoneNumber: row.phone_number ?? null,
    battingStyle: (row.batting_style ?? 'right') as Player['battingStyle'],
    bowlingStyle: (row.bowling_style ?? 'none') as BowlingStyle,
    isWicketKeeper: (row.is_wicket_keeper ?? 0) === 1,
    isAllRounder: (row.is_all_rounder ?? 0) === 1,
    isCaptain: (row.is_captain ?? 0) === 1,
    isViceCaptain: (row.is_vice_captain ?? 0) === 1,
  }));
}

/** Returns true if the phone number is already used by another player. */
export async function isPhoneNumberTaken(phone: string, excludePlayerId?: string): Promise<boolean> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM players WHERE phone_number = ? AND id != ?',
    phone, excludePlayerId ?? '',
  );
  return !!row;
}

export async function addPlayer(
  teamId: string,
  name: string,
  phoneNumber: string | null = null,
  battingStyle: string = 'right',
  bowlingStyle: string = 'none',
  isWicketKeeper: boolean = false,
  isAllRounder: boolean = false,
  isCaptain: boolean = false,
  isViceCaptain: boolean = false,
): Promise<Player> {
  const db = await getDatabase();
  const id = uuidv4();
  await db.runAsync(
    'INSERT INTO players (id, team_id, name, phone_number, batting_style, bowling_style, is_wicket_keeper, is_all_rounder, is_captain, is_vice_captain) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    id, teamId, name, phoneNumber ?? null, battingStyle, bowlingStyle,
    isWicketKeeper ? 1 : 0, isAllRounder ? 1 : 0, isCaptain ? 1 : 0, isViceCaptain ? 1 : 0
  );
  return {
    id, name, phoneNumber: phoneNumber ?? null,
    battingStyle: battingStyle as Player['battingStyle'],
    bowlingStyle: bowlingStyle as BowlingStyle,
    isWicketKeeper, isAllRounder, isCaptain, isViceCaptain,
  };
}

export async function updatePlayer(
  id: string,
  name: string,
  phoneNumber: string | null,
  battingStyle: string,
  bowlingStyle: string,
  isWicketKeeper: boolean,
  isAllRounder: boolean,
  isCaptain: boolean,
  isViceCaptain: boolean = false,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE players SET name = ?, phone_number = ?, batting_style = ?, bowling_style = ?, is_wicket_keeper = ?, is_all_rounder = ?, is_captain = ?, is_vice_captain = ? WHERE id = ?',
    name, phoneNumber ?? null, battingStyle, bowlingStyle,
    isWicketKeeper ? 1 : 0, isAllRounder ? 1 : 0, isCaptain ? 1 : 0, isViceCaptain ? 1 : 0, id
  );
}

export async function deletePlayer(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM players WHERE id = ?', id);
}

// Import a cloud-discovered team without overwriting any locally-owned team.
export async function importCloudTeam(team: Team): Promise<void> {
  const db = await getDatabase();
  const now = Date.now();
  // INSERT OR IGNORE keeps the local row untouched if it already exists
  await db.runAsync(
    `INSERT OR IGNORE INTO teams
       (id, name, short_name, admin_pin_hash, latitude, longitude, created_at, updated_at)
     VALUES (?, ?, ?, NULL, ?, ?, ?, ?)`,
    team.id, team.name, team.shortName, team.latitude, team.longitude, now, now,
  );
  // Update non-sensitive fields for teams we don't own (no adminPinHash row)
  await db.runAsync(
    `UPDATE teams
     SET name = ?, short_name = ?, latitude = ?, longitude = ?, updated_at = ?
     WHERE id = ? AND admin_pin_hash IS NULL`,
    team.name, team.shortName, team.latitude, team.longitude, now, team.id,
  );
  for (const p of team.players) {
    await db.runAsync(
      `INSERT OR IGNORE INTO players
         (id, team_id, name, phone_number, batting_style, bowling_style, is_wicket_keeper, is_all_rounder, is_captain, is_vice_captain)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      p.id, team.id, p.name, p.phoneNumber ?? null, p.battingStyle, p.bowlingStyle,
      p.isWicketKeeper ? 1 : 0, p.isAllRounder ? 1 : 0, p.isCaptain ? 1 : 0, p.isViceCaptain ? 1 : 0,
    );
  }
}
