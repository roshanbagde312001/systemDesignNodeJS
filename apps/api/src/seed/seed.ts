/**
 * Seeds MongoDB with the content package (designs, articles, categories, tags, learning paths)
 * and creates the first admin user from ADMIN_EMAIL / ADMIN_PASSWORD.
 *
 * Idempotent: documents are upserted by slug, so it is safe to re-run after content changes.
 *   npm run seed            # upsert
 *   npm run seed -- --reset # wipe content collections first (users are kept)
 */
import { articles, categories, learningPaths, systemDesigns, tags } from '@sda/content';
import { env } from '../config/env';
import { connectDb, disconnectDb } from '../lib/db';
import { logger } from '../lib/logger';
import { Article, Category, LearningPath, SystemDesign, Tag, User } from '../models';
import { authService } from '../services/auth.service';

type SeedModel = typeof Article | typeof Category | typeof LearningPath | typeof SystemDesign | typeof Tag;

async function upsertAll(model: SeedModel, docs: { slug: string }[]) {
  if (docs.length === 0) return 0;
  const res = await (model as typeof Article).bulkWrite(
    docs.map((doc) => ({ updateOne: { filter: { slug: doc.slug }, update: { $set: doc }, upsert: true } })),
  );
  return res.upsertedCount + res.modifiedCount;
}

export async function seed({ reset = false } = {}) {
  if (reset) {
    await Promise.all([Article, SystemDesign, Category, Tag, LearningPath].map((m) => (m as typeof Article).deleteMany({})));
    logger.info('Content collections cleared');
  }
  // Make sure indexes exist (autoIndex is off in production).
  await Promise.all([Article, SystemDesign, Category, Tag, LearningPath, User].map((m) => (m as typeof Article).syncIndexes()));

  const counts = {
    categories: await upsertAll(Category, categories),
    tags: await upsertAll(Tag, tags),
    systemDesigns: await upsertAll(SystemDesign, systemDesigns.map((d) => ({ ...d, publishedAt: d.status === 'planned' ? undefined : d.publishedAt }) as never)),
    articles: await upsertAll(Article, articles as never),
    learningPaths: await upsertAll(LearningPath, learningPaths.map((p, order) => ({ ...p, order }))),
  };
  logger.info({ counts }, 'Content upserted');

  if (env.ADMIN_EMAIL && env.ADMIN_PASSWORD) {
    const exists = await User.exists({ email: env.ADMIN_EMAIL.toLowerCase() });
    if (!exists) {
      await User.create({ email: env.ADMIN_EMAIL, name: env.ADMIN_NAME, role: 'admin', passwordHash: await authService.hashPassword(env.ADMIN_PASSWORD) });
      logger.info({ email: env.ADMIN_EMAIL }, 'Admin user created');
    }
  } else {
    logger.warn('ADMIN_EMAIL / ADMIN_PASSWORD not set — no admin user created');
  }
  return counts;
}

// Run only when executed directly (not when imported by tests).
const isMain = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js');
if (isMain) {
  connectDb(env.MONGODB_URI)
    .then(() => seed({ reset: process.argv.includes('--reset') }))
    .then(() => disconnectDb())
    .then(() => process.exit(0))
    .catch((err) => {
      logger.fatal({ err }, 'Seed failed');
      process.exit(1);
    });
}
