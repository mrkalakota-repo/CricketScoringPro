/**
 * Seed data — three sample teams with realistic player rosters.
 * loadSeedData() is idempotent (checks for existing data before inserting).
 * deleteSeedData() removes only teams whose names match the seeded team names.
 */
import * as teamRepo from '../db/repositories/team-repo';
import * as matchRepo from '../db/repositories/match-repo';

type PlayerDef = {
  name: string;
  battingStyle: 'right' | 'left';
  bowlingStyle: string;
  isWicketKeeper: boolean;
  isAllRounder: boolean;
  isCaptain: boolean;
};

// ── Team A: Mumbai Blasters ──────────────────────────────────────────────────
const TEAM_A: { name: string; shortName: string; players: PlayerDef[] } = {
  name: 'Mumbai Blasters',
  shortName: 'MBL',
  players: [
    { name: 'Rohit Desai',     battingStyle: 'right', bowlingStyle: 'Right-arm off-break',  isWicketKeeper: false, isAllRounder: false, isCaptain: true  },
    { name: 'Aditya Kulkarni', battingStyle: 'right', bowlingStyle: 'none',                  isWicketKeeper: true,  isAllRounder: false, isCaptain: false },
    { name: 'Suresh Naik',     battingStyle: 'left',  bowlingStyle: 'Left-arm orthodox',     isWicketKeeper: false, isAllRounder: true,  isCaptain: false },
    { name: 'Vikas Pawar',     battingStyle: 'right', bowlingStyle: 'Right-arm fast',        isWicketKeeper: false, isAllRounder: false, isCaptain: false },
    { name: 'Pooja Hegde',     battingStyle: 'right', bowlingStyle: 'Right-arm leg-break',   isWicketKeeper: false, isAllRounder: true,  isCaptain: false },
    { name: 'Kiran Jadhav',    battingStyle: 'left',  bowlingStyle: 'Left-arm fast',         isWicketKeeper: false, isAllRounder: false, isCaptain: false },
    { name: 'Nikhil Sawant',   battingStyle: 'right', bowlingStyle: 'Right-arm medium',      isWicketKeeper: false, isAllRounder: false, isCaptain: false },
    { name: 'Tanya Bhosle',    battingStyle: 'right', bowlingStyle: 'Right-arm off-break',   isWicketKeeper: false, isAllRounder: true,  isCaptain: false },
    { name: 'Prasad Kadam',    battingStyle: 'left',  bowlingStyle: 'Left-arm chinaman',     isWicketKeeper: false, isAllRounder: false, isCaptain: false },
    { name: 'Sanjay More',     battingStyle: 'right', bowlingStyle: 'Right-arm fast',        isWicketKeeper: false, isAllRounder: false, isCaptain: false },
    { name: 'Deepa Patil',     battingStyle: 'right', bowlingStyle: 'Right-arm medium',      isWicketKeeper: false, isAllRounder: false, isCaptain: false },
  ],
};

// ── Team B: Chennai Challengers ──────────────────────────────────────────────
const TEAM_B: { name: string; shortName: string; players: PlayerDef[] } = {
  name: 'Chennai Challengers',
  shortName: 'CHC',
  players: [
    { name: 'Arjun Venkat',    battingStyle: 'right', bowlingStyle: 'Right-arm fast',        isWicketKeeper: false, isAllRounder: false, isCaptain: true  },
    { name: 'Lakshmi Rajan',   battingStyle: 'left',  bowlingStyle: 'none',                  isWicketKeeper: true,  isAllRounder: false, isCaptain: false },
    { name: 'Pradeep Kumar',   battingStyle: 'right', bowlingStyle: 'Right-arm off-break',   isWicketKeeper: false, isAllRounder: true,  isCaptain: false },
    { name: 'Kavitha Murali',  battingStyle: 'right', bowlingStyle: 'Right-arm leg-break',   isWicketKeeper: false, isAllRounder: false, isCaptain: false },
    { name: 'Selvam Babu',     battingStyle: 'left',  bowlingStyle: 'Left-arm orthodox',     isWicketKeeper: false, isAllRounder: true,  isCaptain: false },
    { name: 'Dinesh Raj',      battingStyle: 'right', bowlingStyle: 'Right-arm medium',      isWicketKeeper: false, isAllRounder: false, isCaptain: false },
    { name: 'Meena Suresh',    battingStyle: 'right', bowlingStyle: 'none',                  isWicketKeeper: false, isAllRounder: false, isCaptain: false },
    { name: 'Muthu Krishnan',  battingStyle: 'left',  bowlingStyle: 'Left-arm fast',         isWicketKeeper: false, isAllRounder: true,  isCaptain: false },
    { name: 'Vignesh Pillai',  battingStyle: 'right', bowlingStyle: 'Right-arm fast',        isWicketKeeper: false, isAllRounder: false, isCaptain: false },
    { name: 'Anbu Selvan',     battingStyle: 'right', bowlingStyle: 'Right-arm leg-break',   isWicketKeeper: false, isAllRounder: false, isCaptain: false },
    { name: 'Revathi Nair',    battingStyle: 'left',  bowlingStyle: 'Left-arm chinaman',     isWicketKeeper: false, isAllRounder: false, isCaptain: false },
  ],
};

// ── Team C: Delhi Dynamos ────────────────────────────────────────────────────
const TEAM_C: { name: string; shortName: string; players: PlayerDef[] } = {
  name: 'Delhi Dynamos',
  shortName: 'DDY',
  players: [
    { name: 'Rahul Sharma',    battingStyle: 'right', bowlingStyle: 'Right-arm off-break',   isWicketKeeper: false, isAllRounder: false, isCaptain: true  },
    { name: 'Priya Kapoor',    battingStyle: 'right', bowlingStyle: 'none',                   isWicketKeeper: true,  isAllRounder: false, isCaptain: false },
    { name: 'Aman Yadav',      battingStyle: 'left',  bowlingStyle: 'Left-arm fast',          isWicketKeeper: false, isAllRounder: true,  isCaptain: false },
    { name: 'Ritu Singh',      battingStyle: 'right', bowlingStyle: 'Right-arm fast',         isWicketKeeper: false, isAllRounder: false, isCaptain: false },
    { name: 'Siddharth Jain',  battingStyle: 'right', bowlingStyle: 'Right-arm leg-break',    isWicketKeeper: false, isAllRounder: true,  isCaptain: false },
    { name: 'Neha Gupta',      battingStyle: 'left',  bowlingStyle: 'Left-arm orthodox',      isWicketKeeper: false, isAllRounder: false, isCaptain: false },
    { name: 'Vikram Tomar',    battingStyle: 'right', bowlingStyle: 'Right-arm medium',       isWicketKeeper: false, isAllRounder: false, isCaptain: false },
    { name: 'Anjali Rawat',    battingStyle: 'right', bowlingStyle: 'Right-arm off-break',    isWicketKeeper: false, isAllRounder: true,  isCaptain: false },
    { name: 'Aryan Mehta',     battingStyle: 'left',  bowlingStyle: 'Left-arm chinaman',      isWicketKeeper: false, isAllRounder: false, isCaptain: false },
    { name: 'Sunita Bhatia',   battingStyle: 'right', bowlingStyle: 'Right-arm fast',         isWicketKeeper: false, isAllRounder: false, isCaptain: false },
    { name: 'Devesh Tyagi',    battingStyle: 'right', bowlingStyle: 'Right-arm medium',       isWicketKeeper: false, isAllRounder: false, isCaptain: false },
  ],
};

const ALL_SEED_TEAMS = [TEAM_A, TEAM_B, TEAM_C] as const;
export const SEED_TEAM_NAMES = [TEAM_A.name, TEAM_B.name, TEAM_C.name] as const;
export type SeedTeamName = typeof SEED_TEAM_NAMES[number];

async function seedTeam(def: typeof TEAM_A): Promise<void> {
  const team = await teamRepo.createTeam(def.name, def.shortName);
  for (const p of def.players) {
    await teamRepo.addPlayer(team.id, p.name, p.battingStyle, p.bowlingStyle, p.isWicketKeeper, p.isAllRounder, p.isCaptain);
  }
}

export async function loadSingleSeedTeam(teamName: SeedTeamName): Promise<{ created: boolean; message: string }> {
  const existing = await teamRepo.getAllTeams();
  if (existing.some(t => t.name === teamName)) {
    return { created: false, message: `${teamName} already exists.` };
  }
  const def = ALL_SEED_TEAMS.find(t => t.name === teamName)!;
  await seedTeam(def);
  return { created: true, message: `${teamName} loaded with ${def.players.length} players.` };
}

export async function deleteSeedData(): Promise<{ deleted: boolean; message: string; matchesDeleted: number }> {
  const existing = await teamRepo.getAllTeams();
  const seedTeams = existing.filter(t => (SEED_TEAM_NAMES as readonly string[]).includes(t.name));
  if (seedTeams.length === 0) {
    return { deleted: false, message: 'No sample teams found to delete.', matchesDeleted: 0 };
  }
  const seedTeamIds = new Set(seedTeams.map(t => t.id));

  // Delete any matches involving seed teams
  const allMatches = await matchRepo.getAllMatches();
  const matchesToDelete = allMatches.filter(m => seedTeamIds.has(m.team1_id) || seedTeamIds.has(m.team2_id));
  for (const m of matchesToDelete) {
    await matchRepo.deleteMatch(m.id);
  }

  for (const t of seedTeams) {
    await teamRepo.deleteTeam(t.id);
  }
  return {
    deleted: true,
    message: `Deleted ${seedTeams.length} sample team${seedTeams.length > 1 ? 's' : ''}${matchesToDelete.length > 0 ? ` and ${matchesToDelete.length} associated match${matchesToDelete.length !== 1 ? 'es' : ''}` : ''}.`,
    matchesDeleted: matchesToDelete.length,
  };
}
