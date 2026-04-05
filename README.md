# Inningsly

> Cross-platform cricket scoring app for Android, iOS, and mobile web.
> Built with React Native + Expo SDK 54.

---

## Features

| Category | Capability |
|---|---|
| **Formats** | T20, ODI, Test (4 innings, follow-on), Custom |
| **Scoring** | Ball-by-ball with extras, all dismissal types, free hit, undo |
| **Bowling rules** | Max overs per bowler enforced (T20: 4, ODI: 10); no consecutive overs |
| **Teams** | Create teams, manage rosters, admin PIN, proximity discovery |
| **Players** | Batting/bowling styles, roles (C / VC / WK / AR), career stats |
| **Leagues** | Create leagues, round-robin fixtures, live standings |
| **User Auth** | Phone + PIN registration; cross-device account restore via Supabase |
| **RBAC** | 4 roles: league\_admin, team\_admin, scorer, viewer |
| **Live Scores** | Ball-by-ball broadcast to nearby users (< 50 miles) via Supabase |
| **Team Chat** | Real-time per-team chat via Supabase |
| **Delegate Access** | Single-use 6-char code grants editor access to another device |
| **Offline-first** | Full functionality without internet; cloud features optional |
| **Dark mode** | Follows system color scheme, MD3 theming |

---

## Getting Started

### Prerequisites

- Node.js 18+
- **Expo Go** app on your phone ([Android](https://play.google.com/store/apps/details?id=host.exp.exponent) / [iOS](https://apps.apple.com/app/expo-go/id982107779))

### Install & Run

```bash
# Install dependencies
npm install --legacy-peer-deps

# Scan QR with Expo Go — device must be on same Wi-Fi as Mac
REACT_NATIVE_PACKAGER_HOSTNAME=<your-mac-ip> npx expo start --port 8081

# Or open in browser
npx expo start --web

# Or emulator
npx expo start --android
npx expo start --ios
```

### Optional: Cloud Features (Supabase)

Live scores, team chat, and delegate codes require a Supabase project:

1. Create a free project at [supabase.com](https://supabase.com)
2. Run `supabase-setup.sql` in the Supabase SQL Editor (Dashboard → SQL Editor → New query → Run)
3. Create `.env` in the project root:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

4. Restart Metro — env vars are bundled at build time

### Run Tests

```bash
npm test                                          # All engine tests
npm test -- --testPathPattern=functional          # Functional scenarios only
npm test -- --testNamePattern="strike rotation"   # Filter by test name
npm test -- --coverage                            # Coverage report
```

---

## Usage Guide

### Screen Overview

```
┌─────────────────────────────────────────┐
│           Inningsly          │  ← Primary header (green)
├─────────────────────────────────────────┤
│                                         │
│              [screen content]           │
│                                         │
├─────────────────────────────────────────┤
│  🏠 Home │ 🏆 Matches │ 🛡 Teams │ 🏅 Leagues │ 📊 Stats  │
└─────────────────────────────────────────┘
```

Five bottom tabs: **Home**, **Matches**, **Teams**, **Leagues**, **Stats**

---

### 1. Home Screen

The dashboard shown on launch.

```
┌─────────────────────────────────────────┐
│         Inningsly            │
├─────────────────────────────────────────┤
│  ┌─────────────────────────────────┐   │
│  │  🏏  Inningsly       │   │
│  │       Score. Track. Win.        │   │
│  │       [  + New Match  ]         │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌──────┐  ┌──────┐  ┌──────┐         │
│  │  3   │  │  12  │  │  2   │         │
│  │Teams │  │Match │  │Live  │         │
│  └──────┘  └──────┘  └──────┘         │
│                                         │
│  ── Nearby Matches ─ within 50 miles ─ │  ← Only when cloud enabled
│  ┌─────────────────────────────────┐   │
│  │ 🔴 LIVE   T20 · City Ground    │   │
│  │  RCB vs MI                      │   │
│  │  RCB: 142/3 (14.2 ov)          │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ── Live Matches (local) ──────────── │
│  ┌─────────────────────────────────┐   │
│  │ [IN PROGRESS]  T20             │   │
│  │  THB vs RST                    │   │
│  │  THB: 87/4 (12.0 ov)          │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ── Recent Matches ────────────────── │
│  [completed match cards]               │
│                                         │
│  [My Profile] [Load Sample] [Clear All] │
└─────────────────────────────────────────┘
```

**Nearby Matches** appear only when:
- Cloud is enabled (valid Supabase credentials)
- Location permission granted
- Other users within 50 miles are scoring matches

---

### 2. Teams Tab

```
┌─────────────────────────────────────────┐
│  Teams                                  │
├─────────────────────────────────────────┤
│  🔍  Search teams...                   │
├─────────────────────────────────────────┤
│  ── My Teams ──────────────────────── │
│  ┌─────────────────────────────────┐   │
│  │  [THB]  Thunderbolts            │   │
│  │         11 players  · 📍 0.0 mi │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ── Nearby Teams (within 50 mi) ───── │
│  ┌─────────────────────────────────┐   │
│  │  [RST]  Royal Strikers          │   │
│  │         11 players  · 📍 2.3 mi │   │
│  └─────────────────────────────────┘   │
│                                         │
│                              [  +  ]   │
└─────────────────────────────────────────┘
```

- **My Teams** — teams created on this device (always shown first)
- **Nearby Teams** — up to 10 teams within 50 miles, sorted by distance
- Distance shown in feet (< 1 mile) or miles
- Tap **+** to create a new team

#### Create Team

```
┌─────────────────────────────────────────┐
│  Create Team                      [✕]  │
├─────────────────────────────────────────┤
│  Team Name *                            │
│  ┌─────────────────────────────────┐   │
│  │  Thunderbolts                   │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Short Name * (max 5 chars)            │
│  ┌───────────┐                         │
│  │  THB      │                         │
│  └───────────┘                         │
│                                         │
│  Admin PIN (optional, 4–6 digits)      │
│  ┌─────────────────────────────────┐   │
│  │  ••••                           │   │
│  └─────────────────────────────────┘   │
│  Lock roster & settings behind a PIN   │
│                                         │
│  📍 Location will be captured          │
│                                         │
│            [ Create Team ]             │
└─────────────────────────────────────────┘
```

---

### 3. Roster Management

Tap a team → **Manage Roster**

```
┌─────────────────────────────────────────┐
│  ← Thunderbolts — Roster               │
├─────────────────────────────────────────┤
│  ┌─────────────────────────────────┐   │
│  │  Ravi Kumar      [C] [WK]       │   │
│  │  Ⓡ  Right-arm medium           │   │  ← batting/bowling style icons
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │  Arjun Singh    [VC]            │   │
│  │  Ⓛ  Right-arm fast             │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │  Karan Mehta    [AR]            │   │
│  │  Ⓡ  Left-arm orthodox          │   │
│  └─────────────────────────────────┘   │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│  [ ▼ Add Player ]                      │
│                                         │
│  Name *          Phone (optional)      │
│  ┌──────────┐   ┌──────────────────┐  │
│  │          │   │  +1 555-0100     │  │
│  └──────────┘   └──────────────────┘  │
│                                         │
│  Batting:  [● Right]  [ Left ]         │
│                                         │
│  Bowling:  Right-arm fast  ▼           │
│                                         │
│  Wicket Keeper  ○────●                 │
│  All-Rounder    ○────○                 │
│  Captain        ○────○                 │
│  Vice-Captain   ○────○                 │
│  (C and VC are mutually exclusive)     │
│                                         │
│            [ Add Player ]              │
└─────────────────────────────────────────┘
```

**Role badges:**
- `C` — Captain (green, at most one per team)
- `VC` — Vice-Captain (teal, at most one per team)
- `WK` — Wicket Keeper
- `AR` — All-Rounder

**Skill icons** (MaterialCommunityIcons):

| Icon | Meaning | Color |
|---|---|---|
| `Ⓡ` alpha-r-circle | Right-hand bat | Cricket green |
| `Ⓛ` alpha-l-circle | Left-hand bat | Orange |
| ⚡ lightning-bolt | Fast bowling | Orange |
| 🌬 weather-windy | Medium bowling | Blue |
| ↻ rotate-right | Off-break / Orthodox | Purple |
| ↺ rotate-left | Leg-break / Chinaman | Teal |
| ⊝ minus-circle | Does not bowl | Grey |

---

### 4. Delegate Access (Team Sharing)

Lets another device edit your team without giving them your admin PIN.

**Owner generates code:**
```
┌─────────────────────────────────────────┐
│  Share Team Access              [✕]    │
├─────────────────────────────────────────┤
│  Share this 6-character code:          │
│                                         │
│         ┌─────────────────┐            │
│         │    X7K2MQ       │            │
│         └─────────────────┘            │
│                                         │
│  ⏱ Expires in 9:47                    │
│  Single-use — deleted after first use  │
│                                         │
│  The other device enters this code     │
│  in the Teams tab to gain editor       │
│  access to this team.                  │
└─────────────────────────────────────────┘
```

**Other device enters code** (Teams tab → Enter Delegate Code):
- Code verified against Supabase, deleted on success
- Team added to `delegateTeamIds` locally → full editor access granted

---

### 5. Create Match (5-Step Wizard)

Tap **+** on the Matches tab or **New Match** on Home.

```
Step 1: Format
┌─────────────────────────────────────────┐
│  New Match — Format              1/5   │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────┐  ┌──────────┐           │
│  │  T20     │  │  ODI     │           │
│  │ 20 overs │  │ 50 overs │           │
│  └──────────┘  └──────────┘           │
│  ┌──────────┐  ┌──────────┐           │
│  │  Test    │  │  Custom  │           │
│  │ 4 innings│  │ you set  │           │
│  └──────────┘  └──────────┘           │
│                                         │
│                         [ Next → ]     │
└─────────────────────────────────────────┘

Step 2: Teams
┌─────────────────────────────────────────┐
│  New Match — Teams               2/5   │
├─────────────────────────────────────────┤
│  Team 1 *           Team 2 *           │
│  ┌──────────────┐  ┌──────────────┐   │
│  │ Thunderbolts │  │ Royal Strike │   │
│  └──────────────┘  └──────────────┘   │
│                                         │
│  [ ← Back ]              [ Next → ]   │
└─────────────────────────────────────────┘

Step 3: Playing XI (per team)
┌─────────────────────────────────────────┐
│  New Match — Playing XI          3/5   │
├─────────────────────────────────────────┤
│  Thunderbolts (select 11)              │
│  Selected: 8 / 11                      │
│                                         │
│  ☑ Ravi Kumar     [C] [WK]            │
│  ☑ Arjun Singh    [VC]                │
│  ☑ Karan Mehta    [AR]                │
│  ☐ Deepak Rao                         │
│  ...                                    │
│                                         │
│  [ ← Back ]              [ Next → ]   │
└─────────────────────────────────────────┘

Step 4: Venue & Date
Step 5: Confirm & Create
```

---

### 6. Toss Screen

```
┌─────────────────────────────────────────┐
│  ← Toss — THB vs RST                  │
├─────────────────────────────────────────┤
│                                         │
│  Who won the toss?                     │
│                                         │
│  ● Thunderbolts (THB)                  │
│  ○ Royal Strikers (RST)                │
│                                         │
│  ─────────────────────────────────── │
│                                         │
│  Decision:                             │
│                                         │
│  ● Bat first                           │
│  ○ Bowl first                          │
│                                         │
│            [ Confirm Toss ]            │
└─────────────────────────────────────────┘
```

---

### 7. Live Scoring Screen

The primary scoring interface — large tap targets, thumb-friendly layout.

```
┌─────────────────────────────────────────┐
│  ← THB vs RST  [T20]    ⚡ FREE HIT   │  ← free-hit banner when active
├─────────────────────────────────────────┤
│  THB  142/6  (17.3 ov)                 │  ← mini scorecard
│  CRR: 8.11   RRR: 12.40   TGT: 186    │
├─────────────────────────────────────────┤
│  🏏 Ravi Kumar*    34(28)  4s:2  6s:1  │  ← striker (*)
│     Arjun Singh    18(15)               │  ← non-striker
│  🎯 Deepak Rao     2-0-18-1  (4.3)    │  ← bowler
│  Partnership: 22(14)                    │
├─────────────────────────────────────────┤
│  This over:  . 1 W . 4 2              │  ← dot, run, wicket, etc.
├─────────────────────────────────────────┤
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ │
│  │  0   │ │  1   │ │  2   │ │  3   │ │
│  └──────┘ └──────┘ └──────┘ └──────┘ │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ │
│  │  4   │ │  5   │ │  6   │ │  W   │ │  ← W = wicket modal
│  └──────┘ └──────┘ └──────┘ └──────┘ │
│                                         │
│  [Wide] [No Ball] [Bye] [Leg Bye]     │  ← toggle modifiers
│                                         │
│  [UNDO]                   [END OVER]  │
└─────────────────────────────────────────┘
```

**Extras as modifiers:** Tap `Wide` then `1` = wide + 1 run (total 2 added to score, 1 to extras).

**Wicket modal** (appears after tapping `W`):

```
┌─────────────────────────────────────────┐
│  Wicket                           [✕]  │
├─────────────────────────────────────────┤
│  Dismissed batter:                     │
│  ● Ravi Kumar (striker)                │
│  ○ Arjun Singh (non-striker)           │
│                                         │
│  Dismissal type:                       │
│  ○ Bowled    ● Caught   ○ LBW         │
│  ○ Run Out   ○ Stumped  ○ Hit Wicket  │
│                                         │
│  Fielder (optional):                   │
│  [Select fielder...  ▼]               │
│                                         │
│            [ Confirm ]                 │
└─────────────────────────────────────────┘
```

**After wicket → New Batter modal:**

```
┌─────────────────────────────────────────┐
│  Incoming Batter                  [✕]  │
├─────────────────────────────────────────┤
│  ○ Karan Mehta    (AR)                 │
│  ○ Suresh Patel                        │
│  ● Vikram Nair                         │
│                                         │
│            [ Confirm ]                 │
└─────────────────────────────────────────┘
```

**After over → Bowler modal:**

```
┌─────────────────────────────────────────┐
│  Select Bowler                    [✕]  │
├─────────────────────────────────────────┤
│  ● Rahul Verma     0-0-0-0            │
│  ○ Amit Shah       1-0-12-1           │
│  (Deepak Rao cannot bowl — prev over)  │
│                                         │
│            [ Confirm ]                 │
└─────────────────────────────────────────┘
```

---

### 8. Scorecard

Full innings view accessible from Match Detail.

```
┌─────────────────────────────────────────┐
│  ← Scorecard — THB vs RST  [T20]      │
├─────────────────────────────────────────┤
│  Thunderbolts  185/7  (20.0 ov)        │
├─────────────────────────────────────────┤
│  BATTING              R    B   4s  6s  │
│  Ravi Kumar*         54   38    6   1  │
│  Arjun Singh   b Deepak  23   18    2   0  │
│  Karan Mehta   ct Rahul  12   10    1   0  │
│  ...                                    │
│  Extras: 8 (W:4, NB:2, B:1, LB:1)    │
├─────────────────────────────────────────┤
│  BOWLING              O    M    R    W  │
│  Deepak Rao          4    0   32    2  │
│  Rahul Verma         3    1   18    1  │
│  ...                                    │
├─────────────────────────────────────────┤
│  FALL OF WICKETS                       │
│  1-23(Arjun,4.2) 2-45(Karan,7.1)...  │
├─────────────────────────────────────────┤
│  PARTNERSHIPS                          │
│  1st: 23 runs (4.2 ov)                │
│  2nd: 22 runs (2.5 ov)                │
└─────────────────────────────────────────┘
```

---

### 9. Player Profile

```
┌─────────────────────────────────────────┐
│  ← Ravi Kumar                          │
├─────────────────────────────────────────┤
│  Thunderbolts  [C] [WK]                │
│  Ⓡ Right-hand  ·  🌬 Right-arm medium │
│                                         │
│  Player Code: XK7M2Q                  │
│  Phone: +1 555-0100                    │
│                         [ Edit ]       │
├─────────────────────────────────────────┤
│  BATTING — Career                      │
│  M:8  Inn:7  NO:1  Runs:312           │
│  HS:87  Avg:52.0  SR:145.8            │
│  50s:2  100s:0  4s:18  6s:9          │
├─────────────────────────────────────────┤
│  BOWLING — Career                      │
│  M:8  Overs:12  Wkts:8               │
│  Runs:96  Econ:8.0  Avg:12.0         │
│  Best: 3/18  Maidens:1               │
└─────────────────────────────────────────┘
```

---

### 10. Team Chat

Real-time chat visible to anyone who can see the team (requires cloud).

```
┌─────────────────────────────────────────┐
│  ← Thunderbolts — Chat                 │
├─────────────────────────────────────────┤
│                                         │
│   Ravi Kumar          10:42 AM         │
│   ┌──────────────────────────────┐     │
│   │ Good luck everyone today!   │     │
│   └──────────────────────────────┘     │
│                                         │
│   Arjun Singh         10:44 AM         │
│   ┌──────────────────────────────┐     │
│   │ Let's go THB! 🏏             │     │
│   └──────────────────────────────┘     │
│                                         │
│             You           10:45 AM     │
│         ┌──────────────────────────────┐│
│         │ Ready to play!              ││
│         └──────────────────────────────┘│
│                                         │
├─────────────────────────────────────────┤
│  ┌──────────────────────────┐  [Send]  │
│  │  Type a message...       │          │
│  └──────────────────────────┘          │
└─────────────────────────────────────────┘
```

---

### 11. Leagues

```
┌─────────────────────────────────────────┐
│  Leagues                                │
├─────────────────────────────────────────┤
│  ┌─────────────────────────────────┐   │
│  │  Summer T20 Cup   [STC]         │   │
│  │  4 teams  ·  6 fixtures         │   │
│  └─────────────────────────────────┘   │
│                                         │
│                              [  +  ]   │
└─────────────────────────────────────────┘
```

**League Detail — Standings:**

```
┌─────────────────────────────────────────┐
│  ← Summer T20 Cup                      │
│  [Standings]  [Fixtures]               │
├─────────────────────────────────────────┤
│  #  Team       P   W   L   T   Pts    │
│  1  THB        3   3   0   0    6     │
│  2  RST        3   2   1   0    4     │
│  3  BLZ        3   1   2   0    2     │
│  4  SKY        3   0   3   0    0     │
└─────────────────────────────────────────┘
```

---

### 12. Stats Tab

```
┌─────────────────────────────────────────┐
│  Stats                                  │
├─────────────────────────────────────────┤
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  │
│  │  12  │ │  3   │ │  28  │ │  5   │  │
│  │Compl │ │Teams │ │Playr │ │Total │  │
│  └──────┘ └──────┘ └──────┘ └──────┘  │
│                                         │
│  ── Top Batters ───────────────────── │
│  1. Ravi Kumar    Avg 52.0  SR 145.8  │
│  2. Arjun Singh   Avg 38.4  SR 122.4  │
│                                         │
│  ── Top Bowlers ───────────────────── │
│  1. Deepak Rao    Econ 6.4  Wkts 14   │
│  2. Rahul Verma   Econ 7.1  Wkts 11   │
└─────────────────────────────────────────┘
```

---

### 13. Admin PIN

Teams can have an optional 4–6 digit PIN (SHA-256 hashed, never stored in plaintext).

```
┌─────────────────────────────────────────┐
│  Admin PIN Required             [✕]   │
├─────────────────────────────────────────┤
│  Enter PIN to manage Thunderbolts      │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  · · · ·                       │   │
│  └─────────────────────────────────┘   │
│                                         │
│            [ Unlock ]                  │
└─────────────────────────────────────────┘
```

- `adminPinHash: null` = no PIN (open access)
- Auth state is in-memory — unlocked status resets on app restart
- Team creator auto-authenticated immediately after creation

---

### 14. Sample Data

On first launch (no data), tap **Load Sample Data** on the Home screen:

- **Thunderbolts (THB)** — 11 players with varied styles including WK, C, VC, AR
- **Royal Strikers (RST)** — 11 players covering all batting/bowling styles

Use **Delete Sample Data** to remove them. Use **Clear All Data** to wipe everything.

---

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for full diagrams including:
- System overview (UI → Store → Engine → DB → Cloud)
- Match and innings state machines
- Ball recording processing pipeline
- Strike rotation rules
- Entity relationship diagrams
- Database schema
- Live match broadcast sequence
- Delegate code flow
- Navigation tree
- Store dependency map

### Quick Summary

```
app/                    # Expo Router screens
  (tabs)/               # Home, Matches, Teams, Leagues, Stats
  match/[id]/           # Detail, Toss, Scoring, Scorecard
  team/[id]/            # Detail, Roster, Edit
  chat/[teamId].tsx     # Real-time team chat
  player/[id].tsx       # Player profile + career stats
  league/[id]/          # Standings, Schedule

src/
  engine/               # Pure TypeScript scoring engine (zero React deps)
    types.ts            # All data models
    match-engine.ts     # Immutable MatchEngine — returns new instance per mutation
    __tests__/          # 150+ tests (unit + functional end-to-end)

  store/                # Zustand state (useMatchStore, useTeamStore, ...)
  db/repositories/      # SQLite repos (.ts) + web repos (.web.ts) + cloud repos
  components/           # Reusable UI components
  theme/                # MD3 light/dark themes (primary green #1B6B28)
  utils/                # formatters, cricket-math, seed-data
  config/supabase.ts    # Cloud enabled/disabled, key validation
```

### Key Design Principles

| Principle | Detail |
|---|---|
| **Immutable engine** | `MatchEngine` returns a new instance on every mutation — undo is trivial |
| **Stores as single entry point** | UI never calls repos directly |
| **Platform-specific repos** | Metro resolves `.web.ts` on browser — SQLite layer never bundled for web |
| **Cloud is opt-in** | `isCloudEnabled` guards every Supabase call; app works fully offline |
| **PGRST205 resilience** | Table-not-found errors silently swallowed — cloud features degrade gracefully |

---

## Data & Privacy

- Match data and player info stored locally (SQLite on native, localStorage on web)
- Cloud sync (teams, live scores, chat) requires explicit Supabase setup and only with your own project
- Admin PINs are SHA-256 hashed — plaintext never stored or transmitted
- All SQLite queries use parameterised statements (no SQL injection risk)
- Phone numbers stored locally only; used as optional player identity key, never uploaded automatically
