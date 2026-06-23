import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';

const prisma = new PrismaClient({
  log: [
    { emit: 'stdout', level: 'warn' },
    { emit: 'stdout', level: 'error' },
  ],
});

if (process.env.NODE_ENV === 'development') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma.$on('query' as never, (e: { query: string; params: string; duration: number }) => {
    logger.debug(`Query: ${e.query}`);
    logger.debug(`Params: ${e.params}`);
    logger.debug(`Duration: ${e.duration}ms`);
  });
}

prisma
  .$connect()
  .then(() => {
    logger.info('Connected to database');
  })
  .catch((e: unknown) => {
    logger.error('Database connection error', e);
    process.exit(1);
  });

const shutdown = async (signal: string): Promise<void> => {
  logger.info(`Received ${signal}, disconnecting from database...`);
  try {
    await prisma.$disconnect();
  } catch (e) {
    logger.error('Error disconnecting from database', e);
  } finally {
    process.exit(0);
  }
};

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

export { prisma };
export default prisma;
