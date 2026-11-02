import type { Article, ArticleSummary, Category, LearningPath, Paginated, SystemDesign, SystemDesignSummary } from '@sda/shared';

export const API_BASE: string = import.meta.env.VITE_API_URL ?? '/api/v1';

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

/* ------------------------------------------------------------------ */
/* Content source tracking: the UI shows whether data came from the    */
/* live API or from content bundled with the frontend.                 */
/* ------------------------------------------------------------------ */
export type ContentSource = 'unknown' | 'api' | 'bundled';
let source: ContentSource = 'unknown';
let apiUnreachable = false;
const listeners = new Set<() => void>();
function setSource(s: ContentSource) {
  if (source === s) return;
  source = s;
  listeners.forEach((l) => l());
}
export const contentSource = {
  get: () => source,
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export async function request<T>(path: string, init: RequestInit & { token?: string; timeoutMs?: number } = {}): Promise<T> {
  const { token, timeoutMs = 4000, headers, ...rest } = init;
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    signal: AbortSignal.timeout(timeoutMs),
    ...rest,
    headers: {
      Accept: 'application/json',
      ...(rest.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });
  if (res.status === 204) return undefined as T;
  const isJson = res.headers.get('content-type')?.includes('application/json');
  if (!isJson) throw new HttpError(res.status === 200 ? 502 : res.status, 'BAD_GATEWAY', 'API did not return JSON');
  const body = await res.json();
  if (!res.ok) throw new HttpError(res.status, body?.error?.code ?? 'ERROR', body?.error?.message ?? res.statusText, body?.error?.details);
  return body as T;
}

const loadBundled = () => import('@sda/content');

/**
 * Try the API first; if it is unreachable (network error, 5xx, no JSON), use bundled content.
 * A real 404 from a healthy API is passed through so "not found" pages stay honest.
 */
async function withFallback<T>(fromApi: () => Promise<T>, fromBundle: () => Promise<T>): Promise<T> {
  if (!apiUnreachable) {
    try {
      const result = await fromApi();
      setSource('api');
      return result;
    } catch (err) {
      if (err instanceof HttpError && err.status < 500) throw err;
      apiUnreachable = true;
    }
  }
  setSource('bundled');
  return fromBundle();
}

const summarizeDesign = ({ sections: _s, diagram: _d, apis: _a, interviewQuestions: _i, analogy: _an, related: _r, ...rest }: SystemDesign): SystemDesignSummary => rest;
const summarizeArticle = ({ body: _b, simple: _s, related: _r, ...rest }: Article): ArticleSummary => rest;

export function notFound(what: string): never {
  throw new HttpError(404, 'NOT_FOUND', `${what} not found`);
}

export const api = {
  listDesigns: () =>
    withFallback(
      async () => (await request<Paginated<SystemDesignSummary>>('/system-designs?limit=100&includePlanned=true')).data,
      async () => (await loadBundled()).systemDesigns.map(summarizeDesign),
    ),
  getDesign: (slug: string) =>
    withFallback(
      () => request<SystemDesign>(`/system-designs/${encodeURIComponent(slug)}`),
      async () => (await loadBundled()).systemDesigns.find((d) => d.slug === slug) ?? notFound('System design'),
    ),
  listArticles: () =>
    withFallback(
      async () => (await request<Paginated<ArticleSummary>>('/articles?limit=100')).data,
      async () => (await loadBundled()).articles.filter((a) => a.status === 'published').map(summarizeArticle),
    ),
  getArticle: (slug: string) =>
    withFallback(
      () => request<Article>(`/articles/${encodeURIComponent(slug)}`),
      async () => (await loadBundled()).articles.find((a) => a.slug === slug && a.status === 'published') ?? notFound('Article'),
    ),
  listCategories: () =>
    withFallback(
      async () => (await request<{ data: Category[] }>('/categories')).data,
      async () => (await loadBundled()).categories,
    ),
  listLearningPaths: () =>
    withFallback(
      async () => (await request<{ data: LearningPath[] }>('/learning-paths')).data,
      async () => (await loadBundled()).learningPaths,
    ),
  getLearningPath: (slug: string) =>
    withFallback(
      () => request<LearningPath>(`/learning-paths/${encodeURIComponent(slug)}`),
      async () => (await loadBundled()).learningPaths.find((p) => p.slug === slug) ?? notFound('Learning path'),
    ),
};

/** Test helper: reset fallback state between tests. */
export function __resetApiState() {
  apiUnreachable = false;
  source = 'unknown';
}
