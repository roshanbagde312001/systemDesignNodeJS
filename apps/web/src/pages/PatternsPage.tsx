import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import DoNotDisturbOnOutlinedIcon from '@mui/icons-material/DoNotDisturbOnOutlined';
import { architecturePatterns } from '../content/patterns';
import { Box, Chip, Container, Link, Paper, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { Callout } from '../components/Callout';
import { SectionHeader, Seo } from '../components/common';
import { FlowChain } from '../components/markdown/FlowChain';

export default function PatternsPage() {
  return (
    <Container maxWidth="lg" sx={{ py: 5 }}>
      <Seo title="Architecture Patterns" path="/patterns" description="Common architecture patterns — monolith, microservices, event-driven, cache-aside, saga, circuit breaker, outbox — explained simply with when to use them." />
      <SectionHeader
        eyebrow="Patterns"
        title="Architecture patterns"
        description="Patterns are proven, reusable answers to recurring problems. Learn what each one is, when it helps, when it hurts, and where you can see it in action."
      />
      <Box component="nav" aria-label="Patterns on this page" sx={{ mb: 4, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {architecturePatterns.map((p) => (
          <Chip key={p.slug} label={p.name} component="a" href={`#${p.slug}`} clickable variant="outlined" />
        ))}
      </Box>
      <Stack spacing={3}>
        {architecturePatterns.map((p) => (
          <Paper key={p.slug} component="section" id={p.slug} sx={{ p: { xs: 2, md: 3 }, scrollMarginTop: 88 }} aria-labelledby={`${p.slug}-title`}>
            <Typography id={`${p.slug}-title`} variant="h3" component="h2">
              {p.name}
            </Typography>
            <Callout kind="simple">
              <Typography>{p.simple}</Typography>
            </Callout>
            <Typography color="text.secondary">{p.description}</Typography>
            <FlowChain source={p.flow} />
            <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
              <Box>
                <Typography variant="overline" color="secondary">
                  Use it when
                </Typography>
                {p.useWhen.map((u) => (
                  <Stack key={u} direction="row" spacing={1} sx={{ mt: 0.75 }}>
                    <CheckCircleOutlineIcon fontSize="small" color="secondary" aria-hidden />
                    <Typography variant="body2">{u}</Typography>
                  </Stack>
                ))}
              </Box>
              <Box>
                <Typography variant="overline" color="warning.main">
                  Avoid it when
                </Typography>
                {p.avoidWhen.map((u) => (
                  <Stack key={u} direction="row" spacing={1} sx={{ mt: 0.75 }}>
                    <DoNotDisturbOnOutlinedIcon fontSize="small" color="warning" aria-hidden />
                    <Typography variant="body2">{u}</Typography>
                  </Stack>
                ))}
              </Box>
            </Box>
            {p.seenIn.length > 0 && (
              <Typography variant="body2" sx={{ mt: 2.5 }}>
                <b>See it in action:</b>{' '}
                {p.seenIn.map((s, i) => (
                  <span key={s.slug}>
                    {i > 0 && ', '}
                    <Link component={RouterLink} to={s.kind === 'design' ? `/system-design/${s.slug}` : `/concepts/${s.slug}`}>
                      {s.slug.replace(/-/g, ' ')}
                    </Link>
                  </span>
                ))}
              </Typography>
            )}
          </Paper>
        ))}
      </Stack>
    </Container>
  );
}
