import {
  articleInputSchema,
  articleUpdateSchema,
  categoryInputSchema,
  categoryUpdateSchema,
  learningPathInputSchema,
  learningPathUpdateSchema,
  listQuerySchema,
  loginSchema,
  slugSchema,
  systemDesignMetaUpdateSchema,
  tagInputSchema,
  tagUpdateSchema,
} from '@sda/shared';
import { Router } from 'express';
import { z } from 'zod';
import { adminController as admin, authController as auth, publicController as pub } from '../controllers';
import { loginRateLimit, noStore, publicCache, requireAuth, requireRole, validate } from '../middleware';

const slugParams = z.object({ slug: slugSchema });
const idParams = z.object({ id: z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id') });
const designListQuery = listQuerySchema.extend({ includePlanned: z.enum(['true', 'false']).optional().transform((v) => v === 'true') });
const adminListQuery = listQuerySchema.extend({ status: z.enum(['draft', 'published']).optional() });

/* ------------------------------ Public ------------------------------ */
export const publicRouter = Router();
publicRouter.use(publicCache());
publicRouter.get('/system-designs', validate({ query: designListQuery }), pub.listDesigns);
publicRouter.get('/system-designs/:slug', validate({ params: slugParams }), pub.getDesign);
publicRouter.get('/articles', validate({ query: listQuerySchema }), pub.listArticles);
publicRouter.get('/articles/:slug', validate({ params: slugParams }), pub.getArticle);
publicRouter.get('/categories', pub.listCategories);
publicRouter.get('/tags', pub.listTags);
publicRouter.get('/learning-paths', pub.listLearningPaths);
publicRouter.get('/learning-paths/:slug', validate({ params: slugParams }), pub.getLearningPath);
publicRouter.get('/search', validate({ query: listQuerySchema }), pub.search);

/* ------------------------------- Auth ------------------------------- */
export const authRouter = Router();
authRouter.use(noStore);
authRouter.post('/login', loginRateLimit, validate({ body: loginSchema }), auth.login);
authRouter.post('/refresh', auth.refresh);
authRouter.post('/logout', auth.logout);
authRouter.get('/me', requireAuth, auth.me);

/* ------------------------------- Admin ------------------------------ */
// Every admin route requires a valid access token AND an admin/editor role.
export const adminRouter = Router();
adminRouter.use(noStore, requireAuth, requireRole('admin', 'editor'));

adminRouter.get('/articles', validate({ query: adminListQuery }), admin.listArticles);
adminRouter.post('/articles', validate({ body: articleInputSchema }), admin.createArticle);
adminRouter.get('/articles/:id', validate({ params: idParams }), admin.getArticle);
adminRouter.patch('/articles/:id', validate({ params: idParams, body: articleUpdateSchema }), admin.updateArticle);
adminRouter.post('/articles/:id/publish', validate({ params: idParams }), admin.publishArticle);
adminRouter.post('/articles/:id/unpublish', validate({ params: idParams }), admin.unpublishArticle);
adminRouter.delete('/articles/:id', validate({ params: idParams }), admin.deleteArticle);

adminRouter.get('/system-designs', admin.listDesigns);
adminRouter.patch('/system-designs/:id', validate({ params: idParams, body: systemDesignMetaUpdateSchema }), admin.updateDesign);

adminRouter.get('/categories', admin.listCategories);
adminRouter.post('/categories', requireRole('admin'), validate({ body: categoryInputSchema }), admin.createCategory);
adminRouter.patch('/categories/:id', requireRole('admin'), validate({ params: idParams, body: categoryUpdateSchema }), admin.updateCategory);
adminRouter.delete('/categories/:id', requireRole('admin'), validate({ params: idParams }), admin.deleteCategory);
adminRouter.get('/tags', admin.listTags);
adminRouter.post('/tags', validate({ body: tagInputSchema }), admin.createTag);
adminRouter.patch('/tags/:id', validate({ params: idParams, body: tagUpdateSchema }), admin.updateTag);
adminRouter.delete('/tags/:id', requireRole('admin'), validate({ params: idParams }), admin.deleteTag);

adminRouter.get('/learning-paths', admin.listPaths);
adminRouter.post('/learning-paths', validate({ body: learningPathInputSchema }), admin.createPath);
adminRouter.patch('/learning-paths/:id', validate({ params: idParams, body: learningPathUpdateSchema }), admin.updatePath);
adminRouter.delete('/learning-paths/:id', requireRole('admin'), validate({ params: idParams }), admin.deletePath);
