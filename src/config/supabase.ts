import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// Validate that the values are real credentials, not placeholders
const isValidUrl =
  SUPABASE_URL.startsWith('https://') &&
  SUPABASE_URL.includes('.supabase.co') &&
  !SUPABASE_URL.includes('your-project-ref');

const isValidKey =
  SUPABASE_ANON_KEY.length > 100 &&
  !SUPABASE_ANON_KEY.includes('your-anon-key');

export const isCloudEnabled = isValidUrl && isValidKey;

if (!isCloudEnabled && (SUPABASE_URL || SUPABASE_ANON_KEY)) {
  console.warn('[supabase] Cloud sync disabled — fill in real credentials in .env');
}

export const supabase: SupabaseClient | null = isCloudEnabled
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: globalThis.fetch },
    })
  : null;
