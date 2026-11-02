import { plannedArticleTopics } from '../content/designs/planned';
import { filterAndSort } from '../shared';
import { Box, Button, Chip, Container, Stack, Typography } from '@mui/material';
import { useMemo } from 'react';
import { ArticleCard, CardGridSkeleton, EmptyState, ErrorState, SectionHeader, Seo } from '../components/common';
import { FilterBar, useFilterParams } from '../components/FilterBar';
import { api } from '../data/api';
import { useAsync } from '../data/hooks';

export default function ConceptsPage() {
  const articles = useAsync(() => api.listArticles(), []);
  const categories = useAsync(() => api.listCategories(), []);
  const [filters, update, clear] = useFilterParams();
  const conceptCats = useMemo(() => (categories.data ?? []).filter((c) => c.kind === 'concept'), [categories.data]);
  const catName = useMemo(() => new Map(conceptCats.map((c) => [c.slug, c.name])), [conceptCats]);
  const results = filterAndSort(articles.data ?? [], filters);
  const planned = plannedArticleTopics.filter((t) => !filters.category || t.category === filters.category);

  return (
    <Container maxWidth="lg" sx={{ py: 5 }}>
      <Seo title="Backend Concepts" path="/concepts" description="Clear explanations of backend engineering concepts: the Node.js event loop, caching, indexing, queues, CAP theorem, rate limiting and more." />
      <SectionHeader
        eyebrow="Backend concepts"
        title="Backend engineering concepts"
        description="Each article opens with a plain-English explanation, then goes deep with code, diagrams and gotchas."
      />
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2.5 }} role="group" aria-label="Topics">
        <Chip label="All topics" clickable color={!filters.category ? 'primary' : 'default'} onClick={() => update({ category: undefined })} />
        {conceptCats.map((c) => (
          <Chip key={c.slug} label={c.name} clickable color={filters.category === c.slug ? 'primary' : 'default'} onClick={() => update({ category: c.slug })} />
        ))}
      </Stack>
      <FilterBar items={articles.data ?? []} categories={conceptCats} filters={filters} onChange={update} onClear={clear} />
      {articles.error && <ErrorState error={articles.error} onRetry={articles.reload} />}
      {articles.loading && !articles.data ? (
        <CardGridSkeleton />
      ) : results.length === 0 ? (
        <EmptyState title="No articles match" description="There are no published articles for these filters yet." action={<Button onClick={clear}>Clear filters</Button>} />
      ) : (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '1fr 1fr 1fr' } }}>
          {results.map((a) => (
            <ArticleCard key={a.slug} article={a} categoryName={catName.get(a.category)} />
          ))}
        </Box>
      )}
      {planned.length > 0 && (
        <Box sx={{ mt: 6 }}>
          <Typography variant="h4" component="h2">
            Planned topics
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Not written yet — listed so you know what’s coming.
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {planned.map((t) => (
              <Chip key={t.title} label={`${t.title} · planned`} variant="outlined" />
            ))}
          </Stack>
        </Box>
      )}
    </Container>
  );
}
