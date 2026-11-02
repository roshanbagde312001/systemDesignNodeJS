import type { Article, ArticleSummary } from '../shared';
import { Box, Breadcrumbs, Button, Chip, Container, Link, Paper, Stack, Typography } from '@mui/material';
import { useMemo, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { Callout } from '../components/Callout';
import { ArticleCard, DifficultyChip, ErrorState, PageLoading, ReadingModeToggle, ReadingTime, Seo } from '../components/common';
import { extractHeadings, Markdown } from '../components/markdown/Markdown';
import { TableOfContents } from '../components/TableOfContents';
import { usePreferences } from '../context/PreferencesContext';
import { NotFoundError, api } from '../data/api';
import { useAsync } from '../data/hooks';
import NotFoundPage from './NotFoundPage';

export default function ArticlePage() {
  const { slug = '' } = useParams();
  const article = useAsync(() => api.getArticle(slug), [slug]);
  const all = useAsync(() => api.listArticles(), []);

  if (article.error instanceof NotFoundError) return <NotFoundPage what="article" />;
  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 4 } }}>
      {article.error && <ErrorState error={article.error} onRetry={article.reload} />}
      {article.loading && !article.data && <PageLoading />}
      {article.data && article.data.slug === slug && <ArticleView article={article.data} related={(all.data ?? []).filter((a) => article.data!.related.includes(a.slug))} />}
    </Container>
  );
}

export function ArticleView({ article, related, preview }: { article: Article; related?: ArticleSummary[]; preview?: boolean }) {
  const { readingMode } = usePreferences();
  const [showDetails, setShowDetails] = useState(false);
  const headings = useMemo(() => extractHeadings(article.body), [article.body]);
  const showBody = readingMode === 'deep' || showDetails || preview;

  return (
    <Box sx={{ display: 'grid', gap: 5, gridTemplateColumns: { xs: '1fr', md: 'minmax(0,1fr) 220px' } }}>
      <Box component="article" sx={{ minWidth: 0, maxWidth: 780 }}>
        {!preview && <Seo title={article.title} description={article.summary} path={`/concepts/${article.slug}`} type="article" />}
        {!preview && (
          <Breadcrumbs sx={{ mb: 2 }} aria-label="Breadcrumb">
            <Link component={RouterLink} to="/" color="inherit">
              Home
            </Link>
            <Link component={RouterLink} to="/concepts" color="inherit">
              Backend concepts
            </Link>
            <Typography color="text.primary">{article.title}</Typography>
          </Breadcrumbs>
        )}
        <Typography variant="h1" sx={{ fontSize: 'clamp(1.8rem, 3vw + 1rem, 2.5rem)' }}>
          {article.title}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1.5, fontSize: '1.08rem' }}>
          {article.summary}
        </Typography>
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
          <DifficultyChip value={article.difficulty} />
          <ReadingTime minutes={article.readingMinutes} />
          {article.tags.map((t) => (
            <Chip key={t} size="small" variant="outlined" label={`#${t}`} />
          ))}
        </Stack>
        {article.updatedAt && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Updated {new Date(article.updatedAt).toLocaleDateString()}
          </Typography>
        )}

        {!preview && (
          <Paper sx={{ mt: 3, p: 2, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, justifyContent: 'space-between', alignItems: { sm: 'center' } }}>
            <Typography variant="body2" color="text.secondary">
              Short on time? <b>Quick read</b> shows just the plain-English explanation.
            </Typography>
            <ReadingModeToggle />
          </Paper>
        )}

        <Callout kind="simple" title="In plain English">
          <Typography>{article.simple}</Typography>
        </Callout>

        {showBody ? (
          <Box sx={{ mt: 3 }}>
            <Markdown>{article.body}</Markdown>
          </Box>
        ) : (
          <Button onClick={() => setShowDetails(true)} variant="outlined" sx={{ mt: 1 }}>
            Read the full technical article
          </Button>
        )}

        {related && related.length > 0 && (
          <Box component="section" sx={{ mt: 8 }}>
            <Typography variant="h3" component="h2" sx={{ mb: 2 }}>
              Related articles
            </Typography>
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
              {related.map((a) => (
                <ArticleCard key={a.slug} article={a} />
              ))}
            </Box>
          </Box>
        )}
      </Box>
      {showBody && headings.length > 0 && (
        <Box component="aside" sx={{ display: { xs: 'none', md: 'block' } }}>
          <Box sx={{ position: 'sticky', top: 84 }}>
            <TableOfContents items={headings} />
          </Box>
        </Box>
      )}
    </Box>
  );
}
