/**
 * Global user authentication — phone number + PIN.
 *
 * How it works:
 * - First launch: user registers with phone, name, and a 4–6 digit PIN.
 *   Profile saved locally (user_prefs) AND pushed to Supabase user_profiles
 *   so it can be restored on another device.
 * - Same device, subsequent launches: PIN prompt re-authenticates locally.
 * - New device: "Restore Account" flow — enter phone → fetch profile from
 *   Supabase → verify PIN client-side → save locally → authenticated.
 * - Authenticated session lives in memory — resets on app restart (same
 *   pattern as adminPinHash for teams).
 */
import { create } from 'zustand';
import * as Crypto from 'expo-crypto';
import * as prefsRepo from '../db/repositories/prefs-repo';
import * as cloudUserRepo from '../db/repositories/cloud-user-repo';
import type { UserProfile, UserRole } from '../engine/types';
import type { VerifyResult } from '../db/repositories/cloud-user-repo';

export type RestoreStatus = 'idle' | 'fetching' | 'not_found' | 'wrong_pin' | 'error' | 'success';

interface UserAuthStore {
  profile: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  /** Restore status for the "new device" flow — drives UI feedback. */
  restoreStatus: RestoreStatus;

  /** Load stored profile from local DB — call once on app startup. */
  loadProfile: () => Promise<void>;

  /** Register a new user (first launch). Saves locally + pushes to cloud. */
  register: (phone: string, name: string, pin: string, role?: UserRole) => Promise<void>;

  /** Verify PIN against local profile. Returns true if correct. */
  login: (pin: string) => Promise<boolean>;

  /**
   * Restore profile from another device using Supabase.
   * Fetches by phone, verifies PIN client-side, saves locally if correct.
   * Updates restoreStatus to give the UI precise feedback.
   */
  restoreFromCloud: (phone: string, pin: string) => Promise<boolean>;

  /** Reset restoreStatus back to idle (e.g. when user closes the restore form). */
  resetRestoreStatus: () => void;

  /** Sign out — clear in-memory session (profile stays in local DB + cloud). */
  logout: () => void;
}

async function hashPin(pin: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin.trim());
}

export const useUserAuth = create<UserAuthStore>((set, get) => ({
  profile: null,
  isAuthenticated: false,
  isLoading: true,
  restoreStatus: 'idle',

  loadProfile: async () => {
    try {
      const stored = await prefsRepo.getUserProfile();
      if (stored) {
        const role: UserRole = (stored.role as UserRole) ?? 'scorer';
        set({ profile: { phone: stored.phone, name: stored.name, pinHash: stored.pinHash, role }, isLoading: false });
      } else {
        set({ profile: null, isLoading: false });
      }
    } catch {
      set({ profile: null, isLoading: false });
    }
  },

  register: async (phone, name, pin, role = 'scorer') => {
    const pinHash = await hashPin(pin);
    const profile: UserProfile = { phone, name, pinHash, role };
    // Save locally first so auth works even if cloud push fails
    await prefsRepo.setUserProfile({ phone, name, pinHash, role });
    set({ profile, isAuthenticated: true });
    // Push to cloud in background — failure is non-fatal
    cloudUserRepo.pushUserProfile({ phone, name, pinHash, role }).catch(() => {});
  },

  login: async (pin) => {
    const { profile } = get();
    if (!profile) return false;
    const hash = await hashPin(pin);
    if (hash === profile.pinHash) {
      set({ isAuthenticated: true });
      return true;
    }
    return false;
  },

  restoreFromCloud: async (phone, pin) => {
    set({ restoreStatus: 'fetching' });
    try {
      // Hash the PIN client-side; the server verifies it without returning the stored hash.
      const pinHash = await hashPin(pin);
      const result: VerifyResult = await cloudUserRepo.verifyUserProfile(phone.trim(), pinHash);

      if (result.status === 'not_found') {
        set({ restoreStatus: 'not_found' });
        return false;
      }
      if (result.status === 'wrong_pin') {
        set({ restoreStatus: 'wrong_pin' });
        return false;
      }
      if (result.status === 'error') {
        set({ restoreStatus: 'error' });
        return false;
      }

      // PIN correct — save locally (storing our locally-computed hash) and authenticate
      const role: UserRole = (result.role as UserRole) ?? 'scorer';
      await prefsRepo.setUserProfile({
        phone: phone.trim(),
        name: result.name,
        pinHash,  // local hash — never received from server
        role,
      });
      set({
        profile: { phone: phone.trim(), name: result.name, pinHash, role },
        isAuthenticated: true,
        restoreStatus: 'success',
      });
      return true;
    } catch {
      set({ restoreStatus: 'error' });
      return false;
    }
  },

  resetRestoreStatus: () => set({ restoreStatus: 'idle' }),

  logout: () => {
    set({ isAuthenticated: false });
  },
}));
