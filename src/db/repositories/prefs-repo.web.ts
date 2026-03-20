const MY_TEAM_IDS_KEY = 'my_team_ids';

function loadIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(MY_TEAM_IDS_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export async function getMyTeamIds(): Promise<string[]> {
  return loadIds();
}

export async function addMyTeamId(teamId: string): Promise<void> {
  const ids = loadIds();
  if (!ids.includes(teamId)) {
    localStorage.setItem(MY_TEAM_IDS_KEY, JSON.stringify([...ids, teamId]));
  }
}

export async function removeMyTeamId(teamId: string): Promise<void> {
  const ids = loadIds().filter(id => id !== teamId);
  localStorage.setItem(MY_TEAM_IDS_KEY, JSON.stringify(ids));
}

// ── Delegate Team IDs ─────────────────────────────────────────────────────────

const DELEGATE_KEY = 'delegate_team_ids';

function loadDelegateIds(): string[] {
  try { return JSON.parse(localStorage.getItem(DELEGATE_KEY) ?? '[]'); }
  catch { return []; }
}

export async function getDelegateTeamIds(): Promise<string[]> {
  return loadDelegateIds();
}

export async function addDelegateTeamId(teamId: string): Promise<void> {
  const ids = loadDelegateIds();
  if (!ids.includes(teamId)) {
    localStorage.setItem(DELEGATE_KEY, JSON.stringify([...ids, teamId]));
  }
}

export async function removeDelegateTeamId(teamId: string): Promise<void> {
  localStorage.setItem(DELEGATE_KEY, JSON.stringify(loadDelegateIds().filter(id => id !== teamId)));
}

// ── User Profile ──────────────────────────────────────────────────────────────

const USER_PROFILE_KEY = 'user_profile';

export interface StoredUserProfile {
  phone: string;
  name: string;
  pinHash: string;
  role?: string; // UserRole — optional for backwards compat with existing stored profiles
}

export async function getUserProfile(): Promise<StoredUserProfile | null> {
  try {
    const raw = localStorage.getItem(USER_PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export async function setUserProfile(profile: StoredUserProfile): Promise<void> {
  localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
}

export async function clearUserProfile(): Promise<void> {
  localStorage.removeItem(USER_PROFILE_KEY);
}

// ── Chat Identity ─────────────────────────────────────────────────────────────

export async function getChatIdentity(teamId: string): Promise<{ playerId: string; playerName: string } | null> {
  try {
    const raw = localStorage.getItem(`chat_identity_${teamId}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export async function setChatIdentity(teamId: string, playerId: string, playerName: string): Promise<void> {
  localStorage.setItem(`chat_identity_${teamId}`, JSON.stringify({ playerId, playerName }));
}
