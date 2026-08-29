import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase/server';
import { toE164 } from '@/lib/phone';
import { verifyOtp } from '@/lib/otp';
import { authRatelimit } from '@/lib/rateLimit';
import { withApiLogging } from '@/lib/apiLogger';

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

    const service = createServiceSupabase();

    const { data: list, error: listErr } = await service.auth.admin.listUsers({ perPage: 200 });
    if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });
    const existing = list.users.find((u) => u.phone === phone.replace('+', ''));

    const tempPassword = randomUUID();

    let userId: string;
    if (existing) {
      userId = existing.id;
      const { error } = await service.auth.admin.updateUserById(userId, {
        password: tempPassword,
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