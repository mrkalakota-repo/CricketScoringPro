import { getDatabase } from '../database';
import type { Team, Player, BowlingStyle } from '../../engine/types';
import * as Crypto from 'expo-crypto';

const uuidv4 = () => Crypto.randomUUID();

export async function getAllTeams(): Promise<Team[]> {
  const db = await getDatabase();
  const teamRows = await db.getAllAsync<{
    id: string; name: string; short_name: string; created_at: number; updated_at: number;
  }>('SELECT * FROM teams ORDER BY name');

  const teams: Team[] = [];
  for (const row of teamRows) {
    const players = await getPlayersForTeam(row.id);
    teams.push({
      id: row.id,
      name: row.name,
      shortName: row.short_name,
      players,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
  return teams;
}

export async function getTeamById(id: string): Promise<Team | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{
    id: string; name: string; short_name: string; created_at: number; updated_at: number;
  }>('SELECT * FROM teams WHERE id = ?', id);
  if (!row) return null;
  const players = await getPlayersForTeam(row.id);
  return {
    id: row.id,
    name: row.name,
    shortName: row.short_name,
    players,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createTeam(name: string, shortName: string): Promise<Team> {
  const db = await getDatabase();
  const id = uuidv4();
  const now = Date.now();
  await db.runAsync(
    'INSERT INTO teams (id, name, short_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    id, name, shortName, now, now
  );
  return { id, name, shortName, players: [], createdAt: now, updatedAt: now };
}

export async function updateTeam(id: string, name: string, shortName: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE teams SET name = ?, short_name = ?, updated_at = ? WHERE id = ?',
    name, shortName, Date.now(), id
  );
}

export async function deleteTeam(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM teams WHERE id = ?', id);
}

export async function getPlayersForTeam(teamId: string): Promise<Player[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: string; name: string; batting_style: string; bowling_style: string;
    is_wicket_keeper: number; is_all_rounder: number;
  }>('SELECT * FROM players WHERE team_id = ? ORDER BY name', teamId);

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    battingStyle: row.batting_style as Player['battingStyle'],
    bowlingStyle: row.bowling_style as BowlingStyle,
    isWicketKeeper: row.is_wicket_keeper === 1,
    isAllRounder: row.is_all_rounder === 1,
  }));
}

export async function addPlayer(
  teamId: string,
  name: string,
  battingStyle: string = 'right',
  bowlingStyle: string = 'none',
  isWicketKeeper: boolean = false,
  isAllRounder: boolean = false,
): Promise<Player> {
  const db = await getDatabase();
  const id = uuidv4();
  await db.runAsync(
    'INSERT INTO players (id, team_id, name, batting_style, bowling_style, is_wicket_keeper, is_all_rounder) VALUES (?, ?, ?, ?, ?, ?, ?)',
    id, teamId, name, battingStyle, bowlingStyle, isWicketKeeper ? 1 : 0, isAllRounder ? 1 : 0
  );
  return {
    id,
    name,
    battingStyle: battingStyle as Player['battingStyle'],
    bowlingStyle: bowlingStyle as BowlingStyle,
    isWicketKeeper,
    isAllRounder,
  };
}

export async function updatePlayer(
  id: string,
  name: string,
  battingStyle: string,
  bowlingStyle: string,
  isWicketKeeper: boolean,
  isAllRounder: boolean,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE players SET name = ?, batting_style = ?, bowling_style = ?, is_wicket_keeper = ?, is_all_rounder = ? WHERE id = ?',
    name, battingStyle, bowlingStyle, isWicketKeeper ? 1 : 0, isAllRounder ? 1 : 0, id
  );
}

export async function deletePlayer(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM players WHERE id = ?', id);
}
