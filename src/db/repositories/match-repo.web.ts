import type { Match, MatchConfig } from '../../engine/types';
import * as Crypto from 'expo-crypto';

const uuidv4 = () => Crypto.randomUUID();

const MATCHES_KEY = 'csp_matches';

export interface MatchRow {
  id: string;
  format: string;
  config_json: string;
  status: string;
  team1_id: string;
  team2_id: string;
  team1_playing_xi: string;
  team2_playing_xi: string;
  toss_json: string | null;
  venue: string;
  match_date: number;
  result: string | null;
  match_state_json: string | null;
  created_at: number;
  updated_at: number;
}

function getMatches(): MatchRow[] {
  try {
    return JSON.parse(localStorage.getItem(MATCHES_KEY) || '[]');
  } catch {
    return [];
  }
}

function setMatches(matches: MatchRow[]): void {
  localStorage.setItem(MATCHES_KEY, JSON.stringify(matches));
}

export async function getAllMatches(): Promise<MatchRow[]> {
  return [...getMatches()].sort((a, b) => b.created_at - a.created_at);
}

export async function getMatchById(id: string): Promise<MatchRow | null> {
  return getMatches().find(m => m.id === id) ?? null;
}

export async function createMatch(
  config: MatchConfig,
  team1Id: string,
  team2Id: string,
  team1PlayingXI: string[],
  team2PlayingXI: string[],
  venue: string,
  matchDate: number
): Promise<string> {
  const matches = getMatches();
  const id = uuidv4();
  const now = Date.now();
  matches.push({
    id,
    format: config.format,
    config_json: JSON.stringify(config),
    status: 'scheduled',
    team1_id: team1Id,
    team2_id: team2Id,
    team1_playing_xi: JSON.stringify(team1PlayingXI),
    team2_playing_xi: JSON.stringify(team2PlayingXI),
    toss_json: null,
    venue,
    match_date: matchDate,
    result: null,
    match_state_json: null,
    created_at: now,
    updated_at: now,
  });
  setMatches(matches);
  return id;
}

export async function saveMatchState(id: string, match: Match): Promise<void> {
  const matches = getMatches().map(m =>
    m.id === id
      ? {
          ...m,
          status: match.status,
          match_state_json: JSON.stringify(match),
          result: match.result ?? null,
          toss_json: match.toss ? JSON.stringify(match.toss) : null,
          updated_at: Date.now(),
        }
      : m
  );
  setMatches(matches);
}

export async function deleteMatch(id: string): Promise<void> {
  setMatches(getMatches().filter(m => m.id !== id));
}
