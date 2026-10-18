import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase/server';
import { toE164 } from '@/lib/phone';
import { verifyOtp } from '@/lib/otp';
import { authRatelimit } from '@/lib/rateLimit';
import { withApiLogging } from '@/lib/apiLogger';

const TEST_PHONE_PREFIX = "+91987654321";
const ADDITIONAL_TEST_PHONES = ["+919000000001"];

function isTestPhone(phone: string): boolean {
  return phone.startsWith(TEST_PHONE_PREFIX) || ADDITIONAL_TEST_PHONES.includes(phone);
}

export const POST = withApiLogging(
  '/api/auth/evolution/verify-otp',
  async (req: Request) => {
    const { phone: rawPhone, code } = (await req.json().catch(() => ({}))) as {
      phone?: string;
      code?: string;
    };
    if (!rawPhone || !code) {
      return NextResponse.json({ error: 'phone and code required' }, { status: 400 });
    }

    const phone = toE164(rawPhone);
    if (!/^\+91\d{10}$/.test(phone)) {
      return NextResponse.json({ error: 'Enter a valid 10-digit mobile number' }, { status: 400 });
    }

    const { success } = await authRatelimit.limit(`evo-verify:${phone}`);
    if (!success) {
      return NextResponse.json({ error: 'Too many attempts. Try again shortly.' }, { status: 429 });
    }

    const valid = await verifyOtp(phone, code);
    if (!valid) {
      return NextResponse.json({ error: 'Incorrect or expired code' }, { status: 401 });
    }

    // For test phones, skip user lookup and create/return a test user
    let userId: string;
    if (isTestPhone(phone)) {
      // Use a fixed test user ID or create one
      const service = createServiceSupabase();
      const { data: list } = await service.auth.admin.listUsers({ perPage: 200 });
      const existing = list.users.find((u) => u.phone === phone.replace('+', ''));
      
      const tempPassword = randomUUID();
      if (existing) {
        userId = existing.id;
        await service.auth.admin.updateUserById(userId, {
          password: tempPassword,
          phone_confirm: true,
        });
      } else {
        const { data: created } = await service.auth.admin.createUser({
          phone,
          phone_confirm: true,
          password: tempPassword,
        });
        userId = created.user!.id;
      }
      
      const supabase = createServerSupabase();
      await supabase.auth.signInWithPassword({ phone, password: tempPassword });
      return NextResponse.json({ ok: true, userId });
    }

    const service = createServiceSupabase();

    const { data: list, error: listErr } = await service.auth.admin.listUsers({ perPage: 200 });
    if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });
    const phoneNormalized = phone.replace('+', '');
    const phoneDigits = phone.replace(/\D/g, '').slice(-10);

    let existing = list.users.find(
      (u) => u.phone === phoneNormalized || u.phone === phone || u.phone?.endsWith(phoneDigits)
    );

    if (!existing) {
      // Fallback: check profiles table (e.g. rider or seller registered via admin console)
      const { data: profile } = await service
        .from('profiles')
        .select('id')
        .or(`phone.eq.${phoneNormalized},phone.eq.${phoneDigits},phone.eq.+91${phoneDigits}`)
        .maybeSingle();

      if (profile) {
        existing = list.users.find((u) => u.id === profile.id);
      }
    }

    const tempPassword = randomUUID();

    if (existing) {
      userId = existing.id;
      const { error } = await service.auth.admin.updateUserById(userId, {
        password: tempPassword,
        phone,
        phone_confirm: true,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      const { data: created, error } = await service.auth.admin.createUser({
        phone,
        phone_confirm: true,
        password: tempPassword,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      userId = created.user!.id;
    }

    const supabase = createServerSupabase();
    const { error: signInErr } = await supabase.auth.signInWithPassword({ phone, password: tempPassword });
    if (signInErr) return NextResponse.json({ error: signInErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, userId });
  },
  { rateLimit: 'auth' }
);