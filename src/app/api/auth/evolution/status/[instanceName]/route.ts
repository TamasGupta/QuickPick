import { NextResponse } from 'next/server';
import { getInstanceStatus } from '@/lib/evolution';
import { authRatelimit } from '@/lib/rateLimit';
import { withApiLogging } from '@/lib/apiLogger';

export const GET = withApiLogging(
  '/api/auth/evolution/status/[instanceName]',
  async (_req: Request, { params }: { params: Promise<{ instanceName: string }> }) => {
    const { instanceName } = await params;
    if (!instanceName) return NextResponse.json({ error: 'Instance name required' }, { status: 400 });

    const { success } = await authRatelimit.limit(`evo-status:${instanceName}`);
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    try {
      const status = await getInstanceStatus(instanceName);
      return NextResponse.json({ state: status.state });
    } catch (err) {
      return NextResponse.json(
        { error: (err as Error).message ?? 'Failed to get status' },
        { status: 502 }
      );
    }
  },
  { rateLimit: 'auth' }
);