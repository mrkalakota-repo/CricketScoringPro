# Inningsly — External Integrations

A reference for every third-party service the app connects to: what it does, why we use it, which parts of the codebase own the integration, and what credentials are required.

---

## 1. Supabase

**Role:** Cloud backend — database, real-time subscriptions, authentication RPC, and Edge Function hosting.

### Why Supabase
We needed a hosted Postgres database with real-time row-change events, a serverless function runtime, and a generous free tier — all without managing infrastructure. Supabase gives us all three and its JS client works in both React Native and mobile web without any native modules.

### What we use it for

| Feature | Supabase mechanism |
|---|---|
| User profiles (phone + PIN hash, role, plan) | `user_profiles` table + `verify_user_profile()` RPC |
| Team discovery (proximity, ownership sync) | `cloud_teams` + `cloud_players` tables |
| Live match broadcasting | `live_matches` table — upserted on every ball |
| Nearby live scores | Supabase Realtime subscription on `live_matches` |
| Team chat | `chat_messages` table + Realtime subscription |
| Delegate codes | `delegate_codes` table (single-use, 10-min TTL) |
| League & fixture sync | `cloud_leagues` + `cloud_league_fixtures` tables |
| Edge Functions | `send-otp` and `verify-otp` (see §3 Twilio below) |

### Key files
- [src/config/supabase.ts](../src/config/supabase.ts) — client init, `isCloudEnabled` flag, key format validation
- [src/db/repositories/cloud-team-repo.ts](../src/db/repositories/cloud-team-repo.ts)
- [src/db/repositories/cloud-match-repo.ts](../src/db/repositories/cloud-match-repo.ts)
- [src/db/repositories/cloud-user-repo.ts](../src/db/repositories/cloud-user-repo.ts)
- [src/db/repositories/cloud-chat-repo.ts](../src/db/repositories/cloud-chat-repo.ts)
- [src/db/repositories/cloud-delegate-repo.ts](../src/db/repositories/cloud-delegate-repo.ts)
- [src/db/repositories/cloud-league-repo.ts](../src/db/repositories/cloud-league-repo.ts)
- [supabase/functions/](../supabase/functions/) — Edge Function source

### Required env vars
```
EXPO_PUBLIC_SUPABASE_URL=https://<project-id>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

Both the legacy JWT format (`eyJ...`, length > 100) and the new publishable format (`sb_publishable_...`) are accepted — validation is in `src/config/supabase.ts`.

### Schema setup
Run `supabase-setup.sql` in the Supabase SQL Editor (idempotent — safe to re-run).

### Graceful degradation
Every cloud call is guarded by `isCloudEnabled`. `PGRST205` (schema-cache miss / table not found) errors are silently swallowed so the app works fully offline with zero Supabase credentials.

---

## 2. RevenueCat

**Role:** In-app purchase management and subscription entitlements.

### Why RevenueCat
Managing StoreKit (iOS) and Google Play Billing directly is complex and error-prone. RevenueCat abstracts both stores behind a single SDK, handles receipt validation server-side, and provides a dashboard for subscription analytics and customer lookup.

### What we use it for

| Feature | RevenueCat mechanism |
|---|---|
| Plan detection (`free` / `pro` / `league`) | `getCurrentPlan()` → maps active entitlements to plan string |
| Purchase flow | `purchasePackage()` from the offerings API |
| User identity | `loginPurchasesUser(phone)` on auth — ties the RC anonymous ID to the user's phone number so subscriptions persist across reinstalls |
| Sign-out | `logoutPurchasesUser()` — returns to anonymous RC identity |

### Key files
- [src/services/purchases.ts](../src/services/purchases.ts) — native implementation (iOS + Android). Exports `configurePurchases`, `getCurrentPlan`, `purchasePackage`, `loginPurchasesUser`, `logoutPurchasesUser`.
- [src/services/purchases.web.ts](../src/services/purchases.web.ts) — web stub. Returns `'free'` plan and no-ops for all other calls. Prevents `@revenuecat/purchases-js` and its Stripe.js dependency from being bundled into the web output (Metro platform resolution).
- [src/hooks/usePlan.ts](../src/hooks/usePlan.ts) — central plan authority consumed by all feature gates and `UpgradeSheet`.

### Required env vars
```
EXPO_PUBLIC_RC_API_KEY_IOS=appl_...
EXPO_PUBLIC_RC_API_KEY_ANDROID=goog_...
```

When both keys are absent (e.g. web, CI), `configurePurchases()` is a no-op and `getCurrentPlan()` returns `'free'`. No crash, no setup required for development.

### Plan limits
Defined in `src/hooks/usePlan.ts` as `PLAN_LIMITS`:

| Feature | free | pro | league |
|---|:---:|:---:|:---:|
| Team chat | ❌ | ✅ | ✅ |
| Cloud sync | ❌ | ✅ | ✅ |
| Export scorecard | ❌ | ✅ | ✅ |
| NRR standings | ❌ | ❌ | ✅ |
| Public scoreboard | ❌ | ❌ | ✅ |
| Data export (CSV) | ❌ | ❌ | ✅ |

Web is hard-capped to `'free'` regardless of RevenueCat response (IAP not available on web).

---

## 3. Twilio Verify (via Supabase Edge Functions)

**Role:** Phone number verification — SMS OTP for registration and account restore.

### Why Twilio
Twilio Verify handles OTP delivery, rate-limiting, and expiry at the carrier level. We run it inside a Supabase Edge Function so the Twilio credentials are never exposed to the client.

### What we use it for

| Step | Edge Function | What it does |
|---|---|---|
| Send OTP | `supabase/functions/send-otp` | Rate-limits by phone, verifies Turnstile token (web only), calls Twilio Verify `create` to send SMS |
| Verify OTP | `supabase/functions/verify-otp` | Submits code to Twilio Verify `check`, on success returns the existing profile name + role for cross-device restore |

### Key files
- [supabase/functions/send-otp/index.ts](../supabase/functions/send-otp/index.ts)
- [supabase/functions/verify-otp/index.ts](../supabase/functions/verify-otp/index.ts)
- [src/db/repositories/cloud-user-repo.ts](../src/db/repositories/cloud-user-repo.ts) — `sendOtp()` / `verifyOtp()` client calls

### Required Supabase secrets (set in Supabase dashboard → Edge Functions → Secrets)
```
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_VERIFY_SERVICE_SID
```

### Deployment note
Always deploy with `--no-verify-jwt`:
```bash
supabase functions deploy send-otp --no-verify-jwt
supabase functions deploy verify-otp --no-verify-jwt
```
Without this flag Supabase re-enables JWT verification on every deploy and returns 401 to all clients (these functions are called with the anon key, not a user JWT).

---

## 4. Cloudflare Turnstile

**Role:** Bot protection on the phone-entry step of the web registration and account-restore flow.

### Why Turnstile
Without a CAPTCHA-equivalent, the SMS OTP endpoint would be vulnerable to automated phone enumeration and SMS flooding. Turnstile is invisible to real users (solves silently in most cases) and free.

### What we use it for
The Turnstile widget appears on the phone-number entry screen (web only). "Send OTP" is disabled until a token is received. The token is passed to `sendOtp(phone, token)` → `send-otp` Edge Function → Cloudflare server-side verification. If the token is absent (native apps, where the widget doesn't render), the Edge Function skips Turnstile verification entirely.

### Key files
- [src/components/TurnstileWidget.web.tsx](../src/components/TurnstileWidget.web.tsx) — injects the Cloudflare Turnstile script and renders the challenge widget. Site key is hardcoded here.
- [src/components/TurnstileWidget.tsx](../src/components/TurnstileWidget.tsx) — native stub (no-op `null` render).

### Required Supabase secret
```
TURNSTILE_SECRET_KEY    # server-side verification key — set in Supabase Edge Function secrets
```

The public site key is hardcoded in `TurnstileWidget.web.tsx` (safe to expose).

---

## 5. AWS Amplify

**Role:** Web hosting and CI/CD for the mobile web build.

### Why Amplify
We needed a static hosting service that could auto-deploy from GitHub `main` pushes without any manual step. Amplify gives us this plus a free SSL certificate and CDN.

### What we use it for
- Hosts the Expo web export (`dist/`) at the production web URL
- Auto-deploys on every push to `main` using the build config in `amplify.yml`
- Serves the `docs/` static marketing pages separately (they are **not** part of the Expo build)

### Key files
- [amplify.yml](../amplify.yml) — build spec: `npx expo export --platform web` → artifacts from `dist/`

### Notes
- No Amplify-specific SDK or import in the app code — it's purely a hosting layer
- `docs/` (index.html, privacy.html, support.html) are standalone static files, not imported by the app

---

## 6. Expo / EAS Build

**Role:** Native build pipeline for Android (Play Store) and iOS (App Store).

### Why EAS
EAS Build runs the native Android/iOS build in the cloud, eliminating the need for every developer to maintain a local Android SDK / Xcode setup. It also manages signing certificates and keystores.

### What we use it for

| Profile | Output | Purpose |
|---|---|---|
| `preview` | APK (`android.buildType: "apk"`) | Direct device install / QA testing |
| `production` | AAB (`android.buildType: "app-bundle"`) | Play Store submission |

### Key files
- [eas.json](../eas.json) — build profiles
- [app.json](../app.json) — `expo.android.package: "com.gullycricket.scorer"`, `versionCode` (bump before each store upload)
- [.npmrc](../.npmrc) — `legacy-peer-deps=true` (required — EAS npm install fails without it)
- [.easignore](../.easignore) — excludes `scripts/` to avoid `sharp` native binary errors in the build tarball

### Common commands
```bash
eas build --profile preview --platform android     # APK for testing
eas build --profile production --platform android  # AAB for Play Store

# After any app.json plugin / native config change:
npx expo prebuild --clean
```

---

## Summary table

| Service | Purpose | Credentials location | Required for |
|---|---|---|---|
| **Supabase** | Cloud DB, real-time, Edge Functions | `.env` (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`) | Live scores, chat, user auth, delegate codes, league sync |
| **RevenueCat** | Subscription management | `.env` (`EXPO_PUBLIC_RC_API_KEY_IOS`, `EXPO_PUBLIC_RC_API_KEY_ANDROID`) | Pro / League plan gating |
| **Twilio Verify** | SMS OTP | Supabase Edge Function secrets | Phone-number registration & restore |
| **Cloudflare Turnstile** | Bot protection | Supabase secret (server key); hardcoded site key in `TurnstileWidget.web.tsx` | Web OTP flow only |
| **AWS Amplify** | Web hosting & CI | Configured in Amplify console (no app-side credentials) | Web deployment |
| **Expo EAS** | Native builds | EAS account (`eas login`) + keystore managed by EAS | Android / iOS store builds |
