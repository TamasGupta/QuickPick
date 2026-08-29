import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase/server';

interface EvolutionWebhookMessage {
  event: string;
  instance: string;
  data: {
    key: {
      remoteJid: string;
      fromMe: boolean;
      id: string;
    };
    message?: {
      conversation?: string;
      extendedTextMessage?: { text: string };
    };
    messageTimestamp: number;
  };
}

export async function POST(req: Request) {
  try {
    const body: EvolutionWebhookMessage = await req.json();

    // Only handle incoming text messages (not from me)
    if (body.event !== 'messages.upsert' || body.data.key.fromMe || !body.data.message) {
      return NextResponse.json({ ok: true });
    }

    const text = body.data.message.conversation || body.data.message.extendedTextMessage?.text;
    if (!text) return NextResponse.json({ ok: true });

    // Extract phone from remoteJid (format: 91xxxxxxxxxx@s.whatsapp.net)
    const phoneMatch = body.data.key.remoteJid.match(/^(\d+)@/);
    if (!phoneMatch) return NextResponse.json({ ok: true });

    const phone = `+${phoneMatch[1]}`;
    const code = text.trim();

    // Verify OTP format (6 digits)
    if (!/^\d{6}$/.test(code)) return NextResponse.json({ ok: true });

    // Check OTP in Redis
    const { verifyOtp } = await import('@/lib/otp');
    const valid = await verifyOtp(phone, code);
    if (!valid) return NextResponse.json({ ok: true });

    // OTP valid - mint session (same as verify-otp route)
    const service = createServiceSupabase();
    const { data: list, error: listErr } = await service.auth.admin.listUsers({ perPage: 200 });
    if (listErr) return NextResponse.json({ ok: true });

    const existing = list.users.find((u) => u.phone === phone.replace('+', ''));
    const tempPassword = crypto.randomUUID();

    let userId: string;
    if (existing) {
      userId = existing.id;
      await service.auth.admin.updateUserById(userId, {
        password: tempPassword,
        phone_confirm: true,
      });
    } else {
      const { data: created, error } = await service.auth.admin.createUser({
        phone,
        phone_confirm: true,
        password: tempPassword,
      });
      if (error || !created.user) return NextResponse.json({ ok: true });
      userId = created.user.id;
    }

    const supabase = createServiceSupabase();
    await supabase.auth.signInWithPassword({ phone, password: tempPassword });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Evolution webhook error:', err);
    return NextResponse.json({ ok: true });
  }
}