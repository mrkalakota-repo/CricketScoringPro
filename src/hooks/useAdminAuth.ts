/**
 * In-memory admin authentication state per team.
 *
 * How it works:
 * - Each team can optionally set an admin PIN (stored as SHA-256 hash in the DB).
 * - If no PIN is set (adminPinHash === null), everyone is treated as an admin.
 * - Authentication state lives in memory only — clears on app restart (intentional security behaviour).
 * - Multiple people can be "admins" for a team simply by knowing the PIN.
 */
import { create } from 'zustand';
import * as Crypto from 'expo-crypto';

interface AdminAuthStore {
  /** teamId → authenticated */
  authenticated: Record<string, boolean>;
  /** Returns true if the user has admin access for this team. */
  isAdmin: (teamId: string, adminPinHash: string | null) => boolean;
  /** Verifies the entered PIN and marks team as authenticated if correct. */
  authenticate: (teamId: string, adminPinHash: string, enteredPin: string) => Promise<boolean>;
  /** Revoke admin access for a team (sign out). */
  revoke: (teamId: string) => void;
}

async function hashPin(pin: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin);
}

export const useAdminAuth = create<AdminAuthStore>((set, get) => ({
  authenticated: {},

  isAdmin: (teamId, adminPinHash) => {
    // No PIN set → open access
    if (!adminPinHash) return true;
    return !!get().authenticated[teamId];
  },

  authenticate: async (teamId, adminPinHash, enteredPin) => {
    const hash = await hashPin(enteredPin.trim());
    if (hash === adminPinHash) {
      set(s => ({ authenticated: { ...s.authenticated, [teamId]: true } }));
      return true;
    }
    return false;
  },

  revoke: (teamId) => {
    set(s => {
      const next = { ...s.authenticated };
      delete next[teamId];
      return { authenticated: next };
    });
  },
}));

/** Standalone helper — hash a plain PIN string for storage. */
export async function hashAdminPin(pin: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin.trim());
}
