/**
 * seed-teams.mjs
 *
 * Creates 2 sample cricket teams with 11 players each and publishes them
 * to Supabase (cloud_teams + cloud_players).
 *
 * Usage:
 *   node scripts/seed-teams.mjs --owner1 7046089917 --owner2 4049065277
 *   node scripts/seed-teams.mjs --owner 7046089917 --lat 35.0656 --lon -80.7198
 *
 * Options:
 *   --owner  <phone>   (required) 10-digit US phone number, e.g. 7046089917
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
const owner1Phone = argVal('--owner1') || ownerPhone;
const owner2Phone = argVal('--owner2') || ownerPhone;
const lat = argVal('--lat') !== null ? parseFloat(argVal('--lat')) : null;
const lon = argVal('--lon') !== null ? parseFloat(argVal('--lon')) : null;
const supabaseUrl = argVal('--url') || envVars['EXPO_PUBLIC_SUPABASE_URL'];
const supabaseKey = argVal('--key') || envVars['EXPO_PUBLIC_SUPABASE_ANON_KEY'];

if (!owner1Phone || !owner2Phone) {
  console.error('Error: owner phone(s) are required');
  console.error('Usage: node scripts/seed-teams.mjs --owner1 7046089917 --owner2 4049065277');
  console.error('       node scripts/seed-teams.mjs --owner 7046089917  (same owner for both)');
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
    lat: 35.0656,
    lon: -80.7198,
    players: [
      { name: 'Rohit Sharma',     phone: '1000000001', batting: 'right', bowling: 'Right-arm medium',    keeper: false, allRounder: false, captain: true,  vc: false },
      { name: 'Shubman Gill',     phone: '1000000002', batting: 'right', bowling: 'none',                keeper: false, allRounder: false, captain: false, vc: false },
      { name: 'Virat Kohli',      phone: '1000000003', batting: 'right', bowling: 'Right-arm medium',    keeper: false, allRounder: false, captain: false, vc: true  },
      { name: 'Suryakumar Yadav', phone: '1000000004', batting: 'right', bowling: 'none',                keeper: false, allRounder: false, captain: false, vc: false },
      { name: 'Hardik Pandya',    phone: '1000000005', batting: 'right', bowling: 'Right-arm fast',      keeper: false, allRounder: true,  captain: false, vc: false },
      { name: 'MS Dhoni',         phone: '1000000006', batting: 'right', bowling: 'none',                keeper: true,  allRounder: false, captain: false, vc: false },
      { name: 'Ravindra Jadeja',  phone: '1000000007', batting: 'left',  bowling: 'Left-arm orthodox',   keeper: false, allRounder: true,  captain: false, vc: false },
      { name: 'Jasprit Bumrah',   phone: '1000000008', batting: 'right', bowling: 'Right-arm fast',      keeper: false, allRounder: false, captain: false, vc: false },
      { name: 'Mohammed Shami',   phone: '1000000009', batting: 'right', bowling: 'Right-arm fast',      keeper: false, allRounder: false, captain: false, vc: false },
      { name: 'Kuldeep Yadav',    phone: '1000000010', batting: 'left',  bowling: 'Left-arm chinaman',   keeper: false, allRounder: false, captain: false, vc: false },
      { name: 'Arshdeep Singh',   phone: '1000000011', batting: 'left',  bowling: 'Left-arm fast',       keeper: false, allRounder: false, captain: false, vc: false },
    ],
  },
  {
    name: 'Delhi Thunders',
    shortName: 'DLT',
    lat: 35.2269,
    lon: -80.8431,
    players: [
      { name: 'KL Rahul',          phone: '2000000001', batting: 'right', bowling: 'none',                keeper: true,  allRounder: false, captain: true,  vc: false },
      { name: 'Prithvi Shaw',      phone: '2000000002', batting: 'right', bowling: 'Right-arm off-break', keeper: false, allRounder: false, captain: false, vc: false },
      { name: 'Shreyas Iyer',      phone: '2000000003', batting: 'right', bowling: 'none',                keeper: false, allRounder: false, captain: false, vc: true  },
      { name: 'Rishabh Pant',      phone: '2000000004', batting: 'left',  bowling: 'none',                keeper: false, allRounder: false, captain: false, vc: false },
      { name: 'Axar Patel',        phone: '2000000005', batting: 'left',  bowling: 'Left-arm orthodox',   keeper: false, allRounder: true,  captain: false, vc: false },
      { name: 'Harshal Patel',     phone: '2000000006', batting: 'right', bowling: 'Right-arm medium',    keeper: false, allRounder: false, captain: false, vc: false },
      { name: 'Anrich Nortje',     phone: '2000000007', batting: 'right', bowling: 'Right-arm fast',      keeper: false, allRounder: false, captain: false, vc: false },
      { name: 'Ishant Sharma',     phone: '2000000008', batting: 'right', bowling: 'Right-arm fast',      keeper: false, allRounder: false, captain: false, vc: false },
      { name: 'Shardul Thakur',    phone: '2000000009', batting: 'right', bowling: 'Right-arm medium',    keeper: false, allRounder: true,  captain: false, vc: false },
      { name: 'Yuzvendra Chahal',  phone: '2000000010', batting: 'right', bowling: 'Right-arm leg-break', keeper: false, allRounder: false, captain: false, vc: false },
      { name: 'Avesh Khan',        phone: '2000000011', batting: 'right', bowling: 'Right-arm fast',      keeper: false, allRounder: false, captain: false, vc: false },
    ],
  },
];

// ── Seed ───────────────────────────────────────────────────────────────────────
async function seedTeam(teamDef, teamOwner) {
  const teamId = randomUUID();
  const now = Date.now();

  console.log(`\nCreating team: ${teamDef.name} (${teamDef.shortName})`);

  // Upsert team
  const { error: teamErr } = await supabase.from('cloud_teams').upsert({
    id: teamId,
    name: teamDef.name,
    short_name: teamDef.shortName,
    owner_phone: teamOwner,
    latitude: teamDef.lat ?? lat ?? null,
    longitude: teamDef.lon ?? lon ?? null,
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
  console.log('Inningsly — Team Seeder');
  console.log('====================================');
  console.log(`Team 1 owner: ${owner1Phone}`);
  console.log(`Team 2 owner: ${owner2Phone}`);
  console.log(`Location    : ${lat != null && lon != null ? `${lat}, ${lon} (CLI override)` : 'per-team defaults'}`);
  console.log(`Supabase    : ${supabaseUrl}`);

  const owners = [owner1Phone, owner2Phone];
  const teamIds = [];
  for (let i = 0; i < TEAMS.length; i++) {
    const id = await seedTeam(TEAMS[i], owners[i]);
    teamIds.push(id);
  }

  console.log('\n✅ Done! Teams created:');
  TEAMS.forEach((t, i) => console.log(`  ${t.name} (${t.shortName})  owner=${owners[i]}  lat=${t.lat ?? lat ?? 'none'}  lon=${t.lon ?? lon ?? 'none'}  id=${teamIds[i]}`));
  console.log('\nSign in with each owner phone to see their team in the app.');
}

main().catch(err => {
  console.error('\n❌ Seeding failed:', err.message);
  process.exit(1);
});
