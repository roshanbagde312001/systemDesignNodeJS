import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import type { LearningPathStep } from '@sda/shared';
import { Box, Breadcrumbs, Button, Container, IconButton, LinearProgress, Link, Paper, Stack, Tooltip, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { DifficultyChip, ErrorState, PageLoading, Seo } from '../components/common';
import { HttpError, api } from '../data/api';
import { useAsync } from '../data/hooks';
import NotFoundPage from './NotFoundPage';

const linkFor = (s: LearningPathStep) =>
  s.kind === 'design' ? `/system-design/${s.ref}` : s.kind === 'article' ? `/concepts/${s.ref}` : s.ref === 'simulator' ? '/playground?tab=simulator' : '/playground';
const ICON = { design: HubOutlinedIcon, article: ArticleOutlinedIcon, playground: ScienceOutlinedIcon };

/** Progress is a per-browser convenience; it is safe to lose. */
function useProgress(slug: string) {
  const key = `sda.path.${slug}`;
  const [done, setDone] = useState<number[]>([]);
  useEffect(() => {
    try {
      setDone(JSON.parse(localStorage.getItem(key) ?? '[]'));
    } catch {
      setDone([]);
    }
  }, [key]);
  const toggle = (i: number) =>
    setDone((d) => {
      const next = d.includes(i) ? d.filter((x) => x !== i) : [...d, i];
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  return [done, toggle] as const;
}

export default function LearningPathPage() {
  const { slug = '' } = useParams();
  const path = useAsync(() => api.getLearningPath(slug), [slug]);
  const [done, toggle] = useProgress(slug);

  if (path.error instanceof HttpError && path.error.status === 404) return <NotFoundPage what="learning path" />;
  if (path.error) return <Container sx={{ py: 5 }}><ErrorState error={path.error} onRetry={path.reload} /></Container>;
  if (!path.data) return <Container sx={{ py: 5 }}><PageLoading /></Container>;
  const p = path.data;
  const pct = Math.round((done.length / p.steps.length) * 100);
  const nextIdx = p.steps.findIndex((_, i) => !done.includes(i));

  return (
    <Container maxWidth="md" sx={{ py: 5 }}>
      <Seo title={p.title} description={p.description} path={`/learning-paths/${p.slug}`} />
      <Breadcrumbs sx={{ mb: 2 }} aria-label="Breadcrumb">
        <Link component={RouterLink} to="/learning-paths" color="inherit">
          Learning paths
        </Link>
        <Typography color="text.primary">{p.title}</Typography>
      </Breadcrumbs>
      <Typography variant="h1" sx={{ fontSize: 'clamp(1.8rem, 3vw + 1rem, 2.4rem)' }}>
        {p.title}
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 1.5 }}>
        {p.description}
      </Typography>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 2 }}>
        <DifficultyChip value={p.difficulty} />
        <Typography variant="body2">For: {p.audience}</Typography>
      </Stack>
      <Paper sx={{ mt: 3, p: 2 }}>
        <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography variant="body2" fontWeight={600}>
            Your progress
          </Typography>
          <Typography variant="body2">
            {done.length}/{p.steps.length} done
          </Typography>
        </Stack>
        <LinearProgress variant="determinate" value={pct} sx={{ height: 8, borderRadius: 4 }} aria-label="Path progress" />
        {nextIdx >= 0 && (
          <Button component={RouterLink} to={linkFor(p.steps[nextIdx])} variant="contained" sx={{ mt: 2 }}>
            {done.length === 0 ? 'Start' : 'Continue'}: {p.steps[nextIdx].title}
          </Button>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Progress is saved in this browser only.
        </Typography>
      </Paper>

      <Box component="ol" sx={{ listStyle: 'none', p: 0, mt: 4 }}>
        {p.steps.map((s, i) => {
          const Icon = ICON[s.kind];
          const isDone = done.includes(i);
          return (
            <Box component="li" key={i} sx={{ display: 'flex', gap: 2, pb: 3, position: 'relative' }}>
              <Stack alignItems="center">
                <Tooltip title={isDone ? 'Mark as not done' : 'Mark as done'}>
                  <IconButton onClick={() => toggle(i)} aria-label={`${isDone ? 'Unmark' : 'Mark'} step ${i + 1} as done`} color={isDone ? 'secondary' : 'default'}>
                    {isDone ? <CheckCircleIcon /> : <RadioButtonUncheckedIcon />}
                  </IconButton>
                </Tooltip>
                {i < p.steps.length - 1 && <Box sx={{ flexGrow: 1, width: 2, bgcolor: 'divider' }} />}
              </Stack>
              <Paper sx={{ p: 2, flexGrow: 1 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Icon fontSize="small" color="primary" aria-hidden />
                  <Typography variant="overline" color="text.secondary">
                    Step {i + 1} · {s.kind}
                  </Typography>
                </Stack>
                <Link component={RouterLink} to={linkFor(s)} variant="h5" sx={{ display: 'block', mt: 0.5 }}>
                  {s.title}
                </Link>
                {s.note && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {s.note}
                  </Typography>
                )}
              </Paper>
            </Box>
          );
        })}
      </Box>
    </Container>
  );
}
