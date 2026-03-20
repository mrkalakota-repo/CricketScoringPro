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

Cloud repos (`cloud-team-repo`, `cloud-chat-repo`, `cloud-delegate-repo`, `cloud-match-repo`) use Supabase — same on all platforms, no `.web.ts` needed.

### Scoring Engine
`src/engine/` — pure TypeScript, zero React/RN dependencies. Never import React or RN APIs there.

`MatchEngine` is **immutable** — every method returns a new `MatchEngine` instance. Never mutate the existing instance; always replace it:
```ts
const newEngine = engine.recordBall(input);   // ✓ returns new instance
set({ engine: newEngine });
engine.recordBall(input);                      // ✗ wrong — return value ignored
```
Test files live in `src/engine/__tests__/` (`match-engine.test.ts` — unit tests; `functional.test.ts` — end-to-end scenarios).

### Store Pattern
All mutations go through Zustand stores, never directly through repos.
- `useTeamStore` — team/player CRUD
- `useMatchStore` — match lifecycle, scoring engine, undo, auto-save after every ball
- `usePrefsStore` — device-local prefs (`myTeamIds`, `delegateTeamIds`)
- `useLeagueStore` — leagues and fixtures
- `useChatStore` — real-time per-team chat
- `useLiveScoresStore` — nearby live match scores (Supabase real-time, 50-mile radius)
- `useAdminAuth` — in-memory PIN auth (resets on restart by design)

---

## Key Design Decisions

### Admin PIN
- SHA-256 hashed via expo-crypto; `adminPinHash: null` = open access
- Auth state is in-memory only — lost on restart intentionally
- Team creator auto-authenticated after creation

### Access Control (Team Edit)
- `isMyTeam` — team created on this device (stored in `myTeamIds` pref)
- `isDelegate` — granted editor access via 6-char delegate code
- `hasEditAccess = isMyTeam || isDelegate`
- Owners with a PIN must unlock (`adminUnlocked`) to reach roster/edit; no-PIN owners go straight through

### Delegate Codes
- Owner generates 6-char code (10 min TTL) stored in Supabase `delegate_codes`
- Other device enters code → verified + deleted (single-use) → `delegateTeamIds` stored locally
- Requires `isCloudEnabled` (real Supabase credentials in `.env`)

### Match ID
`matchRepo.createMatch()` takes a client-generated UUID — never let the repo generate its own ID.

### My Teams
Call `addMyTeam(teamId)` after every `createTeam()`. Stored in `user_prefs`.

### Proximity (Teams Tab)
Haversine, 50-mile radius. My Teams first, up to 10 nearby others, rest search-only.

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
players(id, team_id, name, batting_style, bowling_style, is_wicket_keeper, is_all_rounder,
        is_captain, is_vice_captain)
matches(id, format, config_json, status, team1_id, team2_id, team1_playing_xi,
        team2_playing_xi, toss_json, venue, match_date, result, match_state_json,
        created_at, updated_at)
user_prefs(key TEXT PRIMARY KEY, value TEXT)
leagues(id, name, short_name, team_ids TEXT, created_at, updated_at)
league_fixtures(id, league_id, team1_id, team2_id, match_id, venue, scheduled_date,
                status, result, team1_score, team2_score, winner_team_id, created_at, updated_at)
```

Migrations: `ALTER TABLE ... ADD COLUMN` in try/catch. **Never `NOT NULL` in migrations** — breaks Android SQLite < 3.37.

## Supabase Schema (Cloud)
Run `supabase-setup.sql` in the SQL Editor (idempotent — safe to re-run).
Tables: `cloud_teams`, `cloud_players`, `delegate_codes`, `chat_messages`, `live_matches`.
Credentials go in `.env` as `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

Supported key formats: legacy JWT (`length > 100`) **or** new publishable format (`sb_publishable_` prefix). Both are accepted — validation is in `src/config/supabase.ts`.

`live_matches` is upserted on every ball (and undo, start innings, declare). If the table doesn't exist yet, `PGRST205` errors are silently ignored so the app degrades gracefully.

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
