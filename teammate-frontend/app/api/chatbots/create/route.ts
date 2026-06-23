// Proxy /api/chatbots/create to the gateway. Authorization + refresh
// cookie are forwarded by proxyFetch.
import { type NextRequest } from 'next/server';
import { proxyFetch } from '@/lib/api-server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { businessId, name, description } = body ?? {};
    if (!businessId || !name) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    return proxyFetch(request, '/api/widget', {
      method: 'POST',
      body: {
        title: name,
        description: description ?? '',
        theme: 'AUTO',
        position: 'BOTTOM_RIGHT',
        isEnabled: true,
        businessId,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal server error';
    return Response.json({ error: message }, { status: 500 });
  }
}
