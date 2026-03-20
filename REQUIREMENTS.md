# Gully Cricket Scorer — Requirements Document

> Cross-platform cricket scoring app (Android + iOS + mobile web)
> Built with React Native + Expo SDK 54

---

## Table of Contents

1. [Platform & Deployment](#1-platform--deployment)
2. [Team Management](#2-team-management)
3. [Player Management](#3-player-management)
4. [Match Formats & Configuration](#4-match-formats--configuration)
5. [Match Lifecycle — Toss](#5-match-lifecycle--toss)
6. [Match Lifecycle — Innings](#6-match-lifecycle--innings)
7. [Ball-by-Ball Scoring](#7-ball-by-ball-scoring)
8. [Undo Functionality](#8-undo-functionality)
9. [Scoring Aggregates](#9-scoring-aggregates)
10. [Stats & History](#10-stats--history)
11. [Home / Dashboard](#11-home--dashboard)
12. [Teams Tab](#12-teams-tab)
13. [Matches Tab](#13-matches-tab)
14. [Stats Tab](#14-stats-tab)
15. [Match Detail Screen](#15-match-detail-screen)
16. [Player Profile Screen](#16-player-profile-screen)
17. [Admin Auth & PIN System](#17-admin-auth--pin-system)
18. [Location & Proximity](#18-location--proximity)
18a. [Live Match Scores (Proximity Broadcast)](#18a-live-match-scores-proximity-broadcast)
18b. [Delegate Team Access](#18b-delegate-team-access)
18c. [Real-Time Team Chat](#18c-real-time-team-chat)
19. [Error Handling](#19-error-handling)
20. [Data Persistence](#20-data-persistence)
21. [Navigation Structure](#21-navigation-structure)
22. [Theming & Styling](#22-theming--styling)

---

## 1. Platform & Deployment

| Requirement | Detail |
|---|---|
| Platforms | Android (native), iOS (native), Mobile Web |
| Framework | React Native + Expo SDK 54 |
| Language | TypeScript (strict mode) |
| Dark Mode | Auto-detected via `useColorScheme()`, both themes fully supported |
| Persistence | SQLite (native) / localStorage (web) — transparent to UI |

**Dev commands:**

```bash
npm start            # Expo dev server (scan QR with Expo Go)
npm run android      # Android emulator
npm run ios          # iOS simulator
npm run web          # Mobile web (http://localhost:8081)
npm test             # Jest unit tests
```

---

## 2. Team Management

### 2.1 Team Creation
- Team name (required)
- Short name (required, max 5 chars, auto-uppercased)
- Optional admin PIN (4–6 digits, SHA-256 hashed before storage)
- Location auto-captured (latitude/longitude) if permission granted
- Creator is automatically authenticated as admin immediately after creation
- Team added to "My Teams" on the creating device

### 2.2 Team Discovery
- **My Teams** — always shown first; teams created on this device
- **Nearby teams** — up to 10 other teams within 50 miles (Haversine formula, 80.47 km radius), sorted by distance
- **Search** — case-insensitive name search across all teams
- Teams without coordinates are excluded from proximity but findable via search
- If location permission denied: all teams shown alphabetically

### 2.3 Team Actions
- Edit team name, short name
- Set/change admin PIN
- Delete team (requires admin auth; cascades to all players and matches)
- View roster, match history

---

## 3. Player Management

### 3.1 Player Attributes

| Attribute | Options |
|---|---|
| Name | Text, max 50 characters |
| Batting style | `right` (Right-hand) / `left` (Left-hand) |
| Bowling style | `none`, `Right-arm fast`, `Right-arm medium`, `Right-arm off-break`, `Right-arm leg-break`, `Left-arm fast`, `Left-arm medium`, `Left-arm orthodox`, `Left-arm chinaman` |
| Captain | Boolean flag (at most one per team) |
| Vice-captain | Boolean flag (at most one per team; mutually exclusive with Captain) |
| Wicket-keeper | Boolean flag |
| All-rounder | Boolean flag |
| Phone number | Optional — used as cross-team identity key for player discovery |

### 3.2 Roster Management
- Add players to a team (requires admin auth if PIN set)
- Delete players from a team (requires admin auth)
- Edit player batting/bowling style and role flags
- Assigning Captain clears any existing captain; assigning Vice-captain clears any existing vice-captain
- Phone number must be unique within the team (enforced at entry)
- View player career stats

### 3.3 Player Codes
- Each player has a 6-character alphanumeric code (deterministic, generated from player ID)
- Shareable — another device user can look up their profile via code
- "Find My Profile" feature on home screen

### 3.4 Player Skill Icons (MaterialCommunityIcons)

| Style | Icon | Color |
|---|---|---|
| Right-hand bat | `alpha-r-circle` | Cricket green `#1B6B28` |
| Left-hand bat | `alpha-l-circle` | Orange `#E65100` |
| Fast bowling | `lightning-bolt` | Orange `#E65100` |
| Medium bowling | `weather-windy` | Blue `#1565C0` |
| Off-break / Orthodox | `rotate-right` | Purple `#6A1B9A` |
| Leg-break / Chinaman | `rotate-left` | Teal `#00695C` |
| Does not bowl | `minus-circle-outline` | Grey `#9E9E9E` |

---

## 4. Match Formats & Configuration

### 4.1 Preset Formats

| Format | Overs/Side | Max Innings | Players/Side | Notes |
|---|---|---|---|---|
| **T20** | 20 | 2 | 11 | 1 powerplay (overs 0–5, mandatory) |
| **ODI** | 50 | 2 | 11 | 3 powerplays (mandatory) |
| **Test** | Unlimited | 4 | 11 | Follow-on rule at 200 run deficit |
| **Custom** | User-defined | 2 | User-defined | No powerplays |

### 4.2 Match Creation Wizard (5 Steps)

1. **Format** — select T20, ODI, Test, or Custom (with over count input)
2. **Teams** — pick two different teams from available list
3. **Playing XI** — select exactly **11 players** per team for T20/ODI/Test; custom format allows any count ≥ 1. Count displayed as `(X/11 selected)` in red until complete, green when ready.
4. **Venue** — optional venue name (defaults to "Unknown Venue")
5. **Confirm** — review all settings before creating

### 4.3 Match Lifecycle States

```
scheduled → toss → in_progress → completed
                              ↘ abandoned
```

---

## 5. Match Lifecycle — Toss

- Select toss winner (Team 1 or Team 2)
- Select toss decision: `bat` or `bowl`
- System auto-assigns batting team and bowling team accordingly
- Match status moves to `toss`

---

## 6. Match Lifecycle — Innings

### 6.1 Innings States
`not_started` → `in_progress` → `completed` / `declared` / `forfeited`

### 6.2 Innings Opening (each innings)
1. Select two openers (striker + non-striker) from batting XI
2. Select opening bowler from bowling XI
3. Match status moves to `in_progress`

### 6.3 Innings Completion Conditions
- All 10 wickets taken (all out)
- All configured overs bowled (limited-overs formats)
- Captain declares (Test format only)
- Team forfeits

### 6.4 Target (2nd+ Innings)
- Target = 1st innings total + 1
- Required run rate (RRR) shown to batting team
- Current run rate (CRR) always displayed

### 6.5 Match Completion
- Determined automatically after the final innings
- Result string generated: winning team by X runs / X wickets, or Tie/Abandoned

---

## 7. Ball-by-Ball Scoring

### 7.1 Ball Input
- Runs off bat: 0, 1, 2, 3, 4, 5, 6+
- Extras (combinable):
  - **Wide** — 1 run auto-added; free hit on next delivery
  - **No Ball** — 1 run auto-added; free hit on next delivery
  - **Bye** — runs added, batter gets no credit
  - **Leg Bye** — runs added, leg contact only
- Boundary flag (automatic on 4 or 6 runs)
- Dismissal (see below)

### 7.2 Dismissal Types

| Dismissal | Credited to Bowler |
|---|---|
| Bowled | Yes |
| Caught | Yes |
| LBW | Yes |
| Stumped | Yes |
| Hit Wicket | Yes |
| Run Out | **No** |
| Retired Hurt | **No** |
| Retired Out | **No** |
| Obstructing Field | **No** |
| Timed Out | **No** |

### 7.3 Free Hit Rules
- Triggered by previous wide or no ball
- Only `run_out` and `retired_out` valid dismissals on a free hit
- All other dismissals are blocked

### 7.4 Strike Rotation
- Auto-rotate after odd-number runs (1, 3, 5)
- No rotation on dot balls, wides, even runs
- Rotation at end of each completed over

### 7.5 Over Completion
- 6 legal deliveries = complete over
- Maiden over = 0 runs in a completed over (regardless of wickets)
- Bowler must change after each over (same bowler cannot bowl consecutive overs)

### 7.6 Bowling Restrictions (LOI formats only)
- **Max overs per bowler** = `floor(oversPerInnings / 5)` — T20: 4 overs, ODI: 10 overs; custom: proportional; Test: no limit
- Enforced in `MatchEngine.setBowler()` — throws on violation
- Ineligible bowlers shown greyed out in the selection modal with reason: `(bowled last over)` or `(max N overs)`

### 7.6 Partnerships
- Auto-tracked per batter pair
- Records: total runs, balls, individual batter contributions, extras

### 7.7 Fall of Wickets
- Each wicket records: wicket number, total score, overs.balls, dismissal details

---

## 8. Undo Functionality

- Every ball recorded creates a snapshot of innings state before the delivery
- "Undo" button reverts to prior snapshot
- Multiple undo presses supported
- Undo disabled when no balls have been scored
- Match state auto-saved after undo
- Undo stack persisted in match state JSON (survives app restart)

---

## 9. Scoring Aggregates

### 9.1 Per Batter (in innings)
- Runs, Balls faced, 4s, 6s, Strike rate
- On-strike indicator
- Dismissal info (type, bowler, fielder)

### 9.2 Per Bowler (in innings)
- Overs completed, Balls in current over
- Maidens, Runs conceded, Wickets
- Wides, No balls

### 9.3 Per Innings
- Total Runs / Wickets / Overs.Balls
- Extras breakdown (Wides, No-balls, Byes, Leg-byes)
- All balls in sequence
- Over-by-over summaries
- Partnerships
- Fall of wickets

---

## 10. Stats & History

### 10.1 Player Career Stats (completed matches only)

**Batting:** Matches, Innings, Not-outs, Runs, Highest Score, Average, Strike Rate, 50s, 100s, 4s, 6s

**Bowling:** Matches, Innings, Overs, Wickets, Runs, Economy, Average, Best Figures, Maidens

### 10.2 Match History
- All matches filterable by status (live, completed, scheduled)
- Scorecard view: batting table, bowling table, over-by-over breakdown, fall of wickets
- Recent completed matches shown on home screen (last 5)

### 10.3 Team Stats Summary
- Total teams, players, matches (by status)

---

## 11. Home / Dashboard

- **Hero** — app title + "New Match" CTA
- **Quick stats grid** — teams count, matches count, live matches count
- **Live Matches** — all `in_progress` or `toss` matches with score, status, teams, venue
- **Recent Matches** — last 5 completed matches with result
- **Empty state** — prompts to create team or load sample data
- **Quick actions** — My Profile, Load Sample Teams, Delete Sample Teams, Clear All Data

---

## 12. Teams Tab

- Search bar with real-time filtering
- When not searching:
  - **My Teams** section (always first)
  - **Nearby Teams** section (if location granted, up to 10 teams within 50 miles)
  - Distance shown in feet/miles
- When searching: results across all teams
- FAB ( + ) creates new team
- Empty state messages for each condition (no teams, no nearby, denied location, no results)

---

## 13. Matches Tab

- All matches, reverse creation order
- Per match card: Format badge, Status badge, Team short codes, Score/Result, Venue & date
- Tap navigates to: toss screen (toss), scoring screen (in_progress), detail screen (others)
- FAB ( + ) creates new match (5-step wizard)
- Empty state for no matches

---

## 14. Stats Tab

- Summary grid: completed matches, teams, players, total matches
- Player stats appear after completing matches
- Empty state: "Complete matches to see statistics"

---

## 15. Match Detail Screen

- Header: Format, team vs team, venue, status badge
- Innings cards with score, overs, run rate
- Result card (if completed)
- Action buttons: Continue Scoring, Go to Toss, View Scorecard (contextual)
- Delete match (confirmation dialog, not Alert.alert)
- Graceful handling of missing/corrupt match state

---

## 16. Player Profile Screen

- Header: name, team, skill icons for batting/bowling styles, role badges (C / WK / AR)
- Player code displayed and shareable
- Edit mode: change batting/bowling style, role flags (requires admin auth)
- Career stats cards (batting + bowling, only if applicable)
- Empty state if no matches played

---

## 17. User Authentication & RBAC

### 17.1 Global User Auth (phone + PIN)
- On first launch users register with: phone number, display name, 4–6 digit PIN, role
- PIN is SHA-256 hashed client-side; stored locally in `user_prefs`
- Profile also pushed to Supabase `user_profiles` for cross-device restore
- Cross-device account restore: enter phone → `verify_user_profile()` RPC verifies PIN server-side (hash never returned to client) → profile saved locally
- Session is in-memory — PIN must be re-entered after each app restart
- On web: metadata (phone, name, role) persists in `localStorage`; PIN hash in `sessionStorage` only (cleared on tab close)

### 17.2 Role-Based Permissions (RBAC)

| Permission | league_admin | team_admin | scorer | viewer |
|---|:---:|:---:|:---:|:---:|
| Create League | ✅ | ❌ | ❌ | ❌ |
| Manage Teams | ✅ | ✅ | ❌ | ❌ |
| Create / Start Match | ✅ | ✅ | ✅ | ❌ |
| Record Balls (Score) | ✅ | ❌ | ✅ | ❌ |
| Delete Match | ✅ | ❌ | ❌ | ❌ |
| View Live Scores | ✅ | ✅ | ✅ | ✅ |

Default role on registration: `scorer`. Use `useRole()` hook for all permission checks.

### 17.3 Team Admin PIN System
- Optional per-team PIN (4–6 digits), independent of user auth
- Hashed with SHA-256 (expo-crypto) before storage — plaintext never stored
- `adminPinHash: null` = open access (no PIN required)
- Auth state stored in-memory only — intentionally lost on app restart
- Creator auto-authenticated immediately after team creation

**Actions requiring team admin auth (if PIN set):**
- Add/edit/delete players
- Edit team info
- Change/set PIN
- Delete team

### 17.4 Access Control for Team Editing
- `isMyTeam` — team created on this device (stored in `myTeamIds` pref)
- `isDelegate` — editor access granted via delegate code
- `hasEditAccess = isMyTeam || isDelegate`
- Attempting to access `/team/[id]/edit` without access shows an unauthorized screen

---

## 18. Location & Proximity

- Foreground location permission requested at app startup
- Team coordinates captured at creation time (if permission granted)
- Haversine formula calculates great-circle distance
- Proximity radius: **50 miles (80.47 km)**
- Distances displayed: feet (< 1 mile), miles (≥ 1 mile)
- Graceful degradation if location denied or unavailable

---

## 18a. Live Match Scores (Proximity Broadcast)

Live scores from nearby matches are visible to all users within 50 miles, updated ball-by-ball.

### How it works
1. When a scorer records a ball (or undoes, starts innings, declares), the match state is published to Supabase `live_matches` table
2. Any user within 50 miles sees a **Nearby Matches** card on the Home screen, updated in real-time via Supabase `postgres_changes` subscription
3. Matches older than 24 hours are excluded; up to 20 matches shown at once
4. Location is the team's stored latitude/longitude (either team1 or team2 — whichever has coordinates)

### Displayed per match
- Team names (short codes and full)
- Format badge
- Current score (runs/wickets) and overs
- Batting team indicator
- Target (if second innings)
- Match status (LIVE / TOSS / RESULT) and result string (if completed)

### Requirements
- `isCloudEnabled` must be true (valid Supabase credentials in `.env`)
- `live_matches` table must exist in Supabase (run `supabase-setup.sql`)
- Location permission must be granted on the viewer's device
- Errors (e.g., table not yet created — PGRST205) are silently swallowed; feature degrades gracefully

---

## 18b. Delegate Team Access

Allows a non-owner to gain editor access to a team without knowing the full admin PIN.

### Flow
1. **Owner** (must be admin-unlocked) generates a 6-character delegate code
2. Code stored in Supabase `delegate_codes` table with 10-minute TTL; shown on screen
3. **Another device** enters the code on the Teams tab → code verified (and deleted — single use)
4. On success, the team ID is saved to `delegateTeamIds` in local prefs → grants editor access identical to `isMyTeam`

### Requirements
- Requires `isCloudEnabled` — code exchange uses Supabase
- Codes are single-use and time-limited (10 min)
- Delegate access is device-local (stored in `user_prefs`), not propagated to cloud

---

## 18c. Real-Time Team Chat

Per-team in-app chat visible to any device that can see the team.

### Requirements
- Powered by Supabase `chat_messages` table with `postgres_changes` real-time subscription
- Messages stored with: team_id, player_id, player_name, text, created_at (BIGINT epoch ms)
- Last 100 messages fetched on open; new messages arrive via real-time channel
- Requires `isCloudEnabled`
- Chat is unauthenticated by design (anon key); suitable for casual coordination
- Indexed on `(team_id, created_at DESC)` for fast team-scoped queries

---

## 19. Error Handling

- Inline error messages (not Alert.alert) for form validation failures
- Paper `Dialog` for all confirmation flows (web-compatible — Alert.alert multi-button broken on mobile web)
- `console.error()` logging in every catch block
- Global `ErrorBoundary` (React class component) wraps entire app to catch render crashes
- Match state corruption: detect and offer delete option

---

## 20. Data Persistence

### SQLite Schema (device-local)

```sql
teams(id, name, short_name, admin_pin_hash, latitude, longitude, created_at, updated_at)

players(id, team_id, name, batting_style, bowling_style,
        is_wicket_keeper, is_all_rounder, is_captain, is_vice_captain)

matches(id, format, config_json, status, team1_id, team2_id,
        team1_playing_xi, team2_playing_xi, toss_json, venue,
        match_date, result, match_state_json, created_at, updated_at)

user_prefs(key TEXT PRIMARY KEY, value TEXT)

leagues(id, name, short_name, team_ids TEXT, format TEXT DEFAULT 'round_robin', created_at, updated_at)

league_fixtures(id, league_id, team1_id, team2_id, match_id, venue,
                scheduled_date, status, result, team1_score, team2_score,
                winner_team_id, nrr_data_json TEXT, round INTEGER,
                bracket_slot INTEGER, created_at, updated_at)

user_prefs(key TEXT PRIMARY KEY, value TEXT)   -- also stores user_profile JSON
```

### Supabase Schema (cloud — run `supabase-setup.sql`)

```sql
cloud_teams(id, name, short_name, latitude, longitude, updated_at)

cloud_players(id, team_id, name, batting_style, bowling_style,
              is_wicket_keeper, is_all_rounder, is_captain,
              is_vice_captain, phone_number)

delegate_codes(team_id PRIMARY KEY, code, expires_at)

chat_messages(id UUID, team_id, player_id, player_name, text, created_at BIGINT)

live_matches(id, team1_name, team1_short, team2_name, team2_short, format,
             venue, status, innings_num, batting_short, score, wickets,
             overs, balls, target, result, latitude, longitude, updated_at BIGINT)

user_profiles(phone TEXT PRIMARY KEY, name, pin_hash, role, updated_at BIGINT)
-- PIN hashes NEVER returned to clients — all reads go through verify_user_profile() RPC
-- Postgres function verify_user_profile(phone, sha256_hash) → (name, role, found, pin_correct)
-- Opportunistically upgrades SHA-256 hashes to bcrypt on first successful login (pgcrypto)
```

### Notes
- `user_prefs` stores `myTeamIds`, `delegateTeamIds`, and `user_profile` JSON (device-local)
- Full match engine state serialized into `match_state_json` (enables resume + undo persist)
- Migrations use `ALTER TABLE ... ADD COLUMN` wrapped in try/catch (safe for re-runs; no NOT NULL on new columns)
- Match UUID always generated client-side and passed to repo (never repo-generated)
- Auto-save after every ball recorded and after every undo
- Cloud sync requires `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env`
- Supports both legacy JWT anon keys (`length > 100`) and new publishable key format (`sb_publishable_` prefix)
- `.env` must never be committed to git (listed in `.gitignore`)

---

## 21. Navigation Structure

```
app/
├── _layout.tsx                  ← Root layout, ErrorBoundary, PaperProvider
├── (tabs)/
│   ├── index.tsx                ← Home / Dashboard
│   ├── teams.tsx                ← Teams tab (search + proximity)
│   ├── matches.tsx              ← Matches tab
│   └── stats.tsx                ← Stats tab
├── team/
│   ├── create.tsx               ← Create team (modal)
│   └── [id]/
│       ├── index.tsx            ← Team detail
│       └── roster.tsx           ← Roster management
├── match/
│   ├── create.tsx               ← 5-step match wizard (modal)
│   └── [id]/
│       ├── index.tsx            ← Match detail
│       ├── toss.tsx             ← Toss screen
│       ├── scoring.tsx          ← Full-screen scoring
│       └── scorecard.tsx        ← Scorecard view
├── player/
│   └── [id].tsx                 ← Player profile + career stats
└── profile.tsx                  ← Find My Profile (by player code)
```

---

## 22. Theming & Styling

### Color Palette

| Token | Light | Dark | Usage |
|---|---|---|---|
| Primary | `#1B6B28` | `#5EBD6A` | Headers, buttons, accents |
| Secondary | `#E65100` | `#FF7043` | Cricket ball, highlights |
| Background | `#EAF7EB` | `#091409` | Screen backgrounds |
| Surface | `#FFFFFF` | `#0F2210` | Cards, modals |
| `onSurface` | Dark text | `#E3F5E4` | Primary text |
| `onSurfaceVariant` | Muted text | `#9ECBA2` | Secondary text, labels |
| `primaryContainer` | `#A8DBAB` | `#1B3D1D` | Highlighted rows, chips |
| `outlineVariant` | `#C0DCC2` | `#2E4D30` | Borders, dividers |

### Rules
- **Never** hardcode `#1A1A1A`, `#666`, `#999`, `#888`, `#CCC` — use theme tokens
- White text (`#FFFFFF`) is acceptable on primary-colored headers
- All confirmations use react-native-paper `Dialog` (not `Alert.alert`) for web compatibility
- `Dialog` components must be wrapped in `Portal`

---

## Summary

| Domain | Key Capabilities |
|---|---|
| **Formats** | T20, ODI, Test, Custom |
| **Teams** | Create, manage roster, PIN auth, proximity discovery |
| **Players** | Batting/bowling styles, roles (C/VC/WK/AR), phone number, codes, career stats |
| **Match Lifecycle** | Toss → Innings → Ball-by-Ball → Complete |
| **Scoring** | Extras, dismissals, free hits, partnerships, over tracking |
| **Undo** | Full ball revert with innings snapshot restore |
| **Stats** | Per-player career aggregates + team/match summaries |
| **Location** | 50-mile proximity, Haversine distance |
| **Live Scores** | Ball-by-ball broadcast to nearby users (<50 mi) via Supabase real-time |
| **Delegate Access** | Single-use 6-char code grants editor access to another device |
| **Team Chat** | Real-time per-team chat via Supabase `postgres_changes` |
| **Cloud Sync** | Teams + players synced to Supabase for cross-device discovery |
| **User Auth** | Phone + PIN registration, cross-device restore via Supabase RPC, in-memory session |
| **RBAC** | 4 roles: `league_admin`, `team_admin`, `scorer`, `viewer`; `useRole()` hook |
| **Admin** | Per-team optional PIN (SHA-256 hashed, in-memory auth); separate from user auth |
| **Security** | Team edit auth guard; server-side PIN verify (hash never returned to client); bcrypt upgrade path; no PII in logs |
| **Platform** | Android + iOS + Web, SQLite + localStorage/sessionStorage |
| **UX** | Dark mode, MD3 theming, web-compatible dialogs |
