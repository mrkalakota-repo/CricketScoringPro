-- Gully Cricket Scorer — Supabase Cloud Setup
-- Run this entire script in the Supabase SQL Editor
-- Dashboard → SQL Editor → New query → paste → Run
-- Safe to re-run: uses IF NOT EXISTS / exception-swallowing DO blocks on all objects.

-- ── Extensions ───────────────────────────────────────────────────────────────

-- pgcrypto: used for bcrypt PIN hashing in verify_user_profile()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Tables ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cloud_teams (
  id         TEXT             PRIMARY KEY,
  name       TEXT             NOT NULL,
  short_name TEXT             NOT NULL,
  latitude   DOUBLE PRECISION,
  longitude  DOUBLE PRECISION,
  updated_at BIGINT           NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.cloud_players (
  id               TEXT    PRIMARY KEY,
  team_id          TEXT    NOT NULL REFERENCES public.cloud_teams (id) ON DELETE CASCADE,
  name             TEXT    NOT NULL,
  batting_style    TEXT    NOT NULL DEFAULT 'right',
  bowling_style    TEXT    NOT NULL DEFAULT 'none',
  is_wicket_keeper BOOLEAN NOT NULL DEFAULT FALSE,
  is_all_rounder   BOOLEAN NOT NULL DEFAULT FALSE,
  is_captain       BOOLEAN NOT NULL DEFAULT FALSE
);

-- ── Indexes for proximity queries ─────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_cloud_teams_location
  ON public.cloud_teams (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cloud_players_team
  ON public.cloud_players (team_id);

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE public.cloud_teams   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cloud_players ENABLE ROW LEVEL SECURITY;

-- Teams: anyone can read (proximity discovery); INSERT/UPDATE allowed anonymously.
-- DELETE excluded — orphaned cloud records are harmless; removing DELETE from the
-- anonymous API eliminates a potential data-destruction attack surface.
DO $$ BEGIN
  CREATE POLICY "public_select_teams" ON public.cloud_teams FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "public_insert_teams" ON public.cloud_teams FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "public_update_teams" ON public.cloud_teams FOR UPDATE USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Players: read + upsert. DELETE retained because publishTeam() deletes-then-reinserts
-- to replace the full roster. Team-scoped (team_id FK → cloud_teams) limits blast radius.
DO $$ BEGIN
  CREATE POLICY "public_select_players" ON public.cloud_players FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "public_insert_players" ON public.cloud_players FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "public_update_players" ON public.cloud_players FOR UPDATE USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "public_delete_players" ON public.cloud_players FOR DELETE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Team owner (cross-device ownership restoration) ───────────────────────────
-- Identifies which user created the team. Used by fetchTeamsByOwner() to restore
-- myTeamIds on a new device after account restore, enforcing the 1-team-per-user rule.

ALTER TABLE public.cloud_teams ADD COLUMN IF NOT EXISTS owner_phone TEXT;

-- ── Vice Captain column ───────────────────────────────────────────────────────

ALTER TABLE public.cloud_players ADD COLUMN IF NOT EXISTS is_vice_captain BOOLEAN NOT NULL DEFAULT FALSE;

-- ── Player phone number (cross-team identity key) ─────────────────────────────

ALTER TABLE public.cloud_players ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- ── Delegate Codes ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.delegate_codes (
  team_id    TEXT   PRIMARY KEY,
  code       TEXT   NOT NULL,
  expires_at BIGINT NOT NULL
);

ALTER TABLE public.delegate_codes ENABLE ROW LEVEL SECURITY;

-- SELECT only returns non-expired codes — prevents scanning/replaying historical codes.
DO $$ BEGIN
  CREATE POLICY "select_valid_delegate_codes" ON public.delegate_codes
    FOR SELECT USING (expires_at > (EXTRACT(EPOCH FROM now()) * 1000)::BIGINT);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "public_insert_delegate_codes" ON public.delegate_codes FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- UPDATE intentionally excluded: delegate codes are single-use (INSERT then DELETE).
-- Removing UPDATE prevents an attacker from extending a code's expiry or replacing the code value.
DO $$ BEGIN
  DROP POLICY IF EXISTS "public_update_delegate_codes" ON public.delegate_codes;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "public_delete_delegate_codes" ON public.delegate_codes FOR DELETE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Chat Messages ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id          UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     TEXT   NOT NULL,
  player_id   TEXT   NOT NULL,
  player_name TEXT   NOT NULL,
  text        TEXT   NOT NULL,
  created_at  BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_team_created
  ON public.chat_messages (team_id, created_at DESC);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "public_select_chat" ON public.chat_messages FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "public_insert_chat" ON public.chat_messages FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Live Match Scores (proximity broadcast) ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.live_matches (
  id            TEXT             PRIMARY KEY,
  team1_name    TEXT             NOT NULL,
  team1_short   TEXT             NOT NULL,
  team2_name    TEXT             NOT NULL,
  team2_short   TEXT             NOT NULL,
  format        TEXT             NOT NULL,
  venue         TEXT             NOT NULL DEFAULT '',
  status        TEXT             NOT NULL DEFAULT 'in_progress',
  innings_num   INTEGER          NOT NULL DEFAULT 1,
  batting_short TEXT             NOT NULL DEFAULT '',
  score         INTEGER          NOT NULL DEFAULT 0,
  wickets       INTEGER          NOT NULL DEFAULT 0,
  overs         INTEGER          NOT NULL DEFAULT 0,
  balls         INTEGER          NOT NULL DEFAULT 0,
  target        INTEGER,
  result        TEXT,
  latitude      DOUBLE PRECISION,
  longitude     DOUBLE PRECISION,
  updated_at    BIGINT           NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_live_matches_location
  ON public.live_matches (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_live_matches_updated
  ON public.live_matches (updated_at DESC);

ALTER TABLE public.live_matches ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "public_select_live" ON public.live_matches FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "public_insert_live" ON public.live_matches FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "public_update_live" ON public.live_matches FOR UPDATE USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- DELETE intentionally excluded — matches transition to status='completed', never deleted anonymously.

-- ── User Profiles (cross-device login) ────────────────────────────────────────
-- PIN hashes are NEVER returned directly to API clients. All PIN verification goes
-- through the verify_user_profile() RPC (SECURITY DEFINER) which returns profile
-- data (without the hash) only when the correct PIN is supplied.

CREATE TABLE IF NOT EXISTS public.user_profiles (
  phone      TEXT             PRIMARY KEY,
  name       TEXT             NOT NULL,
  pin_hash   TEXT             NOT NULL,
  role       TEXT             NOT NULL DEFAULT 'scorer',
  updated_at BIGINT           NOT NULL DEFAULT 0
);

-- Add role column for existing deployments (idempotent)
DO $$ BEGIN
  ALTER TABLE public.user_profiles ADD COLUMN role TEXT NOT NULL DEFAULT 'scorer';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- No SELECT policy — direct table reads are intentionally blocked.
-- All reads go through verify_user_profile() RPC below.

DO $$ BEGIN
  CREATE POLICY "public_insert_user_profiles" ON public.user_profiles FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "public_update_user_profiles" ON public.user_profiles
    FOR UPDATE USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Server-side PIN verification RPC ─────────────────────────────────────────
-- verify_user_profile(p_phone, p_pin_hash)
--
-- The client computes SHA-256(pin) locally and sends only the hash.
-- This function verifies it server-side and returns (name, role, found, pin_correct)
-- WITHOUT ever sending the stored hash back to the client.
--
-- Hash upgrade path (transparent to clients):
--   • Legacy records: stored as raw SHA-256 hex — compared directly on first login,
--     then immediately re-stored as bcrypt(SHA-256) for future logins.
--   • New / upgraded records: stored as bcrypt(SHA-256) — verified via crypt().
--
-- Runs as SECURITY DEFINER to bypass the no-SELECT RLS on user_profiles.

CREATE OR REPLACE FUNCTION public.verify_user_profile(
  p_phone    TEXT,
  p_pin_hash TEXT   -- SHA-256 hex of the user's PIN, computed client-side
)
RETURNS TABLE (
  name        TEXT,
  role        TEXT,
  found       BOOLEAN,
  pin_correct BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_row   public.user_profiles%ROWTYPE;
  v_match BOOLEAN := FALSE;
BEGIN
  SELECT * INTO v_row FROM public.user_profiles WHERE phone = p_phone;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::TEXT, NULL::TEXT, FALSE, FALSE;
    RETURN;
  END IF;

  -- Two supported hash formats:
  --   bcrypt  → pin_hash starts with '$2' (e.g. '$2a$', '$2b$')
  --   legacy  → raw SHA-256 hex (64 chars)
  IF v_row.pin_hash LIKE '$2%' THEN
    v_match := (crypt(p_pin_hash, v_row.pin_hash) = v_row.pin_hash);
  ELSE
    v_match := (v_row.pin_hash = p_pin_hash);
  END IF;

  IF v_match THEN
    -- Opportunistically upgrade legacy SHA-256 hash to bcrypt on successful login.
    IF v_row.pin_hash NOT LIKE '$2%' THEN
      UPDATE public.user_profiles
        SET pin_hash = crypt(p_pin_hash, gen_salt('bf', 10))
        WHERE phone = p_phone;
    END IF;
    RETURN QUERY SELECT v_row.name, v_row.role, TRUE, TRUE;
  ELSE
    RETURN QUERY SELECT NULL::TEXT, NULL::TEXT, TRUE, FALSE;
  END IF;
END;
$$;

-- Grant execute to the anon and authenticated roles used by the Supabase JS client.
GRANT EXECUTE ON FUNCTION public.verify_user_profile(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_user_profile(TEXT, TEXT) TO authenticated;

-- ── Cloud Leagues (cross-device sync, owner-scoped) ───────────────────────────

CREATE TABLE IF NOT EXISTS public.cloud_leagues (
  id          TEXT   PRIMARY KEY,
  name        TEXT   NOT NULL,
  short_name  TEXT   NOT NULL,
  team_ids    TEXT   NOT NULL DEFAULT '[]',
  format      TEXT   NOT NULL DEFAULT 'round_robin',
  owner_phone TEXT   NOT NULL,
  updated_at  BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_cloud_leagues_owner
  ON public.cloud_leagues (owner_phone);

CREATE TABLE IF NOT EXISTS public.cloud_league_fixtures (
  id              TEXT   PRIMARY KEY,
  league_id       TEXT   NOT NULL REFERENCES public.cloud_leagues (id) ON DELETE CASCADE,
  team1_id        TEXT   NOT NULL,
  team2_id        TEXT   NOT NULL,
  match_id        TEXT,
  venue           TEXT   NOT NULL DEFAULT '',
  scheduled_date  BIGINT NOT NULL DEFAULT 0,
  status          TEXT   NOT NULL DEFAULT 'scheduled',
  result          TEXT,
  team1_score     TEXT,
  team2_score     TEXT,
  winner_team_id  TEXT,
  nrr_data_json   TEXT,
  round           INTEGER,
  bracket_slot    INTEGER,
  updated_at      BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_cloud_league_fixtures_league
  ON public.cloud_league_fixtures (league_id);

ALTER TABLE public.cloud_leagues          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cloud_league_fixtures  ENABLE ROW LEVEL SECURITY;

-- Leagues: any authenticated/anon client can read (filtered by owner_phone in app code).
-- INSERT/UPDATE/DELETE all allowed — ownership enforced at app layer via owner_phone.
DO $$ BEGIN
  CREATE POLICY "public_select_cloud_leagues" ON public.cloud_leagues FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "public_insert_cloud_leagues" ON public.cloud_leagues FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "public_update_cloud_leagues" ON public.cloud_leagues FOR UPDATE USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "public_delete_cloud_leagues" ON public.cloud_leagues FOR DELETE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Fixtures: cascade from league ownership.
DO $$ BEGIN
  CREATE POLICY "public_select_cloud_fixtures" ON public.cloud_league_fixtures FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "public_insert_cloud_fixtures" ON public.cloud_league_fixtures FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "public_update_cloud_fixtures" ON public.cloud_league_fixtures FOR UPDATE USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "public_delete_cloud_fixtures" ON public.cloud_league_fixtures FOR DELETE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Cloud Match States (full match history, cross-device) ─────────────────────
-- Stores the complete match engine state JSON for every match.
-- Updated on every ball (same cadence as live_matches).
-- Retained for 7 days; cleanup is the responsibility of scheduled Supabase jobs
-- or the app (delete on match deletion).

CREATE TABLE IF NOT EXISTS public.cloud_match_states (
  id               TEXT   PRIMARY KEY,
  team1_name       TEXT   NOT NULL,
  team1_short      TEXT   NOT NULL,
  team2_name       TEXT   NOT NULL,
  team2_short      TEXT   NOT NULL,
  format           TEXT   NOT NULL,
  venue            TEXT   NOT NULL DEFAULT '',
  status           TEXT   NOT NULL DEFAULT 'in_progress',
  result           TEXT,
  owner_phone      TEXT,
  match_state_json TEXT   NOT NULL,
  match_date       BIGINT NOT NULL DEFAULT 0,
  updated_at       BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_cloud_match_states_updated
  ON public.cloud_match_states (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_cloud_match_states_owner
  ON public.cloud_match_states (owner_phone);

ALTER TABLE public.cloud_match_states ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "public_select_match_states" ON public.cloud_match_states FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "public_insert_match_states" ON public.cloud_match_states FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "public_update_match_states" ON public.cloud_match_states FOR UPDATE USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "public_delete_match_states" ON public.cloud_match_states FOR DELETE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Match Invitations (two-team acceptance before match starts) ───────────────
-- When a match is created, an invitation row is written here.
-- team1 is the creator (auto-accepted); team2 must explicitly accept.
-- status: 'pending' | 'accepted' | 'declined'
-- Expires after 24 hours (app layer treats expired = declined).

CREATE TABLE IF NOT EXISTS public.match_invitations (
  match_id          TEXT   PRIMARY KEY,
  team1_id          TEXT   NOT NULL,
  team2_id          TEXT   NOT NULL,
  team1_name        TEXT   NOT NULL,
  team2_name        TEXT   NOT NULL,
  format            TEXT   NOT NULL,
  venue             TEXT   NOT NULL DEFAULT '',
  team1_owner_phone TEXT   NOT NULL,
  team2_owner_phone TEXT   NOT NULL,
  status            TEXT   NOT NULL DEFAULT 'pending',
  created_at        BIGINT NOT NULL DEFAULT 0,
  expires_at        BIGINT NOT NULL DEFAULT 0,
  match_state_json  TEXT            DEFAULT ''
);
-- Add column to existing tables (idempotent)
DO $$ BEGIN
  ALTER TABLE public.match_invitations ADD COLUMN match_state_json TEXT DEFAULT '';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_match_invitations_team2
  ON public.match_invitations (team2_owner_phone);

CREATE INDEX IF NOT EXISTS idx_match_invitations_team1
  ON public.match_invitations (team1_owner_phone);

ALTER TABLE public.match_invitations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "public_select_match_invitations" ON public.match_invitations FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "public_insert_match_invitations" ON public.match_invitations FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "public_update_match_invitations" ON public.match_invitations FOR UPDATE USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "public_delete_match_invitations" ON public.match_invitations FOR DELETE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Realtime Publication ───────────────────────────────────────────────────────
-- Tables that use Supabase Realtime subscriptions must be added to the
-- supabase_realtime publication. REPLICA IDENTITY FULL is required for filtered
-- subscriptions (e.g. filter: 'team_id=eq.xxx') to receive the full row payload.
--
-- Tables subscribed to in app code:
--   live_matches       → subscribeToLiveMatches()      (proximity live scores)
--   chat_messages      → subscribeToMessages()         (per-team chat, filtered by team_id)
--   match_invitations  → subscribeToInvitations()      (filtered by team2_owner_phone)
--                      → subscribeToMyMatchInvitation() (filtered by match_id)

ALTER TABLE public.live_matches      REPLICA IDENTITY FULL;
ALTER TABLE public.chat_messages     REPLICA IDENTITY FULL;
ALTER TABLE public.match_invitations REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.live_matches;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.match_invitations;
EXCEPTION WHEN others THEN NULL; END $$;
