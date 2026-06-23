// Proxy /api/chat/message to the gateway. Authorization + refresh
// cookie are forwarded by proxyFetch on every leg.
import { type NextRequest } from 'next/server';
import { proxyFetch } from '@/lib/api-server';

interface ProxyMessage {
  id: string
  content: string
  isFromUser: boolean
  chatSessionId: string
  createdAt: string
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chatbotId, message, visitorId } = body ?? {};
    if (!chatbotId || !message) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1) Start or fetch a chat session
    const sessionRes = await proxyFetch(request, '/api/chat/session', {
      method: 'POST',
      body: { visitorId: visitorId ?? `widget-${chatbotId}` },
    });
    const sessionJson = (await sessionRes.json()) as {
      chatSession?: { id?: string; sessionToken?: string };
      error?: string;
    };
    const sessionId = sessionJson.chatSession?.id;
    if (!sessionId) {
      return Response.json(
        { error: sessionJson.error ?? 'Failed to open chat session' },
        { status: 502 },
      );
    }

    // 2) Post the user message
    await proxyFetch(request, `/api/chat/${sessionId}/message`, {
      method: 'POST',
      body: { content: message, isFromUser: true },
    });

    // 3) Read back the conversation
    const messagesRes = await proxyFetch(request, `/api/chat/${sessionId}/messages`, {
      method: 'GET',
    });
    const messagesJson = (await messagesRes.json()) as { messages?: ProxyMessage[] };
    const lastAssistant = [...(messagesJson.messages ?? [])]
      .reverse()
      .find((m) => !m.isFromUser)

    return Response.json(
      { conversationId: sessionId, response: lastAssistant?.content ?? '' },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal server error';
    return Response.json({ error: message }, { status: 500 });
  }
}
