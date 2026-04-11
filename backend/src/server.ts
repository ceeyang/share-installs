/**
 * @fileoverview Application entrypoint.
 * Initializes database and cache connections, then starts the HTTP server.
 */

import {PrismaClient} from '@prisma/client';
import {Redis} from 'ioredis';
import {config} from './config/index';
import {logger} from './utils/logger';
import {createApp} from './app';

async function bootstrap(): Promise<void> {
  // Initialize Prisma
  const prisma = new PrismaClient({
    log: config.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

  // Initialize Redis
  const redis = new Redis(config.REDIS_URL, {
    keyPrefix: '',
    retryStrategy: (times: number) => Math.min(times * 50, 2000),
    maxRetriesPerRequest: 3,
  });

  redis.on('error', err => logger.error({err}, 'Redis connection error'));
  redis.on('connect', () => logger.info('Redis connected'));

  // Verify DB connection
  try {
    await prisma.$connect();
    logger.info('Database connected');
  } catch (err) {
    logger.fatal({err}, 'Failed to connect to database');
    process.exit(1);
  }

  const app = createApp(prisma, redis);

  const server = app.listen(config.PORT, config.HOST, () => {
    logger.info(
      {port: config.PORT, host: config.HOST, env: config.NODE_ENV},
      'Server started',
    );
  });

  // Graceful shutdown
  const gracefulShutdown = async (signal: string): Promise<void> => {
    logger.info({signal}, 'Received shutdown signal, closing connections...');
    server.close(async () => {
      await prisma.$disconnect();
      redis.disconnect();
      logger.info('Server shut down gracefully');
      process.exit(0);
    });

    // Force shutdown after 30s
    setTimeout(() => {
      logger.error('Graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, 30_000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

bootstrap().catch(err => {
  logger.fatal({err}, 'Unhandled startup error');
  process.exit(1);
});
