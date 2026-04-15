import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * RevenueCat webhook handler — syncs subscription state to Supabase user_profiles.
 *
 * Deploy:
 *   supabase functions deploy rc-webhook --no-verify-jwt
 *
 * Required secret (Supabase dashboard → Edge Functions → Secrets):
 *   RC_WEBHOOK_SECRET — a random string you generate; paste into the RC webhook URL:
 *   https://<project>.supabase.co/functions/v1/rc-webhook?secret=<RC_WEBHOOK_SECRET>
 *
 * RevenueCat dashboard → Integrations → Webhooks → add the URL above.
 *
 * RC user IDs are phone numbers (set by loginPurchasesUser(profile.phone)).
 *
 * Entitlements (must match RC dashboard):
 *   pro_entitlement    — Pro Team plan
 *   league_entitlement — Pro League plan
 */

// Events that grant or upgrade access — plan derived from entitlement_ids
const GRANT_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
]);

// Events that fully revoke access — always downgrade to free
// CANCELLATION is intentionally absent: the user retains access until the
// billing period ends. EXPIRATION fires when access actually expires.
const REVOKE_EVENTS = new Set([
  'EXPIRATION',
]);

const PRO_ENTITLEMENT    = 'pro_entitlement';
const LEAGUE_ENTITLEMENT = 'league_entitlement';

type UserPlan = 'free' | 'pro' | 'league';

interface RCEvent {
  type: string;
  app_user_id: string;
  entitlement_ids?: string[];
  product_id?: string;
  environment?: string;
}

interface RCWebhookPayload {
  api_version: string;
  event: RCEvent;
}

function planFromEntitlements(entitlementIds: string[]): UserPlan {
  if (entitlementIds.includes(LEAGUE_ENTITLEMENT)) return 'league';
  if (entitlementIds.includes(PRO_ENTITLEMENT))    return 'pro';
  return 'free';
}

serve(async (req: Request) => {
  // RC sends POST; ignore everything else
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    // ── Auth ────────────────────────────────────────────────────────────────────
    const url = new URL(req.url);
    const incomingSecret = url.searchParams.get('secret');
    const expectedSecret = Deno.env.get('RC_WEBHOOK_SECRET');

    if (!expectedSecret || incomingSecret !== expectedSecret) {
      console.warn('[rc-webhook] Unauthorized request');
      return new Response('Unauthorized', { status: 401 });
    }

    // ── Parse payload ───────────────────────────────────────────────────────────
    let payload: RCWebhookPayload;
    try {
      payload = await req.json() as RCWebhookPayload;
    } catch {
      return new Response('Bad Request: invalid JSON', { status: 400 });
    }

    const { event } = payload;

    if (!event?.type || !event?.app_user_id) {
      return new Response('Bad Request: missing event.type or event.app_user_id', { status: 400 });
    }

    const phone    = event.app_user_id;
    const isGrant  = GRANT_EVENTS.has(event.type);
    const isRevoke = REVOKE_EVENTS.has(event.type);

    // Ignore events that don't change plan access (e.g. CANCELLATION, BILLING_ISSUE, TEST)
    if (!isGrant && !isRevoke) {
      console.log(`[rc-webhook] Ignored event type=${event.type} phone=${phone}`);
      return new Response(
        JSON.stringify({ ok: true, ignored: true, type: event.type }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // ── Derive new plan ─────────────────────────────────────────────────────────
    const newPlan: UserPlan = isRevoke
      ? 'free'
      : planFromEntitlements(event.entitlement_ids ?? []);

    // Skip sandbox events in production to avoid test purchases polluting real data
    if (event.environment === 'SANDBOX') {
      console.log(`[rc-webhook] Sandbox event skipped type=${event.type} phone=${phone} plan=${newPlan}`);
      return new Response(
        JSON.stringify({ ok: true, ignored: true, reason: 'sandbox' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // ── Update Supabase ─────────────────────────────────────────────────────────
    // Use the service role key so RLS is bypassed for this server-side operation.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 1. Update user profile plan
    const { error: profileError } = await supabase
      .from('user_profiles')
      .update({ plan: newPlan, updated_at: Date.now() })
      .eq('phone', phone);

    if (profileError) {
      console.error('[rc-webhook] user_profiles update failed:', profileError.message);
      return new Response('Internal Server Error', { status: 500 });
    }

    // 2. Update team_plan on all teams owned by this user (best-effort — non-fatal)
    const { error: teamsError } = await supabase
      .from('cloud_teams')
      .update({ team_plan: newPlan })
      .eq('owner_phone', phone);

    if (teamsError) {
      // Non-fatal: team_plan is a denormalised cache. The user's own plan is the source of truth.
      console.warn('[rc-webhook] cloud_teams update failed (non-fatal):', teamsError.message);
    }

    console.log(`[rc-webhook] ${event.type} → phone=${phone} plan=${newPlan}`);

    return new Response(
      JSON.stringify({ ok: true, phone, plan: newPlan, event: event.type }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );

  } catch (err) {
    console.error('[rc-webhook] Unhandled error:', err);
    return new Response('Internal Server Error', { status: 500 });
  }
});
