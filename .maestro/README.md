# Maestro E2E Test Suite — Inningsly

## Quick Start

```bash
# Install Maestro CLI
brew install maestro

# Run a single flow
maestro test .maestro/flows/03_team_creation.yaml

# Run the full suite
maestro test .maestro/flows/00_full_e2e.yaml

# Run by tag (e.g. smoke tests only)
maestro test --include-tags smoke .maestro/flows/
```

## Flow Index

| File | Covers | Tags |
|------|--------|------|
| `00_full_e2e.yaml` | Master runner — chains all flows | e2e, smoke, full |
| `01_auth_registration.yaml` | 5-step registration wizard | auth, smoke |
| `02_auth_login.yaml` | PIN login for returning user | auth, smoke |
| `03_team_creation.yaml` | Create teams with/without PIN, duplicate rejection | team, smoke |
| `04_roster_management.yaml` | Add 11 players to each team, delete | team, roster |
| `05_match_creation.yaml` | 5-step match wizard, back nav, validation | match, smoke |
| `06_match_toss.yaml` | Toss winner/decision/confirm | match, toss |
| `07_scoring_basic.yaml` | Dots, runs, extras, over completion | scoring, smoke |
| `08_scoring_wicket.yaml` | All dismissal types, combined modal | scoring, wicket |
| `09_scoring_undo_abandon.yaml` | Undo last ball, abandon match | scoring, undo, abandon |
| `10_scoring_full_innings.yaml` | Full two-innings T20 match + result | scoring, full-match, e2e |
| `11_subscription_upgrade.yaml` | Upgrade screen, billing toggle, plan gates | subscription, iap |
| `12_cloud_sync_realtime.yaml` | Sync indicator, live scores, NRR gate | cloud, realtime |

## Dependency Order

```
01_auth_registration
    └─► 02_auth_login
    └─► 03_team_creation
            └─► 04_roster_management
                    └─► 05_match_creation
                            └─► 06_match_toss
                                    └─► 07_scoring_basic
                                    └─► 08_scoring_wicket
                                    └─► 09_scoring_undo_abandon
                                    └─► 10_scoring_full_innings
    └─► 11_subscription_upgrade
```

Each flow after `01` expects a logged-in session. The `utils/ensure_logged_in.yaml`
helper is called at the start of each independent flow.

## Test Environment Setup

### OTP / Phone Numbers

The registration flow uses **Twilio Verify test numbers**. Configure a fixed OTP:

1. In Twilio Console → Verify → your Service → Settings → Test Numbers
2. Add `+919191919191` as a test number with fixed code `123456`
3. This number bypasses real SMS delivery and always returns `123456`

### RevenueCat Sandbox

For `11_subscription_upgrade.yaml` (IAP flows):

- Set RC dashboard to Sandbox mode
- Configure a Sandbox Apple ID in App Store Connect for iOS testing
- Configure a Sandbox Google Play account for Android testing
- The test stops at the system purchase sheet and taps Back — no real charge occurs

### Environment Variables

```bash
# .env (already in .gitignore)
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
EXPO_PUBLIC_RC_API_KEY_IOS=...
EXPO_PUBLIC_RC_API_KEY_ANDROID=...
```

## testID Naming Convention

All testIDs follow a `screen-element-variant` pattern:

```
Screen prefix    Element type      Variant/state
-----------      ------------      -------------
team-create      name-input        (none)
match-format     t20               (none)
score-run        4                 (run value)
scoring          opener-modal      (none)
upgrade          pro-btn           (plan name)
toss             decision-bat      (decision)
```

### Full testID Reference

#### Tab Bar
| testID | Element |
|--------|---------|
| `tab-home` | Home tab button |
| `tab-matches` | Matches tab button |
| `tab-teams` | Teams tab button |
| `tab-chat` | Chat tab button |
| `tab-leagues` | Leagues tab button |
| `tab-stats` | Stats tab button |

#### Home Screen
| testID | Element |
|--------|---------|
| `tabs-home` | Root ScrollView (screen identifier) |
| `home-my-profile-btn` | Profile icon top-right |

#### Team Creation (`/team/create`)
| testID | Element |
|--------|---------|
| `team-create-name-input` | Team name TextInput |
| `team-create-short-name-input` | Short name TextInput |
| `team-create-pin-toggle` | Admin PIN Switch |
| `team-create-pin-input` | PIN TextInput |
| `team-create-confirm-pin-input` | Confirm PIN TextInput |
| `team-create-btn` | Create Team Button |
| `team-create-cancel-btn` | Cancel Button |
| `team-limit-upgrade-btn` | Upgrade Plan button (plan limit screen) |

#### Teams Tab
| testID | Element |
|--------|---------|
| `teams-screen` | Root View |
| `teams-create-team-btn` | Create Team FAB |

#### Roster (`/team/[id]/roster`)
| testID | Element |
|--------|---------|
| `roster-screen` | Root View |
| `roster-add-player-btn` | Add Player button |
| `roster-player-name-input` | Player name TextInput |
| `roster-player-phone-input` | Player phone TextInput |
| `roster-batting-right` | Right-hand bat selector |
| `roster-batting-left` | Left-hand bat selector |
| `roster-keeper-switch` | Wicket-keeper Switch |
| `roster-allrounder-switch` | All-rounder Switch |
| `roster-captain-switch` | Captain Switch |
| `roster-vice-captain-switch` | Vice-captain Switch |
| `roster-save-player-btn` | Save Player button |
| `roster-delete-player-btn` | Delete player icon |
| `roster-delete-confirm-dialog` | Delete confirmation dialog |
| `roster-delete-confirm-btn` | Confirm delete button |

#### Match Creation (`/match/create`)
| testID | Element |
|--------|---------|
| `match-create-screen` | Root ScrollView |
| `match-format-t20` | T20 format Card |
| `match-format-odi` | ODI format Card |
| `match-format-test` | Test format Card |
| `match-format-custom` | Custom format Card |
| `match-format-custom-overs-input` | Custom overs TextInput |
| `match-format-next-btn` | Next button (format step) |
| `match-teams-next-btn` | Next button (teams step) |
| `match-xi-next-btn` | Next button (XI step) |
| `match-venue-input` | Venue TextInput |
| `match-venue-next-btn` | Next button (venue step) |
| `match-create-btn` | Create Match button (confirm step) |
| `match-step-back-btn` | Header back button |
| `match-progress-format` | Progress dot — format |
| `match-progress-teams` | Progress dot — teams |
| `match-progress-xi` | Progress dot — XI |
| `match-progress-venue` | Progress dot — venue |
| `match-progress-confirm` | Progress dot — confirm |

#### Toss Screen (`/match/[id]/toss`)
| testID | Element |
|--------|---------|
| `toss-screen` | Root View |
| `toss-team1-card` | Team 1 Card |
| `toss-team2-card` | Team 2 Card |
| `toss-winner-next-btn` | Next button (winner step) |
| `toss-decision-bat` | Bat decision Card |
| `toss-decision-bowl` | Bowl decision Card |
| `toss-back-btn` | Back button (decision step) |
| `toss-confirm-btn` | Confirm button |
| `toss-start-scoring-btn` | Start Scoring button |

#### Scoring Screen (`/match/[id]/scoring`)
| testID | Element |
|--------|---------|
| `scoring-screen` | Root View |
| `scoring-scorecard` | Mini scorecard Surface |
| `scoring-sync-chip` | Cloud sync status chip |
| `scoring-crr` | Current Run Rate text |
| `scoring-rrr` | Required Run Rate text |
| `scoring-controls` | Scoring controls container |
| `score-extra-wide` | Wide toggle Pressable |
| `score-extra-noball` | No-Ball toggle Pressable |
| `score-extra-bye` | Bye toggle Pressable |
| `score-extra-legbye` | Leg-bye toggle Pressable |
| `score-run-0` … `score-run-6` | Run buttons |
| `score-wicket-btn` | Wicket (W) button |
| `score-undo-btn` | Undo button |
| `score-abandon-btn` | Abandon button |
| `scoring-opener-modal` | Opener selection Modal |
| `scoring-striker-section` | Striker ScrollView |
| `scoring-nonstriker-section` | Non-striker ScrollView |
| `scoring-opener1-{id}` | Opener 1 Pressable (per player) |
| `scoring-opener2-{id}` | Opener 2 Pressable (per player) |
| `scoring-confirm-openers-btn` | Confirm openers button |
| `scoring-bowler-modal` | Bowler selection Modal |
| `scoring-bowler-{id}` | Bowler Pressable (per player) |
| `scoring-confirm-bowler-btn` | Confirm bowler button |
| `scoring-wicket-modal` | Wicket Modal |
| `scoring-dismissed-striker` | Striker dismissal Pressable |
| `scoring-dismissed-nonstriker` | Non-striker dismissal Pressable |
| `score-dismissal-{type}` | Dismissal type buttons |
| `scoring-fielder-section` | Fielder ScrollView |
| `scoring-fielder-{id}` | Fielder Pressable (per player) |
| `scoring-wicket-cancel-btn` | Cancel button in wicket modal |
| `score-confirm-wicket-btn` | Confirm wicket button |
| `scoring-new-batter-modal` | New batter Modal |
| `scoring-new-batter-{id}` | New batter Pressable (per player) |
| `scoring-confirm-batter-btn` | Confirm batter button |
| `scoring-combined-batter-bowler-modal` | Combined batter+bowler Modal |
| `scoring-confirm-batter-bowler-btn` | Confirm combined modal button |
| `scoring-innings-complete-modal` | Innings complete Modal |
| `scoring-start-next-innings-btn` | Start Next Innings button |
| `scoring-finish-btn` | Finish match button |
| `scoring-match-complete` | Match complete container |
| `scoring-view-scorecard-btn` | View Scorecard button |
| `scoring-undo-dialog` | Undo confirmation Dialog |
| `scoring-undo-cancel-btn` | Undo dialog Cancel button |
| `scoring-undo-confirm-btn` | Undo dialog Confirm button |
| `scoring-abandon-dialog` | Abandon confirmation Dialog |
| `scoring-abandon-cancel-btn` | Abandon dialog Cancel button |
| `scoring-abandon-confirm-btn` | Abandon dialog Confirm button |
| `scoring-zone-modal` | Zone selector Modal |
| `scoring-zone-{idx}` | Zone Pressable (0–11) |
| `scoring-zone-skip-btn` | Skip zone button |

#### Upgrade Screen (`/upgrade`)
| testID | Element |
|--------|---------|
| `upgrade-screen` | Root View |
| `upgrade-billing-toggle` | Billing toggle container |
| `upgrade-billing-monthly` | Monthly button |
| `upgrade-billing-annual` | Annual button |
| `upgrade-tier-free` | Free tier card |
| `upgrade-tier-pro` | Pro tier card |
| `upgrade-tier-league` | League tier card |
| `upgrade-current-plan-badge` | "Current plan" badge |
| `upgrade-pro-btn` | Upgrade to Pro button |
| `upgrade-league-btn` | Upgrade to League button |
| `upgrade-restore-btn` | Restore Purchases button |
| `upgrade-back-btn` | Back/close button |

## Notes on Real-Time Tests

`12_cloud_sync_realtime.yaml` verifies the sync indicator and live score display.
For full real-time validation, run this flow on two devices simultaneously:
- **Device A**: scoring flow (records balls)
- **Device B**: `12_cloud_sync_realtime.yaml` (observes live updates)

The sync chip transitions: `idle → Syncing… → Synced` within ~3 seconds
on a good connection. On a real device with airplane mode you should see `Offline`.
