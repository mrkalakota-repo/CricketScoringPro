// ===== Enums & Literal Types =====

export type MatchFormat = 'test' | 'odi' | 't20' | 'custom';

export type InningsStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'declared'
  | 'forfeited';

export type MatchStatus =
  | 'pending_acceptance'
  | 'scheduled'
  | 'toss'
  | 'in_progress'
  | 'completed'
  | 'abandoned';

export type DismissalType =
  | 'bowled'
  | 'caught'
  | 'lbw'
  | 'run_out'
  | 'stumped'
  | 'hit_wicket'
  | 'handled_ball'
  | 'obstructing_field'
  | 'timed_out'
  | 'hit_twice'
  | 'retired_hurt'
  | 'retired_out';

export type ExtraType = 'wide' | 'no_ball' | 'bye' | 'leg_bye' | 'penalty';

export type TossDecision = 'bat' | 'bowl';

export type BattingStyle = 'right' | 'left';

export type PowerplayType = 'mandatory' | 'batting' | 'bowling';

// ===== Core Models =====

export type BowlingStyle =
  | 'none'
  | 'Right-arm fast'
  | 'Right-arm medium'
  | 'Right-arm off-break'
  | 'Right-arm leg-break'
  | 'Left-arm fast'
  | 'Left-arm medium'
  | 'Left-arm orthodox'
  | 'Left-arm chinaman';

/** A player's role in the team */
export type PlayerRole = 'batter' | 'bowler' | 'allrounder' | 'wicket-keeper';

export interface Player {
  id: string;
  name: string;
  phoneNumber?: string | null; // Unique across all players — used as cross-team identity key
  battingStyle: BattingStyle;
  bowlingStyle: BowlingStyle;
  isWicketKeeper: boolean;
  isAllRounder: boolean;
  isCaptain: boolean;
  isViceCaptain: boolean;
  jerseyNumber: number | null;  // 0–999; null = not assigned
  photoUri: string | null;      // Local file URI from expo-image-picker; null = no photo
}

/**
 * Role hierarchy (least → most privileged):
 *   viewer → scorer → team_admin → league_admin
 */
export type UserRole = 'viewer' | 'scorer' | 'team_admin' | 'league_admin';

/** Logged-in user profile stored locally */
export interface UserProfile {
  phone: string;
  name: string;
  pinHash: string; // SHA-256 of the user's PIN
  role: UserRole;
}

export interface Team {
  id: string;
  name: string;
  shortName: string; // e.g., "IND", "AUS"
  players: Player[];
  adminPinHash: string | null; // SHA-256 of the admin PIN; null = no PIN set (open access)
  latitude: number | null;    // Set at creation time for proximity sorting
  longitude: number | null;
  createdAt: number;
  updatedAt: number;
}

// ===== Ball-by-Ball Models =====

export interface Extra {
  type: ExtraType;
  runs: number;
}

export interface Dismissal {
  type: DismissalType;
  batsmanId: string;
  bowlerId: string;
  fielderId: string | null;
}

export interface BallOutcome {
  id: string;
  overNumber: number; // 0-indexed
  ballInOver: number; // 0-indexed, legal deliveries only
  batsmanId: string;
  nonStrikerId: string;
  bowlerId: string;
  runs: number; // Runs off bat
  extras: Extra[];
  isLegal: boolean;
  isBoundary: boolean;
  dismissal: Dismissal | null;
  isFreeHit: boolean;
  timestamp: number;
  scoringZone?: number; // 0–7 representing 45° field zones (0=straight, clockwise); only on scoring shots
}

// ===== Innings Aggregates =====

export interface BatterInnings {
  playerId: string;
  runs: number;
  ballsFaced: number;
  fours: number;
  sixes: number;
  dismissal: Dismissal | null;
  isOnStrike: boolean;
  battingPosition: number;
}

export interface BowlerSpell {
  playerId: string;
  overs: number; // Completed overs
  ballsBowled: number; // Balls in current (incomplete) over
  maidens: number;
  runsConceded: number;
  wickets: number;
  wides: number;
  noBalls: number;
}

export interface Partnership {
  batter1Id: string;
  batter2Id: string;
  runs: number;
  balls: number;
  batter1Runs: number;
  batter2Runs: number;
  extras: number;
}

export interface FallOfWicket {
  wicketNumber: number;
  runs: number;
  overs: number;
  ballsInOver: number;
  playerId: string;
  dismissal: Dismissal;
}

export interface ExtrasBreakdown {
  wides: number;
  noBalls: number;
  byes: number;
  legByes: number;
  penalties: number;
}

export interface PowerplayConfig {
  type: PowerplayType;
  startOver: number;
  endOver: number;
}

export interface Innings {
  id: string;
  inningsNumber: number; // 1-based
  battingTeamId: string;
  bowlingTeamId: string;
  status: InningsStatus;
  totalRuns: number;
  totalWickets: number;
  totalOvers: number; // Completed overs
  totalBalls: number; // Balls in current (incomplete) over
  extras: ExtrasBreakdown;
  batters: BatterInnings[];
  bowlers: BowlerSpell[];
  partnerships: Partnership[];
  overs: OverSummary[];
  allBalls: BallOutcome[];
  currentStrikerId: string | null;
  currentNonStrikerId: string | null;
  currentBowlerId: string | null;
  fallOfWickets: FallOfWicket[];
  powerplays: PowerplayConfig[];
  target: number | null;
  isSuperOver: boolean;
  // DLS fields — set when an admin applies a rain interruption ruling
  revisedTarget?: number;   // DLS/Gully-mode revised target
  revisedOvers?: number;    // Revised overs quota after interruption
  dlsMode?: 'standard' | 'gully'; // Which DLS variant was applied
  dlsGullyRunsPerOver?: number;   // Gully-mode custom RPO override
}

export interface OverSummary {
  number: number;
  bowlerId: string;
  balls: BallOutcome[];
  runs: number;
  wickets: number;
  isMaiden: boolean;
}

// ===== Match Models =====

export interface Toss {
  winnerId: string;
  decision: TossDecision;
}

export interface MatchConfig {
  format: MatchFormat;
  oversPerInnings: number | null; // null for Tests
  maxInnings: number; // 2 for LOI, 4 for Tests
  playersPerSide: number;
  powerplays: PowerplayConfig[];
  followOnMinimum: number | null; // 200 for 5-day Tests, null for LOI
  wideRuns: number; // 1 for all formats
  noBallRuns: number; // 1 for all formats
}

export interface Match {
  id: string;
  schemaVersion?: number; // Migration stamp — see src/engine/migration.ts
  config: MatchConfig;
  status: MatchStatus;
  team1: Team;
  team2: Team;
  team1PlayingXI: string[]; // Player IDs
  team2PlayingXI: string[];
  toss: Toss | null;
  innings: Innings[];
  currentInningsIndex: number;
  venue: string;
  date: number;
  result: string | null;
  superOver: boolean;       // true once super over innings have started
  createdAt: number;
  updatedAt: number;
}

// ===== Scoring Input =====

export interface BallInput {
  runs: number;
  isWide: boolean;
  isNoBall: boolean;
  isBye: boolean;
  isLegBye: boolean;
  dismissal: {
    type: DismissalType;
    fielderId?: string;
    batsmanId?: string; // For run outs (could be non-striker)
  } | null;
  isBoundary: boolean;
  scoringZone?: number; // 0–7 field zone tap; only on scoring shots, optional
}

// ===== League Models =====

export type LeagueFixtureStatus = 'scheduled' | 'completed' | 'abandoned';

export interface FixtureNRRData {
  team1Runs: number;
  team1OversRaw: number;   // cricket notation: 18.3 = 18 overs 3 balls
  team1AllOut: boolean;
  team2Runs: number;
  team2OversRaw: number;
  team2AllOut: boolean;
  maxOvers: number;
}

export interface LeagueFixture {
  id: string;
  leagueId: string;
  team1Id: string;
  team2Id: string;
  matchId: string | null;
  venue: string;
  scheduledDate: number;
  status: LeagueFixtureStatus;
  result: string | null;
  team1Score: string | null;
  team2Score: string | null;
  winnerTeamId: string | null;
  nrrData: FixtureNRRData | null;
  round: number | null;        // knockout round (1-based); null for round-robin
  bracketSlot: number | null;  // position within round (0-based) for pairing
  createdAt: number;
  updatedAt: number;
  // Verification — set by a league_admin to lock the result against further edits
  isVerified?: boolean;
  verifiedByPhone?: string | null;
  verifiedAt?: number | null;
  verifiedByName?: string | null;
}

export type LeagueFormat = 'round_robin' | 'knockout';

export interface League {
  id: string;
  name: string;
  shortName: string;
  teamIds: string[];
  format: LeagueFormat;
  createdAt: number;
  updatedAt: number;
}

export interface LeagueStandingRow {
  teamId: string;
  played: number;
  won: number;
  lost: number;
  tied: number;
  abandoned: number;
  points: number;
  nrr: number;
}

// ===== Chat Models =====

export interface ChatMessage {
  id: string;
  teamId: string;
  playerId: string;
  playerName: string;
  text: string;
  createdAt: number;
}

export interface ChatIdentity {
  playerId: string;
  playerName: string;
}

// ===== Undo =====

export interface ScoringAction {
  ballOutcome: BallOutcome;
  previousInningsSnapshot: Innings;
  timestamp: number;
}

// ===== Format Presets =====

export const FORMAT_CONFIGS: Record<Exclude<MatchFormat, 'custom'>, Omit<MatchConfig, 'format'>> = {
  t20: {
    oversPerInnings: 20,
    maxInnings: 2,
    playersPerSide: 11,
    powerplays: [{ type: 'mandatory', startOver: 0, endOver: 5 }],
    followOnMinimum: null,
    wideRuns: 1,
    noBallRuns: 1,
  },
  odi: {
    oversPerInnings: 50,
    maxInnings: 2,
    playersPerSide: 11,
    powerplays: [
      { type: 'mandatory', startOver: 0, endOver: 9 },
      { type: 'mandatory', startOver: 10, endOver: 39 },
      { type: 'mandatory', startOver: 40, endOver: 49 },
    ],
    followOnMinimum: null,
    wideRuns: 1,
    noBallRuns: 1,
  },
  test: {
    oversPerInnings: null,
    maxInnings: 4,
    playersPerSide: 11,
    powerplays: [],
    followOnMinimum: 200,
    wideRuns: 1,
    noBallRuns: 1,
  },
};
