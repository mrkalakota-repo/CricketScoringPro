# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Inningsly — CLAUDE.md

## Project Overview
**Inningsly** — Cross-platform cricket scoring app (Android + iOS + mobile web) — React Native + Expo SDK 55.
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

# Maestro E2E tests (requires `brew install maestro` and a running simulator/device)
maestro test .maestro/flows/03_team_creation.yaml   # Run a single flow
maestro test .maestro/flows/00_full_e2e.yaml        # Run the full suite
maestro test --include-tags smoke .maestro/flows/   # Run by tag

supabase functions deploy send-otp --no-verify-jwt   # Deploy Edge Functions — --no-verify-jwt is REQUIRED
supabase functions deploy verify-otp --no-verify-jwt  # Without it, Supabase re-enables JWT auth and returns 401
supabase functions deploy rc-webhook --no-verify-jwt  # RevenueCat webhook — called by RC, not user JWTs

# Seed Supabase with test teams and players (requires EXPO_PUBLIC_SUPABASE_* in .env)
node scripts/seed-teams.mjs --owner 919876543210           # both teams owned by same phone
node scripts/seed-teams.mjs --owner1 919876543210 --owner2 914049065277  # different owners
```

---

## Deployment

**Web** — AWS Amplify (`amplify.yml`). Build command: `npx expo export --platform web` → artifacts served from `dist/`. Amplify auto-deploys on push to `main`.

**Android / iOS** — EAS Build (`eas.json`). Two profiles:
- `preview` → APK for direct install/testing
- `production` → AAB for Play Store

```bash
eas build --profile preview --platform android
eas build --profile production --platform android
```

**`docs/` directory** — standalone static HTML pages (`index.html`, `privacy.html`, `support.html`, `terms.html`). The `amplify.yml` build copies them into `dist/privacy/`, `dist/support/`, and `dist/terms/` after the Expo export, so they are served at `inningsly.com/privacy`, `/support`, and `/terms` from the same Amplify deployment. Do not import from `docs/` in app code. Metro **does** bundle web-only components (like `MarketingLandingScreen.tsx`) into the iOS JS bundle even when guarded by `Platform.OS === 'web'` — string literals in those files are visible to Apple's binary scanner. Keep user-visible copy in those files store-neutral (no "Google Play" references).

**Edge Functions** — three Supabase Edge Functions in `supabase/functions/`:
- `send-otp` — rate-limits + Cloudflare Turnstile verification + Twilio Verify SMS
- `verify-otp` — Twilio code check + returns existing profile name/role for restore flow
- `rc-webhook` — RevenueCat webhook handler; syncs subscription events (INITIAL_PURCHASE, RENEWAL, EXPIRATION, PRODUCT_CHANGE, UNCANCELLATION) to `user_profiles.plan` + `cloud_teams.team_plan`. CANCELLATION is intentionally ignored — EXPIRATION fires when access actually ends. Webhook URL: `https://<project>.supabase.co/functions/v1/rc-webhook?secret=<RC_WEBHOOK_SECRET>`. RC user ID = phone number (set by `loginPurchasesUser`).

Required secrets (set in Supabase dashboard → Edge Functions → Secrets):
`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`, `TURNSTILE_SECRET_KEY`, `RC_WEBHOOK_SECRET`

**Always deploy with `--no-verify-jwt`** — these functions are called with the anon key (not a user JWT).
Without this flag Supabase re-enables JWT verification on every deploy and returns 401 to all clients.

**Android autolinking** — `@react-native-community/cli` must be installed separately; RN 0.83 ships `@react-native/community-cli-plugin` (Metro only) which does not provide the `react-native config` command that Gradle autolinking requires. If you see `RNGP - Autolinking: Could not find project.android.packageName`, run:
```bash
npx expo install @react-native-community/cli@15 -- --legacy-peer-deps
npx expo prebuild --clean
```

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | React Native 0.83 + Expo SDK 55 |
| Language | TypeScript (strict) |
| Navigation | Expo Router 55.x (file-based) |
| UI | React Native Paper (MD3) |
| State | Zustand (no immer middleware — engine uses immer internally) |
| Persistence | expo-sqlite (native), localStorage (web) via `.web.ts` Metro resolution |
| Cloud | Supabase — proximity sync, real-time chat, delegate codes |
| Icons | MaterialCommunityIcons (`@expo/vector-icons`) |
| Hashing | expo-crypto SHA-256 — admin PINs (unsalted); user PINs salted with phone (`${phone}:${pin}`) |
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

`src/services/purchases.ts` / `src/services/purchases.web.ts` — RevenueCat IAP service also uses Metro platform resolution. The `.web.ts` stub returns safe no-op defaults and prevents `@revenuecat/purchases-js` (and its Stripe.js dependency) from being bundled into the web output.

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
- `engine-coverage.test.ts` — accessor methods, abandonMatch, applyDLS, retireBatter, swapStrike, super over lifecycle, test match completion

`src/utils/__tests__/`:
- `formatters.test.ts` — all formatters.ts exports including every dismissal type and ball outcome
- `dls-calculator.test.ts` — getResourcePercentage, calculateDLSTarget, calculateDLSParScore, calculateGullyTarget

When writing test helpers that bowl multiple overs, use a **pool of ≥5 bowlers** and pick the eligible one with the fewest overs (not round-robin) to avoid quota exhaustion. For test match completion scenarios, use 3-player squads (`playersPerSide: 3`, `MAX_WICKETS = 2`) so innings end by all-out without needing declaration (which doesn't trigger `checkMatchCompletion`).

### Store Pattern
All mutations go through Zustand stores, never directly through repos.
- `useTeamStore` — team/player CRUD; `loadTeams` also does cloud ownership sync (60 s cooldown per phone)
- `useMatchStore` — match lifecycle, scoring engine, undo, auto-save after every ball, match abandonment
- `usePrefsStore` — device-local prefs: `myTeamIds` (owned), `playerTeamIds` (player-member, view-only), `delegateTeamIds`
- `useLeagueStore` — leagues and fixtures; syncs to/from Supabase `cloud_leagues`/`cloud_league_fixtures` when the user is authenticated (owner-scoped by phone). `loadLeagues` fetches from cloud and upserts locally on every call.
- `useChatStore` — real-time per-team chat (**chat tab is currently hidden** from the bottom nav via `href: null` in `app/(tabs)/_layout.tsx`; the store and screen files are intact for re-enabling)
- `useLiveScoresStore` — nearby live match scores (Supabase real-time, 50-mile radius)
- `useAdminAuth` — in-memory PIN auth (resets on restart by design)
- `useUserAuth` — global user auth (phone + PIN); session in-memory, profile persisted locally + Supabase

### Web Entry Point
`app/_layout.tsx` renders a three-layer gate for unauthenticated users on web:
1. **Loading** — spinner while `loadProfile()` resolves
2. **Marketing landing** (`src/components/MarketingLandingScreen.tsx`) — shown when `Platform.OS === 'web' && !isAuthenticated && !showAuth`. Every CTA calls `setShowAuth(true)`.
3. **Login form** (`app/login.tsx`) — shown after user taps any CTA, or immediately on native.

Native apps skip the marketing layer entirely and go straight to the login form.

### User Auth & RBAC
`src/hooks/useUserAuth.ts` — Zustand store for global auth (phone-number registration + PIN). Profile is saved locally (`user_prefs`) and pushed to Supabase `user_profiles` for cross-device restore.

Key behaviours:
- `login()` calls `cloudUserRepo.fetchCloudProfile()` after PIN verification to sync the latest **plan and role** from Supabase before re-pushing. This means manual admin changes in Supabase (e.g. upgrading a user to `league_admin` / `league` plan) take effect on the user's next login without a full account restore. Cloud values always win over locally-stored ones.
- `login()` re-pushes the profile to Supabase on every successful local sign-in using the cloud-fetched plan+role, recovering profiles whose initial push was dropped **and** ensuring admin grants are never overwritten by stale local values.
- `updateProfile(name, newPin?)` — updates name and/or PIN locally + cloud; used by `app/my-profile.tsx` (the logged-in user's own profile screen, with name edit, PIN change, sign-out, and account deletion).
- `deleteAccount()` — deletes the `user_profiles` row from Supabase (fire-and-forget), then calls `prefsRepo.clearUserProfile()` + `clearOwnershipPrefs()` and nulls the in-memory session. Navigates to `/` after completion.
- `sessionExpired: boolean` — set when web `sessionStorage` is missing the PIN hash (tab closed and reopened). UI auto-switches to the restore form with phone pre-filled; local login is impossible in this state.
- `restoreErrorMessage` — propagated from `verifyUserProfile` RPC so the UI can show actionable errors.
- `verifyUserProfile` in `cloud-user-repo.ts` auto-retries up to 3× with a 2.5 s delay on Supabase schema-cache cold-start errors (`PGRST205` / "schema cache" phrase) before returning a friendly "Server is waking up" message.

**Phone format:** International, with a country picker defaulting to India `+91`. Ten cricket-playing nations are supported. The UI shows a flag + dial-code picker; each country defines its expected digit count (9 or 10). Phone numbers are stored as `{countryCodeDigits}{localDigits}` with no `+` and no separator — e.g. India `+91` + `9876543210` → `919876543210`, USA `+1` + `2025550101` → `12025550101`. This concatenated format is globally unique across all countries. Strip non-digits from input and validate `digits.length === country.digits` before any auth call. The login chip displays `+{profile.phone}` (the stored value already contains the country code digits).

`src/hooks/useRole.ts` — pure function of `profile.role`; returns `RolePermissions` object. Use this for all gate checks; never inspect `profile.role` directly in UI.

Roles and permissions are a **two-layer gate** — role controls UI visibility/access, plan controls execution:
- `useRole()` — first gate: can the user see/navigate to the feature?
- `usePlan()` — second gate: can the user actually execute it? (e.g. `league_admin` on `free` plan sees "Create League" but hits the upgrade sheet because `maxLeagues: 0`)

Roles matrix (UI access layer — plan limits apply on top):

| Permission | league_admin | team_admin | scorer | viewer |
|---|:---:|:---:|:---:|:---:|
| Create League (also needs pro/league plan) | ✅ | ❌ | ❌ | ❌ |
| Manage Teams | ✅ | ✅ | ❌ | ❌ |
| Create/Start Match | ✅ | ✅ | ✅ | ❌ |
| Record Balls (Score) | ✅ | ✅ | ✅ | ❌ |
| Delete Match | ✅ | ❌ | ❌ | ❌ |
| View Live Scores | ✅ | ✅ | ✅ | ✅ |

Available roles at registration: `scorer`, `team_admin`, `league_admin`, `viewer`. Viewer is a valid selectable role for users who only want to follow matches and live scores without scoring or managing teams. Unauthenticated users browse as guests with the same read-only access. `useRole()` returns all-false + `role: null` when not authenticated.

### Sync Status
`src/hooks/useSyncStatus.ts` — subscribes to cloud match repo sync events. States: `synced` | `syncing` | `offline` | `disabled`. Used for the scoring-screen cloud indicator.

### Plan Gates (Monetization)
`src/hooks/usePlan.ts` — central plan authority. Reads the stored plan from `useUserAuth` profile and derives per-feature booleans from `PLAN_LIMITS`. The plan is trusted on all platforms — admin-granted plans work on web too. Web users cannot purchase via IAP but can receive plans via admin grant or by restoring a native account.

```
free  → canUseTeamChat: false, canCloudSync: false, canExportScorecard: false,
        canViewNRRStandings: false, canCreatePublicScoreboard: false, canExportData: false
pro   → + canUseTeamChat, canCloudSync, canExportScorecard
league→ + all of the above + canViewNRRStandings, canCreatePublicScoreboard, canExportData
```

`UpgradeSheet` (`src/components/UpgradeSheet.tsx`) — `<Portal><Dialog>` that shows feature copy and navigates to `/upgrade`. Props: `feature: PlanFeature`, `requiredPlan: 'pro' | 'league'`, `visible`, `onDismiss`. Use this pattern when gating any feature:
```tsx
const { canExportScorecard } = usePlan();
if (!canExportScorecard) { setShowUpgrade(true); return; }
// ... do the feature
<UpgradeSheet visible={showUpgrade} feature="scorecard_export" requiredPlan="pro" onDismiss={...} />
```

Cloud sync gate lives in `src/store/match-store.ts` as a module-level `publishToCloud(m: Match)` helper — calls `canCloudSync()` (reads `useUserAuth.getState()` directly, safe outside React) and early-returns for free users. All 8 cloud publish call-sites use this helper; do not call `cloudMatchRepo.publishLiveMatch` / `cloudMatchRepo.publishMatchState` directly from the store.

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
4. iOS simulator fallback: `if (Platform.OS === 'ios' && !Device.isDevice)` → use `SIMULATOR_DEFAULT_LOC` — use `import * as Device from 'expo-device'` (namespace import), **not** a default import and **not** `Constants.isDevice` (that property was removed in expo-constants SDK 55)

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

`user_profiles` has **no SELECT RLS policy** — direct table reads from the anon key are intentionally blocked to protect `pin_hash`. All reads must go through SECURITY DEFINER RPCs:
- `get_user_plan(p_phone)` → returns `{plan, role}` without PIN — used by `fetchCloudProfile()` on every login to sync admin-granted plans
- `verify_user_profile(p_phone, p_pin_hash)` → PIN verification + returns `{name, role, plan}` — used by restore flow

Do **not** add direct `SELECT` queries on `user_profiles` from client code; they silently return empty due to RLS and will cause `pushUserProfile()` to overwrite any manually-granted plan with 'free'.

`user_profiles` stores phone, name, pin_hash, role, plan. User PIN is hashed client-side as `SHA256("${phone}:${pin}")` — the phone acts as a per-user salt, preventing cross-user hash correlation. The hash is sent to `verify_user_profile()` RPC (SECURITY DEFINER) for server-side comparison; the stored hash is never returned to clients. `login()` and `restoreFromCloud()` both transparently fall back to the legacy unsalted hash (`SHA256(pin)`) for existing accounts and re-hash on success — transparent migration with no user action required.

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
- `src/utils/data-export.ts` — `buildDataExportCSV(matches: Match[]): string` — builds a 3-section CSV (Match Results, Batting Stats, Bowling Stats) from completed matches. Used by the Export button on the Stats screen (League plan gate).
- `src/utils/content-filter.ts` — `filterMessage(text): FilterResult` — client-side profanity and abuse filter for team chat. `normalise()` collapses l33tspeak and repeated chars before matching against `BLOCKLIST`. Call before `sendMessage()` and show `result.reason` inline on failure. Not exhaustive — the in-app long-press report mechanism and server-side moderation are the second layer.
- `src/components/UpgradeSheet.tsx` — plan-gate upgrade prompt; see **Plan Gates** above.
- `src/components/TurnstileWidget.web.tsx` / `TurnstileWidget.tsx` — Cloudflare Turnstile bot-protection widget. The `.web.tsx` file injects the Cloudflare script and renders the challenge; the `.tsx` stub is a no-op for native. Shown on the phone-entry step of register and restore-OTP flows. "Send OTP" is disabled until a token is received. Token is passed to `sendOtp()` → `cloud-user-repo` → `send-otp` Edge Function for server-side verification. Site key is hardcoded in the `.web.tsx` file; secret key is in Supabase secrets.
- `src/services/purchases.ts` — RevenueCat in-app purchase integration (`react-native-purchases@10.x` — **do not downgrade below v10**). `configurePurchases()` is called once on app startup (not on purchase); RC initializes `SKPaymentQueue` delegate immediately to catch pending transactions — this is why RC crashes **at launch**, not when the user taps Upgrade. On iOS 26 + New Architecture, `ObjCTurboModule::performVoidMethodInvocation` dispatches void methods async to a background workqueue (ignoring `methodQueue = dispatch_get_main_queue()`); any NSException thrown in a void method causes `convertNSExceptionToJSError(runtime, ...)` to run from that background thread, racing with the Hermes JS thread → heap corruption → SIGSEGV. The two-layer fix is in `patches/react-native-purchases+10.0.1.patch` and `patches/react-native+0.83.4.patch` (see below). `getCurrentPlan()` returns `'free' | 'pro' | 'league'`. `loginPurchasesUser(phone)` / `logoutPurchasesUser()` tie the RC anonymous user to the phone number on auth state change. Env vars: `EXPO_PUBLIC_RC_API_KEY_IOS`, `EXPO_PUBLIC_RC_API_KEY_ANDROID`. IAP product IDs in App Store Connect use a `_v2` suffix (`inningsly_pro_monthly_v2` etc.) because the original IDs were deleted and Apple blocks reuse; Android Play Console uses the originals without `_v2`. The `startsWith` matching in `upgrade.tsx` handles both automatically. `storeKitVersion: STOREKIT_VERSION.STOREKIT_1` is passed to `configure()` **only on iOS** (guarded by `Platform.OS === 'ios'`); passing it on Android causes RC's `setupPurchases()` native bridge to receive an unrecognised iOS-specific string which silently prevents RC from initialising and makes `getOfferings()` return null.
- `patches/react-native-purchases+10.0.1.patch` — **do not delete**. Wraps all 36 void `RCT_EXPORT_METHOD` methods in `RNPurchases.m` with `@try/@catch` that logs and suppresses NSExceptions. Covers `setLogHandler` (called first in RC's JS `configure()`, before `setupPurchases:`), `setTrackedEventListener`, all subscriber attribute setters, and every other void method. Applied automatically by `npm postinstall` → `patch-package` on every `npm install`, including EAS builds. If RC is upgraded, re-run `npx patch-package react-native-purchases` after manually applying the same `@try/@catch` pattern to every void method, then strip any unrelated Android diffs from the generated patch file.
- `patches/react-native+0.83.4.patch` — **do not delete**. Patches `performVoidMethodInvocation` in `RCTTurboModule.mm` so the async `@catch` block suppresses (logs via NSLog) instead of calling `convertNSExceptionToJSError(runtime, ...)` from a background thread. This closes the Hermes data-race at the RN core level for all native modules. For the patch to compile, `expo prebuild` must write `"ios.buildReactNativeFromSource": "true"` to `ios/Podfile.properties.json` — this is handled by `plugins/with-rn-from-source.js` (a custom config plugin in `app.json`). **Do not rely on committing `ios/Podfile.properties.json` directly** — `.easignore` explicitly excludes `ios/`, so the file is never uploaded to EAS and is regenerated from scratch on every build; the config plugin is the only reliable path.
- `src/components/AdminPinModal.tsx` — modal for entering an existing team admin PIN; used on team detail screens. `src/components/SetAdminPinModal.tsx` — modal for creating/changing a PIN.
- `src/hooks/useResponsive.ts` — responsive layout hook. Returns breakpoints **and** scaling helpers — use this for all layout decisions; do not scatter `useWindowDimensions` calls:
  - `isSmallPhone` (< 380pt), `isTablet` (≥ 768pt), `isLargeTablet` (≥ 1024pt)
  - `contentPadding`, `modalMaxWidth`
  - `scale(n)` — scales a dp/pt value by screen-width ratio (baseline 390pt, clamped 0.85–1.4×)
  - `sp(n)` — scales a font size then divides by `PixelRatio.getFontScale()` to prevent double-scaling when the OS "Large Text" accessibility setting is active. Always use `sp()` for `fontSize` values.
  - `icon(n)` — like `scale()` but tighter clamp (0.9–1.25×) for icon sizes
  - `vs(n)` — vertical scale (height-based, baseline 844pt) for vertical padding and fixed heights
  - Because `StyleSheet.create` is static, screens with many sized values should use a `makeStyles(scale, sp, icon, vs)` factory called inside the component (see `app/match/[id]/scoring.tsx` for the pattern). Simple screens can use `scale()`/`sp()` directly in inline styles.

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
`app/match/create.tsx` uses `Stack.Screen` with a custom `headerLeft` `IconButton` (`arrow-left`, white) to intercept the system/header back gesture. The header title updates dynamically per step via `STEP_TITLES`. The `stepBack()` function maps the current step to `STEP_ORDER[idx - 1]`; on the first step (`format`) it calls `router.back()` to close the modal. On all later steps it calls `setStep(prev)`. The in-content Back buttons remain as a secondary affordance — do not remove them.

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

Android package: `com.gullycricket.scorer` (retained for Play Store continuity). Before each store upload bump all three version fields together in `app.json`:
- `version` (semver string, e.g. `"1.1.5"`) — shown to users on both platforms
- `ios.buildNumber` (string integer, e.g. `"7"`) — must increment on every TestFlight / App Store upload
- `android.versionCode` (integer, e.g. `16`) — must increment on every Play Store upload

After any change to `app.json` plugins, `android` config, or native dependencies, regenerate the native project before building:
```bash
npx expo prebuild --clean
```

**iOS source build (required for iOS 26 / Xcode 17 and for the RN patch)** — React Native must be compiled from source so `patches/react-native+0.83.4.patch` takes effect. This is controlled by `"ios.buildReactNativeFromSource": "true"` in `ios/Podfile.properties.json`. **CRITICAL**: `.easignore` excludes the entire `ios/` directory, so EAS never receives a committed `Podfile.properties.json` — it always regenerates it via `expo prebuild`. The key is injected via the `plugins/with-rn-from-source.js` config plugin registered in `app.json`, which runs during every `expo prebuild` (local and EAS) and writes the key to the generated file. Two reasons this is mandatory: (1) pre-built binaries have hardcoded paths incompatible with iOS 26; (2) `patches/react-native+0.83.4.patch` only applies to source-compiled builds. The `post_install` hook in `ios/Podfile` sets `CLANG_CXX_LANGUAGE_STANDARD = 'c++20'` for all pod targets (required because RN bridging headers use C++20 `requires` concept syntax). After any `pod install` you may see `Removing React-Core-prebuilt / Removing ReactNativeDependencies` — this is expected and correct. When running from Xcode directly (not `npx expo run:ios`), Metro must already be running; launch `npx expo start` first. If `npx expo prebuild --clean` fails with `ENOTEMPTY`, run `rm -rf ios android` first then `npx expo prebuild`.

**Local xcodebuild (use when EAS quota is exhausted)** — To iterate on iOS build errors locally without Xcode Archive GUI, run:
```bash
cd ios && xcodebuild -workspace Inningsly.xcworkspace -scheme Inningsly \
  -destination "generic/platform=iOS" -configuration Release -sdk iphoneos build \
  > /tmp/xcode_build.log 2>&1; echo "EXIT: $?"
grep -E "error:|BUILD SUCCEEDED|BUILD FAILED" /tmp/xcode_build.log | grep -v "^note:" | tail -30
```
This gives all errors at once — far faster than running a full Xcode Archive per attempt. Once `BUILD SUCCEEDED`, do `Product → Archive` in Xcode to produce the `.ipa` for TestFlight.

**libwebp and libdav1d are CocoaPods aggregate targets** — Both pods are `PBXAggregateTarget` (no compiled output). Their C source files are never compiled by CocoaPods, so the linker will fail with undefined `_WebPDecode`, `_dav1d_open`, etc. after a fresh `pod install`. Fix by pre-compiling from the CocoaPods cache:
```bash
# libwebp (run once after pod install)
CACHE=$(find ~/Library/Caches/CocoaPods/Pods/Release/libwebp -maxdepth 1 -type d | tail -1)
PODS="ios/Pods/libwebp"; mkdir -p "$PODS/build_arm64"
SDK=$(xcrun --sdk iphoneos --show-sdk-path); CLANG=$(xcrun --sdk iphoneos -f clang)
for f in $(find "$CACHE/src/dec" "$CACHE/src/enc" "$CACHE/src/utils" "$CACHE/src/demux" "$CACHE/src/mux" "$CACHE/sharpyuv" "$CACHE/src/dsp" -name "*.c"); do
  "$CLANG" -arch arm64 -isysroot "$SDK" -miphoneos-version-min=15.1 -O2 -I"$CACHE/src" -I"$CACHE" -c "$f" -o "$PODS/build_arm64/$(basename ${f%.c}).o" 2>/dev/null; done
xcrun --sdk iphoneos -f ar rcs "$PODS/libwebp.a" "$PODS/build_arm64/"*.o

# libdav1d (run once after pod install)
CACHE=$(find ~/Library/Caches/CocoaPods/Pods/Release/libdav1d -maxdepth 1 -type d | tail -1)/dav1d
GENDIR=$(dirname "$CACHE")/generate; PODS="ios/Pods/libdav1d"; mkdir -p "$PODS/build_arm64"
for f in $(find "$CACHE/src" -name "*.c" -not -path "*/ppc/*" -not -path "*/win32/*" -not -path "*/x86/*" -not -path "*/tests/*" -not -path "*/tools/*" -not -path "*/examples/*"); do
  base=$(basename "${f%.c}"); [ "$base" = "cpu" ] && base="arm_cpu"  # avoid collision with src/cpu.c
  "$CLANG" -arch arm64 -isysroot "$SDK" -miphoneos-version-min=15.1 -O2 -I"$GENDIR" -I"$CACHE/include" -I"$CACHE/src" -I"$CACHE" -c "$f" -o "$PODS/build_arm64/${base}.o" 2>/dev/null; done
for f in $(find "$CACHE/src/arm/64" "$GENDIR/tmpl_16" "$GENDIR/tmpl_arm" -name "*.c" -o -name "*.S" 2>/dev/null); do
  "$CLANG" -arch arm64 -isysroot "$SDK" -miphoneos-version-min=15.1 -O2 -I"$GENDIR" -I"$CACHE/include" -I"$CACHE/src" -I"$CACHE" -c "$f" -o "$PODS/build_arm64/extra_$(basename ${f%.*}).o" 2>/dev/null; done
"$CLANG" -arch arm64 -isysroot "$SDK" -miphoneos-version-min=15.1 -O2 -I"$GENDIR" -I"$CACHE/include" -I"$CACHE/src" -I"$CACHE" -c "$CACHE/src/cpu.c" -o "$PODS/build_arm64/src_cpu.o" 2>/dev/null
xcrun --sdk iphoneos -f ar rcs "$PODS/libdav1d.a" "$PODS/build_arm64/"*.o
```
Then add to `ios/Pods/Target Support Files/Pods-Inningsly/Pods-Inningsly.release.xcconfig` (and `.debug.xcconfig`) at the end of `OTHER_LDFLAGS`:
```
-L"${PODS_ROOT}/libwebp" -lwebp -L"${PODS_ROOT}/libdav1d" -ldav1d
```
These `.a` files and xcconfig edits are local-only — they do NOT survive `pod install` or `npx expo prebuild --clean`. Re-run after any Pods reset.

**Android 15/16 compliance** — `react-native-edge-to-edge` is installed as a config plugin (replaces deprecated `setDecorFitsSystemWindows` API). `orientation` in `app.json` is `"default"` (not `"portrait"`) so Android 16 large-screen orientation override is handled gracefully. Do not change it back to `"portrait"`.

---

## Maestro E2E Test Suite

`.maestro/flows/` — 13 YAML flows covering auth, team/roster, match creation, toss, scoring, subscription, and cloud sync. `00_full_e2e.yaml` chains all flows. See `.maestro/README.md` for the full testID reference (100+ IDs) and dependency order.

**testID convention**: `screen-element-variant` (e.g. `score-run-4`, `toss-decision-bat`, `upgrade-tier-pro`). All testIDs are listed in `.maestro/README.md`; keep that file updated when adding new testIDs.

**Native build required** — Maestro does not work with Expo Go. Run `npx expo run:ios` or use an EAS build before executing flows.

**`ensure_logged_in.yaml`** signs out (if already on the home tabs) then signs back in via PIN every run. This forces a fresh `fetchCloudProfile()` call so Supabase plan/role changes are picked up without a manual sign-out.

**Twilio test number**: `+919191919191` with fixed OTP `123456` (configured in Twilio Console → Verify → Test Numbers). Use this for auth flows in CI.

**Pending testIDs** (flows exist but source not yet instrumented):
- `app/login.tsx` — auth flows `01`/`02`
- `app/team/[id]/roster.tsx` — roster flow `04`
- `app/team/[id]/index.tsx` — flows `04`/`11`

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
- **Do not** import from `docs/` in app code — those files are standalone static HTML, not part of the Expo build
- **Do not** put store-specific strings (e.g. "Google Play") in any file imported by the app, even inside `Platform.OS === 'web'` guards — Metro bundles all imported files into the iOS binary and Apple's static scanner reads string literals regardless of runtime branches
- **Do not** require a Turnstile token on native — the token is optional in `sendOtp(phone, token?)`; the Edge Function skips Turnstile verification when the token is absent (native apps have no widget)
- **Do not** call `configurePurchases()` or other RevenueCat methods on web — `src/services/purchases.ts` guards every call with an API-key check and returns safe defaults when keys are absent
- **Do not** call `cloudMatchRepo.publishLiveMatch` / `cloudMatchRepo.publishMatchState` directly from `match-store.ts` — always go through the `publishToCloud(m)` helper which enforces the cloud-sync plan gate
- **Do not** change `orientation` in `app.json` back to `"portrait"` — it is intentionally `"default"` for Android 16 large-screen compliance
- **Do not** push the local plan or role to Supabase in `login()` before calling `fetchCloudProfile()` — cloud values must be fetched first so manual admin upgrades are not overwritten by stale local values
- **Do not** use `profile!.name` or `profile!.phone` non-null assertions in UI — use `profile?.name` / `profile?.phone`; in private/incognito browser `profile` is null while the login screen is visible
- **Do not** pass `initialMode='login'` to `LoginScreen` when `profile` is null — the `defaultMode` logic already guards this, but never add code that assumes `profile` is non-null on web before authentication completes
- **Do not** call the removed `fetchCloudPlan()` — it was replaced by `fetchCloudProfile()` which returns both `plan` and `role`
- **Do not** add a direct `SELECT` on `user_profiles` from client code — RLS blocks it (no SELECT policy by design); use `get_user_plan()` RPC for plan/role reads
- **Do not** remove the `__DEV__` guard in `app/upgrade.tsx` `handleUpgrade` — the no-package fallback that calls `applyPlan()` directly is intentionally dev-only; in production a missing RC package must surface an error, not silently grant the plan
- **Do not** use `getCurrentPlan()` (RC) to downgrade a stored plan — the client-side RC sync in `app/_layout.tsx` only applies upgrades (`rcRank > storedRank`). Downgrades happen exclusively via the `rc-webhook` Edge Function on EXPIRATION. Admin-granted plans have no RC subscription and would be wiped on every login otherwise.
- **Do not** use `tabBarTestID` for tab bar button testIDs — React Navigation v7 / Expo Router 55 silently ignores it. Use `tabBarButtonTestID` in the screen `options` object in `app/(tabs)/_layout.tsx`.
- **Do not** pass `storeKitVersion` to `Purchases.configure()` on Android — it is iOS-only and causes RC's `setupPurchases()` native bridge on Android to receive an unrecognised string, silently preventing RC from initialising so `getOfferings()` returns null. Always guard it: `...(Platform.OS === 'ios' ? { storeKitVersion: STOREKIT_VERSION.STOREKIT_1 } : {})`.
- **Do not** downgrade `react-native-purchases` below v10 — v9.x throws an NSException in `configure()` on iOS 26 that crashes the app on launch.
- **Do not** delete or skip `patches/react-native-purchases+10.0.1.patch` — without it, all 36 RC void methods are unprotected on iOS 26 New Arch; NSExceptions thrown on the background workqueue race with the Hermes JS thread → SIGSEGV on every app launch.
- **Do not** delete or skip `patches/react-native+0.83.4.patch` — without it, any NSException in any native module's async void method calls `convertNSExceptionToJSError(runtime, ...)` from a background thread → Hermes data race → SIGSEGV/SIGABRT. The patch only compiles when RN is built from source; `buildReactNativeFromSource: true` is injected by `plugins/with-rn-from-source.js` during `expo prebuild`. Do not commit `ios/Podfile.properties.json` as a substitute — `.easignore` excludes `ios/` and EAS never receives it.
- **Do not** delete or modify `plugins/with-rn-from-source.js` — it is the only mechanism that ensures `ios.buildReactNativeFromSource: true` survives EAS's `expo prebuild` step. Without it, every EAS build uses pre-built React.framework and the `react-native+0.83.4.patch` has zero effect (this was the root cause of builds 12–14 crashing despite the patch existing in node_modules).
- **Do not** use `Constants.isDevice` from `expo-constants` — the property was removed in expo-constants SDK 55 and always returns `undefined`. Use `Device.isDevice` from `expo-device` instead. `Constants.isDevice` returning `undefined` caused RC to never initialize (blocking all in-app purchases) and location simulator fallbacks to fire on real devices.
- **Do not** use a default import for `expo-device` — `import Device from 'expo-device'` returns `undefined` (the package has no default export). Always use `import * as Device from 'expo-device'`. A default import causes any module-level reference to `Device.isDevice` to throw `TypeError: Cannot read property 'isDevice' of undefined` synchronously during module evaluation — this silently prevents the entire React tree from mounting (blank screen with no crash report on New Architecture production builds).
- **Do not** hardcode `fontSize`, padding, or fixed dimension values in `StyleSheet.create` on screens that need to scale — use `sp()` for all font sizes and `scale()`/`vs()` for spacing. For screens with many sized values, use a `makeStyles(scale, sp, icon, vs)` factory (see `app/match/[id]/scoring.tsx`); for simple screens inline `scale()`/`sp()` directly. Static `StyleSheet.create` with raw numbers produces correct density scaling but ignores screen-width differences (small phones vs tablets).
- **Do not** re-enable the chat tab without reviewing the `useChatStore` subscription lifecycle — the tab is intentionally hidden (`href: null` in `app/(tabs)/_layout.tsx`) and the Supabase Realtime channel is active only when the chat screen is mounted. Re-enabling without auditing will start the channel subscription on every app launch.
