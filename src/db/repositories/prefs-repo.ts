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
