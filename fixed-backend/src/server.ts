import http from 'http';
import { Server } from 'socket.io';
import app from './app';
import { config } from './config';
import logger from './utils/logger';

const server = http.createServer(app);

// Socket.IO setup (feature-flagged so it stays off in environments without FEATURE_WEBSOCKET_ENABLED)
let io: Server | null = null;
if (process.env.FEATURE_WEBSOCKET_ENABLED === 'true') {
  io = new Server(server, {
    cors: {
      origin: config.corsOrigin,
      methods: ['GET', 'POST'],
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  io.on('connection', (socket: any) => {
    logger.info(`User connected: ${socket.id}`);

    socket.on('disconnect', () => {
      logger.info(`User disconnected: ${socket.id}`);
    });
  });
}

const PORT = Number(config.port) || 3000;

server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${config.nodeEnv}`);
});

// Graceful shutdown
const shutdown = (signal: string): void => {
  logger.info(`${signal} received, shutting down gracefully`);
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export { server, io };
export default server;
