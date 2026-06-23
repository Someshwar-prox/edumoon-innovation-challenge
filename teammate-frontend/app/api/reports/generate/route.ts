// Proxy /api/reports/generate to the gateway. Authorization + refresh
// cookie are forwarded by proxyFetch.
import { type NextRequest } from 'next/server';
import { proxyFetch } from '@/lib/api-server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { businessId, focusAreas, includeDocuments, language } = body ?? {};
    if (!businessId) {
      return Response.json({ error: 'Missing businessId' }, { status: 400 });
    }

    return proxyFetch(request, `/api/audit/generate/${businessId}`, {
      method: 'POST',
      body: {
        focusAreas,
        includeDocuments: includeDocuments ?? true,
        language: language ?? 'en',
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal server error';
    return Response.json({ error: message }, { status: 500 });
  }
}
