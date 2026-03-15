# CricketScoringPro

A cross-platform cricket scoring app for Android, iOS, and web built with React Native + Expo.

## Features

- **All formats** — T20, ODI, Test, and Custom matches
- **Team management** — Create teams, manage rosters with batting/bowling style and role (WK, All-Rounder)
- **Live scoring** — Ball-by-ball scoring with undo support, free-hit tracking, extras, wickets
- **Scorecard** — Full innings scorecard with partnerships and fall of wickets
- **Stats dashboard** — Aggregated match and team stats
- **Offline-first** — All data stored locally (SQLite on mobile, localStorage on web)
- **Dark mode** — Respects system color scheme

---

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- Android: Expo Go app ([Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent))
- iOS: Expo Go app ([App Store](https://apps.apple.com/app/expo-go/id982107779))

### Install & Run

```bash
# Install dependencies
npm install --legacy-peer-deps

# Start (choose platform)
npx expo start            # Interactive — scan QR with Expo Go
npx expo start --web      # Browser at http://localhost:8081
npx expo start --android  # Android emulator
npx expo start --ios      # iOS simulator

# Run tests
npm test
```

---

## Usage Guide

### 1. Create Teams

1. Tap the **Teams** tab → **+** button
2. Enter team name and short code (e.g. `IND`, up to 5 chars)
3. Tap **Manage Roster** → **Add Player** to add players

**Player fields:**
| Field | Options |
|---|---|
| Name | Up to 50 characters |
| Batting Style | Right Hand / Left Hand |
| Bowling Style | None, Right-arm fast, Right-arm medium, Right-arm off-break, Right-arm leg-break, Left-arm fast, Left-arm medium, Left-arm orthodox, Left-arm chinaman |
| Wicket Keeper | Toggle (one per team recommended) |
| All-Rounder | Toggle — marks player as capable batter and bowler |

**Badges shown in roster:**
- `WK` — Wicket Keeper
- `AR` — All-Rounder (green badge)

### 2. Create a Match

1. Tap **Matches** tab → **+** button (or **New Match** from Home)
2. Select format (T20 / ODI / Test / Custom)
3. Choose Team 1, Team 2, select Playing XI for each, set venue and date
4. Tap **Create Match**

### 3. Toss

After creating a match, the Toss screen opens automatically:
- Select who won the toss and their decision (bat/bowl)

### 4. Live Scoring

The Live Scoring screen shows:
- Current score and required rate
- Current batters (striker highlighted)
- Current bowler and over progress
- Quick-tap scoring buttons: `0` `1` `2` `3` `4` `6`
- Extras: `Wide` `No Ball` `Bye` `Leg Bye`
- `W` button to record a wicket (select dismissal type)
- **Undo** button to reverse the last ball

After an over completes, you're prompted to select the next bowler.
After a wicket, you're prompted to select the incoming batter.

### 5. Scorecard & Stats

- **Scorecard** tab (from Match Details) shows full batting and bowling figures
- **Stats** tab shows match counts, team records, format breakdowns

### 6. Load Sample Data

On the Home screen (when no data exists), tap **Load Sample Data** to create:
- **Thunderbolts** — 11 players including all-rounders and a wicket keeper
- **Royal Strikers** — 11 players with varied batting and bowling styles

---

## Architecture

```
app/                    # Expo Router screens (file-based navigation)
  (tabs)/               # Bottom tab screens (Home, Matches, Teams, Stats)
  match/[id]/           # Match detail, toss, scoring, scorecard
  team/[id]/            # Team detail, edit, roster
  player/[id].tsx        # Player profile

src/
  engine/               # Pure TypeScript scoring engine (no React deps)
    types.ts            # All data models (Match, Player, Innings, etc.)
    match-engine.ts     # Immutable MatchEngine class — recordBall, undo, etc.
    __tests__/          # 51 unit tests

  store/                # Zustand state management
    match-store.ts      # Active match + match list state
    team-store.ts       # Teams + players state

  db/                   # Persistence layer
    database.ts         # SQLite connection (native)
    schema.ts           # Table definitions + migrations
    repositories/
      team-repo.ts       # SQLite team/player CRUD (native)
      team-repo.web.ts   # localStorage team/player CRUD (web)
      match-repo.ts      # SQLite match CRUD (native)
      match-repo.web.ts  # localStorage match CRUD (web)

  utils/
    seed-data.ts        # Sample data loader for development/testing

  theme.ts              # Material Design 3 light/dark themes
```

### Key design decisions

- **Immutable engine** — `MatchEngine` returns a new instance on every mutation, making undo trivial and enabling easy unit testing
- **Platform-specific repos** — Metro resolves `.web.ts` files on web automatically, so the SQLite layer is never bundled for web
- **No backend** — All data is local; no auth, no network calls, no PII transmitted anywhere
- **Typed bowling styles** — `BowlingStyle` is a union type enforced at compile time; invalid values cannot be stored

---

## Data & Security

- **Local only** — no data leaves the device
- **No PII transmission** — player names and match data are stored exclusively in device SQLite / localStorage
- **Input validation** — player names are trimmed and capped at 50 characters; team short names are capped at 5 characters
- **Parameterised queries** — all SQLite operations use parameterised statements (no SQL injection risk)
- **localStorage (web)** — data is scoped to the browser origin; no cross-origin access

---

## Running Tests

```bash
npm test                   # Run all 51 unit tests
npm test -- --watch        # Watch mode
npm test -- --coverage     # Coverage report
```

Tests cover: match setup, toss, basic scoring, extras (wide/NB/bye/leg-bye), free hit, all dismissal types, over completion, innings completion, second innings, match result (win/loss/tie), undo, partnerships, bowler stats, player roles (all-rounder, WK), and full synthetic match simulation.
