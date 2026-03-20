import { supabase, isCloudEnabled } from '../../config/supabase';
import type { Match } from '../../engine/types';

export interface LiveMatchSummary {
  id: string;
  team1Name: string;
  team1Short: string;
  team2Name: string;
  team2Short: string;
  format: string;
  venue: string;
  status: string;
  inningsNum: number;
  battingShort: string;
  score: number;
  wickets: number;
  overs: number;
  balls: number;
  target: number | null;
  result: string | null;
  latitude: number | null;
  longitude: number | null;
  updatedAt: number;
}

const FIFTY_MILES_KM = 80;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

function buildRow(match: Match) {
  const inn = match.currentInningsIndex >= 0
    ? match.innings[match.currentInningsIndex]
    : null;
  const battingTeam = inn
    ? (inn.battingTeamId === match.team1.id ? match.team1 : match.team2)
    : null;

  // Use whichever team has location data
  const lat = match.team1.latitude ?? match.team2.latitude ?? null;
  const lon = match.team1.longitude ?? match.team2.longitude ?? null;

  return {
    id: match.id,
    team1_name: match.team1.name,
    team1_short: match.team1.shortName,
    team2_name: match.team2.name,
    team2_short: match.team2.shortName,
    format: match.config.format,
    venue: match.venue ?? '',
    status: match.status,
    innings_num: match.currentInningsIndex + 1,
    batting_short: battingTeam?.shortName ?? '',
    score: inn?.totalRuns ?? 0,
    wickets: inn?.totalWickets ?? 0,
    overs: inn?.totalOvers ?? 0,
    balls: inn?.totalBalls ?? 0,
    target: inn?.target ?? null,
    result: match.result ?? null,
    latitude: lat,
    longitude: lon,
    updated_at: Date.now(),
  };
}

function rowToSummary(row: Record<string, unknown>): LiveMatchSummary {
  return {
    id: row.id as string,
    team1Name: row.team1_name as string,
    team1Short: row.team1_short as string,
    team2Name: row.team2_name as string,
    team2Short: row.team2_short as string,
    format: row.format as string,
    venue: row.venue as string,
    status: row.status as string,
    inningsNum: row.innings_num as number,
    battingShort: row.batting_short as string,
    score: row.score as number,
    wickets: row.wickets as number,
    overs: row.overs as number,
    balls: row.balls as number,
    target: row.target as number | null,
    result: row.result as string | null,
    latitude: row.latitude as number | null,
    longitude: row.longitude as number | null,
    updatedAt: row.updated_at as number,
  };
}

// ---------------------------------------------------------------------------
// Sync status — observable by the UI (scoring screen indicator).
// ---------------------------------------------------------------------------

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'disabled';

let _syncStatus: SyncStatus = isCloudEnabled ? 'synced' : 'disabled';
const _syncListeners = new Set<(s: SyncStatus) => void>();

function setSyncStatus(s: SyncStatus): void {
  if (_syncStatus === s) return;
  _syncStatus = s;
  _syncListeners.forEach(fn => fn(s));
}

/** Get current sync status without subscribing. */
export function getSyncStatus(): SyncStatus {
  return _syncStatus;
}

/**
 * Subscribe to sync status changes. Returns an unsubscribe function.
 * The callback is invoked immediately with the current value.
 */
export function subscribeSyncStatus(callback: (s: SyncStatus) => void): () => void {
  callback(_syncStatus);
  _syncListeners.add(callback);
  return () => { _syncListeners.delete(callback); };
}

// ---------------------------------------------------------------------------
// Offline sync queue — keyed by match ID so only the latest state is kept.
// Drained opportunistically on every publish call and every 30 seconds.
// ---------------------------------------------------------------------------
const pendingQueue = new Map<string, Match>();
let drainTimer: ReturnType<typeof setInterval> | null = null;

async function tryUpsert(match: Match): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('live_matches').upsert(buildRow(match));
    if (error && (error as { code?: string }).code !== 'PGRST205') throw error;
    return true;
  } catch {
    return false;
  }
}

async function drainQueue(): Promise<void> {
  if (!isCloudEnabled || pendingQueue.size === 0) return;
  for (const [matchId, match] of Array.from(pendingQueue.entries())) {
    const ok = await tryUpsert(match);
    if (ok) {
      pendingQueue.delete(matchId);
    }
  }
  if (pendingQueue.size === 0) setSyncStatus('synced');
}

function ensureDrainTimer(): void {
  if (drainTimer !== null) return;
  drainTimer = setInterval(() => { drainQueue(); }, 30_000);
}

export async function publishLiveMatch(match: Match): Promise<void> {
  if (!isCloudEnabled || !supabase) return;
  if (match.status === 'scheduled') return;

  setSyncStatus('syncing');

  // Drain any previously queued matches before publishing the new one
  await drainQueue();

  const ok = await tryUpsert(match);
  if (!ok) {
    // Network unavailable — queue this match state; latest wins
    pendingQueue.set(match.id, match);
    ensureDrainTimer();
    setSyncStatus('offline');
    console.warn(`[cloud-match-repo] offline — queued match ${match.id} (queue size: ${pendingQueue.size})`);
  } else {
    if (pendingQueue.size > 0) {
      ensureDrainTimer();
    }
    setSyncStatus('synced');
  }
}

export async function removeLiveMatch(matchId: string): Promise<void> {
  pendingQueue.delete(matchId); // don't re-publish a deleted match
  if (!isCloudEnabled || !supabase) return;
  try {
    await supabase.from('live_matches').delete().eq('id', matchId);
  } catch (err) {
    console.error('[cloud-match-repo] removeLiveMatch failed:', err);
  }
}

export async function fetchNearbyLiveMatches(
  lat: number,
  lon: number,
  radiusKm = FIFTY_MILES_KM,
): Promise<LiveMatchSummary[]> {
  if (!isCloudEnabled || !supabase) return [];
  try {
    const latDelta = radiusKm / 111.0;
    const lonDelta = radiusKm / (111.0 * Math.cos((lat * Math.PI) / 180));
    const since = Date.now() - TWENTY_FOUR_HOURS_MS;

    const { data, error } = await supabase
      .from('live_matches')
      .select('*')
      .not('latitude', 'is', null)
      .gte('latitude', lat - latDelta)
      .lte('latitude', lat + latDelta)
      .gte('longitude', lon - lonDelta)
      .lte('longitude', lon + lonDelta)
      .gte('updated_at', since)
      .order('updated_at', { ascending: false })
      .limit(20);

    // PGRST205 = table not found (SQL not yet run in Supabase) — fail silently
    if (error && (error as { code?: string }).code !== 'PGRST205') throw error;
    return (data ?? []).map(rowToSummary);
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code !== 'PGRST205') {
      console.error('[cloud-match-repo] fetchNearbyLiveMatches failed:', err);
    }
    return [];
  }
}

export function subscribeToNearbyLiveMatches(
  lat: number,
  lon: number,
  radiusKm = FIFTY_MILES_KM,
  onUpdate: (matches: LiveMatchSummary[]) => void,
): () => void {
  if (!isCloudEnabled || !supabase) return () => {};

  const channel = supabase
    .channel('live_matches_realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'live_matches' }, async () => {
      const matches = await fetchNearbyLiveMatches(lat, lon, radiusKm);
      onUpdate(matches);
    })
    .subscribe();

  return () => { supabase!.removeChannel(channel); };
}
