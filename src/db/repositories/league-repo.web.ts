import type { League, LeagueFixture, LeagueFixtureStatus, FixtureNRRData, LeagueFormat } from '../../engine/types';


const uuidv4 = (): string => globalThis.crypto.randomUUID();

const LEAGUES_KEY = 'csp_leagues';
const FIXTURES_KEY = 'csp_league_fixtures';

interface StoredFixture extends LeagueFixture {}

function getLeagues(): League[] {
  try { return JSON.parse(localStorage.getItem(LEAGUES_KEY) || '[]'); }
  catch { return []; }
}
function setLeagues(leagues: League[]): void {
  localStorage.setItem(LEAGUES_KEY, JSON.stringify(leagues));
}
function getFixtures(): StoredFixture[] {
  try { return JSON.parse(localStorage.getItem(FIXTURES_KEY) || '[]'); }
  catch { return []; }
}
function setFixtures(fixtures: StoredFixture[]): void {
  localStorage.setItem(FIXTURES_KEY, JSON.stringify(fixtures));
}

export async function upsertLeague(league: League): Promise<void> {
  const existing = getLeagues();
  const idx = existing.findIndex(l => l.id === league.id);
  if (idx === -1) {
    setLeagues([...existing, league]);
  } else if (league.updatedAt >= existing[idx].updatedAt) {
    setLeagues(existing.map(l => l.id === league.id ? league : l));
  }
}

export async function upsertFixture(fixture: LeagueFixture): Promise<void> {
  const existing = getFixtures();
  const idx = existing.findIndex(f => f.id === fixture.id);
  if (idx === -1) {
    setFixtures([...existing, fixture]);
  } else if (fixture.updatedAt >= existing[idx].updatedAt) {
    setFixtures(existing.map(f => f.id === fixture.id ? fixture : f));
  }
}

export async function getAllLeagues(): Promise<League[]> {
  return getLeagues().map(l => ({ ...l, teamIds: l.teamIds ?? [] }));
}

export async function getLeagueById(id: string): Promise<League | null> {
  return getLeagues().find(l => l.id === id) ?? null;
}

export async function createLeague(name: string, shortName: string, format: LeagueFormat = 'round_robin'): Promise<League> {
  const now = Date.now();
  const league: League = { id: uuidv4(), name, shortName, teamIds: [], format, createdAt: now, updatedAt: now };
  setLeagues([...getLeagues(), league]);
  return league;
}

export async function updateLeague(id: string, name: string, shortName: string): Promise<void> {
  setLeagues(getLeagues().map(l => l.id === id ? { ...l, name, shortName, updatedAt: Date.now() } : l));
}

export async function deleteLeague(id: string): Promise<void> {
  setLeagues(getLeagues().filter(l => l.id !== id));
  setFixtures(getFixtures().filter(f => f.leagueId !== id));
}

export async function addTeamToLeague(leagueId: string, teamId: string): Promise<void> {
  setLeagues(getLeagues().map(l => {
    if (l.id !== leagueId || l.teamIds.includes(teamId)) return l;
    return { ...l, teamIds: [...l.teamIds, teamId], updatedAt: Date.now() };
  }));
}

export async function removeTeamFromLeague(leagueId: string, teamId: string): Promise<void> {
  setLeagues(getLeagues().map(l =>
    l.id === leagueId ? { ...l, teamIds: l.teamIds.filter(id => id !== teamId), updatedAt: Date.now() } : l
  ));
}

export async function getFixturesForLeague(leagueId: string): Promise<LeagueFixture[]> {
  return getFixtures()
    .filter(f => f.leagueId === leagueId)
    .sort((a, b) => a.scheduledDate - b.scheduledDate);
}

export async function createFixture(
  leagueId: string, team1Id: string, team2Id: string, venue: string, scheduledDate: number,
  round: number | null = null, bracketSlot: number | null = null,
): Promise<LeagueFixture> {
  const now = Date.now();
  const fixture: LeagueFixture = {
    id: uuidv4(), leagueId, team1Id, team2Id, matchId: null, venue, scheduledDate,
    status: 'scheduled', result: null, team1Score: null, team2Score: null,
    winnerTeamId: null, nrrData: null, round, bracketSlot, createdAt: now, updatedAt: now,
  };
  setFixtures([...getFixtures(), fixture]);
  return fixture;
}

export async function updateFixtureResult(
  id: string, result: string, winnerTeamId: string | null,
  team1Score: string | null, team2Score: string | null,
  nrrData: FixtureNRRData | null,
): Promise<void> {
  setFixtures(getFixtures().map(f =>
    f.id === id
      ? { ...f, status: 'completed' as LeagueFixtureStatus, result, winnerTeamId, team1Score, team2Score, nrrData, updatedAt: Date.now() }
      : f
  ));
}

export async function deleteFixture(id: string): Promise<void> {
  setFixtures(getFixtures().filter(f => f.id !== id));
}

export async function linkFixtureToMatch(fixtureId: string, matchId: string): Promise<void> {
  setFixtures(getFixtures().map(f =>
    f.id === fixtureId ? { ...f, matchId, updatedAt: Date.now() } : f
  ));
}
