import { useUserAuth } from './useUserAuth';
import { useTeamStore } from '../store/team-store';
import type { UserPlan } from '../engine/types';

// ── Feature identifiers ───────────────────────────────────────────────────────

export type PlanFeature =
  | 'additional_teams'
  | 'team_chat'
  | 'delegate_codes'
  | 'cloud_sync'
  | 'leagues'
  | 'scorecard_export'
  | 'public_scoreboard'
  | 'data_export';

// ── Plan limits ───────────────────────────────────────────────────────────────

export const PLAN_LIMITS = {
  free: {
    maxOwnedTeams: 1,
    maxLeagues: 0,
    cloudSync: false,
    teamChat: false,
    delegateCodes: false,
    scorecardExport: false,
    publicScoreboard: false,
    nrrStandings: false,
    dataExport: false,
  },
  pro: {
    maxOwnedTeams: 3,
    maxLeagues: 2,
    cloudSync: true,
    teamChat: true,
    delegateCodes: true,
    scorecardExport: true,
    publicScoreboard: false,
    nrrStandings: false,
    dataExport: false,
  },
  league: {
    maxOwnedTeams: Infinity,
    maxLeagues: Infinity,
    cloudSync: true,
    teamChat: true,
    delegateCodes: true,
    scorecardExport: true,
    publicScoreboard: true,
    nrrStandings: true,
    dataExport: true,
  },
} as const satisfies Record<UserPlan, {
  maxOwnedTeams: number;
  maxLeagues: number;
  cloudSync: boolean;
  teamChat: boolean;
  delegateCodes: boolean;
  scorecardExport: boolean;
  publicScoreboard: boolean;
  nrrStandings: boolean;
  dataExport: boolean;
}>;

// ── Pricing constants ─────────────────────────────────────────────────────────

export const PLAN_PRICING = {
  pro:    { monthly: 5.99,  annual: 49.99,  annualMonthlyEquiv: 4.17 },
  league: { monthly: 29.99, annual: 249.99, annualMonthlyEquiv: 20.83 },
} as const;

export const PLAN_LABELS: Record<UserPlan, string> = {
  free:   'Starter',
  pro:    'Pro Team',
  league: 'Pro League',
};

// ── Plan rank helper ──────────────────────────────────────────────────────────

const PLAN_RANK: Record<UserPlan, number> = { free: 0, pro: 1, league: 2 };

function higherPlan(a: UserPlan, b: UserPlan): UserPlan {
  return PLAN_RANK[a] >= PLAN_RANK[b] ? a : b;
}

// ── usePlan hook ──────────────────────────────────────────────────────────────

export interface PlanPermissions {
  plan: UserPlan;
  isFree: boolean;
  /** true for both 'pro' AND 'league' */
  isPro: boolean;
  isLeague: boolean;
  limits: typeof PLAN_LIMITS[UserPlan];

  // Feature flags
  canCloudSync: boolean;
  canUseTeamChat: boolean;
  canUseDelegateCodes: boolean;
  canExportScorecard: boolean;
  canCreatePublicScoreboard: boolean;
  canViewNRRStandings: boolean;
  canExportData: boolean;

  // Limit checkers — pass current count
  canCreateTeam: (currentOwnedCount: number) => boolean;
  canCreateLeague: (currentLeagueCount: number) => boolean;

  /**
   * Effective plan for a team-scoped context.
   * Returns the higher of the user's own plan and the team owner's plan
   * (passed as teamPlan from teamPlanCache).
   */
  effectivePlanFor: (teamPlan?: string) => UserPlan;
}

export function usePlan(): PlanPermissions {
  const storedPlan: UserPlan = useUserAuth(s => s.profile?.plan ?? 'free');
  // Web has no payment support — cap all web users at free regardless of stored plan
  const plan: UserPlan = storedPlan;
  const limits = PLAN_LIMITS[plan];

  const effectivePlanFor = (teamPlan?: string): UserPlan => {
    const tp = (teamPlan ?? 'free') as UserPlan;
    return higherPlan(plan, tp);
  };

  return {
    plan,
    isFree: plan === 'free',
    isPro: plan === 'pro' || plan === 'league',
    isLeague: plan === 'league',
    limits,
    canCloudSync: limits.cloudSync,
    canUseTeamChat: limits.teamChat,
    canUseDelegateCodes: limits.delegateCodes,
    canExportScorecard: limits.scorecardExport,
    canCreatePublicScoreboard: limits.publicScoreboard,
    canViewNRRStandings: limits.nrrStandings,
    canExportData: limits.dataExport,
    canCreateTeam: (count) => count < limits.maxOwnedTeams,
    canCreateLeague: (count) => count < limits.maxLeagues,
    effectivePlanFor,
  };
}

/**
 * Returns the effective plan for a specific team, taking into account
 * both the current user's own plan and the team owner's plan (from teamPlanCache).
 * Use this in team-scoped screens (chat, delegate codes) to check inherited access.
 */
export function useEffectivePlanForTeam(teamId: string): UserPlan {
  const ownPlan: UserPlan = useUserAuth(s => s.profile?.plan ?? 'free');
  const teamPlan: UserPlan = useTeamStore(s => s.teamPlanCache[teamId] ?? 'free');
  return higherPlan(ownPlan, teamPlan);
}
