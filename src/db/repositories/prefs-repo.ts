import { getDatabase } from '../database';
import * as SecureStore from 'expo-secure-store';

const MY_TEAM_IDS_KEY = 'my_team_ids';

async function getStringPref(key: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM user_prefs WHERE key = ?', [key]
  );
  return row?.value ?? null;
}

async function setStringPref(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT INTO user_prefs(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value]
  );
}

export async function getMyTeamIds(): Promise<string[]> {
  try {
    const raw = await getStringPref(MY_TEAM_IDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function addMyTeamId(teamId: string): Promise<void> {
  const ids = await getMyTeamIds();
  if (!ids.includes(teamId)) {
    await setStringPref(MY_TEAM_IDS_KEY, JSON.stringify([...ids, teamId]));
  }
}

export async function removeMyTeamId(teamId: string): Promise<void> {
  const ids = await getMyTeamIds();
  await setStringPref(MY_TEAM_IDS_KEY, JSON.stringify(ids.filter(id => id !== teamId)));
}

export async function setMyTeamIds(teamIds: string[]): Promise<void> {
  await setStringPref(MY_TEAM_IDS_KEY, JSON.stringify(teamIds));
}

// ── Player Team IDs ───────────────────────────────────────────────────────────
// Teams the user is listed as a player on (not owner). View-only access.

const PLAYER_TEAM_IDS_KEY = 'player_team_ids';

export async function getPlayerTeamIds(): Promise<string[]> {
  try {
    const raw = await getStringPref(PLAYER_TEAM_IDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function setPlayerTeamIds(teamIds: string[]): Promise<void> {
  await setStringPref(PLAYER_TEAM_IDS_KEY, JSON.stringify(teamIds));
}

// ── My League IDs ─────────────────────────────────────────────────────────────

const MY_LEAGUE_IDS_KEY = 'my_league_ids';

export async function getMyLeagueIds(): Promise<string[]> {
  try {
    const raw = await getStringPref(MY_LEAGUE_IDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function addMyLeagueId(leagueId: string): Promise<void> {
  const ids = await getMyLeagueIds();
  if (!ids.includes(leagueId)) {
    await setStringPref(MY_LEAGUE_IDS_KEY, JSON.stringify([...ids, leagueId]));
  }
}

export async function removeMyLeagueId(leagueId: string): Promise<void> {
  const ids = await getMyLeagueIds();
  await setStringPref(MY_LEAGUE_IDS_KEY, JSON.stringify(ids.filter(id => id !== leagueId)));
}

export async function setMyLeagueIds(leagueIds: string[]): Promise<void> {
  await setStringPref(MY_LEAGUE_IDS_KEY, JSON.stringify(leagueIds));
}

// ── Delegate Team IDs ─────────────────────────────────────────────────────────

const DELEGATE_TEAM_IDS_KEY = 'delegate_team_ids';

export async function getDelegateTeamIds(): Promise<string[]> {
  try {
    const raw = await getStringPref(DELEGATE_TEAM_IDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function addDelegateTeamId(teamId: string): Promise<void> {
  const ids = await getDelegateTeamIds();
  if (!ids.includes(teamId)) {
    await setStringPref(DELEGATE_TEAM_IDS_KEY, JSON.stringify([...ids, teamId]));
  }
}

export async function removeDelegateTeamId(teamId: string): Promise<void> {
  const ids = await getDelegateTeamIds();
  await setStringPref(DELEGATE_TEAM_IDS_KEY, JSON.stringify(ids.filter(id => id !== teamId)));
}

// ── User Profile ──────────────────────────────────────────────────────────────
//
// Security split:
//   • Non-sensitive metadata (phone, name, role) → SQLite user_prefs
//   • PIN hash → expo-secure-store (hardware-backed keystore on Android/iOS)
//
// Migration: existing installs may have pinHash stored in the SQLite JSON blob.
// On first read we migrate it out to SecureStore automatically.

const USER_PROFILE_KEY = 'user_profile';
const SECURE_PIN_KEY = 'user_profile_pin_hash';

export interface StoredUserProfile {
  phone: string;
  name: string;
  pinHash: string;
  role?: string; // UserRole — optional for backwards compat with existing stored profiles
}

export async function getUserProfile(): Promise<StoredUserProfile | null> {
  try {
    const raw = await getStringPref(USER_PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.phone !== 'string' || typeof parsed?.name !== 'string') {
      console.error('[prefs-repo] getUserProfile: stored profile has unexpected shape, ignoring');
      return null;
    }

    // Read PIN hash from SecureStore (preferred) — fall back to SQLite blob for migration
    let pinHash: string = (await SecureStore.getItemAsync(SECURE_PIN_KEY)) ?? '';
    if (!pinHash && typeof parsed?.pinHash === 'string' && parsed.pinHash) {
      // Migrate legacy pinHash from SQLite to SecureStore
      pinHash = parsed.pinHash;
      await SecureStore.setItemAsync(SECURE_PIN_KEY, pinHash);
      // Remove it from the SQLite blob
      const { pinHash: _removed, ...rest } = parsed;
      await setStringPref(USER_PROFILE_KEY, JSON.stringify(rest));
    }

    return { phone: parsed.phone, name: parsed.name, pinHash, role: parsed.role } as StoredUserProfile;
  } catch { return null; }
}

export async function setUserProfile(profile: StoredUserProfile): Promise<void> {
  // Store PIN hash in SecureStore; everything else in SQLite
  await SecureStore.setItemAsync(SECURE_PIN_KEY, profile.pinHash);
  await setStringPref(USER_PROFILE_KEY, JSON.stringify({
    phone: profile.phone,
    name: profile.name,
    role: profile.role,
  }));
}

export async function clearUserProfile(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM user_prefs WHERE key = ?', [USER_PROFILE_KEY]);
  await SecureStore.deleteItemAsync(SECURE_PIN_KEY).catch(() => {});
}

// ── Chat Identity ─────────────────────────────────────────────────────────────

export async function getChatIdentity(teamId: string): Promise<{ playerId: string; playerName: string } | null> {
  try {
    const raw = await getStringPref(`chat_identity_${teamId}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export async function setChatIdentity(teamId: string, playerId: string, playerName: string): Promise<void> {
  await setStringPref(`chat_identity_${teamId}`, JSON.stringify({ playerId, playerName }));
}
