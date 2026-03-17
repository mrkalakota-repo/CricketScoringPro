import { supabase, isCloudEnabled } from '../../config/supabase';
import type { Team } from '../../engine/types';

// ── Publish / Delete ──────────────────────────────────────────────────────────

export async function publishTeam(team: Team): Promise<void> {
  if (!isCloudEnabled || !supabase) return;
  try {
    const { error } = await supabase.from('cloud_teams').upsert({
      id: team.id,
      name: team.name,
      short_name: team.shortName,
      latitude: team.latitude,
      longitude: team.longitude,
      updated_at: Date.now(),
    });
    if (error) throw error;

    // Replace players: delete old, insert new
    await supabase.from('cloud_players').delete().eq('team_id', team.id);
    if (team.players.length > 0) {
      const { error: pe } = await supabase.from('cloud_players').insert(
        team.players.map(p => ({
          id: p.id,
          team_id: team.id,
          name: p.name,
          batting_style: p.battingStyle,
          bowling_style: p.bowlingStyle,
          is_wicket_keeper: p.isWicketKeeper,
          is_all_rounder: p.isAllRounder,
          is_captain: p.isCaptain,
          is_vice_captain: p.isViceCaptain,
        }))
      );
      if (pe) throw pe;
    }
  } catch (err) {
    console.error('[cloud-team-repo] publishTeam failed:', err);
  }
}

export async function deleteCloudTeam(teamId: string): Promise<void> {
  if (!isCloudEnabled || !supabase) return;
  try {
    await supabase.from('cloud_teams').delete().eq('id', teamId);
  } catch (err) {
    console.error('[cloud-team-repo] deleteCloudTeam failed:', err);
  }
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

export async function fetchNearbyTeams(
  lat: number,
  lon: number,
  radiusKm: number,
  excludeIds: string[],
): Promise<Team[]> {
  if (!isCloudEnabled || !supabase) return [];
  try {
    const latDelta = radiusKm / 111.0;
    const lonDelta = radiusKm / (111.0 * Math.cos((lat * Math.PI) / 180));

    let teamQuery = supabase
      .from('cloud_teams')
      .select('*')
      .not('latitude', 'is', null)
      .gte('latitude', lat - latDelta)
      .lte('latitude', lat + latDelta)
      .gte('longitude', lon - lonDelta)
      .lte('longitude', lon + lonDelta)
      .limit(50);

    if (excludeIds.length > 0) {
      teamQuery = teamQuery.not('id', 'in', `(${excludeIds.join(',')})`);
    }

    const { data: teamRows, error: teamErr } = await teamQuery;
    if (teamErr) throw teamErr;
    if (!teamRows || teamRows.length === 0) return [];

    return fetchPlayersAndBuild(teamRows);
  } catch (err) {
    console.error('[cloud-team-repo] fetchNearbyTeams failed:', (err as any)?.message ?? err);
    return [];
  }
}

export async function searchCloudTeams(
  searchQuery: string,
  excludeIds: string[],
): Promise<Team[]> {
  if (!isCloudEnabled || !supabase) return [];
  try {
    let teamQuery = supabase
      .from('cloud_teams')
      .select('*')
      .ilike('name', `%${searchQuery}%`)
      .limit(20);

    if (excludeIds.length > 0) {
      teamQuery = teamQuery.not('id', 'in', `(${excludeIds.join(',')})`);
    }

    const { data: teamRows, error: teamErr } = await teamQuery;
    if (teamErr) throw teamErr;
    if (!teamRows || teamRows.length === 0) return [];

    return fetchPlayersAndBuild(teamRows);
  } catch (err) {
    console.error('[cloud-team-repo] searchCloudTeams failed:', (err as any)?.message ?? err);
    return [];
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchPlayersAndBuild(teamRows: any[]): Promise<Team[]> {
  if (!supabase) return [];
  const teamIds = teamRows.map((r: any) => r.id);

  const { data: playerRows, error: playerErr } = await supabase
    .from('cloud_players')
    .select('*')
    .in('team_id', teamIds);

  if (playerErr) {
    console.error('[cloud-team-repo] fetchPlayers failed:', playerErr.message);
  }

  const playersByTeam: Record<string, any[]> = {};
  for (const p of playerRows ?? []) {
    if (!playersByTeam[p.team_id]) playersByTeam[p.team_id] = [];
    playersByTeam[p.team_id].push(p);
  }

  return teamRows.map((row: any) => ({
    id: row.id,
    name: row.name,
    shortName: row.short_name,
    adminPinHash: null,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    players: (playersByTeam[row.id] ?? []).map((p: any) => ({
      id: p.id,
      name: p.name,
      battingStyle: (p.batting_style ?? 'right') as 'right' | 'left',
      bowlingStyle: p.bowling_style ?? 'none',
      isWicketKeeper: p.is_wicket_keeper ?? false,
      isAllRounder: p.is_all_rounder ?? false,
      isCaptain: p.is_captain ?? false,
      isViceCaptain: p.is_vice_captain ?? false,
    })),
    createdAt: row.updated_at ?? Date.now(),
    updatedAt: row.updated_at ?? Date.now(),
  }));
}
