import { NextResponse } from 'next/server';
import { toE164 } from '@/lib/phone';
import { getOrCreateInstance } from '@/lib/evolution';
import { authRatelimit } from '@/lib/rateLimit';
import { withApiLogging } from '@/lib/apiLogger';

export const POST = withApiLogging(
  '/api/auth/evolution/create-instance',
  async (req: Request) => {
    const { phone: rawPhone } = (await req.json().catch(() => ({}))) as { phone?: string };
    if (!rawPhone) return NextResponse.json({ error: 'Phone number required' }, { status: 400 });

    const phone = toE164(rawPhone);
    if (!/^\+91\d{10}$/.test(phone)) {
      return NextResponse.json({ error: 'Enter a valid 10-digit mobile number' }, { status: 400 });
    }

    const { success } = await authRatelimit.limit(`evo-instance:${phone}`);
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests. Try again shortly.' },
        { status: 429 }
      );
    }

    // Instance name based on phone (consistent across login/register)
    const instanceName = `user-${phone.replace(/\D/g, '')}`;

    try {
      const instance = await getOrCreateInstance(instanceName);
      return NextResponse.json({ instanceName, status: instance.connected ? 'open' : 'close' });
    } catch (err) {
      return NextResponse.json(
        { error: (err as Error).message ?? 'Failed to create instance' },
        { status: 502 }
      );
    }
  },
  { rateLimit: 'auth' }
);