import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const { phone, code } = await req.json() as { phone: string; code: string };

    if (!phone || !code) {
      return new Response(JSON.stringify({ valid: false, error: 'Phone and code are required' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken  = Deno.env.get('TWILIO_AUTH_TOKEN');
    const serviceSid = Deno.env.get('TWILIO_VERIFY_SERVICE_SID');

    if (!accountSid || !authToken || !serviceSid) {
      console.error('[verify-otp] Missing Twilio env vars');
      return new Response(JSON.stringify({ valid: false, error: 'Server misconfiguration' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const e164 = phone.startsWith('+') ? phone : `+${phone}`;

    const url = `https://verify.twilio.com/v2/Services/${serviceSid}/VerificationCheck`;
    const body = new URLSearchParams({ To: e164, Code: code });

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({})) as { message?: string };
      console.error('[verify-otp] Twilio error:', resp.status, err.message);
      return new Response(
        JSON.stringify({ valid: false, error: err.message ?? 'Verification failed' }),
        { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    const data = await resp.json() as { status: string };
    if (data.status !== 'approved') {
      return new Response(JSON.stringify({ valid: false }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // OTP valid — try to fetch existing profile (for the forgot-PIN restore flow).
    // Uses service role key so it can bypass RLS. Returns null if user is new.
    let name: string | undefined;
    let role: string | undefined;

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (supabaseUrl && serviceKey) {
      try {
        const supabase = createClient(supabaseUrl, serviceKey);
        // Strip leading "+" for the stored format (e.g. "+919876543210" → "919876543210")
        const storedPhone = phone.startsWith('+') ? phone.slice(1) : phone;
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('name, role')
          .eq('phone', storedPhone)
          .maybeSingle();

        if (profile) {
          name = profile.name as string;
          role = (profile.role as string) ?? 'scorer';
        }
      } catch (dbErr) {
        // Non-fatal — profile fetch failure doesn't invalidate the OTP
        console.warn('[verify-otp] Profile fetch failed (non-fatal):', dbErr);
      }
    }

    return new Response(JSON.stringify({ valid: true, name, role }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[verify-otp] Unexpected error:', err);
    return new Response(JSON.stringify({ valid: false, error: 'Internal server error' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
