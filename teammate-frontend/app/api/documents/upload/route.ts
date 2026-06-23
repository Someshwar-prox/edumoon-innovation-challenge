// Proxy /api/documents/upload to the gateway. Forwards multipart body
// as-is and lets proxyFetch attach Authorization + refresh cookie.
import { type NextRequest } from 'next/server';
import { proxyFetch } from '@/lib/api-server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const businessId = formData.get('businessId') as string | null;
    if (!file || !businessId) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const upstream = new FormData();
    upstream.append('file', file);
    upstream.append('businessId', businessId);

    return proxyFetch(request, '/api/documents/upload', {
      method: 'POST',
      body: upstream,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal server error';
    return Response.json({ error: message }, { status: 500 });
  }
}
