import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Cloudflare Turnstile verification ─────────────────────────────────────────

async function verifyTurnstileToken(token: string, ip: string): Promise<boolean> {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!secret) return true; // not configured — fail open

  try {
    const body = new URLSearchParams({ secret, response: token, remoteip: ip });
    const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
    });
    const data = await resp.json() as { success: boolean };
    return data.success;
  } catch {
    return true; // network error — fail open to avoid blocking legitimate users
  }
}

// ── In-memory rate limit store ────────────────────────────────────────────────
// Maps key → array of timestamps (ms). Cleared on cold-start but sufficient
// to block burst bot traffic within a single function invocation lifecycle.

const rateLimitStore = new Map<string, number[]>();

const RATE_LIMITS = {
  ip:    { max: 5,  windowMs: 10 * 60 * 1000 }, // 5 per IP per 10 min
  phone: { max: 3,  windowMs: 60 * 60 * 1000 }, // 3 per phone per hour
};

function isRateLimited(key: string, limit: { max: number; windowMs: number }): boolean {
  const now = Date.now();
  const hits = (rateLimitStore.get(key) ?? []).filter(t => now - t < limit.windowMs);
  hits.push(now);
  rateLimitStore.set(key, hits);
  return hits.length > limit.max;
}

// ── Phone number validation ────────────────────────────────────────────────────
// Stored format: countryCodeDigits + localDigits, e.g. "919876543210"
// Allowlist matches exactly the 5 countries in the app's country picker.
// { prefix, totalLength } — prefix is the dial code digits (no +).

const ALLOWED_PREFIXES: { prefix: string; totalLength: number }[] = [
  { prefix: '91', totalLength: 12 }, // India      +91 + 10
  { prefix: '1',  totalLength: 11 }, // USA/Canada +1  + 10
  { prefix: '44', totalLength: 12 }, // UK         +44 + 10
  { prefix: '61', totalLength: 11 }, // Australia  +61 + 9
  { prefix: '64', totalLength: 11 }, // New Zealand+64 + 9
];

function isValidPhone(phone: string): boolean {
  if (!/^\d{10,15}$/.test(phone)) return false;
  return ALLOWED_PREFIXES.some(
    ({ prefix, totalLength }) =>
      phone.startsWith(prefix) && phone.length === totalLength,
  );
}

// ── Supabase-based rate limit (persistent across cold starts) ─────────────────
// Uses a simple otp_rate_limit table. Falls back gracefully if table doesn't exist.

async function checkPersistentRateLimit(phone: string): Promise<boolean> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return false;

  try {
    const supabase = createClient(supabaseUrl, serviceKey);
    const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { count } = await supabase
      .from('otp_rate_limit')
      .select('*', { count: 'exact', head: true })
      .eq('phone', phone)
      .gte('created_at', windowStart);

    if ((count ?? 0) >= 3) return true; // blocked

    // Record this attempt
    await supabase.from('otp_rate_limit').insert({ phone });
    return false;
  } catch {
    // Table may not exist yet — fail open (don't block legitimate users)
    return false;
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  // ── IP rate limit ──
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  if (isRateLimited(`ip:${ip}`, RATE_LIMITS.ip)) {
    console.warn('[send-otp] IP rate limited:', ip);
    return new Response(
      JSON.stringify({ success: false, error: 'Too many requests. Please try again later.' }),
      { status: 429, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'Retry-After': '600' } },
    );
  }

  try {
    const { phone, turnstileToken } = await req.json() as { phone: string; turnstileToken?: string };

    if (!phone) {
      return new Response(JSON.stringify({ success: false, error: 'Phone is required' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // ── Turnstile verification (web clients only — token absent on native) ──
    if (turnstileToken) {
      const valid = await verifyTurnstileToken(turnstileToken, ip);
      if (!valid) {
        console.warn('[send-otp] Turnstile verification failed for IP:', ip);
        return new Response(
          JSON.stringify({ success: false, error: 'Bot check failed. Please try again.' }),
          { status: 403, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        );
      }
    }

    // ── Phone format validation ──
    if (!isValidPhone(phone)) {
      console.warn('[send-otp] Invalid phone format rejected:', phone);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid phone number format.' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    // ── In-memory phone rate limit ──
    if (isRateLimited(`phone:${phone}`, RATE_LIMITS.phone)) {
      console.warn('[send-otp] Phone rate limited:', phone);
      return new Response(
        JSON.stringify({ success: false, error: 'Too many OTP requests for this number. Try again in an hour.' }),
        { status: 429, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'Retry-After': '3600' } },
      );
    }

    // ── Persistent phone rate limit (survives cold starts) ──
    const blocked = await checkPersistentRateLimit(phone);
    if (blocked) {
      console.warn('[send-otp] Persistent rate limit hit for phone:', phone);
      return new Response(
        JSON.stringify({ success: false, error: 'Too many OTP requests for this number. Try again in an hour.' }),
        { status: 429, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'Retry-After': '3600' } },
      );
    }

    const apiKeySid    = Deno.env.get('TWILIO_API_KEY_SID');
    const apiKeySecret = Deno.env.get('TWILIO_API_KEY_SECRET');
    const serviceSid   = Deno.env.get('TWILIO_VERIFY_SERVICE_SID');

    if (!apiKeySid || !apiKeySecret || !serviceSid) {
      console.error('[send-otp] Missing Twilio env vars');
      return new Response(JSON.stringify({ success: false, error: 'Server misconfiguration' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Phone stored as "919876543210" — Twilio needs E.164 "+919876543210"
    const e164 = phone.startsWith('+') ? phone : `+${phone}`;

    // API Key auth: Basic <base64(apiKeySid:apiKeySecret)>
    const url = `https://verify.twilio.com/v2/Services/${serviceSid}/Verifications`;
    const body = new URLSearchParams({ To: e164, Channel: 'sms' });

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${apiKeySid}:${apiKeySecret}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({})) as { message?: string };
      console.error('[send-otp] Twilio error:', resp.status, err.message);
      return new Response(
        JSON.stringify({ success: false, error: err.message ?? 'Failed to send OTP' }),
        { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[send-otp] Unexpected error:', err);
    return new Response(JSON.stringify({ success: false, error: 'Internal server error' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
