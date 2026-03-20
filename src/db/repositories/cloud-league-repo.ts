import { supabase, isCloudEnabled } from '../../config/supabase';
import type { League, LeagueFixture, LeagueFixtureStatus, LeagueFormat, FixtureNRRData } from '../../engine/types';

// ── Push ──────────────────────────────────────────────────────────────────────

export async function pushLeague(league: League, ownerPhone: string): Promise<void> {
  if (!isCloudEnabled || !supabase) return;
  try {
    const { error } = await supabase.from('cloud_leagues').upsert({
      id: league.id,
      name: league.name,
      short_name: league.shortName,
      team_ids: JSON.stringify(league.teamIds),
      format: league.format,
      owner_phone: ownerPhone,
      updated_at: Date.now(),
    });
    if (error && (error as { code?: string }).code !== 'PGRST205') throw error;
  } catch (err) {
    console.error('[cloud-league-repo] pushLeague failed:', (err as Error).message);
  }
}

export async function pushFixture(fixture: LeagueFixture): Promise<void> {
  if (!isCloudEnabled || !supabase) return;
  try {
    const { error } = await supabase.from('cloud_league_fixtures').upsert({
      id: fixture.id,
      league_id: fixture.leagueId,
      team1_id: fixture.team1Id,
      team2_id: fixture.team2Id,
      match_id: fixture.matchId ?? null,
      venue: fixture.venue,
      scheduled_date: fixture.scheduledDate,
      status: fixture.status,
      result: fixture.result ?? null,
      team1_score: fixture.team1Score ?? null,
      team2_score: fixture.team2Score ?? null,
      winner_team_id: fixture.winnerTeamId ?? null,
      nrr_data_json: fixture.nrrData ? JSON.stringify(fixture.nrrData) : null,
      round: fixture.round ?? null,
      bracket_slot: fixture.bracketSlot ?? null,
      updated_at: Date.now(),
    });
    if (error && (error as { code?: string }).code !== 'PGRST205') throw error;
  } catch (err) {
    console.error('[cloud-league-repo] pushFixture failed:', (err as Error).message);
  }
}

export async function pushFixtures(fixtures: LeagueFixture[]): Promise<void> {
  if (!isCloudEnabled || !supabase || fixtures.length === 0) return;
  try {
    const rows = fixtures.map(f => ({
      id: f.id,
      league_id: f.leagueId,
      team1_id: f.team1Id,
      team2_id: f.team2Id,
      match_id: f.matchId ?? null,
      venue: f.venue,
      scheduled_date: f.scheduledDate,
      status: f.status,
      result: f.result ?? null,
      team1_score: f.team1Score ?? null,
      team2_score: f.team2Score ?? null,
      winner_team_id: f.winnerTeamId ?? null,
      nrr_data_json: f.nrrData ? JSON.stringify(f.nrrData) : null,
      round: f.round ?? null,
      bracket_slot: f.bracketSlot ?? null,
      updated_at: Date.now(),
    }));
    const { error } = await supabase.from('cloud_league_fixtures').upsert(rows);
    if (error && (error as { code?: string }).code !== 'PGRST205') throw error;
  } catch (err) {
    console.error('[cloud-league-repo] pushFixtures failed:', (err as Error).message);
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteCloudLeague(leagueId: string): Promise<void> {
  if (!isCloudEnabled || !supabase) return;
  try {
    await supabase.from('cloud_leagues').delete().eq('id', leagueId);
  } catch (err) {
    console.error('[cloud-league-repo] deleteCloudLeague failed:', (err as Error).message);
  }
}

export async function deleteCloudFixture(fixtureId: string): Promise<void> {
  if (!isCloudEnabled || !supabase) return;
  try {
    await supabase.from('cloud_league_fixtures').delete().eq('id', fixtureId);
  } catch (err) {
    console.error('[cloud-league-repo] deleteCloudFixture failed:', (err as Error).message);
  }
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

export async function fetchLeaguesByOwner(ownerPhone: string): Promise<{
  leagues: League[];
  fixturesByLeague: Record<string, LeagueFixture[]>;
}> {
  if (!isCloudEnabled || !supabase) return { leagues: [], fixturesByLeague: {} };
  try {
    const { data: leagueRows, error: le } = await supabase
      .from('cloud_leagues')
      .select('*')
      .eq('owner_phone', ownerPhone)
      .order('updated_at', { ascending: false });

    if (le) {
      if ((le as { code?: string }).code === 'PGRST205') return { leagues: [], fixturesByLeague: {} };
      throw le;
    }
    if (!leagueRows || leagueRows.length === 0) return { leagues: [], fixturesByLeague: {} };

    const leagueIds = leagueRows.map((r: any) => r.id);
    const { data: fixtureRows, error: fe } = await supabase
      .from('cloud_league_fixtures')
      .select('*')
      .in('league_id', leagueIds);

    if (fe && (fe as { code?: string }).code !== 'PGRST205') throw fe;

    const leagues: League[] = leagueRows.map((r: any) => ({
      id: r.id,
      name: r.name,
      shortName: r.short_name,
      teamIds: JSON.parse(r.team_ids || '[]'),
      format: (r.format as LeagueFormat) ?? 'round_robin',
      createdAt: r.updated_at ?? Date.now(),
      updatedAt: r.updated_at ?? Date.now(),
    }));

    const fixturesByLeague: Record<string, LeagueFixture[]> = {};
    for (const r of fixtureRows ?? []) {
      const f: LeagueFixture = {
        id: r.id,
        leagueId: r.league_id,
        team1Id: r.team1_id,
        team2Id: r.team2_id,
        matchId: r.match_id ?? null,
        venue: r.venue ?? '',
        scheduledDate: r.scheduled_date ?? 0,
        status: (r.status as LeagueFixtureStatus) ?? 'scheduled',
        result: r.result ?? null,
        team1Score: r.team1_score ?? null,
        team2Score: r.team2_score ?? null,
        winnerTeamId: r.winner_team_id ?? null,
        nrrData: r.nrr_data_json ? JSON.parse(r.nrr_data_json) as FixtureNRRData : null,
        round: r.round ?? null,
        bracketSlot: r.bracket_slot ?? null,
        createdAt: r.updated_at ?? Date.now(),
        updatedAt: r.updated_at ?? Date.now(),
      };
      if (!fixturesByLeague[f.leagueId]) fixturesByLeague[f.leagueId] = [];
      fixturesByLeague[f.leagueId].push(f);
    }

    return { leagues, fixturesByLeague };
  } catch (err) {
    console.error('[cloud-league-repo] fetchLeaguesByOwner failed:', (err as Error).message);
    return { leagues: [], fixturesByLeague: {} };
  }
}
