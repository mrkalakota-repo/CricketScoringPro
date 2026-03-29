import type { Team, Player, BowlingStyle } from '../../engine/types';

const uuidv4 = (): string => globalThis.crypto.randomUUID();

const TEAMS_KEY = 'csp_teams';
const PLAYERS_KEY = 'csp_players';

interface StoredPlayer extends Player {
  teamId: string;
  phoneNumber: string | null;
}

function getTeams(): Team[] {
  try { return JSON.parse(localStorage.getItem(TEAMS_KEY) || '[]'); }
  catch { return []; }
}

function setTeams(teams: Team[]): void {
  localStorage.setItem(TEAMS_KEY, JSON.stringify(teams));
}

function getPlayers(): StoredPlayer[] {
  try { return JSON.parse(localStorage.getItem(PLAYERS_KEY) || '[]'); }
  catch { return []; }
}

function setPlayers(players: StoredPlayer[]): void {
  localStorage.setItem(PLAYERS_KEY, JSON.stringify(players));
}

function toPlayer({ teamId: _t, ...p }: StoredPlayer): Player {
  return {
    ...p,
    phoneNumber: p.phoneNumber ?? null,
    isAllRounder: p.isAllRounder ?? false,
    isCaptain: p.isCaptain ?? false,
    isViceCaptain: p.isViceCaptain ?? false,
    jerseyNumber: p.jerseyNumber ?? null,
    photoUri: p.photoUri ?? null,
  };
}

export async function isPhoneNumberTaken(phone: string, excludePlayerId?: string): Promise<boolean> {
  return getPlayers().some(p => p.phoneNumber === phone && p.id !== (excludePlayerId ?? ''));
}

export async function getAllTeams(): Promise<Team[]> {
  const teams = getTeams();
  const allPlayers = getPlayers();
  return teams.map(team => ({
    ...team,
    adminPinHash: team.adminPinHash ?? null,
    latitude: team.latitude ?? null,
    longitude: team.longitude ?? null,
    players: allPlayers.filter(p => p.teamId === team.id).map(toPlayer),
  }));
}

export async function getTeamById(id: string): Promise<Team | null> {
  const team = getTeams().find(t => t.id === id);
  if (!team) return null;
  return {
    ...team,
    adminPinHash: team.adminPinHash ?? null,
    latitude: team.latitude ?? null,
    longitude: team.longitude ?? null,
    players: getPlayers().filter(p => p.teamId === id).map(toPlayer),
  };
}

export async function isTeamNameTaken(name: string, excludeTeamId?: string): Promise<boolean> {
  return getTeams().some(t =>
    t.name.toLowerCase() === name.toLowerCase() && t.id !== (excludeTeamId ?? '')
  );
}

export async function createTeam(
  name: string,
  shortName: string,
  latitude: number | null = null,
  longitude: number | null = null,
): Promise<Team> {
  const teams = getTeams();
  const now = Date.now();
  const team: Team = { id: uuidv4(), name, shortName, adminPinHash: null, latitude, longitude, players: [], createdAt: now, updatedAt: now };
  teams.push(team);
  setTeams(teams);
  return team;
}

export async function updateTeam(id: string, name: string, shortName: string): Promise<void> {
  setTeams(getTeams().map(t => t.id === id ? { ...t, name, shortName, updatedAt: Date.now() } : t));
}

export async function setTeamAdminPin(id: string, pinHash: string | null): Promise<void> {
  setTeams(getTeams().map(t => t.id === id ? { ...t, adminPinHash: pinHash, updatedAt: Date.now() } : t));
}

export async function deleteTeam(id: string): Promise<void> {
  setTeams(getTeams().filter(t => t.id !== id));
  setPlayers(getPlayers().filter(p => p.teamId !== id));
}

export async function getPlayersForTeam(teamId: string): Promise<Player[]> {
  return getPlayers().filter(p => p.teamId === teamId).map(toPlayer);
}

export async function addPlayer(
  teamId: string,
  name: string,
  phoneNumber: string | null = null,
  battingStyle: string = 'right',
  bowlingStyle: string = 'none',
  isWicketKeeper: boolean = false,
  isAllRounder: boolean = false,
  isCaptain: boolean = false,
  isViceCaptain: boolean = false,
  jerseyNumber: number | null = null,
  photoUri: string | null = null,
): Promise<Player> {
  const players = getPlayers();
  const stored: StoredPlayer = {
    id: uuidv4(), name, phoneNumber: phoneNumber ?? null,
    battingStyle: battingStyle as Player['battingStyle'],
    bowlingStyle: bowlingStyle as BowlingStyle,
    isWicketKeeper, isAllRounder, isCaptain, isViceCaptain,
    jerseyNumber: jerseyNumber ?? null, photoUri: photoUri ?? null,
    teamId,
  };
  players.push(stored);
  setPlayers(players);
  return toPlayer(stored);
}

export async function updatePlayer(
  id: string,
  name: string,
  phoneNumber: string | null,
  battingStyle: string,
  bowlingStyle: string,
  isWicketKeeper: boolean,
  isAllRounder: boolean,
  isCaptain: boolean,
  isViceCaptain: boolean = false,
  jerseyNumber: number | null = null,
  photoUri: string | null = null,
): Promise<void> {
  setPlayers(getPlayers().map(p =>
    p.id === id
      ? { ...p, name, phoneNumber: phoneNumber ?? null, battingStyle: battingStyle as Player['battingStyle'], bowlingStyle: bowlingStyle as BowlingStyle, isWicketKeeper, isAllRounder, isCaptain, isViceCaptain, jerseyNumber: jerseyNumber ?? null, photoUri: photoUri ?? null }
      : p
  ));
}

export async function deletePlayer(id: string): Promise<void> {
  setPlayers(getPlayers().filter(p => p.id !== id));
}

// Import a cloud-discovered team without overwriting any locally-owned team.
export async function importCloudTeam(team: Team): Promise<void> {
  const teams = getTeams();
  const existing = teams.find(t => t.id === team.id);
  if (!existing) {
    // New team from cloud — save without players (players added below)
    setTeams([...teams, { ...team, adminPinHash: null, players: [] }]);
  } else if (existing.adminPinHash === null) {
    // We don't own it — update name/location from cloud
    setTeams(teams.map(t =>
      t.id === team.id
        ? { ...t, name: team.name, shortName: team.shortName, latitude: team.latitude, longitude: team.longitude }
        : t
    ));
  }
  // Merge in players we don't already have
  const players = getPlayers();
  const existingPlayerIds = new Set(players.map(p => p.id));
  const newPlayers = team.players
    .filter(p => !existingPlayerIds.has(p.id))
    .map(p => ({ ...p, phoneNumber: p.phoneNumber ?? null, teamId: team.id }));
  if (newPlayers.length > 0) {
    setPlayers([...players, ...newPlayers]);
  }
}
