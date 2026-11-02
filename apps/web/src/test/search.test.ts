import { articles, systemDesigns } from '@sda/content';
import { filterAndSort, scoreMatch } from '@sda/shared';

const published = systemDesigns.filter((d) => d.status === 'published');

describe('search and filtering', () => {
  it('requires every query term to match', () => {
    const redis = articles.find((a) => a.slug === 'redis-caching')!;
    expect(scoreMatch(redis, 'redis caching')).toBeGreaterThan(0);
    expect(scoreMatch(redis, 'redis kubernetes')).toBe(0);
  });

  it('ranks title matches above summary matches', () => {
    const results = filterAndSort(articles, { q: 'kafka' });
    expect(results[0].slug).toBe('message-queues-kafka');
  });

  it('filters by difficulty, technology (case-insensitive) and pattern', () => {
    expect(filterAndSort(articles, { difficulty: 'Beginner' }).every((a) => a.difficulty === 'Beginner')).toBe(true);
    expect(filterAndSort(published, { technology: 'websockets' }).map((d) => d.slug)).toEqual(['messaging-system']);
    expect(filterAndSort(published, { pattern: 'Saga' }).map((d) => d.slug)).toEqual(['ecommerce-orders']);
  });

  it('sorts by newest, popularity and reading time', () => {
    const newest = filterAndSort(articles, { sort: 'newest' });
    expect(newest[0].publishedAt >= newest[newest.length - 1].publishedAt).toBe(true);
    const popular = filterAndSort(articles, { sort: 'popular' });
    expect(popular[0].popularity).toBe(Math.max(...articles.map((a) => a.popularity)));
    const short = filterAndSort(articles, { sort: 'reading-time' });
    expect(short[0].readingMinutes).toBe(Math.min(...articles.map((a) => a.readingMinutes)));
  });

  it('returns nothing for an unmatched query', () => {
    expect(filterAndSort(articles, { q: 'zzzz-no-match' })).toEqual([]);
  });
});

describe('content integrity', () => {
  it('every published design has all 22 sections, a diagram and valid flows', () => {
    for (const d of published) {
      expect(d.sections).toHaveLength(22);
      const ids = new Set(d.diagram!.nodes.map((n) => n.id));
      for (const e of d.diagram!.edges) {
        expect(ids.has(e.source) && ids.has(e.target), `${d.slug}: edge ${e.id}`).toBe(true);
      }
      for (const f of d.diagram!.flows) for (const s of f.steps) expect(ids.has(s.from) && ids.has(s.to), `${d.slug}/${f.id}: ${s.title}`).toBe(true);
      for (const r of d.related) expect(systemDesigns.some((x) => x.slug === r)).toBe(true);
    }
  });

  it('article related links point to existing articles', () => {
    for (const a of articles) for (const r of a.related) expect(articles.some((x) => x.slug === r), `${a.slug} -> ${r}`).toBe(true);
  });
});
