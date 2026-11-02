import type { Difficulty } from './types';

/** Minimal shape needed to search and filter any content item. */
export interface Searchable {
  slug: string;
  title: string;
  summary: string;
  category: string;
  difficulty: Difficulty;
  tags: string[];
  technologies: string[];
  patterns: string[];
  readingMinutes: number;
  publishedAt: string;
  popularity: number;
}

export interface SearchFilters {
  q?: string;
  category?: string;
  difficulty?: Difficulty;
  technology?: string;
  pattern?: string;
  sort?: 'newest' | 'popular' | 'reading-time';
}

const norm = (s: string) => s.toLowerCase();

/** Scores an item against a free-text query. 0 means no match. */
export function scoreMatch(item: Searchable, q: string): number {
  const terms = norm(q).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return 1;
  let score = 0;
  for (const term of terms) {
    let termScore = 0;
    if (norm(item.title).includes(term)) termScore += 5;
    if ([...item.tags, ...item.technologies, ...item.patterns].some((t) => norm(t).includes(term))) termScore += 3;
    if (norm(item.category).includes(term)) termScore += 2;
    if (norm(item.summary).includes(term)) termScore += 1;
    // Every term must match somewhere, so "redis cache" doesn't return everything mentioning "cache".
    if (termScore === 0) return 0;
    score += termScore;
  }
  return score;
}

const eq = (a: string, b: string) => norm(a) === norm(b);

/** Pure filter + sort used by the search page; the API implements the same semantics in MongoDB. */
export function filterAndSort<T extends Searchable>(items: T[], f: SearchFilters): T[] {
  const scored = items
    .map((item) => ({ item, score: f.q ? scoreMatch(item, f.q) : 1 }))
    .filter(({ item, score }) => {
      if (score === 0) return false;
      if (f.category && !eq(item.category, f.category)) return false;
      if (f.difficulty && item.difficulty !== f.difficulty) return false;
      if (f.technology && !item.technologies.some((t) => eq(t, f.technology!))) return false;
      if (f.pattern && !item.patterns.some((p) => eq(p, f.pattern!))) return false;
      return true;
    });

  const sort = f.sort ?? 'newest';
  scored.sort((a, b) => {
    if (f.q && b.score !== a.score && sort === 'newest') return b.score - a.score;
    if (sort === 'popular') return b.item.popularity - a.item.popularity;
    if (sort === 'reading-time') return a.item.readingMinutes - b.item.readingMinutes;
    return b.item.publishedAt.localeCompare(a.item.publishedAt);
  });
  return scored.map((s) => s.item);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[`*_~[\]()]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
