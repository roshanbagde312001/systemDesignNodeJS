import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import RouteOutlinedIcon from '@mui/icons-material/RouteOutlined';
import SearchIcon from '@mui/icons-material/Search';
import { simulatorDiagramCompact } from '@sda/content/src/playground';
import type { ArticleSummary, Category } from '@sda/shared';
import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Container,
  InputAdornment,
  Link,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { lazy, Suspense, useMemo, useState, type FormEvent } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  ArticleCard,
  CardGridSkeleton,
  DesignCard,
  DifficultyChip,
  ErrorState,
  SectionHeader,
  Seo,
  ViewAllButton,
} from '../components/common';
import { api } from '../data/api';
import { useAsync } from '../data/hooks';

const ArchitectureViewer = lazy(() => import('../components/diagram/ArchitectureViewer').then((m) => ({ default: m.ArchitectureViewer })));

const FEATURED = ['messaging-system', 'video-streaming', 'url-shortener', 'ride-hailing', 'ecommerce-orders', 'notification-service'];

export default function HomePage() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const designs = useAsync(() => api.listDesigns(), []);
  const articles = useAsync(() => api.listArticles(), []);
  const categories = useAsync(() => api.listCategories(), []);
  const paths = useAsync(() => api.listLearningPaths(), []);

  const catName = useMemo(() => new Map((categories.data ?? []).map((c) => [c.slug, c.name])), [categories.data]);
  const featured = useMemo(
    () => FEATURED.map((slug) => designs.data?.find((d) => d.slug === slug)).filter((d): d is NonNullable<typeof d> => !!d),
    [designs.data],
  );

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    navigate(q.trim() ? `/search?q=${encodeURIComponent(q.trim())}` : '/search');
  };

  return (
    <>
      <Seo title="Understand How Systems Are Built" path="/" description="Explore real-world architectures, backend engineering patterns and distributed systems through simple, interactive visual explanations." />

      {/* A. Hero */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', py: { xs: 6, md: 9 } }}>
        <Container maxWidth="lg">
          <Box sx={{ display: 'grid', gap: { xs: 5, md: 6 }, gridTemplateColumns: { xs: '1fr', md: '5fr 6fr' }, alignItems: 'center' }}>
            <Box>
              <Typography variant="overline" color="secondary">
                Interactive system design, explained simply
              </Typography>
              <Typography variant="h1" sx={{ mt: 1 }}>
                Understand How Systems Are Built.
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mt: 2.5, fontSize: '1.1rem', maxWidth: 540 }}>
                Explore real-world architectures, backend engineering patterns, distributed systems, and scalable applications through interactive visual explanations.
              </Typography>
              <Box component="form" onSubmit={onSearch} role="search" sx={{ mt: 3.5, maxWidth: 520 }}>
                <TextField
                  fullWidth
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search systems and concepts — e.g. “Redis”, “chat”, “rate limiting”"
                  inputProps={{ 'aria-label': 'Search systems and concepts' }}
                  InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
                />
              </Box>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 2.5 }}>
                <Button component={RouterLink} to="/system-designs" variant="contained" size="large" endIcon={<ArrowForwardIcon />}>
                  Explore System Designs
                </Button>
                <Button component={RouterLink} to="/concepts" variant="outlined" size="large">
                  Browse Backend Concepts
                </Button>
              </Stack>
            </Box>
            <Suspense fallback={<Skeleton variant="rounded" height={520} />}>
              <ArchitectureViewer diagram={simulatorDiagramCompact} height={320} />
            </Suspense>
          </Box>
        </Container>
      </Box>

      <Container maxWidth="lg">
        {/* Beginner on-ramp */}
        <Paper sx={{ mt: 6, p: { xs: 2.5, md: 3.5 }, borderColor: 'secondary.main' }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems={{ md: 'center' }}>
            <RouteOutlinedIcon color="secondary" sx={{ fontSize: 40 }} aria-hidden />
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h4" component="h2">
                New to system design? Start here.
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                Every page starts with a real-life analogy and has a <b>Quick read</b> mode that hides the jargon. Hover any <Box component="span" sx={{ borderBottom: '1px dashed', borderColor: 'secondary.main' }}>underlined word</Box> for a one-line meaning.
              </Typography>
            </Box>
            <Button component={RouterLink} to="/learning-paths/start-from-zero" variant="contained" color="secondary" endIcon={<ArrowForwardIcon />} sx={{ flexShrink: 0 }}>
              Start from zero
            </Button>
          </Stack>
        </Paper>

        {/* B. Featured system designs */}
        <Box component="section" sx={{ mt: 9 }} aria-labelledby="featured-heading">
          <SectionHeader eyebrow="System designs" title="Featured system designs" description="Complete walk-throughs with requirements, estimates, interactive diagrams, APIs, schemas and trade-offs." action={<ViewAllButton to="/system-designs">All designs</ViewAllButton>} />
          {designs.error && <ErrorState error={designs.error} onRetry={designs.reload} />}
          {designs.loading && !designs.data ? (
            <CardGridSkeleton />
          ) : (
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '1fr 1fr 1fr' } }}>
              {featured.map((d) => (
                <DesignCard key={d.slug} design={d} categoryName={catName.get(d.category)} />
              ))}
            </Box>
          )}
        </Box>

        {/* C. Backend engineering topics */}
        <Box component="section" sx={{ mt: 9 }}>
          <SectionHeader eyebrow="Backend concepts" title="Backend engineering topics" description="The building blocks every system design is made of." action={<ViewAllButton to="/concepts">All concepts</ViewAllButton>} />
          <TopicGrid categories={categories.data} articles={articles.data} />
        </Box>

        {/* D. Learning paths */}
        <Box component="section" sx={{ mt: 9 }}>
          <SectionHeader eyebrow="Guided" title="Learning paths" description="Not sure what to read next? Follow a path — each step builds on the last." action={<ViewAllButton to="/learning-paths">All paths</ViewAllButton>} />
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' } }}>
            {(paths.data ?? []).slice(0, 6).map((p) => (
              <Card key={p.slug}>
                <CardActionArea component={RouterLink} to={`/learning-paths/${p.slug}`} sx={{ height: '100%' }}>
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="caption" color="text.secondary">
                        {p.steps.length} steps
                      </Typography>
                      <DifficultyChip value={p.difficulty} />
                    </Stack>
                    <Typography variant="h5" component="h3" sx={{ mt: 1 }}>
                      {p.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                      {p.description}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            ))}
            {paths.loading && !paths.data && [0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={170} />)}
          </Box>
        </Box>

        {/* E. Recently published + popular */}
        <Box component="section" sx={{ mt: 9, display: 'grid', gap: 4, gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' } }}>
          <Box>
            <SectionHeader title="Recently published" />
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
              {[...(articles.data ?? [])]
                .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
                .slice(0, 4)
                .map((a) => (
                  <ArticleCard key={a.slug} article={a} categoryName={catName.get(a.category)} />
                ))}
            </Box>
          </Box>
          <Box>
            <SectionHeader title="Popular designs" />
            <Paper>
              <List disablePadding>
                {[...(designs.data ?? [])]
                  .filter((d) => d.status === 'published')
                  .sort((a, b) => b.popularity - a.popularity)
                  .map((d, i) => (
                    <ListItemButton key={d.slug} component={RouterLink} to={`/system-design/${d.slug}`} divider>
                      <Typography sx={{ width: 28, color: 'text.secondary', fontWeight: 700 }}>{i + 1}</Typography>
                      <ListItemText primary={d.title} secondary={`${d.difficulty} · ${d.readingMinutes} min`} />
                    </ListItemButton>
                  ))}
              </List>
            </Paper>
            <Link component={RouterLink} to="/playground" sx={{ display: 'inline-block', mt: 2 }}>
              Try the architecture playground →
            </Link>
          </Box>
        </Box>
      </Container>
    </>
  );
}

function TopicGrid({ categories, articles }: { categories?: Category[]; articles?: ArticleSummary[] }) {
  if (!categories) return <CardGridSkeleton count={10} />;
  const topics = categories.filter((c) => c.kind === 'concept');
  return (
    <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(5, 1fr)' } }}>
      {topics.map((c) => {
        const count = articles?.filter((a) => a.category === c.slug).length ?? 0;
        return (
          <Card key={c.slug}>
            <CardActionArea component={RouterLink} to={`/concepts?category=${c.slug}`} sx={{ height: '100%' }}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="h6" component="h3">
                  {c.name}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  {c.description}
                </Typography>
                <Typography variant="caption" color={count ? 'secondary' : 'text.secondary'} sx={{ display: 'block', mt: 1, fontWeight: 600 }}>
                  {count ? `${count} article${count > 1 ? 's' : ''}` : 'Articles planned'}
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        );
      })}
    </Box>
  );
}
