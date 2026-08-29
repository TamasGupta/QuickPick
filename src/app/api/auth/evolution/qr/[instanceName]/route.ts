import { NextResponse } from 'next/server';
import { getInstanceQrCode } from '@/lib/evolution';
import { authRatelimit } from '@/lib/rateLimit';
import { withApiLogging } from '@/lib/apiLogger';

export const GET = withApiLogging(
  '/api/auth/evolution/qr/[instanceName]',
  async (_req: Request, { params }: { params: Promise<{ instanceName: string }> }) => {
    const { instanceName } = await params;
    if (!instanceName) return NextResponse.json({ error: 'Instance name required' }, { status: 400 });

    const { success } = await authRatelimit.limit(`evo-qr:${instanceName}`);
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    try {
      const qr = await getInstanceQrCode(instanceName);
      return NextResponse.json({ qrCode: qr.base64, code: qr.code });
    } catch (err) {
      return NextResponse.json(
        { error: (err as Error).message ?? 'Failed to get QR code' },
        { status: 502 }
      );
    }
  },
  { rateLimit: 'auth' }
);