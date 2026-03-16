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
