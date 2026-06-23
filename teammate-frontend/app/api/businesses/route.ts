// True proxy for /api/businesses. The previous version used the api()
// helper which does a server-side fetch with a relative URL — that
// throws "Failed to parse URL" because Node has no base URL for
// relative paths. Forward the request to the backend with absolute
// URL and BOTH the Authorization header and the refreshToken cookie
// carried through (the new proxyFetch helper handles both).
import { type NextRequest } from 'next/server';
import { proxyFetch } from '@/lib/api-server';

export async function GET(req: NextRequest) {
  return proxyFetch(req, '/api/business/mine', { method: 'GET' });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  return proxyFetch(req, '/api/business', { method: 'POST', body });
}
