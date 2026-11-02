import { z } from 'zod';
import { CONTENT_STATUSES, DIFFICULTIES } from './types';

/** URL-safe slug: lowercase letters, numbers and single hyphens. */
export const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens');

const shortText = (max: number) => z.string().trim().min(1).max(max);
const stringList = z.array(z.string().trim().min(1).max(60)).max(30);

export const difficultySchema = z.enum(DIFFICULTIES);
export const statusSchema = z.enum(CONTENT_STATUSES);

export const articleInputSchema = z.object({
  slug: slugSchema,
  title: shortText(160),
  summary: shortText(400),
  simple: shortText(2000),
  body: z.string().min(1).max(100_000),
  category: slugSchema,
  tags: stringList.default([]),
  technologies: stringList.default([]),
  patterns: stringList.default([]),
  difficulty: difficultySchema,
  readingMinutes: z.number().int().min(1).max(120),
  related: z.array(slugSchema).max(10).default([]),
  status: z.enum(['draft', 'published']).default('draft'),
});
export type ArticleInput = z.infer<typeof articleInputSchema>;
export const articleUpdateSchema = articleInputSchema.partial();

export const categoryInputSchema = z.object({
  slug: slugSchema,
  name: shortText(80),
  description: shortText(400),
  kind: z.enum(['concept', 'design', 'pattern']),
});
export const categoryUpdateSchema = categoryInputSchema.partial();

export const tagInputSchema = z.object({ slug: slugSchema, name: shortText(60) });
export const tagUpdateSchema = tagInputSchema.partial();

export const learningPathInputSchema = z.object({
  slug: slugSchema,
  title: shortText(160),
  description: shortText(600),
  audience: shortText(200),
  difficulty: difficultySchema,
  status: z.enum(['draft', 'published']).default('draft'),
  steps: z
    .array(
      z.object({
        title: shortText(160),
        kind: z.enum(['article', 'design', 'playground']),
        ref: z.string().trim().min(1).max(120),
        note: z.string().trim().max(400).default(''),
      }),
    )
    .min(1)
    .max(40),
});
export const learningPathUpdateSchema = learningPathInputSchema.partial();

/** Only metadata is editable from the admin; the deep content lives in the content package/seed. */
export const systemDesignMetaUpdateSchema = z
  .object({
    title: shortText(160),
    tagline: shortText(200),
    summary: shortText(600),
    category: slugSchema,
    difficulty: difficultySchema,
    readingMinutes: z.number().int().min(1).max(180),
    technologies: stringList,
    patterns: stringList,
    tags: stringList,
    status: statusSchema,
    diagramImageUrl: z.union([z.literal(''), z.string().url().max(500)]),
  })
  .partial();

export const listQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(60).optional(),
  difficulty: difficultySchema.optional(),
  technology: z.string().trim().max(60).optional(),
  pattern: z.string().trim().max(60).optional(),
  tag: z.string().trim().max(60).optional(),
  sort: z.enum(['newest', 'popular', 'reading-time']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListQuery = z.infer<typeof listQuerySchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8).max(200),
});
