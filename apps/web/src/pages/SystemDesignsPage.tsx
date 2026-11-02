import { filterAndSort } from '../shared';
import { Box, Button, Container, Typography } from '@mui/material';
import { useMemo } from 'react';
import { CardGridSkeleton, DesignCard, EmptyState, ErrorState, SectionHeader, Seo } from '../components/common';
import { FilterBar, useFilterParams } from '../components/FilterBar';
import { api } from '../data/api';
import { useAsync } from '../data/hooks';

export default function SystemDesignsPage() {
  const designs = useAsync(() => api.listDesigns(), []);
  const categories = useAsync(() => api.listCategories(), []);
  const [filters, update, clear] = useFilterParams();
  const catName = useMemo(() => new Map((categories.data ?? []).map((c) => [c.slug, c.name])), [categories.data]);

  const all = designs.data ?? [];
  const published = filterAndSort(all.filter((d) => d.status === 'published'), filters);
  const planned = all.filter((d) => d.status === 'planned');

  return (
    <Container maxWidth="lg" sx={{ py: 5 }}>
      <Seo title="System Designs" path="/system-designs" description="Step-by-step system design walk-throughs: URL shortener, messaging app, e-commerce orders and more, with interactive diagrams." />
      <SectionHeader
        eyebrow="Library"
        title="System designs"
        description="Each design follows the same 22-section structure — from the problem and requirements to failure handling and interview questions. Start with Quick read, then switch to Deep dive."
      />
      <FilterBar items={all.filter((d) => d.status === 'published')} categories={categories.data ?? []} filters={filters} onChange={update} onClear={clear} />
      {designs.error && <ErrorState error={designs.error} onRetry={designs.reload} />}
      {designs.loading && !designs.data ? (
        <CardGridSkeleton count={3} />
      ) : published.length === 0 ? (
        <EmptyState title="No designs match these filters" description="Try removing a filter or searching for a broader term like “cache”." action={<Button onClick={clear}>Clear filters</Button>} />
      ) : (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '1fr 1fr 1fr' } }}>
          {published.map((d) => (
            <DesignCard key={d.slug} design={d} categoryName={catName.get(d.category)} />
          ))}
        </Box>
      )}

      {planned.length > 0 && (
        <Box sx={{ mt: 7 }}>
          <Typography variant="h3" component="h2">
            Coming soon
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
            These designs are planned and not written yet.
          </Typography>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '1fr 1fr 1fr' } }}>
            {planned.map((d) => (
              <DesignCard key={d.slug} design={d} categoryName={catName.get(d.category)} />
            ))}
          </Box>
        </Box>
      )}
    </Container>
  );
}
