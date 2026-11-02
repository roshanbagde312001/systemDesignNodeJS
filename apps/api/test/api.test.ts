import type { Express } from 'express';
import request from 'supertest';
import { loginAsAdmin, setupTestApp, teardownTestApp, validArticle } from './helpers';

let app: Express;
beforeAll(async () => {
  app = await setupTestApp();
});
afterAll(teardownTestApp);

describe('health', () => {
  it('reports liveness and readiness', async () => {
    expect((await request(app).get('/health')).status).toBe(200);
    const ready = await request(app).get('/ready');
    expect(ready.status).toBe(200);
    expect(ready.body.checks.mongodb).toBe('up');
  });
});

describe('public content API', () => {
  it('lists published system designs with pagination metadata', async () => {
    const res = await request(app).get('/api/v1/system-designs');
    expect(res.status).toBe(200);
    expect(res.body.data.map((d: { slug: string }) => d.slug)).toEqual(expect.arrayContaining(['url-shortener', 'messaging-system', 'ecommerce-orders']));
    expect(res.body.data.every((d: { status: string }) => d.status === 'published')).toBe(true);
    expect(res.body).toMatchObject({ page: 1, limit: 20, total: 3 });
    // Summaries must not include the heavy fields
    expect(res.body.data[0].sections).toBeUndefined();
    expect(res.headers['cache-control']).toContain('max-age=60');
  });

  it('includes planned designs only when asked', async () => {
    const res = await request(app).get('/api/v1/system-designs?includePlanned=true');
    expect(res.body.data.some((d: { status: string }) => d.status === 'planned')).toBe(true);
  });

  it('returns a full design with all 22 sections and a diagram', async () => {
    const res = await request(app).get('/api/v1/system-designs/url-shortener');
    expect(res.status).toBe(200);
    expect(res.body.sections).toHaveLength(22);
    expect(res.body.diagram.nodes.length).toBeGreaterThan(5);
    expect(res.body.id).toBeDefined();
    expect(res.body._id).toBeUndefined();
  });

  it('filters articles by difficulty, technology and keyword', async () => {
    const byDifficulty = await request(app).get('/api/v1/articles?difficulty=Beginner');
    expect(byDifficulty.body.data.length).toBeGreaterThan(0);
    expect(byDifficulty.body.data.every((a: { difficulty: string }) => a.difficulty === 'Beginner')).toBe(true);

    const byTech = await request(app).get('/api/v1/articles?technology=redis');
    expect(byTech.body.data.map((a: { slug: string }) => a.slug)).toContain('redis-caching');

    const byQ = await request(app).get('/api/v1/articles?q=kafka');
    expect(byQ.body.data[0].slug).toBe('message-queues-kafka');
  });

  it('sorts and paginates', async () => {
    const res = await request(app).get('/api/v1/articles?sort=reading-time&limit=3&page=2');
    expect(res.body.data).toHaveLength(3);
    expect(res.body.page).toBe(2);
    const mins = res.body.data.map((a: { readingMinutes: number }) => a.readingMinutes);
    expect([...mins].sort((a, b) => a - b)).toEqual(mins);
  });

  it('returns 404 with a structured error for unknown slugs', async () => {
    const res = await request(app).get('/api/v1/articles/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatchObject({ code: 'NOT_FOUND' });
    expect(res.body.error.requestId).toBeDefined();
  });
});

describe('validation and error handling', () => {
  it('rejects invalid query parameters', async () => {
    const res = await request(app).get('/api/v1/articles?difficulty=Expert&limit=1000');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toHaveProperty('difficulty');
    expect(res.body.error.details).toHaveProperty('limit');
  });

  it('rejects invalid slugs in the path', async () => {
    expect((await request(app).get('/api/v1/articles/Bad_Slug!')).status).toBe(400);
  });

  it('rejects malformed JSON', async () => {
    const res = await request(app).post('/api/v1/auth/login').set('Content-Type', 'application/json').send('{"email":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/api/v1/nope/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
  });

  it('sets security headers', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-request-id']).toBeDefined();
  });
});

describe('authentication', () => {
  it('rejects wrong credentials without revealing which part was wrong', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'admin@test.dev', password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    const unknown = await request(app).post('/api/v1/auth/login').send({ email: 'nobody@test.dev', password: 'wrong-password' });
    expect(unknown.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('logs in, sets an httpOnly refresh cookie, and never returns the password hash', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'admin@test.dev', password: 'correct-horse-battery' });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTypeOf('string');
    expect(res.body.user).toMatchObject({ email: 'admin@test.dev', role: 'admin' });
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toContain('sda_rt=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
  });

  it('rotates the refresh token and rejects reuse of the old one', async () => {
    const { cookie } = await loginAsAdmin(app);
    const first = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(first.status).toBe(200);
    expect(first.body.accessToken).toBeTypeOf('string');
    const reused = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(reused.status).toBe(401);
    const second = await request(app).post('/api/v1/auth/refresh').set('Cookie', first.headers['set-cookie']);
    expect(second.status).toBe(200);
  });

  it('logout revokes the refresh token', async () => {
    const { cookie } = await loginAsAdmin(app);
    expect((await request(app).post('/api/v1/auth/logout').set('Cookie', cookie)).status).toBe(204);
    expect((await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie)).status).toBe(401);
  });

  it('returns the current user for a valid token', async () => {
    const { token } = await loginAsAdmin(app);
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('admin@test.dev');
  });
});

describe('admin authorization', () => {
  it('blocks admin endpoints without a token', async () => {
    const res = await request(app).get('/api/v1/admin/articles');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('blocks admin endpoints with a forged token', async () => {
    const forged = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIiwicm9sZSI6ImFkbWluIn0.invalidsignature';
    const res = await request(app).delete('/api/v1/admin/articles/000000000000000000000000').set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });
});

describe('admin article management', () => {
  let token: string;
  beforeAll(async () => {
    ({ token } = await loginAsAdmin(app));
  });
  const auth = () => ({ Authorization: `Bearer ${token}` });

  it('validates input and reports field errors', async () => {
    const res = await request(app).post('/api/v1/admin/articles').set(auth()).send({ ...validArticle, slug: 'Not A Slug', readingMinutes: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toHaveProperty('slug');
    expect(res.body.error.details).toHaveProperty('readingMinutes');
  });

  it('creates a draft that is hidden from the public API, publishes it, then unpublishes it', async () => {
    const created = await request(app).post('/api/v1/admin/articles').set(auth()).send(validArticle);
    expect(created.status).toBe(201);
    expect(created.body.title).toBe('Test Article'); // HTML stripped from plain-text fields
    expect(created.body.body).toContain('<T>'); // Markdown body untouched
    const id = created.body.id;

    expect((await request(app).get('/api/v1/articles/test-article')).status).toBe(404);

    const published = await request(app).post(`/api/v1/admin/articles/${id}/publish`).set(auth());
    expect(published.body.status).toBe('published');
    expect(published.body.publishedAt).toBeDefined();
    expect((await request(app).get('/api/v1/articles/test-article')).status).toBe(200);

    await request(app).post(`/api/v1/admin/articles/${id}/unpublish`).set(auth()).expect(200);
    expect((await request(app).get('/api/v1/articles/test-article')).status).toBe(404);
  });

  it('rejects duplicate slugs with 409', async () => {
    const res = await request(app).post('/api/v1/admin/articles').set(auth()).send({ ...validArticle, slug: 'redis-caching' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('updates and deletes an article', async () => {
    const created = await request(app).post('/api/v1/admin/articles').set(auth()).send({ ...validArticle, slug: 'to-delete' });
    const id = created.body.id;
    const updated = await request(app).patch(`/api/v1/admin/articles/${id}`).set(auth()).send({ title: 'Renamed' });
    expect(updated.body.title).toBe('Renamed');
    expect((await request(app).delete(`/api/v1/admin/articles/${id}`).set(auth())).status).toBe(204);
    expect((await request(app).get(`/api/v1/admin/articles/${id}`).set(auth())).status).toBe(404);
  });

  it('rejects malformed ids', async () => {
    expect((await request(app).get('/api/v1/admin/articles/123').set(auth())).status).toBe(400);
  });

  it('prevents deleting a category that is still in use', async () => {
    const cats = await request(app).get('/api/v1/admin/categories').set(auth());
    const caching = cats.body.data.find((c: { slug: string }) => c.slug === 'caching');
    const res = await request(app).delete(`/api/v1/admin/categories/${caching.id}`).set(auth());
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CATEGORY_IN_USE');
  });

  it('edits system design metadata', async () => {
    const list = await request(app).get('/api/v1/admin/system-designs').set(auth());
    const d = list.body.data.find((x: { slug: string }) => x.slug === 'url-shortener');
    const res = await request(app).patch(`/api/v1/admin/system-designs/${d.id}`).set(auth()).send({ readingMinutes: 30, diagramImageUrl: 'https://example.com/d.png' });
    expect(res.status).toBe(200);
    expect(res.body.readingMinutes).toBe(30);
    // Deep content is preserved
    expect(res.body.sections).toHaveLength(22);
  });
});

describe('login rate limiting', () => {
  it('returns 429 after too many failed attempts', async () => {
    let last = 0;
    for (let i = 0; i < 8; i++) {
      last = (await request(app).post('/api/v1/auth/login').send({ email: 'admin@test.dev', password: 'bad-password-x' })).status;
    }
    expect(last).toBe(429);
  });
});
