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

/**
 * Stop the background drain timer. Call this when the app goes to background
 * or is unmounted to prevent the timer from running indefinitely.
 */
export function stopDrainTimer(): void {
  if (drainTimer !== null) {
    clearInterval(drainTimer);
    drainTimer = null;
  }
}

export async function publishLiveMatch(match: Match): Promise<void> {
  if (!isCloudEnabled || !supabase) return;
  if (match.status === 'scheduled' || match.status === 'pending_acceptance') return;

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
    console.error('[cloud-match-repo] removeLiveMatch failed:', (err as Error).message);
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
      console.error('[cloud-match-repo] fetchNearbyLiveMatches failed:', (err as Error).message);
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

// ---------------------------------------------------------------------------
// Full match state — cross-device history
// ---------------------------------------------------------------------------

export interface CloudMatchRow {
  id: string;
  team1Name: string;
  team1Short: string;
  team2Name: string;
  team2Short: string;
  format: string;
  venue: string;
  status: string;
  result: string | null;
  ownerPhone: string | null;
  matchStateJson: string;
  matchDate: number;
  updatedAt: number;
}

function matchToCloudRow(match: Match, ownerPhone?: string) {
  return {
    id: match.id,
    team1_name: match.team1.name,
    team1_short: match.team1.shortName,
    team2_name: match.team2.name,
    team2_short: match.team2.shortName,
    format: match.config.format,
    venue: match.venue ?? '',
    status: match.status,
    result: match.result ?? null,
    owner_phone: ownerPhone ?? null,
    match_state_json: JSON.stringify(match),
    match_date: match.createdAt ?? Date.now(),
    updated_at: Date.now(),
  };
}

export async function publishMatchState(match: Match, ownerPhone?: string): Promise<void> {
  if (!isCloudEnabled || !supabase) return;
  if (match.status === 'scheduled' || match.status === 'pending_acceptance') return;
  try {
    const { error } = await supabase
      .from('cloud_match_states')
      .upsert(matchToCloudRow(match, ownerPhone));
    if (error && (error as { code?: string }).code !== 'PGRST205') {
      console.error('[cloud-match-repo] publishMatchState failed:', error.message);
    }
  } catch (err) {
    console.error('[cloud-match-repo] publishMatchState error:', (err as Error).message);
  }
}

export async function removeMatchState(matchId: string): Promise<void> {
  if (!isCloudEnabled || !supabase) return;
  try {
    await supabase.from('cloud_match_states').delete().eq('id', matchId);
  } catch (err) {
    console.error('[cloud-match-repo] removeMatchState failed:', (err as Error).message);
  }
}

export async function fetchRecentCloudMatches(days = 7): Promise<CloudMatchRow[]> {
  if (!isCloudEnabled || !supabase) return [];
  try {
    const since = Date.now() - days * 24 * 60 * 60 * 1000;
    const { data, error } = await supabase
      .from('cloud_match_states')
      .select('id, team1_name, team1_short, team2_name, team2_short, format, venue, status, result, owner_phone, match_date, updated_at')
      .gte('updated_at', since)
      .order('updated_at', { ascending: false })
      .limit(50);
    if (error && (error as { code?: string }).code !== 'PGRST205') throw error;
    return (data ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      team1Name: r.team1_name as string,
      team1Short: r.team1_short as string,
      team2Name: r.team2_name as string,
      team2Short: r.team2_short as string,
      format: r.format as string,
      venue: r.venue as string,
      status: r.status as string,
      result: r.result as string | null,
      ownerPhone: r.owner_phone as string | null,
      matchStateJson: '',
      matchDate: r.match_date as number,
      updatedAt: r.updated_at as number,
    }));
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code !== 'PGRST205') {
      console.error('[cloud-match-repo] fetchRecentCloudMatches failed:', (err as Error).message);
    }
    return [];
  }
}

export async function fetchMyCloudMatches(ownerPhone: string, days = 30): Promise<CloudMatchRow[]> {
  if (!isCloudEnabled || !supabase) return [];
  try {
    const since = Date.now() - days * 24 * 60 * 60 * 1000;
    const { data, error } = await supabase
      .from('cloud_match_states')
      .select('id, team1_name, team1_short, team2_name, team2_short, format, venue, status, result, owner_phone, match_date, updated_at')
      .eq('owner_phone', ownerPhone)
      .gte('updated_at', since)
      .order('updated_at', { ascending: false })
      .limit(50);
    if (error && (error as { code?: string }).code !== 'PGRST205') throw error;
    return (data ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      team1Name: r.team1_name as string,
      team1Short: r.team1_short as string,
      team2Name: r.team2_name as string,
      team2Short: r.team2_short as string,
      format: r.format as string,
      venue: r.venue as string,
      status: r.status as string,
      result: r.result as string | null,
      ownerPhone: r.owner_phone as string | null,
      matchStateJson: '',
      matchDate: r.match_date as number,
      updatedAt: r.updated_at as number,
    }));
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code !== 'PGRST205') {
      console.error('[cloud-match-repo] fetchMyCloudMatches failed:', (err as Error).message);
    }
    return [];
  }
}

/**
 * Fetch completed cloud matches with full match state JSON for stats computation.
 * Returns parsed Match objects, skipping any with invalid JSON.
 * Fetches owner's matches (no date cap) + community matches within `days`.
 */
export async function fetchCompletedCloudMatchStates(ownerPhone: string | null, days = 90): Promise<Match[]> {
  if (!isCloudEnabled || !supabase) return [];
  try {
    const since = Date.now() - days * 24 * 60 * 60 * 1000;
    let query = supabase
      .from('cloud_match_states')
      .select('id, match_state_json, owner_phone, updated_at')
      .eq('status', 'completed')
      .not('match_state_json', 'is', null)
      .gte('updated_at', since)
      .order('updated_at', { ascending: false })
      .limit(100);
    const { data, error } = await query;
    if (error && (error as { code?: string }).code !== 'PGRST205') throw error;
    const results: Match[] = [];
    for (const r of data ?? []) {
      try {
        const m = JSON.parse(r.match_state_json as string) as Match;
        results.push(m);
      } catch {}
    }
    // Also include owner's older completed matches beyond `days`
    if (ownerPhone) {
      const { data: ownerData, error: ownerErr } = await supabase
        .from('cloud_match_states')
        .select('id, match_state_json')
        .eq('status', 'completed')
        .eq('owner_phone', ownerPhone)
        .not('match_state_json', 'is', null)
        .lt('updated_at', since)
        .order('updated_at', { ascending: false })
        .limit(50);
      if (!ownerErr || (ownerErr as { code?: string }).code === 'PGRST205') {
        const seen = new Set(results.map(m => m.id));
        for (const r of ownerData ?? []) {
          if (seen.has(r.id as string)) continue;
          try {
            results.push(JSON.parse(r.match_state_json as string) as Match);
          } catch {}
        }
      }
    }
    return results;
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code !== 'PGRST205') {
      console.error('[cloud-match-repo] fetchCompletedCloudMatchStates failed:', (err as Error).message);
    }
    return [];
  }
}

export async function fetchCloudMatchState(matchId: string): Promise<Match | null> {
  if (!isCloudEnabled || !supabase) return null;
  try {
    const { data, error } = await supabase
      .from('cloud_match_states')
      .select('match_state_json')
      .eq('id', matchId)
      .maybeSingle();
    if (error && (error as { code?: string }).code !== 'PGRST205') throw error;
    if (!data?.match_state_json) return null;
    return JSON.parse(data.match_state_json) as Match;
  } catch (err) {
    console.error('[cloud-match-repo] fetchCloudMatchState failed:', (err as Error).message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Match Invitations — two-team acceptance before match starts
// ---------------------------------------------------------------------------

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

export interface MatchInvitation {
  matchId: string;
  team1Id: string;
  team2Id: string;
  team1Name: string;
  team2Name: string;
  format: string;
  venue: string;
  team1OwnerPhone: string;
  team2OwnerPhone: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: number;
  expiresAt: number;
  matchStateJson: string;
}

function rowToInvitation(r: Record<string, unknown>): MatchInvitation {
  return {
    matchId: r.match_id as string,
    team1Id: r.team1_id as string,
    team2Id: r.team2_id as string,
    team1Name: r.team1_name as string,
    team2Name: r.team2_name as string,
    format: r.format as string,
    venue: r.venue as string,
    team1OwnerPhone: r.team1_owner_phone as string,
    team2OwnerPhone: r.team2_owner_phone as string,
    status: r.status as 'pending' | 'accepted' | 'declined',
    createdAt: r.created_at as number,
    expiresAt: r.expires_at as number,
    matchStateJson: (r.match_state_json as string) ?? '',
  };
}

/** Publish a match invitation. Called by the creating admin immediately after match creation. */
export async function publishMatchInvitation(
  match: Match,
  team1OwnerPhone: string,
  team2OwnerPhone: string,
): Promise<void> {
  if (!isCloudEnabled || !supabase) return;
  const now = Date.now();
  try {
    // Write the invitation row — include full match JSON so the acceptor
    // can fetch it directly without depending on cloud_match_states.
    const { error: invErr } = await supabase.from('match_invitations').upsert({
      match_id: match.id,
      team1_id: match.team1.id,
      team2_id: match.team2.id,
      team1_name: match.team1.name,
      team2_name: match.team2.name,
      format: match.config.format,
      venue: match.venue ?? '',
      team1_owner_phone: team1OwnerPhone,
      team2_owner_phone: team2OwnerPhone,
      status: 'pending',
      created_at: now,
      expires_at: now + TWENTY_FOUR_HOURS,
      match_state_json: JSON.stringify(match),
    });
    if (invErr && (invErr as { code?: string }).code !== 'PGRST205') {
      console.error('[cloud-match-repo] publishMatchInvitation invitation write failed:', invErr.message);
    }

    // Also write the full match JSON to cloud_match_states so the acceptor
    // can fetch it via fetchCloudMatchState. publishMatchState skips
    // pending_acceptance, so we write directly here.
    const { error: stateErr } = await supabase
      .from('cloud_match_states')
      .upsert(matchToCloudRow(match, team1OwnerPhone));
    if (stateErr && (stateErr as { code?: string }).code !== 'PGRST205') {
      console.error('[cloud-match-repo] publishMatchInvitation state write failed:', stateErr.message);
    }
  } catch (err) {
    console.error('[cloud-match-repo] publishMatchInvitation error:', (err as Error).message);
  }
}

/** Accept or decline an invitation. */
export async function respondToInvitation(
  matchId: string,
  response: 'accepted' | 'declined',
): Promise<void> {
  if (!isCloudEnabled || !supabase) return;
  try {
    const { error } = await supabase
      .from('match_invitations')
      .update({ status: response })
      .eq('match_id', matchId);
    if (error && (error as { code?: string }).code !== 'PGRST205') {
      console.error('[cloud-match-repo] respondToInvitation failed:', error.message);
    }
  } catch (err) {
    console.error('[cloud-match-repo] respondToInvitation error:', (err as Error).message);
  }
}

/** Fetch pending (non-expired) invitations for the opposing team's admin. */
export async function fetchPendingInvitations(myPhone: string): Promise<MatchInvitation[]> {
  if (!isCloudEnabled || !supabase) return [];
  try {
    const { data, error } = await supabase
      .from('match_invitations')
      .select('*')
      .eq('team2_owner_phone', myPhone)
      .eq('status', 'pending')
      .gt('expires_at', Date.now())
      .order('created_at', { ascending: false });
    if (error && (error as { code?: string }).code !== 'PGRST205') throw error;
    return (data ?? []).map(rowToInvitation);
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code !== 'PGRST205') {
      console.error('[cloud-match-repo] fetchPendingInvitations failed:', (err as Error).message);
    }
    return [];
  }
}

/** Fetch the invitation status for a match the creator is watching. */
export async function fetchInvitationStatus(matchId: string): Promise<MatchInvitation | null> {
  if (!isCloudEnabled || !supabase) return null;
  try {
    const { data, error } = await supabase
      .from('match_invitations')
      .select('*')
      .eq('match_id', matchId)
      .single();
    if (error && (error as { code?: string }).code !== 'PGRST205' && (error as { code?: string }).code !== 'PGRST116') throw error;
    if (!data) return null;
    return rowToInvitation(data as Record<string, unknown>);
  } catch (err) {
    console.error('[cloud-match-repo] fetchInvitationStatus failed:', (err as Error).message);
    return null;
  }
}

/**
 * Fetch the full Match object stored in the invitation row.
 * Used as a fallback in acceptMatchInvitation when cloud_match_states
 * doesn't have the row yet (e.g. written before the publishMatchInvitation fix).
 */
export async function fetchMatchFromInvitation(matchId: string): Promise<import('../engine/types').Match | null> {
  if (!isCloudEnabled || !supabase) return null;
  try {
    const { data, error } = await supabase
      .from('match_invitations')
      .select('match_state_json')
      .eq('match_id', matchId)
      .maybeSingle();
    if (error && (error as { code?: string }).code !== 'PGRST205') throw error;
    if (!data?.match_state_json) return null;
    return JSON.parse(data.match_state_json) as import('../engine/types').Match;
  } catch (err) {
    console.error('[cloud-match-repo] fetchMatchFromInvitation failed:', (err as Error).message);
    return null;
  }
}

/**
 * Subscribe to invitation changes for the opposing team admin.
 * Triggers onUpdate whenever any invitation row for myPhone changes.
 */
export function subscribeToInvitations(
  myPhone: string,
  onUpdate: (invitations: MatchInvitation[]) => void,
): () => void {
  if (!isCloudEnabled || !supabase) return () => {};
  const channel = supabase
    .channel(`match_invitations_${myPhone}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'match_invitations' }, async () => {
      const invitations = await fetchPendingInvitations(myPhone);
      onUpdate(invitations);
    })
    .subscribe();
  return () => { supabase!.removeChannel(channel); };
}

/**
 * Subscribe to live_matches updates for a specific match.
 * Used by the observer on the toss screen to detect when the match goes in_progress.
 */
export function subscribeToLiveMatch(
  matchId: string,
  onUpdate: (status: string) => void,
): () => void {
  if (!isCloudEnabled || !supabase) return () => {};
  const channel = supabase
    .channel(`live_match_${matchId}`)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'live_matches', filter: `id=eq.${matchId}` },
      (payload) => {
        const row = (payload.new ?? payload.old) as Record<string, unknown> | null;
        if (row && typeof row.status === 'string') onUpdate(row.status);
      })
    .subscribe();
  return () => { supabase!.removeChannel(channel); };
}

/**
 * Subscribe to changes on a specific match invitation (for the creating admin
 * waiting for team2 to accept or decline).
 */
export function subscribeToMatchInvitation(
  matchId: string,
  onUpdate: (invitation: MatchInvitation | null) => void,
): () => void {
  if (!isCloudEnabled || !supabase) return () => {};
  const channel = supabase
    .channel(`match_invitation_${matchId}`)
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'match_invitations', filter: `match_id=eq.${matchId}` },
      async () => {
        const inv = await fetchInvitationStatus(matchId);
        onUpdate(inv);
      })
    .subscribe();
  return () => { supabase!.removeChannel(channel); };
}
