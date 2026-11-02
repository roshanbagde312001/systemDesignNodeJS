import { filterAndSort, type ArticleSummary, type SystemDesignSummary } from '@sda/shared';
import { Box, Button, Container, Tab, Tabs, Typography } from '@mui/material';
import { useMemo, useState } from 'react';
import { ArticleCard, CardGridSkeleton, DesignCard, EmptyState, SectionHeader, Seo } from '../components/common';
import { FilterBar, useFilterParams } from '../components/FilterBar';
import { api } from '../data/api';
import { useAsync } from '../data/hooks';

type Item = ({ type: 'design' } & SystemDesignSummary) | ({ type: 'article' } & ArticleSummary);

export default function SearchPage() {
  const data = useAsync(async () => {
    const [designs, articles, categories] = await Promise.all([api.listDesigns(), api.listArticles(), api.listCategories()]);
    const items: Item[] = [
      ...designs.filter((d) => d.status === 'published').map((d) => ({ ...d, type: 'design' as const })),
      ...articles.map((a) => ({ ...a, type: 'article' as const })),
    ];
    return { items, categories };
  }, []);
  const [filters, update, clear] = useFilterParams();
  const [tab, setTab] = useState<'all' | 'design' | 'article'>('all');
  const catName = useMemo(() => new Map((data.data?.categories ?? []).map((c) => [c.slug, c.name])), [data.data]);

  const results = filterAndSort(data.data?.items ?? [], filters);
  const shown = tab === 'all' ? results : results.filter((r) => r.type === tab);
  const count = (t: 'design' | 'article') => results.filter((r) => r.type === t).length;

  return (
    <Container maxWidth="lg" sx={{ py: 5 }}>
      <Seo title="Search" path="/search" description="Search system designs and backend concepts by keyword, technology, pattern and difficulty." />
      <SectionHeader title="Search" description="Find designs and concepts by keyword, category, difficulty, technology or architecture pattern." />
      <FilterBar items={data.data?.items ?? []} categories={data.data?.categories ?? []} filters={filters} onChange={update} onClear={clear} />
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }} aria-label="Result type">
        <Tab value="all" label={`All (${results.length})`} />
        <Tab value="design" label={`System designs (${count('design')})`} />
        <Tab value="article" label={`Concepts (${count('article')})`} />
      </Tabs>
      {data.loading && !data.data ? (
        <CardGridSkeleton />
      ) : shown.length === 0 ? (
        <EmptyState
          title={filters.q ? `No results for “${filters.q}”` : 'Nothing matches these filters'}
          description="Check the spelling, try a more general word (for example “cache” instead of “write-through cache”), or clear the filters."
          action={<Button onClick={clear}>Clear search</Button>}
        />
      ) : (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }} aria-live="polite">
            {shown.length} result{shown.length === 1 ? '' : 's'}
          </Typography>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '1fr 1fr 1fr' } }}>
            {shown.map((r) =>
              r.type === 'design' ? (
                <DesignCard key={`d-${r.slug}`} design={r} categoryName={catName.get(r.category)} />
              ) : (
                <ArticleCard key={`a-${r.slug}`} article={r} categoryName={catName.get(r.category)} />
              ),
            )}
          </Box>
        </>
      )}
    </Container>
  );
}
