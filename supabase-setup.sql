-- Gully Cricket Scorer — Supabase Cloud Setup
-- Run this entire script in the Supabase SQL Editor
-- Dashboard → SQL Editor → New query → paste → Run

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
CREATE POLICY "public_select_teams"
  ON public.cloud_teams FOR SELECT USING (true);

-- Anyone can publish their team (insert + update via upsert)
CREATE POLICY "public_insert_teams"
  ON public.cloud_teams FOR INSERT WITH CHECK (true);

CREATE POLICY "public_update_teams"
  ON public.cloud_teams FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "public_delete_teams"
  ON public.cloud_teams FOR DELETE USING (true);

-- Same for players
CREATE POLICY "public_select_players"
  ON public.cloud_players FOR SELECT USING (true);

CREATE POLICY "public_insert_players"
  ON public.cloud_players FOR INSERT WITH CHECK (true);

CREATE POLICY "public_update_players"
  ON public.cloud_players FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "public_delete_players"
  ON public.cloud_players FOR DELETE USING (true);
