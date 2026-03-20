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
//
// Security split:
//   • Non-sensitive metadata (phone, name, role) → localStorage (persists across browser sessions)
//   • PIN hash → sessionStorage (cleared when browser tab closes, limits XSS exposure)
//
// On page load both halves are recombined; the app shows a PIN prompt when
// the PIN hash is absent (session expired), which is the intended behaviour.

const USER_PROFILE_KEY = 'user_profile';
const USER_PROFILE_PIN_KEY = 'user_profile_pin';

export interface StoredUserProfile {
  phone: string;
  name: string;
  pinHash: string;
  role?: string; // UserRole — optional for backwards compat with existing stored profiles
}

export async function getUserProfile(): Promise<StoredUserProfile | null> {
  try {
    const rawMeta = localStorage.getItem(USER_PROFILE_KEY);
    const rawPin = sessionStorage.getItem(USER_PROFILE_PIN_KEY);
    if (!rawMeta) return null;
    const meta = JSON.parse(rawMeta);
    if (typeof meta?.phone !== 'string' || typeof meta?.name !== 'string') return null;
    // If session has expired, return profile without pinHash — caller must re-authenticate
    const pinHash = rawPin ?? '';
    return { phone: meta.phone, name: meta.name, role: meta.role, pinHash } as StoredUserProfile;
  } catch { return null; }
}

export async function setUserProfile(profile: StoredUserProfile): Promise<void> {
  // Store metadata in localStorage (survives browser restart)
  localStorage.setItem(USER_PROFILE_KEY, JSON.stringify({
    phone: profile.phone,
    name: profile.name,
    role: profile.role,
  }));
  // Store PIN hash in sessionStorage only (cleared when tab closes)
  sessionStorage.setItem(USER_PROFILE_PIN_KEY, profile.pinHash);
}

export async function clearUserProfile(): Promise<void> {
  localStorage.removeItem(USER_PROFILE_KEY);
  sessionStorage.removeItem(USER_PROFILE_PIN_KEY);
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
