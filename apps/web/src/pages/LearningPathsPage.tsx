import { Box, Card, CardActionArea, CardContent, Container, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { CardGridSkeleton, DifficultyChip, EmptyState, ErrorState, SectionHeader, Seo } from '../components/common';
import { api } from '../data/api';
import { useAsync } from '../data/hooks';

export default function LearningPathsPage() {
  const paths = useAsync(() => api.listLearningPaths(), []);
  return (
    <Container maxWidth="lg" sx={{ py: 5 }}>
      <Seo title="Learning Paths" path="/learning-paths" description="Guided learning paths from absolute beginner to system design interview ready." />
      <SectionHeader eyebrow="Guided" title="Learning paths" description="Pick a path that matches where you are. Each one is a short, ordered reading list — the first one assumes no prior knowledge at all." />
      {paths.error && <ErrorState error={paths.error} onRetry={paths.reload} />}
      {paths.loading && !paths.data ? (
        <CardGridSkeleton />
      ) : paths.data?.length === 0 ? (
        <EmptyState title="No learning paths yet" />
      ) : (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
          {(paths.data ?? []).map((p) => (
            <Card key={p.slug}>
              <CardActionArea component={RouterLink} to={`/learning-paths/${p.slug}`} sx={{ height: '100%' }}>
                <CardContent sx={{ p: 3 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <DifficultyChip value={p.difficulty} />
                    <Typography variant="caption" color="text.secondary">
                      {p.steps.length} steps
                    </Typography>
                  </Stack>
                  <Typography variant="h4" component="h2" sx={{ mt: 1.5 }}>
                    {p.title}
                  </Typography>
                  <Typography color="text.secondary" sx={{ mt: 1 }}>
                    {p.description}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1.5 }}>
                    <b>For:</b> {p.audience}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Box>
      )}
    </Container>
  );
}
