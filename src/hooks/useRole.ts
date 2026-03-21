/**
 * useRole — centralised permissions helper.
 *
 * Permissions matrix (requirements doc):
 *
 *   Feature              | League Admin | Team Admin | Scorer | Viewer
 *   ---------------------|:------------:|:----------:|:------:|:------:
 *   Create League        |      ✅      |     ❌     |   ❌   |   ❌
 *   Edit Player Stats    |      ✅      |     ✅     |   ❌   |   ❌
 *   Record Ball Data     |      ❌      |     ❌     |   ✅   |   ❌
 *   View Live Scores     |      ✅      |     ✅     |   ✅   |   ✅
 *   Delete Match         |      ✅      |     ❌     |   ❌   |   ❌
 *   Create/Start Match   |      ✅      |     ✅     |   ✅   |   ❌
 *   Create Team          |      ✅      |     ✅     |   ❌   |   ❌
 */

import { useUserAuth } from './useUserAuth';
import type { UserRole } from '../engine/types';

export interface RolePermissions {
  /** The user's current role. null when not authenticated. */
  role: UserRole | null;

  /** Can create and administer leagues */
  canCreateLeague: boolean;

  /** Can create / edit / delete teams and manage rosters */
  canManageTeams: boolean;

  /** Can create and start matches */
  canCreateMatch: boolean;

  /** Can record ball-by-ball data during a live match */
  canScore: boolean;

  /** Can delete a match permanently */
  canDeleteMatch: boolean;

  /** View live scores, scorecards, and stats — all authenticated users */
  canViewLive: boolean;

  /** Display label for the current role */
  roleLabel: string;

  /** MaterialCommunityIcons icon name for the role */
  roleIcon: string;

  /** Colour token key for the role badge */
  roleColor: string;
}

const ROLE_META: Record<UserRole, { label: string; icon: string; color: string }> = {
  league_admin: { label: 'League Admin',  icon: 'shield-crown',        color: '#7B1FA2' },
  team_admin:   { label: 'Team Admin',    icon: 'shield-account',      color: '#1565C0' },
  scorer:       { label: 'Scorer',        icon: 'scoreboard-outline',  color: '#2E7D32' },
  viewer:       { label: 'Viewer',        icon: 'eye-outline',         color: '#6D4C41' },
};

export function useRole(): RolePermissions {
  const profile = useUserAuth(s => s.profile);
  const role = profile?.role ?? null;

  return {
    role,
    canCreateLeague: role === 'league_admin',
    canManageTeams:  role === 'league_admin' || role === 'team_admin',
    canCreateMatch:  role === 'league_admin' || role === 'team_admin' || role === 'scorer',
    canScore:        role === 'league_admin' || role === 'scorer',
    canDeleteMatch:  role === 'league_admin',
    canViewLive:     role !== null,
    roleLabel: role ? ROLE_META[role].label : 'Unknown',
    roleIcon:  role ? ROLE_META[role].icon  : 'account-outline',
    roleColor: role ? ROLE_META[role].color : '#9E9E9E',
  };
}
