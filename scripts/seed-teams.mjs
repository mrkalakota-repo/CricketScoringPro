/**
 * seed-teams.mjs
 *
 * Creates 2 sample cricket teams with 11 players each and publishes them
 * to Supabase (cloud_teams + cloud_players).
 *
 * Usage:
 *   node scripts/seed-teams.mjs --owner +919876543210
 *   node scripts/seed-teams.mjs --owner +919876543210 --lat 37.7749 --lon -122.4194
 *
 * Options:
 *   --owner  <phone>   (required) Phone number of the team owner, e.g. +919876543210
 *   --lat    <number>  Latitude for proximity discovery (optional)
 *   --lon    <number>  Longitude for proximity discovery (optional)
 *   --url    <url>     Supabase project URL (defaults to EXPO_PUBLIC_SUPABASE_URL from .env)
 *   --key    <key>     Supabase anon key  (defaults to EXPO_PUBLIC_SUPABASE_ANON_KEY from .env)
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ── Load .env ──────────────────────────────────────────────────────────────────
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dir, '..', '.env');

function loadEnv(path) {
  try {
    const lines = readFileSync(path, 'utf8').split('\n');
    const env = {};
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    }
    return env;
  } catch {
    return {};
  }
}

const envVars = loadEnv(envPath);

// ── Parse CLI args ─────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function argVal(flag) {
  const i = args.indexOf(flag);
  return i !== -1 && i + 1 < args.length ? args[i + 1] : null;
}

const ownerPhone = argVal('--owner');
const lat = argVal('--lat') !== null ? parseFloat(argVal('--lat')) : null;
const lon = argVal('--lon') !== null ? parseFloat(argVal('--lon')) : null;
const supabaseUrl = argVal('--url') || envVars['EXPO_PUBLIC_SUPABASE_URL'];
const supabaseKey = argVal('--key') || envVars['EXPO_PUBLIC_SUPABASE_ANON_KEY'];

if (!ownerPhone) {
  console.error('Error: --owner <phone> is required');
  console.error('Usage: node scripts/seed-teams.mjs --owner +919876543210');
  process.exit(1);
}
if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Supabase credentials not found. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env or pass --url / --key.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ── Sample data ────────────────────────────────────────────────────────────────
const TEAMS = [
  {
    name: 'Mumbai Strikers',
    shortName: 'MBS',
    players: [
      { name: 'Rohit Sharma',     phone: '+911000000001', batting: 'right', bowling: 'Right-arm medium',    keeper: false, allRounder: false, captain: true,  vc: false },
      { name: 'Shubman Gill',     phone: '+911000000002', batting: 'right', bowling: 'none',                keeper: false, allRounder: false, captain: false, vc: false },
      { name: 'Virat Kohli',      phone: '+911000000003', batting: 'right', bowling: 'Right-arm medium',    keeper: false, allRounder: false, captain: false, vc: true  },
      { name: 'Suryakumar Yadav', phone: '+911000000004', batting: 'right', bowling: 'none',                keeper: false, allRounder: false, captain: false, vc: false },
      { name: 'Hardik Pandya',    phone: '+911000000005', batting: 'right', bowling: 'Right-arm fast',      keeper: false, allRounder: true,  captain: false, vc: false },
      { name: 'MS Dhoni',         phone: '+911000000006', batting: 'right', bowling: 'none',                keeper: true,  allRounder: false, captain: false, vc: false },
      { name: 'Ravindra Jadeja',  phone: '+911000000007', batting: 'left',  bowling: 'Left-arm orthodox',   keeper: false, allRounder: true,  captain: false, vc: false },
      { name: 'Jasprit Bumrah',   phone: '+911000000008', batting: 'right', bowling: 'Right-arm fast',      keeper: false, allRounder: false, captain: false, vc: false },
      { name: 'Mohammed Shami',   phone: '+911000000009', batting: 'right', bowling: 'Right-arm fast',      keeper: false, allRounder: false, captain: false, vc: false },
      { name: 'Kuldeep Yadav',    phone: '+911000000010', batting: 'left',  bowling: 'Left-arm chinaman',   keeper: false, allRounder: false, captain: false, vc: false },
      { name: 'Arshdeep Singh',   phone: '+911000000011', batting: 'left',  bowling: 'Left-arm fast',       keeper: false, allRounder: false, captain: false, vc: false },
    ],
  },
  {
    name: 'Delhi Thunders',
    shortName: 'DLT',
    players: [
      { name: 'KL Rahul',          phone: '+912000000001', batting: 'right', bowling: 'none',                keeper: true,  allRounder: false, captain: true,  vc: false },
      { name: 'Prithvi Shaw',      phone: '+912000000002', batting: 'right', bowling: 'Right-arm off-break', keeper: false, allRounder: false, captain: false, vc: false },
      { name: 'Shreyas Iyer',      phone: '+912000000003', batting: 'right', bowling: 'none',                keeper: false, allRounder: false, captain: false, vc: true  },
      { name: 'Rishabh Pant',      phone: '+912000000004', batting: 'left',  bowling: 'none',                keeper: false, allRounder: false, captain: false, vc: false },
      { name: 'Axar Patel',        phone: '+912000000005', batting: 'left',  bowling: 'Left-arm orthodox',   keeper: false, allRounder: true,  captain: false, vc: false },
      { name: 'Harshal Patel',     phone: '+912000000006', batting: 'right', bowling: 'Right-arm medium',    keeper: false, allRounder: false, captain: false, vc: false },
      { name: 'Anrich Nortje',     phone: '+912000000007', batting: 'right', bowling: 'Right-arm fast',      keeper: false, allRounder: false, captain: false, vc: false },
      { name: 'Ishant Sharma',     phone: '+912000000008', batting: 'right', bowling: 'Right-arm fast',      keeper: false, allRounder: false, captain: false, vc: false },
      { name: 'Shardul Thakur',    phone: '+912000000009', batting: 'right', bowling: 'Right-arm medium',    keeper: false, allRounder: true,  captain: false, vc: false },
      { name: 'Yuzvendra Chahal',  phone: '+912000000010', batting: 'right', bowling: 'Right-arm leg-break', keeper: false, allRounder: false, captain: false, vc: false },
      { name: 'Avesh Khan',        phone: '+912000000011', batting: 'right', bowling: 'Right-arm fast',      keeper: false, allRounder: false, captain: false, vc: false },
    ],
  },
];

// ── Seed ───────────────────────────────────────────────────────────────────────
async function seedTeam(teamDef) {
  const teamId = randomUUID();
  const now = Date.now();

  console.log(`\nCreating team: ${teamDef.name} (${teamDef.shortName})`);

  // Upsert team
  const { error: teamErr } = await supabase.from('cloud_teams').upsert({
    id: teamId,
    name: teamDef.name,
    short_name: teamDef.shortName,
    owner_phone: ownerPhone,
    latitude: lat ?? null,
    longitude: lon ?? null,
    updated_at: now,
  });
  if (teamErr) throw new Error(`cloud_teams upsert failed: ${teamErr.message}`);
  console.log(`  ✓ Team inserted  id=${teamId}`);

  // Insert players
  const players = teamDef.players.map(p => ({
    id: randomUUID(),
    team_id: teamId,
    name: p.name,
    phone_number: p.phone,
    batting_style: p.batting,
    bowling_style: p.bowling,
    is_wicket_keeper: p.keeper,
    is_all_rounder: p.allRounder,
    is_captain: p.captain,
    is_vice_captain: p.vc,
  }));

  const { error: playerErr } = await supabase.from('cloud_players').insert(players);
  if (playerErr) throw new Error(`cloud_players insert failed: ${playerErr.message}`);
  console.log(`  ✓ ${players.length} players inserted`);

  return teamId;
}

async function main() {
  console.log('Gully Cricket Scorer — Team Seeder');
  console.log('====================================');
  console.log(`Owner phone : ${ownerPhone}`);
  console.log(`Location   : ${lat != null && lon != null ? `${lat}, ${lon}` : 'not set (proximity disabled)'}`);
  console.log(`Supabase   : ${supabaseUrl}`);

  const teamIds = [];
  for (const teamDef of TEAMS) {
    const id = await seedTeam(teamDef);
    teamIds.push(id);
  }

  console.log('\n✅ Done! Teams created:');
  TEAMS.forEach((t, i) => console.log(`  ${t.name} (${t.shortName})  id=${teamIds[i]}`));
  console.log('\nSign in with the owner phone to see these teams in the app.');
}

main().catch(err => {
  console.error('\n❌ Seeding failed:', err.message);
  process.exit(1);
});
