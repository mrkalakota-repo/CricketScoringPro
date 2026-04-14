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
import { usePrefsStore } from '../store/prefs-store';
import type { UserProfile, UserRole, UserPlan } from '../engine/types';
import type { VerifyResult, OtpVerifyResult } from '../db/repositories/cloud-user-repo';

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

  /** True while an OTP SMS is being dispatched via the edge function. */
  otpSending: boolean;
  /** True while an OTP code is being verified via the edge function. */
  otpVerifying: boolean;
  /** Error message from the last OTP send or verify call. Empty string when idle. */
  otpError: string;

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

  /** Update display name, optionally change PIN, role, and/or plan. Saves locally + syncs to cloud. */
  updateProfile: (name: string, newPin?: string, newRole?: UserRole, newPlan?: UserPlan) => Promise<void>;

  /** Sign out — clear in-memory session (profile stays in local DB + cloud). */
  logout: () => Promise<void>;

  /**
   * Check whether a phone number already has a registered account in Supabase.
   * No SMS is sent. Fails open (returns exists:false) on network error.
   */
  checkPhoneExists: (phone: string) => Promise<import('../db/repositories/cloud-user-repo').PhoneCheckResult>;

  /**
   * Send a Twilio Verify OTP SMS to the given phone.
   * Phone should be in stored format e.g. "919876543210".
   * Returns true on success; sets otpError on failure.
   */
  sendOtp: (phone: string, turnstileToken?: string) => Promise<boolean>;

  /**
   * Verify the 6-digit OTP code against Twilio Verify.
   * Returns OtpVerifyResult — callers get { valid, name?, role? }.
   * Sets otpError on failure.
   */
  verifyOtp: (phone: string, code: string) => Promise<OtpVerifyResult>;

  /** Clear any OTP error (e.g. when navigating back a step). */
  clearOtpError: () => void;
}

/** Salted PIN hash — phone acts as a per-user salt, preventing cross-user hash correlation. */
async function hashPin(pin: string, phone: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${phone}:${pin.trim()}`);
}

/** Legacy unsalted hash — used only as a migration fallback for existing accounts. */
async function hashPinLegacy(pin: string): Promise<string> {
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
  otpSending: false,
  otpVerifying: false,
  otpError: '',

  loadProfile: async () => {
    try {
      const stored = await prefsRepo.getUserProfile();
      if (stored) {
        const role: UserRole = (stored.role as UserRole) ?? 'scorer';
        const plan: UserPlan = (stored.plan as UserPlan) ?? 'free';
        // On web, sessionStorage is cleared when the tab is closed. If pinHash is empty
        // the user's metadata is present but local auth is impossible — they must restore
        // from cloud. Flag this so the UI can skip straight to the restore form.
        const sessionExpired = stored.pinHash === '';
        set({
          profile: { phone: stored.phone, name: stored.name, pinHash: stored.pinHash, role, plan },
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
    const pinHash = await hashPin(pin, phone);
    const plan: UserPlan = 'free';
    const profile: UserProfile = { phone, name, pinHash, role, plan };
    // Save locally first so auth works even if cloud push fails
    await prefsRepo.setUserProfile({ phone, name, pinHash, role, plan });
    set({ profile, isAuthenticated: true });
    // Push to cloud in background — failure is non-fatal
    cloudUserRepo.pushUserProfile({ phone, name, pinHash, role, plan }).catch(() => {});
  },

  login: async (pin) => {
    const { profile, loginAttempts, loginLockedUntil } = get();
    if (!profile) return false;

    // Enforce lockout
    if (loginLockedUntil > 0 && Date.now() < loginLockedUntil) {
      return false;
    }

    // Try new salted hash first; fall back to legacy for existing accounts.
    const newHash = await hashPin(pin, profile.phone);
    let pinCorrect = newHash === profile.pinHash;
    let needsMigration = false;

    if (!pinCorrect) {
      const legacyHash = await hashPinLegacy(pin);
      if (legacyHash === profile.pinHash) {
        pinCorrect = true;
        needsMigration = true; // will re-hash and push with new format below
      }
    }

    if (pinCorrect) {
      // Sync plan from cloud — picks up manual admin upgrades without requiring a restore.
      const cloudPlan = await cloudUserRepo.fetchCloudPlan(profile.phone);
      const plan: UserPlan = (cloudPlan as UserPlan) ?? profile.plan;
      const pinHash = needsMigration ? newHash : profile.pinHash;
      const updatedProfile: UserProfile = { ...profile, plan, pinHash };
      if (needsMigration || plan !== profile.plan) {
        await prefsRepo.setUserProfile({ phone: updatedProfile.phone, name: updatedProfile.name, pinHash, role: updatedProfile.role, plan });
      }
      set({ isAuthenticated: true, loginAttempts: 0, loginLockedUntil: 0, profile: updatedProfile });
      // Re-push to cloud: recovers failed registration pushes and migrates legacy hashes.
      cloudUserRepo.pushUserProfile({ phone: updatedProfile.phone, name: updatedProfile.name, pinHash, role: updatedProfile.role, plan: updatedProfile.plan }).catch(() => {});
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
      const trimmedPhone = phone.trim();

      // Try new salted hash first; fall back to legacy for existing accounts.
      const newHash = await hashPin(pin, trimmedPhone);
      let result: VerifyResult = await cloudUserRepo.verifyUserProfile(trimmedPhone, newHash);
      let migrated = false;

      if (result.status === 'wrong_pin') {
        const legacyHash = await hashPinLegacy(pin);
        result = await cloudUserRepo.verifyUserProfile(trimmedPhone, legacyHash);
        if (result.status === 'ok') migrated = true;
      }

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

      // PIN correct — always store locally with new salted hash going forward.
      const role: UserRole = (result.role as UserRole) ?? 'scorer';
      const plan: UserPlan = (result.plan as UserPlan) ?? 'free';
      await prefsRepo.setUserProfile({ phone: trimmedPhone, name: result.name, pinHash: newHash, role, plan });
      set({
        profile: { phone: trimmedPhone, name: result.name, pinHash: newHash, role, plan },
        isAuthenticated: true,
        restoreStatus: 'success',
      });
      // Push new hash to cloud when migrating from legacy format.
      if (migrated) {
        cloudUserRepo.pushUserProfile({ phone: trimmedPhone, name: result.name, pinHash: newHash, role, plan }).catch(() => {});
      }
      return true;
    } catch (err) {
      console.error('[useUserAuth] restoreFromCloud:', (err as Error).message);
      set({ restoreStatus: 'error', restoreErrorMessage: 'Could not restore your account. Check your connection and try again.' });
      return false;
    }
  },

  resetRestoreStatus: () => set({ restoreStatus: 'idle', restoreErrorMessage: '' }),

  updateProfile: async (name, newPin, newRole, newPlan) => {
    const { profile } = get();
    if (!profile) return;
    const pinHash = newPin ? await hashPin(newPin, profile.phone) : profile.pinHash;
    const role: UserRole = newRole ?? profile.role;
    const plan: UserPlan = newPlan ?? profile.plan;
    const updated: UserProfile = { ...profile, name: name.trim(), pinHash, role, plan };
    await prefsRepo.setUserProfile({ phone: updated.phone, name: updated.name, pinHash: updated.pinHash, role: updated.role, plan: updated.plan });
    set({ profile: updated });
    cloudUserRepo.pushUserProfile({ phone: updated.phone, name: updated.name, pinHash: updated.pinHash, role: updated.role, plan: updated.plan }).catch(() => {});
  },

  logout: async () => {
    await usePrefsStore.getState().clearOwnershipPrefs();
    set({ isAuthenticated: false });
  },

  checkPhoneExists: (phone) => cloudUserRepo.checkPhoneExists(phone),

  sendOtp: async (phone, turnstileToken) => {
    set({ otpSending: true, otpError: '' });
    try {
      const result = await cloudUserRepo.sendOtp(phone, turnstileToken);
      if (!result.success) {
        // result.error is already sanitized in cloud-user-repo
        set({ otpError: result.error || 'Failed to send verification code. Please try again.' });
        return false;
      }
      return true;
    } catch (err) {
      console.error('[useUserAuth] sendOtp:', (err as Error).message);
      set({ otpError: 'Unable to send verification code. Check your connection and try again.' });
      return false;
    } finally {
      set({ otpSending: false });
    }
  },

  verifyOtp: async (phone, code) => {
    set({ otpVerifying: true, otpError: '' });
    try {
      const result = await cloudUserRepo.verifyOtp(phone, code);
      if (!result.valid) {
        set({ otpError: result.error ?? 'Incorrect code. Try again.' });
      }
      return result;
    } catch (err) {
      console.error('[useUserAuth] verifyOtp:', (err as Error).message);
      const message = 'Code verification failed. Check your connection and try again.';
      set({ otpError: message });
      return { valid: false, error: message };
    } finally {
      set({ otpVerifying: false });
    }
  },

  clearOtpError: () => set({ otpError: '' }),
}));
