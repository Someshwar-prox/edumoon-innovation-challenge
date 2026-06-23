import { type NextRequest } from 'next/server';
import { proxyFetch } from '@/lib/api-server';

export async function POST(req: NextRequest) {
  const body = await req.json();
  return proxyFetch(req, '/api/business/generate-description', { method: 'POST', body });
}
