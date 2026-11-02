import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import type { ArticleSummary, Difficulty, SystemDesignSummary } from '../shared';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Skeleton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import type { ReactNode } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link as RouterLink } from 'react-router-dom';
import { usePreferences } from '../context/PreferencesContext';

export const SITE_URL: string = import.meta.env.VITE_SITE_URL ?? 'https://systemdesign.academy';
export const SITE_NAME = 'System Design Academy';

export function Seo({ title, description, path, type = 'website' }: { title: string; description: string; path: string; type?: 'website' | 'article' }) {
  const url = `${SITE_URL}${path}`;
  const fullTitle = path === '/' ? `${SITE_NAME} — ${title}` : `${title} | ${SITE_NAME}`;
  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta name="twitter:card" content="summary" />
    </Helmet>
  );
}

const DIFF_COLOR: Record<Difficulty, 'success' | 'info' | 'warning'> = { Beginner: 'success', Intermediate: 'info', Advanced: 'warning' };

export function DifficultyChip({ value }: { value: Difficulty }) {
  return <Chip size="small" variant="outlined" color={DIFF_COLOR[value]} label={value} />;
}

export function ReadingTime({ minutes }: { minutes: number }) {
  return (
    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: 'text.secondary' }}>
      <AccessTimeIcon sx={{ fontSize: 16 }} aria-hidden />
      <Typography variant="caption">{minutes} min read</Typography>
    </Stack>
  );
}

export function DesignCard({ design, categoryName }: { design: SystemDesignSummary; categoryName?: string }) {
  const planned = design.status === 'planned';
  const content = (
    <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, height: '100%' }}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <Typography variant="overline" color="secondary" sx={{ lineHeight: 1.4 }}>
          {categoryName ?? design.category}
        </Typography>
        {planned && <Chip size="small" label="Planned" />}
      </Stack>
      <Typography variant="h4" component="h3">
        {design.title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
        {design.tagline}
      </Typography>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <DifficultyChip value={design.difficulty} />
        <ReadingTime minutes={design.readingMinutes} />
      </Stack>
    </CardContent>
  );
  return (
    <Card sx={{ height: '100%', opacity: planned ? 0.7 : 1, transition: 'border-color .15s', '&:hover': planned ? undefined : { borderColor: 'primary.main' } }}>
      {planned ? (
        <Tooltip title="This design is planned and not written yet.">
          <Box sx={{ height: '100%' }} aria-label={`${design.title} (planned, not yet available)`}>
            {content}
          </Box>
        </Tooltip>
      ) : (
        <CardActionArea component={RouterLink} to={`/system-design/${design.slug}`} sx={{ height: '100%' }}>
          {content}
        </CardActionArea>
      )}
    </Card>
  );
}

export function ArticleCard({ article, categoryName }: { article: ArticleSummary; categoryName?: string }) {
  return (
    <Card sx={{ height: '100%', '&:hover': { borderColor: 'primary.main' } }}>
      <CardActionArea component={RouterLink} to={`/concepts/${article.slug}`} sx={{ height: '100%' }}>
        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1, height: '100%' }}>
          <Typography variant="overline" color="secondary" sx={{ lineHeight: 1.4 }}>
            {categoryName ?? article.category}
          </Typography>
          <Typography variant="h5" component="h3">
            {article.title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
            {article.summary}
          </Typography>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <DifficultyChip value={article.difficulty} />
            <ReadingTime minutes={article.readingMinutes} />
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '1fr 1fr 1fr' } }} aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} variant="rounded" height={190} />
      ))}
    </Box>
  );
}

export function PageLoading() {
  return (
    <Box sx={{ py: 4 }} aria-busy="true" aria-label="Loading page">
      <Skeleton width="40%" height={48} />
      <Skeleton width="70%" />
      <Skeleton variant="rounded" height={280} sx={{ mt: 3 }} />
    </Box>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <Box sx={{ textAlign: 'center', py: 8, px: 2, border: 1, borderStyle: 'dashed', borderColor: 'divider', borderRadius: 2 }}>
      <SearchOffIcon sx={{ fontSize: 40, color: 'text.secondary' }} aria-hidden />
      <Typography variant="h4" component="p" sx={{ mt: 1 }}>
        {title}
      </Typography>
      {description && (
        <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 480, mx: 'auto' }}>
          {description}
        </Typography>
      )}
      {action && <Box sx={{ mt: 2 }}>{action}</Box>}
    </Box>
  );
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <Alert severity="error" action={onRetry && <Button color="inherit" size="small" onClick={onRetry}>Retry</Button>} sx={{ my: 3 }}>
      Something went wrong: {error.message}
    </Alert>
  );
}

export function SectionHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'flex-end' }} spacing={2} sx={{ mb: 3 }}>
      <Box>
        {eyebrow && (
          <Typography variant="overline" color="secondary">
            {eyebrow}
          </Typography>
        )}
        <Typography variant="h2">{title}</Typography>
        {description && (
          <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 680 }}>
            {description}
          </Typography>
        )}
      </Box>
      {action}
    </Stack>
  );
}

export function ViewAllButton({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Button component={RouterLink} to={to} endIcon={<ArrowForwardIcon />} sx={{ flexShrink: 0 }}>
      {children}
    </Button>
  );
}

/** Lets readers switch between plain-English "Quick read" and full "Deep dive". */
export function ReadingModeToggle() {
  const { readingMode, setReadingMode } = usePreferences();
  return (
    <ToggleButtonGroup
      size="small"
      exclusive
      value={readingMode}
      onChange={(_, v) => v && setReadingMode(v)}
      aria-label="Reading mode"
      color="secondary"
    >
      <Tooltip title="Plain-English explanations and diagrams only — understand the idea in a few minutes">
        <ToggleButton value="quick" aria-label="Quick read">
          Quick read
        </ToggleButton>
      </Tooltip>
      <Tooltip title="Everything: technical details, code, schemas and trade-offs">
        <ToggleButton value="deep" aria-label="Deep dive">
          Deep dive
        </ToggleButton>
      </Tooltip>
    </ToggleButtonGroup>
  );
}
