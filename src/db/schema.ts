import type { SQLiteDatabase } from 'expo-sqlite';

export async function initializeDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      short_name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL,
      name TEXT NOT NULL,
      batting_style TEXT NOT NULL DEFAULT 'right',
      bowling_style TEXT NOT NULL DEFAULT 'none',
      is_wicket_keeper INTEGER NOT NULL DEFAULT 0,
      is_all_rounder INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      format TEXT NOT NULL,
      config_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'scheduled',
      team1_id TEXT NOT NULL,
      team2_id TEXT NOT NULL,
      team1_playing_xi TEXT NOT NULL DEFAULT '[]',
      team2_playing_xi TEXT NOT NULL DEFAULT '[]',
      toss_json TEXT,
      venue TEXT NOT NULL DEFAULT '',
      match_date INTEGER NOT NULL,
      result TEXT,
      match_state_json TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (team1_id) REFERENCES teams(id),
      FOREIGN KEY (team2_id) REFERENCES teams(id)
    );
  `);

  // Migrations — each wrapped in try/catch so re-runs are safe (column already exists = ignore).
  // NO NOT NULL in ALTER TABLE ADD COLUMN: required for Android SQLite < 3.37.0.

  try {
    await db.execAsync(`ALTER TABLE players ADD COLUMN is_all_rounder INTEGER DEFAULT 0;`);
  } catch { /* already exists */ }

  try {
    await db.execAsync(`ALTER TABLE players ADD COLUMN is_captain INTEGER DEFAULT 0;`);
  } catch { /* already exists */ }

  try {
    await db.execAsync(`ALTER TABLE teams ADD COLUMN admin_pin_hash TEXT;`);
  } catch { /* already exists */ }

  try {
    await db.execAsync(`ALTER TABLE teams ADD COLUMN latitude REAL;`);
  } catch { /* already exists */ }

  try {
    await db.execAsync(`ALTER TABLE teams ADD COLUMN longitude REAL;`);
  } catch { /* already exists */ }

  try {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS user_prefs (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  } catch { /* already exists */ }
}
