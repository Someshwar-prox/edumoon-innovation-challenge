// Side-effects of a business URL change: wipe the per-business vector
// memory in ai-service and clear the chat history in Postgres so a
// fresh URL doesn't keep inheriting the previous site's context.
import axios from 'axios';
import { config } from '../../config';
import { chatRepository } from '../../chat/repositories/chat.repository';
import logger from '../../utils/logger';

export async function wipeBusinessKnowledge(businessId: string): Promise<void> {
  const aiUrl = config.externalLlmServiceUrl;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.externalApiKey) headers['X-Api-Key'] = config.externalApiKey;
  try {
    await axios.post(
      `${aiUrl}/v1/reset-knowledge`,
      { business_id: businessId },
      { headers, timeout: 30_000 },
    );
  } catch (err) {
    logger.error({ err, businessId }, 'ai-service reset-knowledge failed');
  }
  try {
    const dropped = await chatRepository.deleteByBusinessId(businessId);
    logger.info({ businessId, dropped }, 'cleared chat history for business');
  } catch (err) {
    logger.error({ err, businessId }, 'failed to clear chat history');
  }
}