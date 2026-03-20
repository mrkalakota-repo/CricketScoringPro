import { supabase, isCloudEnabled } from '../../config/supabase';

export interface CloudUserProfile {
  phone: string;
  name: string;
  pinHash: string;
  role?: string; // UserRole
}

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
      console.error('[cloud-user-repo] pushUserProfile failed:', err);
    }
  }
}

/**
 * Fetch a user profile from Supabase by phone number.
 * Returns null if not found, cloud is disabled, or the table doesn't exist yet.
 */
export async function fetchUserProfile(phone: string): Promise<CloudUserProfile | null> {
  if (!isCloudEnabled || !supabase) return null;
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('phone, name, pin_hash, role')
      .eq('phone', phone)
      .single();

    if (error) {
      const code = (error as { code?: string }).code;
      // PGRST205 = table not found; PGRST116 = no rows returned
      if (code !== 'PGRST205' && code !== 'PGRST116') throw error;
      return null;
    }
    if (!data) return null;
    return {
      phone: data.phone as string,
      name: data.name as string,
      pinHash: data.pin_hash as string,
      role: (data.role as string) ?? 'scorer',
    };
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code !== 'PGRST205' && code !== 'PGRST116') {
      console.error('[cloud-user-repo] fetchUserProfile failed:', err);
    }
    return null;
  }
}
