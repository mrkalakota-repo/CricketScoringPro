import * as SQLite from 'expo-sqlite';
import { initializeDatabase } from './schema';

let db: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  // Return existing ready db immediately
  if (db) return db;

  // Prevent concurrent initialization — reuse the in-flight promise
  if (!initPromise) {
    initPromise = (async () => {
      const connection = await SQLite.openDatabaseAsync('gullycricket.db');
      await initializeDatabase(connection);
      db = connection;
      return db;
    })().catch(err => {
      // Reset so the next call retries
      initPromise = null;
      throw err;
    });
  }

  return initPromise;
}
