import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// Validate that the values are real credentials, not placeholders
const isValidUrl =
  SUPABASE_URL.startsWith('https://') &&
  SUPABASE_URL.includes('.supabase.co') &&
  !SUPABASE_URL.includes('your-project-ref');

const isValidKey =
  !SUPABASE_ANON_KEY.includes('your-anon-key') &&
  (SUPABASE_ANON_KEY.length > 100 || SUPABASE_ANON_KEY.startsWith('sb_publishable_'));

export const isCloudEnabled = isValidUrl && isValidKey;
export const SUPABASE_ANON_KEY_VALUE = SUPABASE_ANON_KEY;

if (!isCloudEnabled && (SUPABASE_URL || SUPABASE_ANON_KEY)) {
  console.warn('[supabase] Cloud sync disabled — fill in real credentials in .env');
}

/**
 * Returns true when the Supabase error indicates the schema or table doesn't exist yet
 * (PGRST205) or a single-row query returned no results (PGRST116).
 * Use this to decide whether to suppress an error vs. rethrow it.
 */
export function isSchemaNotReady(error: unknown, includePgrst116 = false): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === 'PGRST205' || (includePgrst116 && code === 'PGRST116');
}

export const supabase: SupabaseClient | null = isCloudEnabled
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: globalThis.fetch },
    })
  : null;
