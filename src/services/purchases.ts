/**
 * RevenueCat purchases service for Inningsly.
 *
 * Product IDs (must match exactly in App Store Connect / Google Play Console):
 *   inningsly_pro_monthly    — Pro Team $6/mo
 *   inningsly_pro_annual     — Pro Team $50/yr
 *   inningsly_league_monthly — League Pro $29/mo
 *   inningsly_league_annual  — League Pro $250/yr
 *
 * Entitlements (configured in RevenueCat dashboard):
 *   pro_entitlement    — granted by any pro product
 *   league_entitlement — granted by any league product
 *
 * Env vars required:
 *   EXPO_PUBLIC_RC_API_KEY_IOS     — RevenueCat iOS API key
 *   EXPO_PUBLIC_RC_API_KEY_ANDROID — RevenueCat Android API key
 */

import { Platform } from 'react-native';
import Purchases, {
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
  LOG_LEVEL,
} from 'react-native-purchases';
import type { UserPlan } from '../engine/types';

// ── Constants ──────────────────────────────────────────────────────────────────

const RC_API_KEY_IOS     = process.env.EXPO_PUBLIC_RC_API_KEY_IOS ?? '';
const RC_API_KEY_ANDROID = process.env.EXPO_PUBLIC_RC_API_KEY_ANDROID ?? '';

const PRO_ENTITLEMENT    = 'pro_entitlement';
const LEAGUE_ENTITLEMENT = 'league_entitlement';

// ── Configure ─────────────────────────────────────────────────────────────────

/**
 * Call once on app startup (before any other RC method).
 * Safe to call multiple times — RC ignores duplicate configure calls.
 */
export function configurePurchases(userId?: string): void {
  const apiKey = Platform.OS === 'ios' ? RC_API_KEY_IOS : RC_API_KEY_ANDROID;
  if (!apiKey) {
    // No API key provided — purchases disabled (dev / web builds)
    return;
  }
  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  }
  Purchases.configure({ apiKey, appUserID: userId ?? null });
}

// ── Plan helpers ──────────────────────────────────────────────────────────────

/**
 * Derives the user's active plan from a RevenueCat CustomerInfo object.
 * Checks league first (higher tier), then pro, then defaults to free.
 */
export function planFromCustomerInfo(info: CustomerInfo): UserPlan {
  if (info.entitlements.active[LEAGUE_ENTITLEMENT]?.isActive) return 'league';
  if (info.entitlements.active[PRO_ENTITLEMENT]?.isActive)    return 'pro';
  return 'free';
}

// ── Getters ───────────────────────────────────────────────────────────────────

/**
 * Fetches the current CustomerInfo and derives the active plan.
 * Returns 'free' if RC is unconfigured or the request fails.
 */
export async function getCurrentPlan(): Promise<UserPlan> {
  try {
    const info = await Purchases.getCustomerInfo();
    return planFromCustomerInfo(info);
  } catch {
    return 'free';
  }
}

/**
 * Fetches the default RC offering.
 * Returns null if unavailable.
 */
export async function getOfferings(): Promise<PurchasesOffering | null> {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current ?? null;
  } catch {
    return null;
  }
}

// ── Purchase ──────────────────────────────────────────────────────────────────

export type PurchaseResult =
  | { success: true; plan: UserPlan; customerInfo: CustomerInfo }
  | { success: false; cancelled: boolean; error: string };

/**
 * Initiates a purchase for the given package.
 * The caller is responsible for updating the user profile and Supabase after success.
 */
export async function purchasePackage(pkg: PurchasesPackage): Promise<PurchaseResult> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return { success: true, plan: planFromCustomerInfo(customerInfo), customerInfo };
  } catch (err: unknown) {
    const e = err as { userCancelled?: boolean; message?: string };
    if (e.userCancelled) {
      return { success: false, cancelled: true, error: 'Purchase cancelled.' };
    }
    return {
      success: false,
      cancelled: false,
      error: e.message ?? 'Purchase failed. Please try again.',
    };
  }
}

// ── Restore ───────────────────────────────────────────────────────────────────

export type RestoreResult =
  | { success: true; plan: UserPlan; customerInfo: CustomerInfo }
  | { success: false; error: string };

/**
 * Restores prior purchases from the App Store / Google Play.
 */
export async function restorePurchases(): Promise<RestoreResult> {
  try {
    const customerInfo = await Purchases.restorePurchases();
    return { success: true, plan: planFromCustomerInfo(customerInfo), customerInfo };
  } catch (err: unknown) {
    const e = err as { message?: string };
    return { success: false, error: e.message ?? 'Restore failed. Please try again.' };
  }
}

// ── Login / Logout ─────────────────────────────────────────────────────────────

/**
 * Associates the RC anonymous user with a known app user ID (e.g. phone number).
 * Call after the user authenticates so purchase history is tied to their account.
 */
export async function loginPurchasesUser(userId: string): Promise<void> {
  try {
    await Purchases.logIn(userId);
  } catch {
    // Non-fatal — RC will still work anonymously
  }
}

/**
 * Switches RC back to anonymous mode on sign-out.
 */
export async function logoutPurchasesUser(): Promise<void> {
  try {
    await Purchases.logOut();
  } catch {
    // Non-fatal
  }
}
