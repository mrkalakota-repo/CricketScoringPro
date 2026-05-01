import * as SQLite from 'expo-sqlite';
import { initializeDatabase } from './schema';

let db: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  // Return existing ready db immediately
  if (db) return db;

  // Prevent concurrent initialization — reuse the in-flight promise
  if (!initPromise) {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('SQLite init timeout')), 15_000)
    );
    initPromise = Promise.race([
      (async () => {
        const connection = await SQLite.openDatabaseAsync('gullycricket.db');
        await initializeDatabase(connection);
        db = connection;
        return db;
      })(),
      timeout,
    ]).catch(err => {
      // Reset so the next call retries
      initPromise = null;
      throw err;
    });
  }

  return initPromise;
}
