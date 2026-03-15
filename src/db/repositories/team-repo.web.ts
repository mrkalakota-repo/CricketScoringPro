import type { Team, Player, BowlingStyle } from '../../engine/types';
import * as Crypto from 'expo-crypto';

const uuidv4 = () => Crypto.randomUUID();

const TEAMS_KEY = 'csp_teams';
const PLAYERS_KEY = 'csp_players';

interface StoredPlayer extends Player {
  teamId: string;
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
  return { ...p, isAllRounder: p.isAllRounder ?? false };
}

export async function getAllTeams(): Promise<Team[]> {
  const teams = getTeams();
  const allPlayers = getPlayers();
  return teams.map(team => ({
    ...team,
    players: allPlayers.filter(p => p.teamId === team.id).map(toPlayer),
  }));
}

export async function getTeamById(id: string): Promise<Team | null> {
  const team = getTeams().find(t => t.id === id);
  if (!team) return null;
  return {
    ...team,
    players: getPlayers().filter(p => p.teamId === id).map(toPlayer),
  };
}

export async function createTeam(name: string, shortName: string): Promise<Team> {
  const teams = getTeams();
  const now = Date.now();
  const team: Team = { id: uuidv4(), name, shortName, players: [], createdAt: now, updatedAt: now };
  teams.push(team);
  setTeams(teams);
  return team;
}

export async function updateTeam(id: string, name: string, shortName: string): Promise<void> {
  setTeams(getTeams().map(t => t.id === id ? { ...t, name, shortName, updatedAt: Date.now() } : t));
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
  battingStyle: string = 'right',
  bowlingStyle: string = 'none',
  isWicketKeeper: boolean = false,
  isAllRounder: boolean = false,
): Promise<Player> {
  const players = getPlayers();
  const stored: StoredPlayer = {
    id: uuidv4(),
    name,
    battingStyle: battingStyle as Player['battingStyle'],
    bowlingStyle: bowlingStyle as BowlingStyle,
    isWicketKeeper,
    isAllRounder,
    teamId,
  };
  players.push(stored);
  setPlayers(players);
  return toPlayer(stored);
}

export async function updatePlayer(
  id: string,
  name: string,
  battingStyle: string,
  bowlingStyle: string,
  isWicketKeeper: boolean,
  isAllRounder: boolean,
): Promise<void> {
  setPlayers(getPlayers().map(p =>
    p.id === id
      ? { ...p, name, battingStyle: battingStyle as Player['battingStyle'], bowlingStyle: bowlingStyle as BowlingStyle, isWicketKeeper, isAllRounder }
      : p
  ));
}

export async function deletePlayer(id: string): Promise<void> {
  setPlayers(getPlayers().filter(p => p.id !== id));
}
