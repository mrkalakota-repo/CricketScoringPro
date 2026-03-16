# Gully Cricket Scorer — CLAUDE.md

## Project Overview
Cross-platform cricket scoring app (Android + iOS + mobile web) built with React Native + Expo.
Supports all cricket formats (T20, ODI, Test, custom), team/player management with admin PIN
protection, ball-by-ball scoring with undo, and proximity-based team discovery.

---

## Commands

```bash
npm start              # Expo dev server (scan QR with Expo Go)
npm run android        # Android emulator
npm run ios            # iOS simulator
npm run web            # Mobile web browser (http://localhost:8081)
npm test               # Jest unit tests (engine tests only)
npx expo install <pkg> # Add Expo-compatible package (use --legacy-peer-deps if it fails)
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
| Icons | MaterialCommunityIcons from `@expo/vector-icons` |
| Hashing | expo-crypto SHA-256 for admin PINs |
| Location | expo-location for proximity team discovery |
| Testing | Jest (pure engine tests, no React Native Testing Library yet) |

---

## Architecture

### Platform-Specific Files
Metro resolves `.web.ts` over `.ts` on web. Every DB repo has a web twin:
- `src/db/repositories/team-repo.ts` → SQLite
- `src/db/repositories/team-repo.web.ts` → localStorage
- `src/db/repositories/match-repo.ts` → SQLite
- `src/db/repositories/match-repo.web.ts` → localStorage
- `src/db/repositories/prefs-repo.ts` → SQLite
- `src/db/repositories/prefs-repo.web.ts` → localStorage

When adding a new repo, always create both files.

### Scoring Engine
`src/engine/` is **pure TypeScript with zero React dependencies**. Never import React or
RN APIs there. All cricket rules live here and are fully unit-tested with Jest.

### Store Pattern
Zustand stores bridge the engine and React. Every destructive operation (delete team,
delete match) must go through the **store action**, not the repo directly — store actions
update both the DB and in-memory state, which is critical for web where localStorage
changes don't trigger re-renders.

### State Management Rules
- `useTeamStore` — team/player CRUD
- `useMatchStore` — match lifecycle, scoring engine, undo
- `usePrefsStore` — device-local preferences (myTeamIds)
- `useAdminAuth` — in-memory PIN authentication (resets on app restart by design)

---

## Key Design Decisions

### Admin PIN
- Hashed with SHA-256 via expo-crypto before storage
- `adminPinHash: null` means open access (no PIN)
- Auth state is in-memory only — intentionally lost on restart
- Team creator is auto-authenticated immediately after creation

### Match ID
`matchRepo.createMatch()` takes the client-generated UUID as the first argument.
Never let the repo generate its own ID — this caused a critical routing bug where
the in-memory engine ID diverged from the DB ID.

### My Teams
Teams created on this device are stored in `user_prefs` (SQLite key-value table / localStorage).
The `usePrefsStore` exposes `myTeamIds`. Call `addMyTeam(teamId)` after every `createTeam()`.

### Proximity (Teams Tab)
- Haversine formula, 50-mile radius = 80.47 km (`RADIUS_KM`)
- My Teams always appear first regardless of location
- Up to 10 nearby OTHER teams shown; rest are search-only
- Teams without lat/lng get `distance = Infinity` (excluded from proximity, findable via search)

---

## UI Conventions

### Colors — Always use MD3 theme tokens
Never hardcode `#1A1A1A`, `#666`, `#999`, `#888`, `#CCC` etc. Use:
- Main text → `theme.colors.onSurface`
- Secondary text → `theme.colors.onSurfaceVariant`
- Borders → `theme.colors.outlineVariant`
- Tinted backgrounds → `theme.colors.surfaceVariant`
- Colored container backgrounds → `theme.colors.primaryContainer`
- Text on primaryContainer → `theme.colors.onPrimaryContainer`
- Text on primary-colored headers → hardcode `#FFFFFF` (it's always white)

### Dialogs — Always use react-native-paper Dialog
`Alert.alert` with multiple buttons does not work on mobile web browsers.
Use `<Portal><Dialog>` for all confirmation flows.

### Dark Mode
The app uses `useColorScheme()` to switch between `lightTheme` and `darkTheme` (both
defined in `src/theme/index.ts`). All colors must look correct in both modes.

### Error Handling
- Wrap async operations in try/catch
- Show user-facing errors inline (not Alert) — set an `error` state string
- The global `ErrorBoundary` in `app/_layout.tsx` catches React render crashes
- Never let errors silently swallow — at minimum `console.error()`

---

## Theming

`src/theme/colors.ts` — raw color palette
`src/theme/index.ts` — MD3 `lightTheme` and `darkTheme` objects passed to `PaperProvider`

Primary: `#1B6B28` (cricket green)
Secondary: `#E65100` (cricket ball orange)
Light background: `#EAF7EB`
Dark background: `#091409`

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

## Database Schema

```sql
teams(id, name, short_name, admin_pin_hash, latitude, longitude, created_at, updated_at)
players(id, team_id, name, batting_style, bowling_style, is_wicket_keeper, is_all_rounder, is_captain)
matches(id, format, config_json, status, team1_id, team2_id, team1_playing_xi,
        team2_playing_xi, toss_json, venue, match_date, result, match_state_json,
        created_at, updated_at)
user_prefs(key TEXT PRIMARY KEY, value TEXT)
```

Migrations in `src/db/schema.ts` use `ALTER TABLE ... ADD COLUMN` wrapped in try/catch
(safe for re-runs). Never add `NOT NULL` to `ALTER TABLE ADD COLUMN` — breaks Android
SQLite < 3.37.

---

## Things to Avoid

- **Do not** call repo functions directly from UI components — always go through the store
- **Do not** use `Alert.alert` with multiple buttons — use Paper `Dialog` instead
- **Do not** hardcode text colors — use MD3 theme tokens
- **Do not** let `matchRepo.createMatch()` generate its own UUID — pass the client ID
- **Do not** add `NOT NULL` constraints in `ALTER TABLE ADD COLUMN` migrations
- **Do not** import React or RN APIs into `src/engine/` — keep it pure TypeScript
- **Do not** use `npm install` for Expo packages — use `npx expo install` (then add `--legacy-peer-deps` if needed)
