import type { Match } from './types';

export const CURRENT_SCHEMA_VERSION = 1;

/**
 * Upgrades a raw parsed match object (from SQLite or cloud JSON) to the current
 * schema version. Safe to call on already-current matches — idempotent.
 *
 * Version history:
 *   (none / 0) → 1: Stamp schemaVersion; ensure superOver, isSuperOver, date,
 *                    and updatedAt have safe defaults for pre-v1 saved matches.
 */
export function migrateMatch(raw: unknown): Match {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = raw as any;

  if ((m.schemaVersion ?? 0) >= CURRENT_SCHEMA_VERSION) {
    return m as Match;
  }

  // v0 → v1: backfill fields that may be absent in pre-release saved matches
  if (typeof m.superOver !== 'boolean') {
    m.superOver = false;
  }
  if (typeof m.date !== 'number') {
    m.date = typeof m.createdAt === 'number' ? m.createdAt : Date.now();
  }
  if (typeof m.updatedAt !== 'number') {
    m.updatedAt = typeof m.createdAt === 'number' ? m.createdAt : Date.now();
  }
  if (Array.isArray(m.innings)) {
    for (const inn of m.innings) {
      if (typeof inn.isSuperOver !== 'boolean') inn.isSuperOver = false;
    }
  }

  m.schemaVersion = CURRENT_SCHEMA_VERSION;
  return m as Match;
}
