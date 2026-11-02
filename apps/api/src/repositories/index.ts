import type { ListQuery, Paginated } from '@sda/shared';
import mongoose, { type FilterQuery, type Model } from 'mongoose';
import { Article, Category, LearningPath, SystemDesign, Tag, User } from '../models';
import { cleanLean } from '../models/plugins';
import { escapeRegex } from '../utils/sanitize';

/* Data-access layer: the only place that knows about Mongoose queries. */

const ci = (v: string) => new RegExp(`^${escapeRegex(v)}$`, 'i');

/** Translates validated list query params into a MongoDB filter (same semantics as the frontend filter). */
export function buildContentFilter(q: Partial<ListQuery>, base: FilterQuery<unknown> = {}): FilterQuery<unknown> {
  const filter: FilterQuery<unknown> = { ...base };
  if (q.category) filter.category = q.category;
  if (q.difficulty) filter.difficulty = q.difficulty;
  if (q.technology) filter.technologies = ci(q.technology);
  if (q.pattern) filter.patterns = ci(q.pattern);
  if (q.tag) filter.tags = ci(q.tag);
  if (q.q) filter.$text = { $search: q.q };
  return filter;
}

const SORTS = {
  newest: { publishedAt: -1, _id: -1 },
  popular: { popularity: -1, _id: -1 },
  'reading-time': { readingMinutes: 1, _id: 1 },
} as const;

// Mongoose's per-model generics don't unify across models, so the shared paginator accepts any model.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyModel = Model<any>;

export async function paginate(
  model: AnyModel,
  filter: FilterQuery<unknown>,
  opts: { page: number; limit: number; sort?: keyof typeof SORTS; projection?: Record<string, 0 | 1> },
): Promise<Paginated<Record<string, unknown>>> {
  const sort = filter.$text && opts.sort === 'newest' ? { score: { $meta: 'textScore' } as const, publishedAt: -1 as const } : SORTS[opts.sort ?? 'newest'];
  const projection = filter.$text ? { ...opts.projection, score: { $meta: 'textScore' } } : opts.projection;
  const [docs, total] = await Promise.all([
    model
      .find(filter, projection)
      .sort(sort as Record<string, 1 | -1>)
      .skip((opts.page - 1) * opts.limit)
      .limit(opts.limit)
      .lean(),
    model.countDocuments(filter),
  ]);
  return {
    data: docs.map((d) => {
      const { score: _s, ...rest } = cleanLean(d as Record<string, unknown> & { _id: unknown });
      return rest;
    }),
    page: opts.page,
    limit: opts.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / opts.limit)),
  };
}

export const isObjectId = (id: string) => mongoose.isValidObjectId(id);

/** Generic CRUD for simple collections. */
function crud<T>(model: Model<T>) {
  return {
    list: (filter: FilterQuery<T> = {}, sort: Record<string, 1 | -1> = { name: 1 }) => model.find(filter).sort(sort),
    findById: (id: string) => model.findById(id),
    findOne: (filter: FilterQuery<T>) => model.findOne(filter),
    // Inputs are already validated by Zod at the HTTP boundary and by the schema on write.
    create: (data: Record<string, unknown>) => model.create(data),
    update: (id: string, data: Record<string, unknown>) => model.findByIdAndUpdate(id, data, { new: true, runValidators: true }),
    remove: (id: string) => model.findByIdAndDelete(id),
  };
}

const SUMMARY_EXCLUDE = { body: 0, simple: 0, related: 0, sections: 0, diagram: 0, apis: 0, interviewQuestions: 0, analogy: 0 } as const;

export const articleRepo = {
  ...crud(Article),
  listPublic: (q: ListQuery) => paginate(Article, buildContentFilter(q, { status: 'published' }), { ...q, projection: SUMMARY_EXCLUDE }),
  listAdmin: (q: ListQuery & { status?: string }) =>
    paginate(Article, buildContentFilter(q, q.status ? { status: q.status } : {}), { page: q.page, limit: q.limit, sort: 'newest', projection: SUMMARY_EXCLUDE }),
  findPublishedBySlug: (slug: string) => Article.findOne({ slug, status: 'published' }),
};

export const designRepo = {
  ...crud(SystemDesign),
  listPublic: (q: ListQuery, includePlanned: boolean) =>
    paginate(SystemDesign, buildContentFilter(q, { status: { $in: includePlanned ? ['published', 'planned'] : ['published'] } }), { ...q, projection: SUMMARY_EXCLUDE }),
  listAdmin: () => SystemDesign.find({}, SUMMARY_EXCLUDE).sort({ publishedAt: -1 }),
  findPublicBySlug: (slug: string) => SystemDesign.findOne({ slug, status: { $in: ['published', 'planned'] } }),
};

export const categoryRepo = crud(Category);
export const tagRepo = crud(Tag);
export const learningPathRepo = {
  ...crud(LearningPath),
  listPublic: () => LearningPath.find({ status: 'published' }).sort({ order: 1, createdAt: 1 }),
  findPublishedBySlug: (slug: string) => LearningPath.findOne({ slug, status: 'published' }),
};

export const userRepo = {
  findByEmailWithSecrets: (email: string) => User.findOne({ email: email.toLowerCase() }).select('+passwordHash +refreshTokens'),
  findById: (id: string) => User.findById(id),
  findByRefreshHash: (hash: string) => User.findOne({ 'refreshTokens.hash': hash }).select('+refreshTokens'),
  create: (data: { email: string; name: string; passwordHash: string; role: 'admin' | 'editor' }) => User.create(data),
  /** Atomically swaps one refresh token for another (rotation) and prunes expired ones. */
  rotateRefreshToken: async (userId: unknown, oldHash: string | null, next: { hash: string; expiresAt: Date }) => {
    if (oldHash) await User.updateOne({ _id: userId }, { $pull: { refreshTokens: { $or: [{ hash: oldHash }, { expiresAt: { $lt: new Date() } }] } } });
    // Keep at most 5 sessions per user.
    await User.updateOne({ _id: userId }, { $push: { refreshTokens: { $each: [next], $slice: -5 } } });
  },
  removeRefreshToken: (hash: string) => User.updateOne({ 'refreshTokens.hash': hash }, { $pull: { refreshTokens: { hash } } }),
};
