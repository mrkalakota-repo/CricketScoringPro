import type { SQLiteDatabase } from 'expo-sqlite';

export async function initializeDatabase(db: SQLiteDatabase): Promise<void> {
  // Run PRAGMAs separately — Android SQLite may skip subsequent statements in
  // a multi-statement block when the first statement returns a result (like
  // "PRAGMA journal_mode = WAL" does).
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      short_name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL,
      name TEXT NOT NULL,
      phone_number TEXT,
      batting_style TEXT NOT NULL DEFAULT 'right',
      bowling_style TEXT NOT NULL DEFAULT 'none',
      is_wicket_keeper INTEGER NOT NULL DEFAULT 0,
      is_all_rounder INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
    );
  `);

  await db.execAsync(`
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

  // Create leagues and league_fixtures tables BEFORE any ALTER TABLE migrations
  // that reference them — otherwise a fresh install creates tables without the
  // columns that ALTER TABLE would add, causing INSERT failures.
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS leagues (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      short_name TEXT NOT NULL,
      team_ids TEXT NOT NULL DEFAULT '[]',
      format TEXT DEFAULT 'round_robin',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS league_fixtures (
      id TEXT PRIMARY KEY,
      league_id TEXT NOT NULL,
      team1_id TEXT NOT NULL,
      team2_id TEXT NOT NULL,
      match_id TEXT,
      venue TEXT NOT NULL DEFAULT '',
      scheduled_date INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'scheduled',
      result TEXT,
      team1_score TEXT,
      team2_score TEXT,
      winner_team_id TEXT,
      nrr_data_json TEXT,
      round INTEGER,
      bracket_slot INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS user_prefs (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
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
    await db.execAsync(`ALTER TABLE players ADD COLUMN is_vice_captain INTEGER DEFAULT 0;`);
  } catch { /* already exists */ }

  try {
    await db.execAsync(`ALTER TABLE players ADD COLUMN phone_number TEXT;`);
  } catch { /* already exists */ }

  // These columns are already in the CREATE TABLE above for new installs;
  // the try/catch migrations handle existing databases that pre-date them.
  try {
    await db.execAsync(`ALTER TABLE leagues ADD COLUMN format TEXT DEFAULT 'round_robin';`);
  } catch { /* already exists */ }

  try {
    await db.execAsync(`ALTER TABLE league_fixtures ADD COLUMN nrr_data_json TEXT;`);
  } catch { /* already exists */ }

  try {
    await db.execAsync(`ALTER TABLE league_fixtures ADD COLUMN round INTEGER;`);
  } catch { /* already exists */ }

  try {
    await db.execAsync(`ALTER TABLE league_fixtures ADD COLUMN bracket_slot INTEGER;`);
  } catch { /* already exists */ }

  try {
    await db.execAsync(`ALTER TABLE players ADD COLUMN jersey_number INTEGER;`);
  } catch { /* already exists */ }

  try {
    await db.execAsync(`ALTER TABLE players ADD COLUMN photo_uri TEXT;`);
  } catch { /* already exists */ }
}
