import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import type { DesignSection, SystemDesign, SystemDesignSummary } from '../shared';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Chip,
  Container,
  Link,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { lazy, Suspense, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { Callout } from '../components/Callout';
import { DesignCard, DifficultyChip, ErrorState, PageLoading, ReadingModeToggle, ReadingTime, Seo } from '../components/common';
import { ApiEndpointCard } from '../components/design/ApiEndpointCard';
import { SequenceSection } from '../components/design/SequenceSection';
import { Markdown } from '../components/markdown/Markdown';
import { TableOfContents } from '../components/TableOfContents';
import { usePreferences } from '../context/PreferencesContext';
import { NotFoundError, api } from '../data/api';
import { useAsync } from '../data/hooks';
import NotFoundPage from './NotFoundPage';

const ArchitectureViewer = lazy(() => import('../components/diagram/ArchitectureViewer').then((m) => ({ default: m.ArchitectureViewer })));

export default function SystemDesignPage() {
  const { slug = '' } = useParams();
  const design = useAsync(() => api.getDesign(slug), [slug]);
  const all = useAsync(() => api.listDesigns(), []);

  if (design.error instanceof NotFoundError) return <NotFoundPage what="system design" />;
  return (
    <Container maxWidth="xl" sx={{ py: { xs: 3, md: 4 } }}>
      <Box sx={{ display: 'grid', gap: 4, gridTemplateColumns: { xs: '1fr', md: 'minmax(0,1fr) 220px', lg: '220px minmax(0,1fr) 220px' } }}>
        {/* Left sidebar: other designs */}
        <Box component="aside" sx={{ display: { xs: 'none', lg: 'block' } }} aria-label="System designs">
          <Box sx={{ position: 'sticky', top: 84 }}>
            <DesignNav designs={all.data} current={slug} />
          </Box>
        </Box>

        <Box sx={{ minWidth: 0 }}>
          {design.error && <ErrorState error={design.error} onRetry={design.reload} />}
          {design.loading && !design.data && <PageLoading />}
          {design.data && design.data.slug === slug && <DesignArticle design={design.data} all={all.data ?? []} />}
        </Box>

        {/* Right sidebar: table of contents + progress */}
        <Box component="aside" sx={{ display: { xs: 'none', md: 'block' } }}>
          <Box sx={{ position: 'sticky', top: 84, maxHeight: 'calc(100vh - 100px)', overflowY: 'auto', pr: 1 }}>
            {design.data && <TableOfContents items={design.data.sections.map((s, i) => ({ id: s.id, text: `${i + 1}. ${s.title}` }))} />}
          </Box>
        </Box>
      </Box>
    </Container>
  );
}

function DesignNav({ designs, current }: { designs?: SystemDesignSummary[]; current: string }) {
  if (!designs) return <Skeleton variant="rounded" height={240} />;
  return (
    <nav aria-label="All system designs">
      <Typography variant="overline" color="text.secondary">
        System designs
      </Typography>
      <List dense disablePadding>
        {designs.map((d) =>
          d.status === 'planned' ? (
            <ListItemText key={d.slug} primary={d.title} secondary="Planned" sx={{ px: 1.25, py: 0.5, opacity: 0.55 }} primaryTypographyProps={{ fontSize: '0.85rem' }} />
          ) : (
            <ListItemButton
              key={d.slug}
              component={RouterLink}
              to={`/system-design/${d.slug}`}
              selected={d.slug === current}
              aria-current={d.slug === current ? 'page' : undefined}
              sx={{ borderRadius: 1, borderLeft: 2, borderColor: d.slug === current ? 'primary.main' : 'transparent' }}
            >
              <ListItemText primary={d.title} primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: d.slug === current ? 650 : 400 }} />
            </ListItemButton>
          ),
        )}
      </List>
    </nav>
  );
}

function DesignArticle({ design, all }: { design: SystemDesign; all: SystemDesignSummary[] }) {
  const { readingMode } = usePreferences();
  const quick = readingMode === 'quick';

  if (design.status === 'planned') {
    return (
      <Box>
        <Typography variant="h1">{design.title}</Typography>
        <Alert severity="info" sx={{ mt: 3 }}>
          This design is <b>planned</b> and hasn’t been written yet. In the meantime, read one of the completed designs.
        </Alert>
        <Button component={RouterLink} to="/system-designs" sx={{ mt: 2 }}>
          Browse completed designs
        </Button>
      </Box>
    );
  }

  return (
    <Box component="article">
      <Seo title={design.title} description={design.summary} path={`/system-design/${design.slug}`} type="article" />
      <Breadcrumbs sx={{ mb: 2 }} aria-label="Breadcrumb">
        <Link component={RouterLink} to="/" color="inherit">
          Home
        </Link>
        <Link component={RouterLink} to="/system-designs" color="inherit">
          System designs
        </Link>
        <Typography color="text.primary">{design.title}</Typography>
      </Breadcrumbs>

      <Typography variant="h1" sx={{ fontSize: 'clamp(1.8rem, 3vw + 1rem, 2.6rem)' }}>
        {design.title}
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 1.5, fontSize: '1.1rem' }}>
        {design.tagline}
      </Typography>
      <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
        <DifficultyChip value={design.difficulty} />
        <ReadingTime minutes={quick ? Math.max(5, Math.round(design.readingMinutes / 4)) : design.readingMinutes} />
        {design.technologies.slice(0, 6).map((t) => (
          <Chip key={t} size="small" label={t} variant="outlined" component={RouterLink} to={`/search?technology=${encodeURIComponent(t)}`} clickable />
        ))}
      </Stack>

      <Paper sx={{ mt: 3, p: 2, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, alignItems: { sm: 'center' }, justifyContent: 'space-between' }}>
        <Box>
          <Typography fontWeight={650}>How do you want to read this?</Typography>
          <Typography variant="body2" color="text.secondary">
            {quick ? 'Quick read: plain-English summaries and diagrams only.' : 'Deep dive: every technical detail, with code and trade-offs.'}
          </Typography>
        </Box>
        <ReadingModeToggle />
      </Paper>

      {/* The 60-second version */}
      <Paper sx={{ mt: 3, p: { xs: 2, md: 3 }, borderColor: 'secondary.main' }} component="section" aria-labelledby="analogy-heading">
        <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'secondary.main' }}>
          <LightbulbOutlinedIcon aria-hidden />
          <Typography variant="overline">The 60-second version</Typography>
        </Stack>
        <Typography id="analogy-heading" variant="h3" component="h2" sx={{ mt: 0.5 }}>
          {design.analogy.title}
        </Typography>
        <Box sx={{ mt: 1 }}>
          <Markdown>{design.analogy.story}</Markdown>
        </Box>
      </Paper>

      {/* Mobile table of contents */}
      <Accordion sx={{ mt: 3, display: { md: 'none' } }} disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>On this page</AccordionSummary>
        <AccordionDetails>
          <Box component="ol" sx={{ m: 0, pl: 3 }}>
            {design.sections.map((s) => (
              <li key={s.id}>
                <Link href={`#${s.id}`}>{s.title}</Link>
              </li>
            ))}
          </Box>
        </AccordionDetails>
      </Accordion>

      {design.sections.map((s, i) => (
        <SectionBlock key={s.id} section={s} index={i} design={design} all={all} quick={quick} />
      ))}
    </Box>
  );
}

function SectionBlock({ section, index, design, all, quick }: { section: DesignSection; index: number; design: SystemDesign; all: SystemDesignSummary[]; quick: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const showBody = !quick || expanded;
  // Visual sections stay visible in Quick read because pictures are the fastest way to understand.
  const visual = section.id === 'diagram' || section.id === 'sequence' || section.id === 'interview' || section.id === 'summary';

  return (
    <Box component="section" aria-labelledby={`h-${section.id}`} sx={{ mt: 6 }}>
      <Typography id={section.id} variant="h2" component="h2" sx={{ scrollMarginTop: 88, display: 'flex', gap: 1.25, alignItems: 'baseline' }}>
        <Box component="span" sx={{ color: 'text.secondary', fontSize: '0.75em', fontWeight: 600 }}>
          {String(index + 1).padStart(2, '0')}
        </Box>
        <span id={`h-${section.id}`}>{section.title}</span>
      </Typography>

      <Callout kind="simple">
        <Typography>{section.simple}</Typography>
      </Callout>

      {showBody && <Markdown>{section.body}</Markdown>}

      {section.id === 'diagram' && design.diagram && (
        <Suspense fallback={<Skeleton variant="rounded" height={560} />}>
          <ArchitectureViewer diagram={design.diagram} height={480} />
        </Suspense>
      )}
      {section.id === 'api' && design.apis.map((e) => <ApiEndpointCard key={`${e.method} ${e.path}`} endpoint={e} compact={!showBody} />)}
      {section.id === 'sequence' && design.diagram && <SequenceSection diagram={design.diagram} />}
      {section.id === 'interview' && <InterviewQuestions design={design} />}
      {section.id === 'summary' && <Related design={design} all={all} />}

      {quick && !visual && (
        <Button size="small" onClick={() => setExpanded((e) => !e)} sx={{ mt: 1 }} aria-expanded={expanded}>
          {expanded ? 'Hide technical details' : 'Show technical details'}
        </Button>
      )}
    </Box>
  );
}

function InterviewQuestions({ design }: { design: SystemDesign }) {
  return (
    <Box sx={{ mt: 2 }}>
      {design.interviewQuestions.map((q, i) => (
        <Accordion key={i} disableGutters sx={{ '&:before': { display: 'none' }, mb: 1 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight={600}>
              Q{i + 1}. {q.question}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography color="text.secondary">{q.answer}</Typography>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
}

function Related({ design, all }: { design: SystemDesign; all: SystemDesignSummary[] }) {
  const related = design.related.map((slug) => all.find((d) => d.slug === slug)).filter((d): d is SystemDesignSummary => !!d);
  if (related.length === 0) return null;
  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="h4" component="h3" sx={{ mb: 1.5 }}>
        Related designs
      </Typography>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        {related.map((d) => (
          <DesignCard key={d.slug} design={d} />
        ))}
      </Box>
    </Box>
  );
}
