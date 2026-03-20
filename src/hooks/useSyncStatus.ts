import { useState, useEffect } from 'react';
import { getSyncStatus, subscribeSyncStatus } from '../db/repositories/cloud-match-repo';
import type { SyncStatus } from '../db/repositories/cloud-match-repo';

export type { SyncStatus };

/**
 * Returns the live cloud sync status for the scoring screen indicator.
 *
 * States:
 *   'synced'   — last upsert succeeded, queue is empty
 *   'syncing'  — upsert in flight
 *   'offline'  — upsert failed, balls are queued for retry
 *   'disabled' — Supabase credentials not configured
 */
export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus);

  useEffect(() => {
    return subscribeSyncStatus(setStatus);
  }, []);

  return status;
}
