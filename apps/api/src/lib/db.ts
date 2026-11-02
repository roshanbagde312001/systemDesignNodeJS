import mongoose from 'mongoose';
import { isProd } from '../config/env';
import { logger } from './logger';

mongoose.set('strictQuery', true);

export async function connectDb(uri: string) {
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000,
    maxPoolSize: 20,
    // Index builds can be expensive on large collections; in production create them during deploys (npm run seed syncs them).
    autoIndex: !isProd,
  });
  logger.info({ host: mongoose.connection.host, db: mongoose.connection.name }, 'MongoDB connected');
}

export async function disconnectDb() {
  await mongoose.disconnect();
}

export const isDbReady = () => mongoose.connection.readyState === 1;
