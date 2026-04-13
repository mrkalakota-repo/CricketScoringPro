/**
 * Web stub for the RevenueCat purchases service.
 *
 * Metro resolves this file instead of purchases.ts on web builds,
 * preventing @revenuecat/purchases-js (and its Stripe.js dependency)
 * from being bundled into the web output.
 *
 * All functions are no-ops that return safe defaults.
 */

import type { UserPlan } from '../engine/types';

export type PurchaseResult =
  | { success: true; plan: UserPlan; customerInfo: never }
  | { success: false; cancelled: boolean; error: string };

export type RestoreResult =
  | { success: true; plan: UserPlan; customerInfo: never }
  | { success: false; error: string };

export function configurePurchases(_userId?: string): void {}

export async function getCurrentPlan(): Promise<UserPlan> {
  return 'free';
}

export async function getOfferings() {
  return null;
}

export async function purchasePackage(_pkg: unknown): Promise<PurchaseResult> {
  return { success: false, cancelled: false, error: 'Purchases not available on web.' };
}

export async function restorePurchases(): Promise<RestoreResult> {
  return { success: false, error: 'Purchases not available on web.' };
}

export async function loginPurchasesUser(_userId: string): Promise<void> {}

export async function logoutPurchasesUser(): Promise<void> {}
