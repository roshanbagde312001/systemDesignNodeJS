import type { ArticleInput, ListQuery } from '@sda/shared';
import type { z } from 'zod';
import type { categoryInputSchema, learningPathInputSchema, systemDesignMetaUpdateSchema, tagInputSchema } from '@sda/shared';
import { articleRepo, categoryRepo, designRepo, isObjectId, learningPathRepo, tagRepo } from '../repositories';
import { AppError, notFound } from '../utils/errors';
import { sanitizeFields } from '../utils/sanitize';

/* Business rules for content. Controllers stay thin; repositories stay query-only. */

const requireId = (id: string) => {
  if (!isObjectId(id)) throw new AppError(400, 'INVALID_ID', 'Invalid id');
};

/* ------------------------------ Articles ----------------------------- */
const ARTICLE_TEXT_FIELDS: (keyof ArticleInput)[] = ['title', 'summary', 'simple'];

export const articleService = {
  listPublic: (q: ListQuery) => articleRepo.listPublic(q),
  async getPublic(slug: string) {
    const a = await articleRepo.findPublishedBySlug(slug);
    if (!a) throw notFound('Article');
    return a;
  },
  listAdmin: (q: ListQuery & { status?: string }) => articleRepo.listAdmin(q),
  async getAdmin(id: string) {
    requireId(id);
    const a = await articleRepo.findById(id);
    if (!a) throw notFound('Article');
    return a;
  },
  async create(input: ArticleInput) {
    const data = sanitizeFields(input, ARTICLE_TEXT_FIELDS);
    return articleRepo.create({ ...data, publishedAt: data.status === 'published' ? new Date() : undefined });
  },
  async update(id: string, input: Partial<ArticleInput>) {
    const existing = await this.getAdmin(id);
    const data: Record<string, unknown> = sanitizeFields(input, ARTICLE_TEXT_FIELDS);
    // First publication sets publishedAt; later edits keep the original date (updatedAt tracks edits).
    if (data.status === 'published' && !existing.publishedAt) data.publishedAt = new Date();
    return articleRepo.update(id, data);
  },
  publish: (id: string) => articleService.update(id, { status: 'published' }),
  unpublish: (id: string) => articleService.update(id, { status: 'draft' }),
  async remove(id: string) {
    requireId(id);
    const deleted = await articleRepo.remove(id);
    if (!deleted) throw notFound('Article');
  },
};

/* --------------------------- System designs -------------------------- */
export const designService = {
  listPublic: (q: ListQuery, includePlanned: boolean) => designRepo.listPublic(q, includePlanned),
  async getPublic(slug: string) {
    const d = await designRepo.findPublicBySlug(slug);
    if (!d) throw notFound('System design');
    return d;
  },
  listAdmin: () => designRepo.listAdmin(),
  async updateMeta(id: string, input: z.infer<typeof systemDesignMetaUpdateSchema>) {
    requireId(id);
    const data: Record<string, unknown> = sanitizeFields(input, ['title', 'tagline', 'summary']);
    if (data.diagramImageUrl === '') data.diagramImageUrl = undefined;
    if (data.status === 'published') {
      const existing = await designRepo.findById(id);
      if (existing && !existing.publishedAt) data.publishedAt = new Date();
    }
    const d = await designRepo.update(id, data);
    if (!d) throw notFound('System design');
    return d;
  },
};

/* ------------------------- Categories and tags ----------------------- */
export const taxonomyService = {
  listCategories: () => categoryRepo.list({}, { kind: 1, name: 1 }),
  createCategory: (input: z.infer<typeof categoryInputSchema>) => categoryRepo.create(sanitizeFields(input, ['name', 'description'])),
  async updateCategory(id: string, input: Partial<z.infer<typeof categoryInputSchema>>) {
    requireId(id);
    const c = await categoryRepo.update(id, sanitizeFields(input, ['name', 'description']));
    if (!c) throw notFound('Category');
    return c;
  },
  async removeCategory(id: string) {
    requireId(id);
    const c = await categoryRepo.findById(id);
    if (!c) throw notFound('Category');
    // Referential integrity: don't orphan articles.
    const inUse = await articleRepo.findOne({ category: c.slug });
    if (inUse) throw new AppError(409, 'CATEGORY_IN_USE', 'Move or delete the articles in this category first');
    await categoryRepo.remove(id);
  },
  listTags: () => tagRepo.list(),
  createTag: (input: z.infer<typeof tagInputSchema>) => tagRepo.create(sanitizeFields(input, ['name'])),
  async updateTag(id: string, input: Partial<z.infer<typeof tagInputSchema>>) {
    requireId(id);
    const t = await tagRepo.update(id, sanitizeFields(input, ['name']));
    if (!t) throw notFound('Tag');
    return t;
  },
  async removeTag(id: string) {
    requireId(id);
    if (!(await tagRepo.remove(id))) throw notFound('Tag');
  },
};

/* --------------------------- Learning paths -------------------------- */
type PathInput = z.infer<typeof learningPathInputSchema>;
export const learningPathService = {
  listPublic: () => learningPathRepo.listPublic(),
  async getPublic(slug: string) {
    const p = await learningPathRepo.findPublishedBySlug(slug);
    if (!p) throw notFound('Learning path');
    return p;
  },
  listAdmin: () => learningPathRepo.list({}, { order: 1, createdAt: 1 }),
  create: (input: PathInput) => learningPathRepo.create(sanitizeFields(input, ['title', 'description', 'audience'])),
  async update(id: string, input: Partial<PathInput>) {
    requireId(id);
    const p = await learningPathRepo.update(id, sanitizeFields(input, ['title', 'description', 'audience']));
    if (!p) throw notFound('Learning path');
    return p;
  },
  async remove(id: string) {
    requireId(id);
    if (!(await learningPathRepo.remove(id))) throw notFound('Learning path');
  },
};
