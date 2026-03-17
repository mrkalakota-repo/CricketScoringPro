/**
 * Global user authentication — phone number + PIN.
 *
 * How it works:
 * - First launch: user registers with phone, name, and a 4–6 digit PIN.
 * - On subsequent launches: PIN prompt re-authenticates the user.
 * - Profile (phone, name, PIN hash) is persisted in user_prefs.
 * - Authenticated session lives in memory — resets on app restart (same
 *   pattern as adminPinHash for teams).
 */
import { create } from 'zustand';
import * as Crypto from 'expo-crypto';
import * as prefsRepo from '../db/repositories/prefs-repo';
import type { UserProfile } from '../engine/types';

interface UserAuthStore {
  profile: UserProfile | null;   // Loaded from DB on startup
  isAuthenticated: boolean;      // True once PIN verified this session
  isLoading: boolean;

  /** Load stored profile from DB — call once on app startup. */
  loadProfile: () => Promise<void>;

  /** Register a new user (first launch). Stores profile and marks authenticated. */
  register: (phone: string, name: string, pin: string) => Promise<void>;

  /** Verify PIN for an existing profile. Returns true if correct. */
  login: (pin: string) => Promise<boolean>;

  /** Sign out — clear in-memory session (profile stays in DB). */
  logout: () => void;
}

async function hashPin(pin: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin.trim());
}

export const useUserAuth = create<UserAuthStore>((set, get) => ({
  profile: null,
  isAuthenticated: false,
  isLoading: true,

  loadProfile: async () => {
    try {
      const stored = await prefsRepo.getUserProfile();
      if (stored) {
        set({ profile: { phone: stored.phone, name: stored.name, pinHash: stored.pinHash }, isLoading: false });
      } else {
        set({ profile: null, isLoading: false });
      }
    } catch {
      set({ profile: null, isLoading: false });
    }
  },

  register: async (phone, name, pin) => {
    const pinHash = await hashPin(pin);
    const profile: UserProfile = { phone, name, pinHash };
    await prefsRepo.setUserProfile({ phone, name, pinHash });
    set({ profile, isAuthenticated: true });
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

  logout: () => {
    set({ isAuthenticated: false });
  },
}));
