import { supabase, isCloudEnabled, isSchemaNotReady } from '../../config/supabase';

export interface CloudUserProfile {
  phone: string;
  name: string;
  /** Never populated from server responses — verification happens via RPC. */
  pinHash: string;
  role?: string; // UserRole
  plan?: string; // UserPlan — optional; missing → 'free'
}

export type VerifyResult =
  | { status: 'not_found' }
  | { status: 'wrong_pin' }
  | { status: 'ok'; name: string; role: string; plan: string }
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
      plan: profile.plan ?? 'free',
      updated_at: Date.now(),
    });
    if (error && !isSchemaNotReady(error)) throw error;
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (!isSchemaNotReady({ code })) {
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
const SCHEMA_CACHE_PHRASE = 'schema cache';
const RETRY_DELAY_MS = 2500;
const MAX_RETRIES = 3;

function isSchemaCacheError(msg: string): boolean {
  return msg.toLowerCase().includes(SCHEMA_CACHE_PHRASE);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function verifyUserProfile(
  phone: string,
  pinHash: string,
): Promise<VerifyResult> {
  if (!isCloudEnabled || !supabase) {
    return { status: 'error', message: 'Cloud not enabled' };
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { data, error } = await supabase.rpc('verify_user_profile', {
        p_phone: phone,
        p_pin_hash: pinHash,
      });

      if (error) {
        // PGRST205 = table/function not found — degrade gracefully
        if (isSchemaNotReady(error)) return { status: 'error', message: 'Cloud table not ready' };
        // Schema cache error — Supabase free tier waking up; retry after delay
        if (isSchemaCacheError(error.message) && attempt < MAX_RETRIES) {
          await sleep(RETRY_DELAY_MS);
          continue;
        }
        throw error;
      }

      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return { status: 'error', message: 'Empty RPC response' };

      if (!row.found) return { status: 'not_found' };
      if (!row.pin_correct) return { status: 'wrong_pin' };
      return { status: 'ok', name: row.name as string, role: (row.role as string) ?? 'scorer', plan: (row.plan as string) ?? 'free' };
    } catch (err) {
      const message = (err as { message?: string })?.message ?? String(err);
      if (isSchemaCacheError(message) && attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      console.error('[cloud-user-repo] verifyUserProfile failed:', message);
      return { status: 'error', message };
    }
  }

  return { status: 'error', message: 'Server is waking up — please try again.' };
}

// ── OTP via Twilio Verify edge functions ──────────────────────────────────────

export type OtpSendResult =
  | { success: true }
  | { success: false; error: string };

export type OtpVerifyResult =
  | { valid: true; name?: string; role?: string }
  | { valid: false; error?: string };

/**
 * Trigger a Twilio Verify SMS OTP for the given phone number.
 * Phone should be in stored format (e.g. "919876543210") — the edge function
 * prepends "+" to produce E.164 before calling Twilio.
 */
export async function sendOtp(phone: string, turnstileToken?: string): Promise<OtpSendResult> {
  if (!isCloudEnabled || !supabase) {
    return { success: false, error: 'Cloud not enabled' };
  }
  try {
    const { data, error } = await supabase.functions.invoke('send-otp', {
      body: { phone, ...(turnstileToken ? { turnstileToken } : {}) },
    });
    if (error) throw error;
    const res = data as { success: boolean; error?: string };
    if (!res.success) return { success: false, error: res.error ?? 'Failed to send OTP' };
    return { success: true };
  } catch (err) {
    const message = (err as { message?: string })?.message ?? String(err);
    console.error('[cloud-user-repo] sendOtp failed:', message);
    return { success: false, error: message };
  }
}

/**
 * Verify a Twilio OTP code for the given phone number.
 * On success, also returns the existing profile name+role if the phone is
 * already registered (used for the forgot-PIN restore flow).
 */
export async function verifyOtp(phone: string, code: string): Promise<OtpVerifyResult> {
  if (!isCloudEnabled || !supabase) {
    return { valid: false, error: 'Cloud not enabled' };
  }
  try {
    const { data, error } = await supabase.functions.invoke('verify-otp', {
      body: { phone, code },
    });
    if (error) throw error;
    const res = data as { valid: boolean; name?: string; role?: string; error?: string };
    if (!res.valid) return { valid: false, error: res.error };
    return { valid: true, name: res.name, role: res.role };
  } catch (err) {
    const message = (err as { message?: string })?.message ?? String(err);
    console.error('[cloud-user-repo] verifyOtp failed:', message);
    return { valid: false, error: message };
  }
}
