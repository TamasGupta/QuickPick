import { NextResponse } from 'next/server';
import { toE164 } from '@/lib/phone';
import { generateOtp, storeOtp } from '@/lib/otp';
import { sendTextMessage, sendButtonMessage } from '@/lib/evolution';
import { authRatelimit } from '@/lib/rateLimit';
import { withApiLogging } from '@/lib/apiLogger';
import { createServiceSupabase } from '@/lib/supabase/server';

// Single pre-connected instance for sending OTPs (admin sets up once, scans QR once)
const OTP_INSTANCE_NAME = process.env.EVOLUTION_OTP_INSTANCE_NAME || 'otp-sender';

export const POST = withApiLogging(
  '/api/auth/evolution/send-otp',
  async (req: Request) => {
    const { phone: rawPhone, mode = 'login' } = (await req.json().catch(() => ({}))) as { 
      phone?: string; 
      mode?: 'login' | 'register';
    };
    if (!rawPhone) return NextResponse.json({ error: 'Phone number required' }, { status: 400 });

    const phone = toE164(rawPhone);
    if (!/^\+91\d{10}$/.test(phone)) {
      return NextResponse.json({ error: 'Enter a valid 10-digit mobile number' }, { status: 400 });
    }

    // Check if user exists for login/register mode
    const service = createServiceSupabase();
    const { data: list, error: listErr } = await service.auth.admin.listUsers({ perPage: 200 });
    if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });
    
    const phoneNormalized = phone.replace('+', '');
    const existing = list.users.find((u) => u.phone === phoneNormalized);

    if (mode === 'login' && !existing) {
      return NextResponse.json({ error: 'No account found with this number. Please register first.' }, { status: 404 });
    }
    if (mode === 'register' && existing) {
      return NextResponse.json({ error: 'Account already exists. Please log in instead.' }, { status: 409 });
    }

    const { success } = await authRatelimit.limit(`evo-send:${phone}`);
    if (!success) {
      return NextResponse.json(
        { error: 'Too many codes requested. Try again shortly.' },
        { status: 429 }
      );
    }

    const code = generateOtp();
    await storeOtp(phone, code);

    const bodyText = `Your Grabonn verification code is: ${code}\n\nDo not share this code with anyone.`;
    const buttonText = "Copy Code";
    const buttonId = `copy_${code}`;

    try {
      await sendButtonMessage(OTP_INSTANCE_NAME, phone, bodyText, buttonText, buttonId);
      return NextResponse.json({ ok: true });
    } catch (err) {
      // Fallback to text message if button fails
      try {
        await sendTextMessage(OTP_INSTANCE_NAME, phone, bodyText);
        return NextResponse.json({ ok: true });
      } catch {
        return NextResponse.json(
          { error: (err as Error).message ?? 'Failed to send OTP' },
          { status: 502 }
        );
      }
    }
  },
  { rateLimit: 'auth' }
);