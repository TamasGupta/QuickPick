import { NextResponse } from 'next/server';
import { toE164 } from '@/lib/phone';
import { generateOtp, storeOtp } from '@/lib/otp';
import { sendOtpWhatsapp } from '@/lib/whatsapp';
import { authRatelimit } from '@/lib/rateLimit';
import { withApiLogging } from '@/lib/apiLogger';

export const POST = withApiLogging(
  '/api/auth/whatsapp/send-otp',
  async (req: Request) => {
    const { phone: rawPhone } = (await req.json().catch(() => ({}))) as { phone?: string };
    if (!rawPhone) return NextResponse.json({ error: 'Phone number required' }, { status: 400 });

    const phone = toE164(rawPhone);
    if (!/^\+91\d{10}$/.test(phone)) {
      return NextResponse.json({ error: 'Enter a valid 10-digit mobile number' }, { status: 400 });
    }

    const { success } = await authRatelimit.limit(`wa-send:${phone}`);
    if (!success) {
      return NextResponse.json(
        { error: 'Too many codes requested. Try again shortly.' },
        { status: 429 }
      );
    }

    const code = generateOtp();
    await storeOtp(phone, code);

    const result = await sendOtpWhatsapp(phone, code);
    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? 'Failed to send OTP' }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  },
  { rateLimit: 'auth' }
);