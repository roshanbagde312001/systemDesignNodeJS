import { createApp } from './app';
import { env } from './config/env';
import { connectDb, disconnectDb } from './lib/db';
import { logger } from './lib/logger';

async function main() {
  await connectDb(env.MONGODB_URI);
  const server = createApp().listen(env.PORT, () => logger.info({ port: env.PORT, env: env.NODE_ENV }, 'API listening'));

  // Graceful shutdown: stop accepting connections, finish in-flight requests, then close the DB.
  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    server.close(async () => {
      await disconnectDb();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start');
  process.exit(1);
});
