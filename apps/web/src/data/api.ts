import type { Article, ArticleSummary, SystemDesign, SystemDesignSummary } from '../shared';

/** Thrown when a slug does not match any bundled content, so pages can show "not found". */
export class NotFoundError extends Error {
  readonly status = 404;
}

/** All content ships with the frontend; it is loaded lazily so it lands in its own chunk. */
const loadContent = () => import('../content');

const summarizeDesign = ({ sections: _s, diagram: _d, apis: _a, interviewQuestions: _i, analogy: _an, related: _r, ...rest }: SystemDesign): SystemDesignSummary => rest;
const summarizeArticle = ({ body: _b, simple: _s, related: _r, ...rest }: Article): ArticleSummary => rest;

export function notFound(what: string): never {
  throw new NotFoundError(`${what} not found`);
}

export const api = {
  listDesigns: async () => (await loadContent()).systemDesigns.map(summarizeDesign),
  getDesign: async (slug: string) => (await loadContent()).systemDesigns.find((d) => d.slug === slug) ?? notFound('System design'),
  listArticles: async () => (await loadContent()).articles.filter((a) => a.status === 'published').map(summarizeArticle),
  getArticle: async (slug: string) => (await loadContent()).articles.find((a) => a.slug === slug && a.status === 'published') ?? notFound('Article'),
  listCategories: async () => (await loadContent()).categories,
  listLearningPaths: async () => (await loadContent()).learningPaths,
  getLearningPath: async (slug: string) => (await loadContent()).learningPaths.find((p) => p.slug === slug) ?? notFound('Learning path'),
};
