# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Gully Cricket Scorer — CLAUDE.md

## Project Overview
Cross-platform cricket scoring app (Android + iOS + mobile web) — React Native + Expo SDK 54.
Supports T20/ODI/Test/custom formats, team/player management, ball-by-ball scoring with undo,
proximity-based team discovery, leagues, real-time player chat, and delegate team access.

---

## Commands

```bash
npm start              # Expo dev server — start Metro with correct local IP:
                       # REACT_NATIVE_PACKAGER_HOSTNAME=<mac-ip> npx expo start --port 8081
npm run android        # Android emulator
npm run ios            # iOS simulator
npm run web            # Mobile web (http://localhost:8081)
npm test               # Jest unit tests (engine only)
npm test -- --testPathPattern=functional          # Run a single test file by name
npm test -- --testNamePattern="strike rotation"   # Run tests matching a name pattern
npm test -- --coverage                            # Coverage report
npx expo install <pkg> # Add Expo package (add --legacy-peer-deps if it fails)
```

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | React Native + Expo SDK 54 |
| Language | TypeScript (strict) |
| Navigation | Expo Router v6 (file-based) |
| UI | React Native Paper (MD3) |
| State | Zustand (no immer middleware — engine uses immer internally) |
| Persistence | expo-sqlite (native), localStorage (web) via `.web.ts` Metro resolution |
| Cloud | Supabase — proximity sync, real-time chat, delegate codes |
| Icons | MaterialCommunityIcons (`@expo/vector-icons`) |
| Hashing | expo-crypto SHA-256 for admin PINs |
| Location | expo-location for proximity team discovery |
| Testing | Jest (pure engine tests) |

---

## Architecture

### Platform-Specific Files
Metro resolves `.web.ts` over `.ts` on web. Every DB repo needs both files:
- `team-repo.ts` / `team-repo.web.ts`
- `match-repo.ts` / `match-repo.web.ts`
- `prefs-repo.ts` / `prefs-repo.web.ts`
- `league-repo.ts` / `league-repo.web.ts`

Cloud repos (`cloud-team-repo`, `cloud-chat-repo`, `cloud-delegate-repo`, `cloud-match-repo`, `cloud-league-repo`, `cloud-user-repo`) use Supabase — same on all platforms, no `.web.ts` needed.

### Scoring Engine
`src/engine/` — pure TypeScript, zero React/RN dependencies. Never import React or RN APIs there.

`MatchEngine` is **immutable** — every method returns a new `MatchEngine` instance. Never mutate the existing instance; always replace it:
```ts
const newEngine = engine.recordBall(input);   // ✓ returns new instance
set({ engine: newEngine });
engine.recordBall(input);                      // ✗ wrong — return value ignored
```
Test files live in `src/engine/__tests__/`:
- `match-engine.test.ts` — unit tests for individual engine methods
- `functional.test.ts` — end-to-end ball-by-ball scenarios
- `commentary.test.ts` — deterministic commentary generation
- `roles-and-rules.test.ts` — bowling rule enforcement and RBAC

### Store Pattern
All mutations go through Zustand stores, never directly through repos.
- `useTeamStore` — team/player CRUD; `loadTeams` also does cloud ownership sync (60 s cooldown per phone)
- `useMatchStore` — match lifecycle, scoring engine, undo, auto-save after every ball, match abandonment
- `usePrefsStore` — device-local prefs: `myTeamIds` (owned), `playerTeamIds` (player-member, view-only), `delegateTeamIds`
- `useLeagueStore` — leagues and fixtures; syncs to/from Supabase `cloud_leagues`/`cloud_league_fixtures` when the user is authenticated (owner-scoped by phone). `loadLeagues` fetches from cloud and upserts locally on every call.
- `useChatStore` — real-time per-team chat
- `useLiveScoresStore` — nearby live match scores (Supabase real-time, 50-mile radius)
- `useAdminAuth` — in-memory PIN auth (resets on restart by design)
- `useUserAuth` — global user auth (phone + PIN); session in-memory, profile persisted locally + Supabase

### User Auth & RBAC
`src/hooks/useUserAuth.ts` — Zustand store for global auth (phone-number registration + PIN). Profile is saved locally (`user_prefs`) and pushed to Supabase `user_profiles` for cross-device restore.

Key behaviours:
- `login()` re-pushes the profile to Supabase on every successful local sign-in, recovering profiles whose initial push was dropped (e.g. table didn't exist at registration time).
- `updateProfile(name, newPin?)` — updates name and/or PIN locally + cloud; used by `app/my-profile.tsx` (the logged-in user's own profile screen, with name edit, PIN change, and sign-out).
- `sessionExpired: boolean` — set when web `sessionStorage` is missing the PIN hash (tab closed and reopened). UI auto-switches to the restore form with phone pre-filled; local login is impossible in this state.
- `restoreErrorMessage` — propagated from `verifyUserProfile` RPC so the UI can show actionable errors.
- `verifyUserProfile` in `cloud-user-repo.ts` auto-retries up to 3× with a 2.5 s delay on Supabase schema-cache cold-start errors (`PGRST205` / "schema cache" phrase) before returning a friendly "Server is waking up" message.

**Phone format:** International, with a country picker defaulting to India `+91`. Ten cricket-playing nations are supported. The UI shows a flag + dial-code picker; each country defines its expected digit count (9 or 10). Phone numbers are stored as `{countryCodeDigits}{localDigits}` with no `+` and no separator — e.g. India `+91` + `9876543210` → `919876543210`, USA `+1` + `2025550101` → `12025550101`. This concatenated format is globally unique across all countries. Strip non-digits from input and validate `digits.length === country.digits` before any auth call. The login chip displays `+{profile.phone}` (the stored value already contains the country code digits).

`src/hooks/useRole.ts` — pure function of `profile.role`; returns `RolePermissions` object. Use this for all gate checks; never inspect `profile.role` directly in UI.

Roles and permissions matrix:

| Permission | league_admin | team_admin | scorer | viewer |
|---|:---:|:---:|:---:|:---:|
| Create League | ✅ | ❌ | ❌ | ❌ |
| Manage Teams | ✅ | ✅ | ❌ | ❌ |
| Create/Start Match | ✅ | ✅ | ✅ | ❌ |
| Record Balls (Score) | ✅ | ✅ | ✅ | ❌ |
| Delete Match | ✅ | ❌ | ❌ | ❌ |
| View Live Scores | ✅ | ✅ | ✅ | ✅ |

Available roles at registration: `scorer`, `team_admin`, `league_admin`, `viewer`. Viewer is a valid selectable role for users who only want to follow matches and live scores without scoring or managing teams. Unauthenticated users browse as guests with the same read-only access. `useRole()` returns all-false + `role: null` when not authenticated.

### Sync Status
`src/hooks/useSyncStatus.ts` — subscribes to cloud match repo sync events. States: `synced` | `syncing` | `offline` | `disabled`. Used for the scoring-screen cloud indicator.

---

## Key Design Decisions

### Bowling Rules (Enforced in Engine)
`MatchEngine.setBowler()` throws — not warns — on two violations:
1. **Consecutive overs**: same bowler cannot bowl back-to-back overs.
2. **Max overs per bowler (LOI)**: `Math.floor(oversPerInnings / 5)` — T20: 4, ODI: 10, custom: proportional. Test (`oversPerInnings === null`): unlimited.

The scoring UI greys out ineligible bowlers with a reason label: `(bowled last over)` or `(max N overs)`.

When writing test helpers that bowl multiple overs, use a **pool of ≥5 bowlers** and pick the eligible one with the fewest overs (not round-robin) to avoid quota exhaustion.

### Admin PIN
- SHA-256 hashed via expo-crypto; `adminPinHash: null` = open access
- Auth state is in-memory only — lost on restart intentionally
- Team creator auto-authenticated after creation

### Access Control (Team Edit)
- `isMyTeam` — team owned by this account (stored in `myTeamIds` pref; sourced from `cloud_teams.owner_phone`)
- `isPlayerTeam` — user is listed as a player on the team (`cloud_players.phone_number`); stored in `playerTeamIds` pref; shown in "My Teams" section with a **PLAYER** badge but gives no edit access
- `isDelegate` — granted editor access via 6-char delegate code; stored in `delegateTeamIds`
- `hasEditAccess = isMyTeam || isDelegate`
- Owners with a PIN must unlock (`adminUnlocked`) to reach roster/edit; no-PIN owners go straight through

### Delegate Codes
- Owner generates 6-char code (10 min TTL) stored in Supabase `delegate_codes`
- Other device enters code → verified + deleted (single-use) → `delegateTeamIds` stored locally
- Requires `isCloudEnabled` (real Supabase credentials in `.env`)

### Match Creation Flow
Match creation goes **directly to toss** — no cross-device acceptance/invitation flow. The `pending_acceptance` status and invitation banners exist in the codebase but are no longer triggered. Do not re-introduce `needsAcceptance` logic in `app/match/create.tsx`.

### Toss Screen
`canDoToss = true` always — any device that opens the toss screen can record it. The per-team ownership gate (team1-only) was removed. The observer "Waiting for toss…" dead-code block has been deleted; do not re-add it.

### Match Abandonment
`MatchEngine.abandonMatch()` sets the match `status` to `'abandoned'`, marks the current innings `completed`, clears the current batter/bowler IDs, sets `result = 'Match abandoned'`, and returns a new engine with an **empty undo stack** (abandoned matches cannot be resumed).

Exposed as `abandonMatch(): Promise<void>` in `useMatchStore` — saves to SQLite and publishes to cloud before refreshing the matches list. The scoring UI shows an **Abandon** button (red, `flag-off` icon) in the bottom actions row that opens a confirmation `Dialog` before proceeding. After confirmation the scorer is navigated to `/(tabs)/matches`.

### Match State Schema Versioning
`src/engine/migration.ts` — `CURRENT_SCHEMA_VERSION = 1` constant and `migrateMatch(raw: unknown): Match` function.

`Match.schemaVersion?: number` is stamped on every match after migration. Call `migrateMatch(JSON.parse(json))` at every `JSON.parse → Match` boundary:
- `useMatchStore` `loadMatch`, `acceptMatchInvitation`, `markMatchScheduled` (SQLite parse points)
- `cloud-match-repo` `fetchCloudMatchState`, `fetchMatchFromInvitation` (cloud parse points)

**Adding a new migration:** increment `CURRENT_SCHEMA_VERSION` and add one `if`-block inside `migrateMatch` that backfills the new field with a safe default for matches where it is absent. Keep earlier version blocks intact.

Do **not** add `JSON.parse(...) as Match` anywhere without wrapping it in `migrateMatch()`.

### Concurrent Scoring / Cloud Write Protection
`publishMatchState` in `cloud-match-repo.ts` uses a **conditional two-step write** to prevent a slower device from overwriting a faster device's balls:

1. `UPDATE cloud_match_states WHERE id = ? AND updated_at < match.updatedAt` — only overwrites if stored record is older.
2. If 0 rows updated (first publish, or our state is stale) → `UPSERT WITH ignoreDuplicates: true` — inserts if row doesn't exist, skips if a concurrent write already won.

`matchToCloudRow` uses `match.updatedAt` (the engine's logical timestamp, set by `produce` on every ball) as the `updated_at` column value — **not** `Date.now()`. This makes ordering semantic rather than network-latency-dependent. Do not change it back to `Date.now()`.

### Retire Batter (Engine)
`MatchEngine.retireBatter(batsmanId, type)` marks a batter retired **without consuming a ball delivery** (happens between balls, not on a delivery):
- `retired_hurt` — NOT a wicket; batter may return later
- `retired_out` — IS a wicket; fall of wicket recorded

Exposed as `retireBatter(batsmanId, type)` in `useMatchStore`. The scoring UI shows a **Retire** button in the bottom actions and opens a modal to pick which batter and the reason.

### Match ID
`matchRepo.createMatch()` takes a client-generated UUID — never let the repo generate its own ID.

### My Teams
Call `addMyTeam(teamId)` after every `createTeam()`. Stored in `user_prefs`.

### Proximity (Teams Tab)
Haversine, 50-mile radius. "My Teams" section shows owned + player-member teams. Up to 10 nearby others in a separate section; rest search-only.

`importCloudTeams` **purges** any locally-stored transient team (not in `myTeamIds`/`playerTeamIds`/`delegateTeamIds`) that is absent from the incoming cloud batch before upserting — this prevents duplicate rows accumulating after seed re-runs that generate new UUIDs.

**iOS location pattern** — `getCurrentPositionAsync` hangs indefinitely on iOS. `timeoutInterval` is NOT a valid expo-location option and is silently ignored. Use `Promise.race` for the timeout instead:
1. `getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000 })` — instant cache hit, use immediately if available
2. `Promise.race([getCurrentPositionAsync({ accuracy: Balanced }), new Promise((_, reject) => setTimeout(() => reject(), 10_000))])` — fresh fix with hard 10 s timeout
3. `getLastKnownPositionAsync()` (no maxAge) in the catch block — stale is better than nothing
4. iOS simulator fallback: `if (Platform.OS === 'ios' && !Constants.isDevice)` → use `SIMULATOR_DEFAULT_LOC`

**Proximity re-trigger pattern** — use a `needsSync` state (not a ref) as the trigger for the cloud fetch effect. The `useFocusEffect` sets `setNeedsSync(true)` when the cooldown has elapsed; the fetch `useEffect` depends on `[userLoc, needsSync]` and sets `setNeedsSync(false)` immediately to prevent double-fire. Using a ref instead of state means re-renders don't re-run the effect.

### SQLite Initialization (Critical)
`PRAGMA` statements must be separate `execAsync` calls — Android SQLite skips subsequent
statements in a multi-statement block when the first statement returns a result row.
```ts
await db.execAsync('PRAGMA journal_mode = WAL;');
await db.execAsync('PRAGMA foreign_keys = ON;');
await db.execAsync('CREATE TABLE IF NOT EXISTS ...');
```

### Expo Go on Device
Metro must advertise the Mac's real LAN IP (not 127.0.0.1):
```bash
REACT_NATIVE_PACKAGER_HOSTNAME=<mac-ip> npx expo start --port 8081
```

---

## UI Conventions

### Back Button Title (iOS)
`headerBackTitleVisible` was **removed in React Navigation v7** — setting it does nothing. Use `headerBackButtonDisplayMode: 'minimal' as const` in the global `screenOptions` in `app/_layout.tsx`. Do not set `headerBackTitle` or `headerBackTitleVisible` on individual screens.

### Chip Icon Colors
React Native Paper `Chip` — `selectedColor` only applies when `selected={true}`; it cannot style the icon otherwise. When full icon color control is needed (e.g. badge-style chips), replace `Chip` with a `View + MaterialCommunityIcons` custom badge.

### Surface + overflow:hidden
Do **not** put `overflow: 'hidden'` directly on a `<Surface>` — it suppresses the iOS shadow. Instead wrap the Surface's content in an inner `<View style={{ borderRadius, overflow: 'hidden' }}>`.

### Colors — MD3 theme tokens only
Never hardcode `#1A1A1A`, `#666`, `#999` etc.
- Main text → `theme.colors.onSurface`
- Secondary → `theme.colors.onSurfaceVariant`
- Borders → `theme.colors.outlineVariant`
- Tinted bg → `theme.colors.surfaceVariant`
- Container bg → `theme.colors.primaryContainer`
- Text on container → `theme.colors.onPrimaryContainer`
- Text on primary header → `#FFFFFF` (always white)

### Dialogs — `<Portal><Dialog>` always
`Alert.alert` with multiple buttons does not work on mobile web.

### Error Handling
Wrap async in try/catch. Show errors inline (not Alert). Never silently swallow — at minimum `console.error()`.

---

## Theming
`src/theme/colors.ts` — palette | `src/theme/index.ts` — `lightTheme` / `darkTheme`

Primary: `#1B6B28` (green) · Secondary: `#E65100` (orange) · Light bg: `#EAF7EB` · Dark bg: `#091409`

---

## Player Skill Icons (MaterialCommunityIcons)

| Style | Icon | Color |
|---|---|---|
| Right-hand bat | `alpha-r-circle` | `#1B6B28` |
| Left-hand bat | `alpha-l-circle` | `#E65100` |
| Fast bowling | `lightning-bolt` | `#E65100` |
| Medium bowling | `weather-windy` | `#1565C0` |
| Off-break / Orthodox | `rotate-right` | `#6A1B9A` |
| Leg-break / Chinaman | `rotate-left` | `#00695C` |
| Does not bowl | `minus-circle-outline` | `#9E9E9E` |

---

## Database Schema (SQLite)

```sql
teams(id, name, short_name, admin_pin_hash, latitude, longitude, created_at, updated_at)
players(id, team_id, name, phone_number TEXT, batting_style, bowling_style, is_wicket_keeper, is_all_rounder,
        is_captain, is_vice_captain, jersey_number INTEGER, photo_uri TEXT)
matches(id, format, config_json, status, team1_id, team2_id, team1_playing_xi,
        team2_playing_xi, toss_json, venue, match_date, result, match_state_json,
        created_at, updated_at)
user_prefs(key TEXT PRIMARY KEY, value TEXT)
leagues(id, name, short_name, team_ids TEXT, format TEXT DEFAULT 'round_robin', created_at, updated_at)
league_fixtures(id, league_id, team1_id, team2_id, match_id, venue, scheduled_date,
                status, result, team1_score, team2_score, winner_team_id,
                nrr_data_json TEXT, round INTEGER, bracket_slot INTEGER, created_at, updated_at,
                is_verified INTEGER, verified_by_phone TEXT, verified_at INTEGER, verified_by_name TEXT)
```

Migrations: `ALTER TABLE ... ADD COLUMN` in try/catch. **Never `NOT NULL` in migrations** — breaks Android SQLite < 3.37.

## Supabase Schema (Cloud)
Run `supabase-setup.sql` in the SQL Editor (idempotent — safe to re-run).
Tables: `cloud_teams`, `cloud_players`, `delegate_codes`, `chat_messages`, `live_matches`, `user_profiles`, `cloud_leagues`, `cloud_league_fixtures`.
Credentials go in `.env` as `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

`user_profiles` stores phone, name, pinHash, role. PIN verification goes through `verify_user_profile()` RPC (SECURITY DEFINER) — the hash is never returned to clients. The RPC uses pgcrypto (`crypt`, `gen_salt`) and requires `SET search_path = public, extensions` because Supabase installs pgcrypto in the `extensions` schema.

`cloud_leagues` / `cloud_league_fixtures` are owner-scoped (`owner_phone` column). `league-store` pushes on every mutation and pulls on `loadLeagues` when authenticated.

Supported key formats: legacy JWT (`length > 100`) **or** new publishable format (`sb_publishable_` prefix). Both are accepted — validation is in `src/config/supabase.ts`.

`live_matches` is upserted on every ball (and undo, start innings, declare). If any table doesn't exist yet, `PGRST205` errors are silently ignored so the app degrades gracefully.

---

## Shared Utilities & Components

- `src/engine/migration.ts` — `migrateMatch(raw)` and `CURRENT_SCHEMA_VERSION`. Always wrap `JSON.parse(...) as Match` with this; see **Match State Schema Versioning** above.
- `src/utils/player-icons.ts` — `bowlingIcon(style)` and `battingIcon(style)` — use these instead of local icon lookups in UI files
- `src/utils/avatar.ts` — `getAvatarColor(name)` and `AVATAR_COLORS` constant — use for team/player avatar backgrounds and chat message colors. Do not redefine a local `getColor`/`MSG_COLORS` — this is the single source of truth.
- `src/utils/commentary.ts` — `getBallCommentary(ball, ctx)` and `getLiveFeed(balls, ctx, limit)`. Deterministic via `ball.id` hash — all devices produce identical commentary for the same ball. Import from here; do not write local commentary logic.
- `src/utils/constants.ts` — `BALLS_PER_OVER = 6` and other shared constants. Import from here; do not redefine inline.
- `src/utils/player-stats.ts` — `aggregatePlayerStats(matches, playerId)` — computes career batting/bowling stats across all stored matches. Used by player profile screens.
- `src/utils/scorecard-export.ts` — generates a plain-text scorecard string from a `MatchEngine` instance (for sharing/copying).
- `src/components/AdminPinModal.tsx` — modal for entering an existing team admin PIN; used on team detail screens. `src/components/SetAdminPinModal.tsx` — modal for creating/changing a PIN.
- `src/hooks/useResponsive.ts` — breakpoint hook returning `{ isSmallPhone, isTablet, contentPadding, modalMaxWidth }`. Use this for all responsive layout decisions; do not scatter `useWindowDimensions` calls.

### Stats Screen Team Count
`app/(tabs)/stats.tsx` derives team count from **prefs** (`myTeamIds.length + playerTeamIds.length`) rather than `teams.length`, because prefs are updated by the cloud sync before the local SQLite import completes. This gives the correct count immediately after login without waiting for `importCloudTeams` to finish. Fall back to `teams.length` only when prefs are empty (`|| teams.length`).
- `src/utils/formatters.ts` — `formatOvers(overs, balls)` (e.g. `"3.2"`) and other display formatters — import from here, do not redefine locally
- `src/components/NearbyLiveCard.tsx` — shared card for nearby live match display (used by home tab + guest screen). Also exports `LIVE_RED = '#D32F2F'` — use this constant anywhere live/in-progress status needs a red color instead of hardcoding the hex.

---

## Scoring UI Conventions

### Wicket Modal Chain
After a wicket, `confirmWicket` checks two things before opening any modal:
- **Wicket mid-over** (bowler still set after ball): opens **New Batter** modal only — 2 steps total (Wicket → Batter).
- **Wicket on last ball of over** (bowler cleared after ball): opens the **combined Batter + Bowler** modal — 2 steps total (Wicket → Batter+Bowler). Do **not** re-introduce the old sequential chain (New Batter → then setTimeout → Bowler); use the combined modal (`batterAndBowlerModal` state).

The combined modal reuses `selectedNewBatter` and `selectedBowler` state, has two labeled scroll sections, and requires both selections before enabling Confirm. It calls `setNewBatter` then `setBowler` in sequence — Zustand reads fresh state between calls so ordering is safe.

### Match Creation Wizard Back Navigation
`app/match/create.tsx` uses `Stack.Screen` with a custom `headerLeft` button to intercept the system/header back gesture. The `stepBack()` function maps the current step to `STEP_ORDER[idx - 1]`; on the first step (`format`) it calls `router.back()` to close the modal (button label "Cancel"). On all later steps it calls `setStep(prev)` (button label "Back"). The in-content Back buttons remain as a secondary affordance — do not remove them.

### Player Photo Fallback
`app/player/[id].tsx` tracks `photoError` state. The `<Image>` has `onError={() => setPhotoError(true)}`. When `photoUri` is absent or the file is gone (app reinstall, storage clear), a fallback circle is shown with the player's initial in white on a translucent primary-colour background. Reset `photoError` to `false` in `startEdit()` when a fresh photo URI is loaded.

---

## EAS Build (Play Store / App Store)

`eas.json` defines two profiles:
- `preview` → APK (`android.buildType: "apk"`) — for direct device install / testing
- `production` → AAB (`android.buildType: "app-bundle"`) — for Play Store submission

`.npmrc` sets `legacy-peer-deps=true` (required — EAS npm install fails without it).
`.easignore` excludes `scripts/` from the build tarball (avoids `sharp` native binary errors).

```bash
eas build --profile preview --platform android    # Build APK
eas build --profile production --platform android # Build AAB
```

Android package: `com.gullycricket.scorer` · versionCode: bump in `app.json` before each store upload.

---

## Things to Avoid

- **Do not** call repo functions directly from UI — always go through the store
- **Do not** use `Alert.alert` with multiple buttons — use Paper `Dialog`
- **Do not** hardcode text colors — use MD3 theme tokens
- **Do not** let `matchRepo.createMatch()` generate its own UUID — pass the client ID
- **Do not** add `NOT NULL` in `ALTER TABLE ADD COLUMN` migrations
- **Do not** import React or RN APIs into `src/engine/`
- **Do not** use `npm install` for Expo packages — use `npx expo install`
- **Do not** put PRAGMAs and CREATE TABLE in the same `execAsync` call (Android bug)
- **Do not** use `headerBackTitleVisible` — it was removed in React Navigation v7; use `headerBackButtonDisplayMode: 'minimal'`
- **Do not** use a ref as a trigger for a `useEffect` — refs don't cause re-renders; use state instead
- **Do not** pass `timeoutInterval` to `getCurrentPositionAsync` — it is not a valid expo-location option and is silently ignored; use `Promise.race` with a manual `setTimeout` reject instead
- **Do not** re-introduce the match acceptance/invitation flow — matches go directly to toss; `pending_acceptance` status is intentionally unused
- **Do not** gate the toss screen on team ownership — `canDoToss` is `true` for all devices; do not re-add the observer "Waiting for toss…" block
- **Do not** write `JSON.parse(json) as Match` without wrapping in `migrateMatch()` — old saved matches may be missing fields
- **Do not** use `Date.now()` for `updated_at` in `matchToCloudRow` — use `match.updatedAt` (the engine's logical timestamp) so concurrent writes are ordered by match state, not network arrival
- **Do not** re-introduce the sequential New Batter → Bowler modal chain after a wicket on the last ball of an over — use the combined `batterAndBowlerModal` instead
- **Do not** store phone numbers with a `+` prefix or separator — stored format is `{countryCodeDigits}{localDigits}` (e.g. `919876543210`)
