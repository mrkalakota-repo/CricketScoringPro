-- Gully Cricket Scorer — Supabase Cloud Setup
-- Run this entire script in the Supabase SQL Editor
-- Dashboard → SQL Editor → New query → paste → Run
-- Safe to re-run: uses IF NOT EXISTS / IF NOT EXISTS on all objects.

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

-- ── Row Level Security (allow public anonymous discovery) ─────────────────────

ALTER TABLE public.cloud_teams   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cloud_players ENABLE ROW LEVEL SECURITY;

-- Anyone can read teams (needed for discovery)
DO $$ BEGIN
  CREATE POLICY "public_select_teams" ON public.cloud_teams FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "public_insert_teams" ON public.cloud_teams FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "public_update_teams" ON public.cloud_teams FOR UPDATE USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "public_delete_teams" ON public.cloud_teams FOR DELETE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Same for players
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

DO $$ BEGIN
  CREATE POLICY "public_select_delegate_codes" ON public.delegate_codes FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "public_insert_delegate_codes" ON public.delegate_codes FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "public_update_delegate_codes" ON public.delegate_codes FOR UPDATE USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

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

DO $$ BEGIN
  CREATE POLICY "public_delete_live" ON public.live_matches FOR DELETE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── User Profiles (cross-device login) ────────────────────────────────────────
-- Stores phone + name + SHA-256 PIN hash so a user can restore their profile
-- on a new device by entering their phone number and PIN.
-- NOTE: PIN hashes are readable by anyone with the anon key. 4–6 digit PINs
-- have a small keyspace — this is acceptable for a low-stakes community app
-- but should be upgraded (e.g. bcrypt via a Postgres function) for production.

CREATE TABLE IF NOT EXISTS public.user_profiles (
  phone      TEXT             PRIMARY KEY,
  name       TEXT             NOT NULL,
  pin_hash   TEXT             NOT NULL,
  updated_at BIGINT           NOT NULL DEFAULT 0
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "public_select_user_profiles" ON public.user_profiles FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "public_insert_user_profiles" ON public.user_profiles FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "public_update_user_profiles" ON public.user_profiles FOR UPDATE USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
