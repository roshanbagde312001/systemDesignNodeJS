import { articleInputSchema, DIFFICULTIES, slugify, type Article, type ArticleInput, type Category } from '@sda/shared';
import { Alert, Box, Button, MenuItem, Paper, Skeleton, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { HttpError } from '../../data/api';
import { ArticleView } from '../ArticlePage';

const EMPTY: ArticleInput = {
  slug: '',
  title: '',
  summary: '',
  simple: '',
  body: '## Introduction\n\nWrite your article in Markdown. Use [[cache]] to link glossary terms, and\n\n> [!TIP]\n> callouts like this.\n',
  category: 'caching',
  tags: [],
  technologies: [],
  patterns: [],
  difficulty: 'Beginner',
  readingMinutes: 8,
  related: [],
  status: 'draft',
};

const list = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

export default function AdminArticleEditor() {
  const { id } = useParams();
  const isNew = !id;
  const { authFetch } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<ArticleInput>(EMPTY);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string }>();
  const [slugTouched, setSlugTouched] = useState(!isNew);

  useEffect(() => {
    authFetch<{ data: Category[] }>('/admin/categories').then((r) => setCategories(r.data)).catch(() => undefined);
    if (!isNew) {
      authFetch<Article & { id: string }>(`/admin/articles/${id}`)
        .then((a) => setForm({ ...EMPTY, ...a, status: a.status === 'published' ? 'published' : 'draft' }))
        .catch((e) => setMessage({ type: 'error', text: (e as Error).message }))
        .finally(() => setLoading(false));
    }
  }, [id, isNew, authFetch]);

  const set = <K extends keyof ArticleInput>(k: K, v: ArticleInput[K]) => {
    setForm((f) => ({ ...f, [k]: v, ...(k === 'title' && !slugTouched ? { slug: slugify(String(v)) } : {}) }));
  };

  const save = async (status: 'draft' | 'published') => {
    setMessage(undefined);
    const candidate = { ...form, status };
    // Validate with the same Zod schema the API uses, for instant feedback.
    const parsed = articleInputSchema.safeParse(candidate);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      setMessage({ type: 'error', text: 'Please fix the highlighted fields.' });
      return;
    }
    setErrors({});
    try {
      const saved = await authFetch<{ id: string }>(isNew ? '/admin/articles' : `/admin/articles/${id}`, {
        method: isNew ? 'POST' : 'PATCH',
        body: JSON.stringify(parsed.data),
      });
      setForm(candidate);
      setMessage({ type: 'success', text: status === 'published' ? 'Published.' : 'Draft saved.' });
      if (isNew) navigate(`/admin/articles/${saved.id}`, { replace: true });
    } catch (e) {
      if (e instanceof HttpError && e.details && typeof e.details === 'object') {
        setErrors(Object.fromEntries(Object.entries(e.details as Record<string, string[]>).map(([k, v]) => [k, v[0]])));
      }
      setMessage({ type: 'error', text: (e as Error).message });
    }
  };

  if (loading) return <Skeleton variant="rounded" height={500} />;

  const field = (k: keyof ArticleInput) => ({ error: !!errors[k], helperText: errors[k] });
  const previewArticle: Article = { ...form, publishedAt: new Date().toISOString(), popularity: 0 };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }} flexWrap="wrap" useFlexGap spacing={1}>
        <Typography variant="h3" component="h2">
          {isNew ? 'New article' : 'Edit article'}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button onClick={() => navigate('/admin')}>Back</Button>
          <Button variant="outlined" onClick={() => save('draft')}>
            Save draft
          </Button>
          <Button variant="contained" onClick={() => save('published')}>
            {form.status === 'published' ? 'Update published' : 'Publish'}
          </Button>
        </Stack>
      </Stack>
      {message && <Alert severity={message.type} sx={{ mb: 2 }}>{message.text}</Alert>}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="edit" label="Edit" />
        <Tab value="preview" label="Preview" />
      </Tabs>
      {tab === 'edit' ? (
        <Stack spacing={2}>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' } }}>
            <TextField label="Title" value={form.title} onChange={(e) => set('title', e.target.value)} {...field('title')} required />
            <TextField
              label="Slug"
              value={form.slug}
              onChange={(e) => {
                setSlugTouched(true);
                set('slug', e.target.value);
              }}
              {...field('slug')}
              required
            />
          </Box>
          <TextField label="Summary (shown on cards)" value={form.summary} onChange={(e) => set('summary', e.target.value)} {...field('summary')} multiline minRows={2} required />
          <TextField label="In plain English (beginner explanation, use an analogy)" value={form.simple} onChange={(e) => set('simple', e.target.value)} {...field('simple')} multiline minRows={3} required />
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' } }}>
            <TextField select label="Category" value={form.category} onChange={(e) => set('category', e.target.value)} {...field('category')}>
              {(categories.length ? categories : [{ slug: form.category, name: form.category } as Category]).map((c) => (
                <MenuItem key={c.slug} value={c.slug}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField select label="Difficulty" value={form.difficulty} onChange={(e) => set('difficulty', e.target.value as ArticleInput['difficulty'])}>
              {DIFFICULTIES.map((d) => (
                <MenuItem key={d} value={d}>
                  {d}
                </MenuItem>
              ))}
            </TextField>
            <TextField label="Reading minutes" type="number" value={form.readingMinutes} onChange={(e) => set('readingMinutes', Number(e.target.value))} {...field('readingMinutes')} />
          </Box>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
            <TextField label="Tags (comma separated)" value={form.tags.join(', ')} onChange={(e) => set('tags', list(e.target.value))} />
            <TextField label="Technologies (comma separated)" value={form.technologies.join(', ')} onChange={(e) => set('technologies', list(e.target.value))} />
            <TextField label="Patterns (comma separated)" value={form.patterns.join(', ')} onChange={(e) => set('patterns', list(e.target.value))} />
            <TextField label="Related article slugs (comma separated)" value={form.related.join(', ')} onChange={(e) => set('related', list(e.target.value))} {...field('related')} />
          </Box>
          <TextField
            label="Body (Markdown)"
            value={form.body}
            onChange={(e) => set('body', e.target.value)}
            {...field('body')}
            multiline
            minRows={18}
            InputProps={{ sx: { fontFamily: '"JetBrains Mono", monospace', fontSize: '0.85rem' } }}
            helperText={errors.body ?? 'Markdown with GFM tables. [[slug]] glossary links, > [!TIP] callouts, ```diagram A -> B``` flow diagrams. Raw HTML is not rendered.'}
          />
        </Stack>
      ) : (
        <Paper sx={{ p: { xs: 2, md: 4 } }}>
          <ArticleView article={previewArticle} preview />
        </Paper>
      )}
    </Box>
  );
}
