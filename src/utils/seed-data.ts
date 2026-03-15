/**
 * Seed data utility — loads two sample teams with realistic player rosters.
 * Intended for development/testing. Call from the Home screen "Load Sample Data" button.
 * Safe to call multiple times (checks for existing data first).
 */
import * as teamRepo from '../db/repositories/team-repo';

type PlayerDef = {
  name: string;
  battingStyle: 'right' | 'left';
  bowlingStyle: string;
  isWicketKeeper: boolean;
  isAllRounder: boolean;
  isCaptain: boolean;
};

const TEAM_A_PLAYERS: PlayerDef[] = [
  { name: 'Ravi Sharma',    battingStyle: 'right', bowlingStyle: 'Right-arm off-break',  isWicketKeeper: false, isAllRounder: false, isCaptain: true  },
  { name: 'Priya Singh',    battingStyle: 'right', bowlingStyle: 'none',                  isWicketKeeper: true,  isAllRounder: false, isCaptain: false },
  { name: 'Arjun Patel',   battingStyle: 'left',  bowlingStyle: 'Left-arm orthodox',     isWicketKeeper: false, isAllRounder: true,  isCaptain: false },
  { name: 'Dev Mehta',      battingStyle: 'right', bowlingStyle: 'Right-arm fast',        isWicketKeeper: false, isAllRounder: false, isCaptain: false },
  { name: 'Sana Rao',       battingStyle: 'right', bowlingStyle: 'Right-arm leg-break',   isWicketKeeper: false, isAllRounder: true,  isCaptain: false },
  { name: 'Kabir Khan',     battingStyle: 'left',  bowlingStyle: 'Left-arm fast',         isWicketKeeper: false, isAllRounder: false, isCaptain: false },
  { name: 'Ananya Iyer',    battingStyle: 'right', bowlingStyle: 'none',                  isWicketKeeper: false, isAllRounder: false, isCaptain: false },
  { name: 'Rohan Das',      battingStyle: 'right', bowlingStyle: 'Right-arm medium',      isWicketKeeper: false, isAllRounder: true,  isCaptain: false },
  { name: 'Meera Nair',     battingStyle: 'left',  bowlingStyle: 'Left-arm chinaman',     isWicketKeeper: false, isAllRounder: false, isCaptain: false },
  { name: 'Varun Gupta',    battingStyle: 'right', bowlingStyle: 'Right-arm fast',        isWicketKeeper: false, isAllRounder: false, isCaptain: false },
  { name: 'Divya Reddy',    battingStyle: 'right', bowlingStyle: 'Right-arm off-break',   isWicketKeeper: false, isAllRounder: false, isCaptain: false },
];

const TEAM_B_PLAYERS: PlayerDef[] = [
  { name: 'James Carter',   battingStyle: 'right', bowlingStyle: 'Right-arm fast',        isWicketKeeper: false, isAllRounder: false, isCaptain: true  },
  { name: 'Sam Wilson',     battingStyle: 'left',  bowlingStyle: 'none',                  isWicketKeeper: true,  isAllRounder: false, isCaptain: false },
  { name: 'Alex Morgan',    battingStyle: 'right', bowlingStyle: 'Right-arm medium',      isWicketKeeper: false, isAllRounder: true,  isCaptain: false },
  { name: 'Chris Lee',      battingStyle: 'right', bowlingStyle: 'Right-arm leg-break',   isWicketKeeper: false, isAllRounder: false, isCaptain: false },
  { name: 'Jordan Taylor',  battingStyle: 'left',  bowlingStyle: 'Left-arm orthodox',     isWicketKeeper: false, isAllRounder: true,  isCaptain: false },
  { name: 'Riley Brown',    battingStyle: 'right', bowlingStyle: 'none',                  isWicketKeeper: false, isAllRounder: false, isCaptain: false },
  { name: 'Morgan Smith',   battingStyle: 'right', bowlingStyle: 'Right-arm off-break',   isWicketKeeper: false, isAllRounder: false, isCaptain: false },
  { name: 'Casey Jones',    battingStyle: 'left',  bowlingStyle: 'Left-arm fast',         isWicketKeeper: false, isAllRounder: true,  isCaptain: false },
  { name: 'Dana White',     battingStyle: 'right', bowlingStyle: 'Right-arm medium',      isWicketKeeper: false, isAllRounder: false, isCaptain: false },
  { name: 'Blake Evans',    battingStyle: 'right', bowlingStyle: 'Right-arm fast',        isWicketKeeper: false, isAllRounder: false, isCaptain: false },
  { name: 'Quinn Adams',    battingStyle: 'left',  bowlingStyle: 'Left-arm chinaman',     isWicketKeeper: false, isAllRounder: false, isCaptain: false },
];

export async function loadSeedData(): Promise<{ created: boolean; message: string }> {
  const existing = await teamRepo.getAllTeams();
  if (existing.length > 0) {
    return { created: false, message: 'Sample data already exists.' };
  }

  const teamA = await teamRepo.createTeam('Thunderbolts', 'TBT');
  for (const p of TEAM_A_PLAYERS) {
    await teamRepo.addPlayer(teamA.id, p.name, p.battingStyle, p.bowlingStyle, p.isWicketKeeper, p.isAllRounder, p.isCaptain);
  }

  const teamB = await teamRepo.createTeam('Royal Strikers', 'RST');
  for (const p of TEAM_B_PLAYERS) {
    await teamRepo.addPlayer(teamB.id, p.name, p.battingStyle, p.bowlingStyle, p.isWicketKeeper, p.isAllRounder, p.isCaptain);
  }

  return { created: true, message: 'Thunderbolts and Royal Strikers loaded with 11 players each.' };
}
