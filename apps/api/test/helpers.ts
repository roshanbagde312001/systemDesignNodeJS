import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../src/app';
import { seed } from '../src/seed/seed';

let mongo: MongoMemoryServer;

/** Starts an in-memory MongoDB, seeds it, and returns a fresh Express app. */
export async function setupTestApp() {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await seed();
  return createApp();
}

export async function teardownTestApp() {
  await mongoose.disconnect();
  await mongo?.stop();
}

export async function loginAsAdmin(app: ReturnType<typeof createApp>) {
  const res = await request(app).post('/api/v1/auth/login').send({ email: 'admin@test.dev', password: 'correct-horse-battery' });
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { token: res.body.accessToken as string, cookie: res.headers['set-cookie'] as unknown as string[] };
}

export const validArticle = {
  slug: 'test-article',
  title: 'Test <b>Article</b>',
  summary: 'A summary',
  simple: 'Explained simply',
  body: '## Hello\n\nSome `code` with <T> generics.',
  category: 'caching',
  tags: ['redis'],
  technologies: ['Redis'],
  patterns: [],
  difficulty: 'Beginner',
  readingMinutes: 5,
  related: [],
  status: 'draft',
};
