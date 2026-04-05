# Inningsly — Architecture & Design

> Technical design reference. For feature requirements see `REQUIREMENTS.md`. For developer setup see `CLAUDE.md`.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Layer Architecture](#2-layer-architecture)
3. [Data Flow](#3-data-flow)
4. [Match State Machine](#4-match-state-machine)
5. [Innings State Machine](#5-innings-state-machine)
6. [Scoring Engine Internals](#6-scoring-engine-internals)
7. [Data Models (ERD)](#7-data-models-erd)
8. [Database Schema (SQLite)](#8-database-schema-sqlite)
9. [Cloud Architecture (Supabase)](#9-cloud-architecture-supabase)
10. [Live Match Broadcast Flow](#10-live-match-broadcast-flow)
11. [Delegate Code Flow](#11-delegate-code-flow)
12. [Navigation Structure](#12-navigation-structure)
13. [Platform Resolution](#13-platform-resolution)
14. [Store Dependency Map](#14-store-dependency-map)

---

## 1. System Overview

```mermaid
graph TB
    subgraph Device["📱 Device (offline-first)"]
        UI["Expo Router Screens\n(app/**)"]
        Stores["Zustand Stores\n(src/store/)"]
        Engine["Scoring Engine\n(src/engine/) — pure TS"]
        SQLite["expo-sqlite\n(native)"]
        LS["localStorage\n(web)"]
    end

    subgraph Cloud["☁️ Supabase (optional)"]
        Teams_T["cloud_teams"]
        Players_T["cloud_players"]
        Delegate["delegate_codes"]
        Chat["chat_messages"]
        LiveM["live_matches"]
    end

    UI -->|"reads selectors"| Stores
    UI -->|"dispatches actions"| Stores
    Stores -->|"immutable mutations"| Engine
    Stores -->|"auto-save"| SQLite
    Stores -->|"auto-save"| LS
    Stores -->|"publishLiveMatch"| LiveM
    Stores -->|"syncTeam"| Teams_T
    Stores -->|"syncPlayers"| Players_T

    UI -->|"fetch nearby"| LiveM
    UI -->|"real-time sub"| LiveM
    UI -->|"send/recv"| Chat
    UI -->|"redeem code"| Delegate
```

**Key invariants:**
- UI never calls repos directly — always via Zustand stores
- Engine is stateless/immutable — every method returns a new instance
- Cloud is optional — `isCloudEnabled` guards every Supabase call
- SQLite and localStorage are fully interchangeable (same repo interface, different implementations)

---

## 2. Layer Architecture

```mermaid
graph LR
    subgraph Presentation["Presentation Layer"]
        A["app/ screens\n(Expo Router)"]
        B["src/components/\nReusable UI"]
        C["src/hooks/\nuseAdminAuth, etc."]
    end

    subgraph State["State Layer"]
        D["useMatchStore"]
        E["useTeamStore"]
        F["usePrefsStore"]
        G["useLeagueStore"]
        H["useChatStore"]
        I["useLiveScoresStore"]
    end

    subgraph Engine["Engine Layer (pure TS)"]
        J["MatchEngine\n(immutable class)"]
        K["types.ts\n(all data models)"]
    end

    subgraph Persistence["Persistence Layer"]
        L["SQLite repos\n(.ts files)"]
        M["Web repos\n(.web.ts files)"]
        N["Cloud repos\n(Supabase)"]
    end

    A --> D & E & F & G & H & I
    B --> D & E
    C --> E
    D --> J
    D --> L & M
    E --> L & M & N
    G --> L & M
    H --> N
    I --> N
```

---

## 3. Data Flow

### Ball Recording (critical path)

```mermaid
sequenceDiagram
    participant UI as ScoringScreen
    participant Store as useMatchStore
    participant Eng as MatchEngine
    participant DB as SQLite/localStorage
    participant Cloud as Supabase live_matches

    UI->>Store: recordBall(input)
    Store->>Eng: engine.recordBall(input)
    Eng-->>Store: new MatchEngine instance
    Store->>Store: set({ engine: newEngine })
    Store->>DB: saveMatchState(matchId, match) [async, fire-and-forget]
    Store->>Cloud: publishLiveMatch(match) [async, fire-and-forget]
    Store-->>UI: re-render via Zustand selector
```

### Undo

```mermaid
sequenceDiagram
    participant UI as ScoringScreen
    participant Store as useMatchStore
    participant Eng as MatchEngine

    UI->>Store: undoLastBall()
    Note over Eng: engine holds ScoringAction[] stack\neach entry = (ball, previousInningsSnapshot)
    Store->>Eng: engine.undoLastBall()
    Note over Eng: pops last ScoringAction\nrestores previousInningsSnapshot
    Eng-->>Store: new MatchEngine
    Store->>DB: saveMatchState [async]
    Store->>Cloud: publishLiveMatch [async]
```

---

## 4. Match State Machine

```mermaid
stateDiagram-v2
    [*] --> scheduled : createMatch()
    scheduled --> toss : recordToss()
    toss --> in_progress : startMatch()\n→ setOpeners()\n→ setBowler()
    in_progress --> in_progress : recordBall()
    in_progress --> in_progress : undoLastBall()
    in_progress --> in_progress : startNextInnings()
    in_progress --> completed : final innings ends\n(all-out / overs / target chased)
    in_progress --> abandoned : manual abandon
    completed --> [*]
    abandoned --> [*]
```

---

## 5. Innings State Machine

```mermaid
stateDiagram-v2
    [*] --> not_started
    not_started --> in_progress : setOpeners() + setBowler()

    in_progress --> in_progress : recordBall()
    in_progress --> completed : all out (10 wkts)\nor overs completed\nor target chased
    in_progress --> declared : declareInnings() [Test only]
    in_progress --> forfeited : forfeit()

    completed --> [*]
    declared --> [*]
    forfeited --> [*]
```

---

## 6. Scoring Engine Internals

### `recordBall()` processing pipeline

```mermaid
flowchart TD
    A[BallInput received] --> B{isWide?}
    B -- Yes --> C[runsForRotation = 0\nextras += 1 + runs]
    B -- No --> D{isNoBall?}
    D -- Yes --> E[runsForRotation = runsOffBat\nextras += 1]
    D -- No --> F[runsForRotation = totalRuns]

    C & E & F --> G{dismissal?}
    G -- Yes --> H{retired_hurt?}
    H -- No --> I[totalWickets++\nfallOfWickets.push]
    H -- Yes --> J[mark batter dismissed\nno wicket count]
    I & J --> K[update batter stats]

    G -- No --> K
    K --> L{runsForRotation % 2 === 1?}
    L -- Yes --> M[swap striker/nonStriker]
    L -- No --> N[no rotation]

    M & N --> O{isLegal?}
    O -- Yes --> P[totalBalls++]
    P --> Q{totalBalls === 6?}
    Q -- Yes --> R[complete over\nreset totalBalls=0\ntotalOvers++\nswap striker/nonStriker]
    Q -- No --> S[continue over]
    O -- No --> S

    R & S --> T{free hit next?}
    T --> U[set isFreeHit flag\nbased on wide/NB]
    U --> V[return new MatchEngine]
```

### Strike rotation rules

| Delivery | `runsForRotation` | Odd → swap? | End-of-over swap? |
|---|---|---|---|
| Legal, 1 run | 1 | ✓ | ✓ (net: back to striker) |
| Legal, 2 runs | 2 | ✗ | ✓ |
| Wide, 1 run | 0 | ✗ | ✓ |
| No Ball, 1 run off bat | 1 (off bat only) | ✓ | ✓ |
| No Ball, 0 runs | 0 | ✗ | ✓ |

---

## 7. Data Models (ERD)

```mermaid
erDiagram
    TEAM {
        string id PK
        string name
        string shortName
        string adminPinHash "null = open"
        float latitude "null if no location"
        float longitude
        number createdAt
        number updatedAt
    }

    PLAYER {
        string id PK
        string name
        string phoneNumber "optional, cross-team identity"
        string battingStyle "right | left"
        string bowlingStyle
        bool isWicketKeeper
        bool isAllRounder
        bool isCaptain
        bool isViceCaptain
    }

    MATCH {
        string id PK
        string status "scheduled|toss|in_progress|completed|abandoned"
        string venue
        number date
        string result "null until completed"
    }

    MATCH_CONFIG {
        string format "t20|odi|test|custom"
        number oversPerInnings "null for Test"
        number maxInnings "2 or 4"
        number playersPerSide
        number followOnMinimum "null for LOI"
    }

    INNINGS {
        string id PK
        number inningsNumber
        string status
        number totalRuns
        number totalWickets
        number totalOvers
        number totalBalls
        string currentStrikerId
        string currentNonStrikerId
        string currentBowlerId
        number target "null for 1st innings"
    }

    BALL_OUTCOME {
        string id PK
        number overNumber
        number ballInOver
        number runs "off bat"
        bool isLegal
        bool isBoundary
        bool isFreeHit
        number timestamp
    }

    LEAGUE {
        string id PK
        string name
        string shortName
        string teamIds "JSON array"
    }

    LEAGUE_FIXTURE {
        string id PK
        string status "scheduled|completed|abandoned"
        string venue
        number scheduledDate
        string result
    }

    TEAM ||--o{ PLAYER : "has"
    MATCH ||--|| MATCH_CONFIG : "configured by"
    MATCH ||--o{ INNINGS : "has"
    MATCH }o--|| TEAM : "team1"
    MATCH }o--|| TEAM : "team2"
    INNINGS ||--o{ BALL_OUTCOME : "contains"
    LEAGUE ||--o{ LEAGUE_FIXTURE : "has"
    LEAGUE_FIXTURE }o--o| MATCH : "linked to"
```

---

## 8. Database Schema (SQLite)

```mermaid
erDiagram
    teams {
        TEXT id PK
        TEXT name
        TEXT short_name
        TEXT admin_pin_hash "nullable"
        REAL latitude "nullable"
        REAL longitude "nullable"
        INTEGER created_at
        INTEGER updated_at
    }

    players {
        TEXT id PK
        TEXT team_id FK
        TEXT name
        TEXT batting_style
        TEXT bowling_style
        INTEGER is_wicket_keeper
        INTEGER is_all_rounder
        INTEGER is_captain
        INTEGER is_vice_captain
    }

    matches {
        TEXT id PK
        TEXT format
        TEXT config_json
        TEXT status
        TEXT team1_id FK
        TEXT team2_id FK
        TEXT team1_playing_xi "JSON array"
        TEXT team2_playing_xi "JSON array"
        TEXT toss_json "nullable"
        TEXT venue
        INTEGER match_date
        TEXT result "nullable"
        TEXT match_state_json "full engine state"
        INTEGER created_at
        INTEGER updated_at
    }

    user_prefs {
        TEXT key PK
        TEXT value "JSON value"
    }

    leagues {
        TEXT id PK
        TEXT name
        TEXT short_name
        TEXT team_ids "JSON array"
        INTEGER created_at
        INTEGER updated_at
    }

    league_fixtures {
        TEXT id PK
        TEXT league_id FK
        TEXT team1_id FK
        TEXT team2_id FK
        TEXT match_id "nullable FK"
        TEXT venue
        INTEGER scheduled_date
        TEXT status
        TEXT result "nullable"
        TEXT team1_score "nullable"
        TEXT team2_score "nullable"
        TEXT winner_team_id "nullable"
        INTEGER created_at
        INTEGER updated_at
    }

    teams ||--o{ players : "has"
    teams ||--o{ matches : "team1"
    teams ||--o{ matches : "team2"
    leagues ||--o{ league_fixtures : "has"
    matches ||--o| league_fixtures : "linked"
```

**Migration rules:**
- New columns: `ALTER TABLE ... ADD COLUMN` wrapped in try/catch
- **Never** add `NOT NULL` constraint in a migration (breaks Android SQLite < 3.37)
- PRAGMAs must be separate `execAsync` calls (Android SQLite limitation)

---

## 9. Cloud Architecture (Supabase)

```mermaid
graph TB
    subgraph App["Mobile App"]
        TS["useTeamStore"]
        LS["useLiveScoresStore"]
        CS["useChatStore"]
        UI2["Teams UI"]
    end

    subgraph Supabase["Supabase (PostgreSQL + Realtime)"]
        CT["cloud_teams\n+ cloud_players"]
        DC["delegate_codes\n(TTL: 10 min)"]
        CM["chat_messages\n(indexed by team_id, created_at)"]
        LM["live_matches\n(indexed by lat/lon, updated_at)"]

        RT1["Realtime channel:\nlive_matches_realtime"]
        RT2["Realtime channel:\nchat_{teamId}"]
    end

    TS -->|"upsert on create/edit"| CT
    UI2 -->|"fetch nearby (50mi bbox)"| CT
    UI2 -->|"generate / redeem"| DC
    CS -->|"send message"| CM
    CS <-->|"postgres_changes"| RT2
    LS -->|"initial fetch (50mi bbox, 24h)"| LM
    LS <-->|"postgres_changes"| RT1
```

**Row Level Security:** All tables use `USING (true)` policies (anonymous read/write) — suitable for public community data. No user auth on the Supabase level; admin PIN auth is client-side only.

**Key validation (`src/config/supabase.ts`):**
- Legacy JWT key: `length > 100`
- New publishable key: starts with `sb_publishable_`
- `isCloudEnabled = isValidUrl && isValidKey`

---

## 10. Live Match Broadcast Flow

```mermaid
sequenceDiagram
    participant Scorer as Scorer Device
    participant Store as useMatchStore
    participant Repo as cloud-match-repo
    participant DB as Supabase live_matches
    participant RT as Realtime Channel
    participant Viewer as Viewer Device
    participant VS as useLiveScoresStore

    Scorer->>Store: recordBall(input)
    Store->>Repo: publishLiveMatch(match)
    Repo->>DB: UPSERT (id, teams, score, overs, lat, lon, updated_at)

    DB->>RT: postgres_changes event (INSERT/UPDATE)
    RT->>VS: onUpdate callback
    VS->>Repo: fetchNearbyLiveMatches(lat, lon, 80km)
    Repo->>DB: SELECT WHERE lat/lon bbox AND updated_at > 24h ago
    DB-->>Repo: rows[]
    Repo-->>VS: LiveMatchSummary[]
    VS->>Viewer: re-render Nearby Matches section
```

**Proximity query** (bounding box, not exact Haversine — fast, approximate):
```
latDelta = 80 / 111.0
lonDelta = 80 / (111.0 × cos(lat × π/180))
WHERE latitude BETWEEN (lat - latDelta) AND (lat + latDelta)
  AND longitude BETWEEN (lon - lonDelta) AND (lon + lonDelta)
  AND updated_at > (now - 24h)
ORDER BY updated_at DESC LIMIT 20
```

**Graceful degradation:** `PGRST205` (table not found) is silently ignored — live scores just won't show until the SQL is run in Supabase.

---

## 11. Delegate Code Flow

```mermaid
sequenceDiagram
    participant Owner as Owner Device
    participant Supabase as delegate_codes table
    participant Other as Other Device
    participant Prefs as user_prefs (local)

    Note over Owner: Must be admin-unlocked
    Owner->>Supabase: INSERT {team_id, code, expires_at=now+10min}
    Owner-->>Owner: display 6-char code on screen

    Note over Other: Enters code in Teams tab
    Other->>Supabase: SELECT WHERE team_id=X AND code=Y AND expires_at > now
    alt Code valid
        Supabase-->>Other: row found
        Other->>Supabase: DELETE WHERE team_id=X (single-use)
        Other->>Prefs: addDelegateTeam(team_id) → stored in user_prefs
        Other-->>Other: hasEditAccess = true (same as isMyTeam)
    else Code invalid / expired
        Supabase-->>Other: empty
        Other-->>Other: show error
    end
```

---

## 12. Navigation Structure

```mermaid
graph TD
    Root["app/_layout.tsx\nErrorBoundary + PaperProvider + ThemeProvider"]

    Root --> Tabs["(tabs)/_layout.tsx\nBottom Tab Navigator"]

    Tabs --> Home["index.tsx\nHome / Dashboard\n• Quick stats\n• Live matches\n• Nearby live (cloud)\n• Recent completed"]
    Tabs --> Matches["matches.tsx\nAll Matches"]
    Tabs --> Teams["teams.tsx\nTeam Discovery\n• My Teams\n• Nearby Teams (50mi)\n• Search"]
    Tabs --> Leagues["leagues.tsx\nLeague List"]
    Tabs --> Stats["stats.tsx\nCareer + Match Stats"]

    Matches --> MatchDetail["match/[id]/index.tsx\nMatch Detail"]
    MatchDetail --> Toss["match/[id]/toss.tsx"]
    MatchDetail --> Scoring["match/[id]/scoring.tsx\nLive Scoring"]
    MatchDetail --> Scorecard["match/[id]/scorecard.tsx"]
    Matches --> CreateMatch["match/create.tsx\n5-step wizard (modal)"]

    Teams --> TeamDetail["team/[id]/index.tsx\nTeam Detail"]
    TeamDetail --> Roster["team/[id]/roster.tsx\nManage Players"]
    TeamDetail --> EditTeam["team/[id]/edit.tsx\nEdit Team Info"]
    TeamDetail --> Chat["chat/[teamId].tsx\nReal-time Chat"]
    Teams --> CreateTeam["team/create.tsx\n(modal)"]

    Leagues --> LeagueDetail["league/[id]/index.tsx\nStandings + Fixtures"]
    LeagueDetail --> Schedule["league/[id]/schedule.tsx"]
    Leagues --> CreateLeague["league/create.tsx\n(modal)"]

    Home --> Profile["profile.tsx\nFind My Profile (by player code)"]
    Root --> Login["login.tsx\nPhone + PIN auth"]
    TeamDetail --> PlayerProfile["player/[id].tsx\nCareer Stats + Edit"]
```

---

## 13. Platform Resolution

Metro bundler resolves `.web.ts` before `.ts` for browser builds. This allows a clean SQLite ↔ localStorage swap with zero UI changes.

```mermaid
graph LR
    subgraph "Native (iOS / Android)"
        TR1["team-repo.ts\n(expo-sqlite)"]
        MR1["match-repo.ts\n(expo-sqlite)"]
        PR1["prefs-repo.ts\n(expo-sqlite)"]
        LR1["league-repo.ts\n(expo-sqlite)"]
    end

    subgraph "Web (Browser)"
        TR2["team-repo.web.ts\n(localStorage)"]
        MR2["match-repo.web.ts\n(localStorage)"]
        PR2["prefs-repo.web.ts\n(localStorage)"]
        LR2["league-repo.web.ts\n(localStorage)"]
    end

    subgraph "All Platforms"
        CR["cloud-team-repo.ts\ncloud-chat-repo.ts\ncloud-delegate-repo.ts\ncloud-match-repo.ts\n(Supabase — same everywhere)"]
    end
```

Both repo variants implement the same TypeScript interface, so stores are platform-agnostic.

---

## 14. Store Dependency Map

```mermaid
graph TD
    subgraph Screens
        H["HomeScreen"]
        T["TeamsScreen"]
        R["RosterScreen"]
        S["ScoringScreen"]
        SC["ScorecardScreen"]
        CH["ChatScreen"]
        LS_Screen["LiveScoresSection\n(in HomeScreen)"]
    end

    subgraph Stores
        MS["useMatchStore\n• engine (MatchEngine)\n• matches (MatchRow[])\n• matchId"]
        TS["useTeamStore\n• teams (Team[])\n• addPlayer / deletePlayer"]
        PS["usePrefsStore\n• myTeamIds\n• delegateTeamIds"]
        LSS["useLiveScoresStore\n• matches (LiveMatchSummary[])\n• location"]
        CS["useChatStore\n• messages\n• identity"]
        LS_Store["useLeagueStore\n• leagues\n• fixtures"]
        AA["useAdminAuth\n• isAdmin(teamId, hash)\n• unlock(teamId, pin)"]
    end

    H --> MS & TS & LSS
    T --> TS & PS
    R --> TS & PS & AA
    S --> MS
    SC --> MS
    CH --> CS & PS
    LS_Screen --> LSS
```
