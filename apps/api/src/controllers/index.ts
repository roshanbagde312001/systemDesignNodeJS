import type { ListQuery } from '@sda/shared';
import type { CookieOptions, Request, Response } from 'express';
import { env, isProd } from '../config/env';
import { isDbReady } from '../lib/db';
import { authService } from '../services/auth.service';
import { articleService, designService, learningPathService, taxonomyService } from '../services/content.service';
import { asyncHandler } from '../utils/errors';

/* Controllers translate HTTP <-> service calls. No business logic or queries live here. */

const query = <T = ListQuery>(req: Request) => req.query as unknown as T;

/* ------------------------------- Health ------------------------------ */
export const health = {
  live: (_req: Request, res: Response) => res.json({ status: 'ok', uptime: process.uptime() }),
  ready: (_req: Request, res: Response) => {
    const db = isDbReady();
    res.status(db ? 200 : 503).json({ status: db ? 'ready' : 'not-ready', checks: { mongodb: db ? 'up' : 'down' } });
  },
};

/* ------------------------------- Public ------------------------------ */
export const publicController = {
  listDesigns: asyncHandler(async (req, res) => {
    const q = query<ListQuery & { includePlanned?: boolean }>(req);
    res.json(await designService.listPublic(q, !!q.includePlanned));
  }),
  getDesign: asyncHandler(async (req, res) => res.json(await designService.getPublic(req.params.slug))),
  listArticles: asyncHandler(async (req, res) => res.json(await articleService.listPublic(query(req)))),
  getArticle: asyncHandler(async (req, res) => res.json(await articleService.getPublic(req.params.slug))),
  listCategories: asyncHandler(async (_req, res) => res.json({ data: await taxonomyService.listCategories() })),
  listTags: asyncHandler(async (_req, res) => res.json({ data: await taxonomyService.listTags() })),
  listLearningPaths: asyncHandler(async (_req, res) => res.json({ data: await learningPathService.listPublic() })),
  getLearningPath: asyncHandler(async (req, res) => res.json(await learningPathService.getPublic(req.params.slug))),
  search: asyncHandler(async (req, res) => {
    const q = query(req);
    const [designs, articles] = await Promise.all([designService.listPublic(q, false), articleService.listPublic(q)]);
    res.json({ designs: designs.data, articles: articles.data, total: designs.total + articles.total });
  }),
};

/* -------------------------------- Auth ------------------------------- */
const REFRESH_COOKIE = 'sda_rt';
const cookieOptions = (expires?: Date): CookieOptions => ({
  httpOnly: true, // not readable by JavaScript → safe from XSS token theft
  secure: isProd, // HTTPS only in production
  sameSite: 'strict', // not sent on cross-site requests → CSRF protection for the refresh endpoint
  path: '/api/v1/auth', // only sent to auth endpoints
  expires,
});

export const authController = {
  login: asyncHandler(async (req, res) => {
    const r = await authService.login(req.body.email, req.body.password);
    res.cookie(REFRESH_COOKIE, r.refreshToken, cookieOptions(r.refreshExpiresAt));
    res.json({ accessToken: r.accessToken, user: r.user, expiresIn: env.ACCESS_TOKEN_TTL });
  }),
  refresh: asyncHandler(async (req, res) => {
    try {
      const r = await authService.refresh(req.cookies?.[REFRESH_COOKIE]);
      res.cookie(REFRESH_COOKIE, r.refreshToken, cookieOptions(r.refreshExpiresAt));
      res.json({ accessToken: r.accessToken, user: r.user, expiresIn: env.ACCESS_TOKEN_TTL });
    } catch (err) {
      res.clearCookie(REFRESH_COOKIE, cookieOptions());
      throw err;
    }
  }),
  logout: asyncHandler(async (req, res) => {
    await authService.logout(req.cookies?.[REFRESH_COOKIE]);
    res.clearCookie(REFRESH_COOKIE, cookieOptions());
    res.status(204).end();
  }),
  me: asyncHandler(async (req, res) => res.json(await authService.me(req.user!.sub))),
};

/* ------------------------------- Admin ------------------------------- */
export const adminController = {
  listArticles: asyncHandler(async (req, res) => res.json(await articleService.listAdmin(query(req)))),
  getArticle: asyncHandler(async (req, res) => res.json(await articleService.getAdmin(req.params.id))),
  createArticle: asyncHandler(async (req, res) => res.status(201).json(await articleService.create(req.body))),
  updateArticle: asyncHandler(async (req, res) => res.json(await articleService.update(req.params.id, req.body))),
  publishArticle: asyncHandler(async (req, res) => res.json(await articleService.publish(req.params.id))),
  unpublishArticle: asyncHandler(async (req, res) => res.json(await articleService.unpublish(req.params.id))),
  deleteArticle: asyncHandler(async (req, res) => {
    await articleService.remove(req.params.id);
    res.status(204).end();
  }),

  listDesigns: asyncHandler(async (_req, res) => res.json({ data: await designService.listAdmin() })),
  updateDesign: asyncHandler(async (req, res) => res.json(await designService.updateMeta(req.params.id, req.body))),

  listCategories: asyncHandler(async (_req, res) => res.json({ data: await taxonomyService.listCategories() })),
  createCategory: asyncHandler(async (req, res) => res.status(201).json(await taxonomyService.createCategory(req.body))),
  updateCategory: asyncHandler(async (req, res) => res.json(await taxonomyService.updateCategory(req.params.id, req.body))),
  deleteCategory: asyncHandler(async (req, res) => {
    await taxonomyService.removeCategory(req.params.id);
    res.status(204).end();
  }),
  listTags: asyncHandler(async (_req, res) => res.json({ data: await taxonomyService.listTags() })),
  createTag: asyncHandler(async (req, res) => res.status(201).json(await taxonomyService.createTag(req.body))),
  updateTag: asyncHandler(async (req, res) => res.json(await taxonomyService.updateTag(req.params.id, req.body))),
  deleteTag: asyncHandler(async (req, res) => {
    await taxonomyService.removeTag(req.params.id);
    res.status(204).end();
  }),

  listPaths: asyncHandler(async (_req, res) => res.json({ data: await learningPathService.listAdmin() })),
  createPath: asyncHandler(async (req, res) => res.status(201).json(await learningPathService.create(req.body))),
  updatePath: asyncHandler(async (req, res) => res.json(await learningPathService.update(req.params.id, req.body))),
  deletePath: asyncHandler(async (req, res) => {
    await learningPathService.remove(req.params.id);
    res.status(204).end();
  }),
};
