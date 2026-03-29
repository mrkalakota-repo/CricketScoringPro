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
export type RestoreStatusWithMessage = { status: RestoreStatus; errorMessage?: string };

const MAX_LOGIN_ATTEMPTS = 3;
const LOGIN_LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes

interface UserAuthStore {
  profile: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  /**
   * True on web when the profile metadata exists in localStorage but the PIN hash
   * is gone from sessionStorage (tab was closed and reopened). In this state local
   * login is impossible — the user must restore from cloud to re-acquire the hash.
   */
  sessionExpired: boolean;

  /** Restore status for the "new device" flow — drives UI feedback. */
  restoreStatus: RestoreStatus;
  /** Error message from the last failed restore attempt (e.g. server error details). */
  restoreErrorMessage: string;

  /** Number of consecutive failed local login attempts (in-memory, resets on restart). */
  loginAttempts: number;
  /**
   * Timestamp (ms) until which local login is locked out after too many failed attempts.
   * 0 = not locked. Resets on successful login or app restart.
   */
  loginLockedUntil: number;

  /** Load stored profile from local DB — call once on app startup. */
  loadProfile: () => Promise<void>;

  /** Register a new user (first launch). Saves locally + pushes to cloud. */
  register: (phone: string, name: string, pin: string, role?: UserRole) => Promise<void>;

  /**
   * Verify PIN against local profile. Returns true if correct.
   * Enforces rate limiting: after MAX_LOGIN_ATTEMPTS wrong PINs, locks for LOGIN_LOCKOUT_MS.
   * Returns false (without hashing) when locked out.
   */
  login: (pin: string) => Promise<boolean>;

  /**
   * Restore profile from another device using Supabase.
   * Fetches by phone, verifies PIN client-side, saves locally if correct.
   * Updates restoreStatus to give the UI precise feedback.
   */
  restoreFromCloud: (phone: string, pin: string) => Promise<boolean>;

  /** Reset restoreStatus back to idle (e.g. when user closes the restore form). */
  resetRestoreStatus: () => void;

  /** Update display name, optionally change PIN, and/or change role. Saves locally + syncs to cloud. */
  updateProfile: (name: string, newPin?: string, newRole?: UserRole) => Promise<void>;

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
  sessionExpired: false,
  restoreStatus: 'idle',
  restoreErrorMessage: '',
  loginAttempts: 0,
  loginLockedUntil: 0,

  loadProfile: async () => {
    try {
      const stored = await prefsRepo.getUserProfile();
      if (stored) {
        const role: UserRole = (stored.role as UserRole) ?? 'scorer';
        // On web, sessionStorage is cleared when the tab is closed. If pinHash is empty
        // the user's metadata is present but local auth is impossible — they must restore
        // from cloud. Flag this so the UI can skip straight to the restore form.
        const sessionExpired = stored.pinHash === '';
        set({
          profile: { phone: stored.phone, name: stored.name, pinHash: stored.pinHash, role },
          sessionExpired,
          isLoading: false,
        });
      } else {
        set({ profile: null, sessionExpired: false, isLoading: false });
      }
    } catch {
      set({ profile: null, sessionExpired: false, isLoading: false });
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
    const { profile, loginAttempts, loginLockedUntil } = get();
    if (!profile) return false;

    // Enforce lockout
    if (loginLockedUntil > 0 && Date.now() < loginLockedUntil) {
      return false;
    }

    const hash = await hashPin(pin);
    if (hash === profile.pinHash) {
      set({ isAuthenticated: true, loginAttempts: 0, loginLockedUntil: 0 });
      // Re-push to cloud in case the initial registration push failed (e.g. table didn't exist yet).
      cloudUserRepo.pushUserProfile({ phone: profile.phone, name: profile.name, pinHash: profile.pinHash, role: profile.role }).catch(() => {});
      return true;
    }

    // Wrong PIN — track attempts and lock if threshold reached
    const attempts = loginAttempts + 1;
    const lockedUntil = attempts >= MAX_LOGIN_ATTEMPTS ? Date.now() + LOGIN_LOCKOUT_MS : 0;
    set({ loginAttempts: attempts, loginLockedUntil: lockedUntil });
    return false;
  },

  restoreFromCloud: async (phone, pin) => {
    set({ restoreStatus: 'fetching' });
    try {
      // Hash the PIN client-side; the server verifies it without returning the stored hash.
      const pinHash = await hashPin(pin);
      const result: VerifyResult = await cloudUserRepo.verifyUserProfile(phone.trim(), pinHash);

      if (result.status === 'not_found') {
        set({ restoreStatus: 'not_found', restoreErrorMessage: '' });
        return false;
      }
      if (result.status === 'wrong_pin') {
        set({ restoreStatus: 'wrong_pin', restoreErrorMessage: '' });
        return false;
      }
      if (result.status === 'error') {
        set({ restoreStatus: 'error', restoreErrorMessage: result.message });
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
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? String(err);
      set({ restoreStatus: 'error', restoreErrorMessage: msg });
      return false;
    }
  },

  resetRestoreStatus: () => set({ restoreStatus: 'idle', restoreErrorMessage: '' }),

  updateProfile: async (name, newPin, newRole) => {
    const { profile } = get();
    if (!profile) return;
    const pinHash = newPin ? await hashPin(newPin) : profile.pinHash;
    const role: UserRole = newRole ?? profile.role;
    const updated: UserProfile = { ...profile, name: name.trim(), pinHash, role };
    await prefsRepo.setUserProfile({ phone: updated.phone, name: updated.name, pinHash: updated.pinHash, role: updated.role });
    set({ profile: updated });
    cloudUserRepo.pushUserProfile({ phone: updated.phone, name: updated.name, pinHash: updated.pinHash, role: updated.role }).catch(() => {});
  },

  logout: () => {
    set({ isAuthenticated: false });
  },
}));
