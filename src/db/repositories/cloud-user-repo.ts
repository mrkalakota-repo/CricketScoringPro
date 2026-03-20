import { supabase, isCloudEnabled } from '../../config/supabase';

export interface CloudUserProfile {
  phone: string;
  name: string;
  /** Never populated from server responses — verification happens via RPC. */
  pinHash: string;
  role?: string; // UserRole
}

export type VerifyResult =
  | { status: 'not_found' }
  | { status: 'wrong_pin' }
  | { status: 'ok'; name: string; role: string }
  | { status: 'error'; message: string };

/**
 * Push (upsert) a user profile to Supabase so it can be restored on another device.
 * Silently no-ops if cloud is disabled or the table doesn't exist yet (PGRST205).
 */
export async function pushUserProfile(profile: CloudUserProfile): Promise<void> {
  if (!isCloudEnabled || !supabase) return;
  try {
    const { error } = await supabase.from('user_profiles').upsert({
      phone: profile.phone,
      name: profile.name,
      pin_hash: profile.pinHash,
      role: profile.role ?? 'scorer',
      updated_at: Date.now(),
    });
    if (error && (error as { code?: string }).code !== 'PGRST205') throw error;
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code !== 'PGRST205') {
      // Log error code/message only — never log profile data (phone, name, pinHash)
    console.error('[cloud-user-repo] pushUserProfile failed:', (err as { code?: string; message?: string })?.code, (err as Error).message);
    }
  }
}

/**
 * Verify a user's PIN server-side via the verify_user_profile() RPC.
 *
 * The PIN hash is computed client-side (SHA-256) and sent to the server.
 * The server verifies it without ever returning the stored hash to the client.
 * On success the server returns (name, role) so the profile can be restored locally.
 *
 * Returns a typed VerifyResult — callers should handle all four states.
 */
export async function verifyUserProfile(
  phone: string,
  pinHash: string,
): Promise<VerifyResult> {
  if (!isCloudEnabled || !supabase) {
    return { status: 'error', message: 'Cloud not enabled' };
  }
  try {
    const { data, error } = await supabase.rpc('verify_user_profile', {
      p_phone: phone,
      p_pin_hash: pinHash,
    });

    if (error) {
      const code = (error as { code?: string }).code;
      // PGRST205 = table/function not found — degrade gracefully
      if (code === 'PGRST205') return { status: 'error', message: 'Cloud table not ready' };
      throw error;
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return { status: 'error', message: 'Empty RPC response' };

    if (!row.found) return { status: 'not_found' };
    if (!row.pin_correct) return { status: 'wrong_pin' };
    return { status: 'ok', name: row.name as string, role: (row.role as string) ?? 'scorer' };
  } catch (err) {
    const message = (err as { message?: string })?.message ?? String(err);
    console.error('[cloud-user-repo] verifyUserProfile failed:', message);
    return { status: 'error', message };
  }
}
