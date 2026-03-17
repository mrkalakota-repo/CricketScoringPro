import { getDatabase } from '../database';

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

const USER_PROFILE_KEY = 'user_profile';

export interface StoredUserProfile {
  phone: string;
  name: string;
  pinHash: string;
}

export async function getUserProfile(): Promise<StoredUserProfile | null> {
  try {
    const raw = await getStringPref(USER_PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export async function setUserProfile(profile: StoredUserProfile): Promise<void> {
  await setStringPref(USER_PROFILE_KEY, JSON.stringify(profile));
}

export async function clearUserProfile(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM user_prefs WHERE key = ?', [USER_PROFILE_KEY]);
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
