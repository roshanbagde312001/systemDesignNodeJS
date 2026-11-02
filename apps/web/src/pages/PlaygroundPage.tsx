import RouteIcon from '@mui/icons-material/Route';
import SpeedIcon from '@mui/icons-material/Speed';
import { playgroundConfigs, type PlaygroundConfig } from '@sda/content/src/playground';
import {
  Alert,
  Box,
  Button,
  Container,
  LinearProgress,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Callout } from '../components/Callout';
import { SectionHeader, Seo } from '../components/common';
import { ArchitectureViewer } from '../components/diagram/ArchitectureViewer';
import { TrafficLab } from '../components/playground/TrafficLab';
import { RequestSimulator } from '../components/RequestSimulator';

const SCORE_LABELS: Record<keyof PlaygroundConfig['scores'], { label: string; help: string }> = {
  complexity: { label: 'Complexity', help: 'How much there is to build and understand (higher = more complex)' },
  scalability: { label: 'Scalability', help: 'How far it can grow by adding resources' },
  resilience: { label: 'Resilience', help: 'How well it survives a component failing' },
  operationalCost: { label: 'Operational effort', help: 'How much work it takes to run and monitor' },
};

function ScoreBar({ value }: { value: number }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <LinearProgress variant="determinate" value={value * 20} sx={{ flexGrow: 1, height: 6, borderRadius: 3, minWidth: 60 }} aria-hidden />
      <Typography variant="caption" sx={{ minWidth: 28 }}>
        {value}/5
      </Typography>
    </Stack>
  );
}

export default function PlaygroundPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'simulator' ? 'simulator' : 'architectures';
  return (
    <Container maxWidth="lg" sx={{ py: 5 }}>
      <Seo title="Interactive Playground" path="/playground" description="Compare hypothetical architectures — single server, cluster, load balancing, Redis, queues, microservices — and simulate failures and request flows." />
      <SectionHeader eyebrow="Playground" title="Interactive playground" description="Explore how an architecture changes as you add building blocks, break components on purpose, and follow a request step by step." />
      <Tabs value={tab} onChange={(_, v) => setParams(v === 'simulator' ? { tab: v } : {}, { replace: true })} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab value="architectures" label="Compare architectures" />
        <Tab value="simulator" label="Request lifecycle simulator" />
      </Tabs>
      {tab === 'architectures' ? <ArchitectureComparison /> : <RequestSimulator />}
    </Container>
  );
}

function ArchitectureComparison() {
  const [configId, setConfigId] = useState(playgroundConfigs[0].id);
  const [mode, setMode] = useState<'traffic' | 'request'>('traffic');
  const config = playgroundConfigs.find((c) => c.id === configId)!;
  const select = (id: string) => setConfigId(id);

  return (
    <Stack spacing={3}>
      <Alert severity="info" variant="outlined">
        These architectures are <b>hypothetical teaching examples</b>. Capacities, response times and scores are illustrative judgements to help you compare — not benchmark results or real performance measurements.
      </Alert>

      <Box role="radiogroup" aria-label="Architecture configuration" sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(6, 1fr)' } }}>
        {playgroundConfigs.map((c, i) => (
          <Button
            key={c.id}
            role="radio"
            aria-checked={c.id === configId}
            variant={c.id === configId ? 'contained' : 'outlined'}
            onClick={() => select(c.id)}
            sx={{ justifyContent: 'flex-start', textAlign: 'left', py: 1, lineHeight: 1.3 }}
          >
            {i + 1}. {c.name}
          </Button>
        ))}
      </Box>

      <Paper sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }} justifyContent="space-between">
          <Box>
            <Typography variant="h4" component="h2">
              {config.name}
            </Typography>
            <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>
              {config.simple}
            </Typography>
          </Box>
          <ToggleButtonGroup exclusive color="primary" value={mode} onChange={(_, v) => v && setMode(v)} aria-label="Playground mode" sx={{ flexShrink: 0 }}>
            <ToggleButton value="traffic">
              <SpeedIcon fontSize="small" sx={{ mr: 0.75 }} /> Live traffic
            </ToggleButton>
            <ToggleButton value="request">
              <RouteIcon fontSize="small" sx={{ mr: 0.75 }} /> Follow one request
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Paper>

      {mode === 'traffic' ? (
        <TrafficLab key={config.id} config={config} />
      ) : (
        <Box>
          <Callout kind="simple" title="Follow one request">
            <Typography>Press <b>Play</b> (or Next) to watch a single request travel through this architecture, step by step. Switch to the Sequence view to see the same journey as a timeline.</Typography>
          </Callout>
          <ArchitectureViewer key={config.id} diagram={config.diagram} height={400} />
        </Box>
      )}

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="overline" color="text.secondary">
            How it works
          </Typography>
          <Typography variant="body2">{config.description}</Typography>
          <Typography variant="body2" sx={{ mt: 1.5 }}>
            <b>Capacity (illustrative):</b> {config.capacityNote}
          </Typography>
        </Paper>
        <Paper sx={{ p: 2 }}>
          <Typography variant="overline" color="text.secondary">
            Potential bottlenecks
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
            {config.bottlenecks.map((b) => (
              <li key={b}>
                <Typography variant="body2">{b}</Typography>
              </li>
            ))}
          </Box>
          <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
            Operational trade-offs
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
            {config.tradeoffs.map((b) => (
              <li key={b}>
                <Typography variant="body2">{b}</Typography>
              </li>
            ))}
          </Box>
        </Paper>
      </Box>

      <Paper sx={{ overflowX: 'auto' }}>
        <Box sx={{ p: 2, pb: 1 }}>
          <Typography variant="h4" component="h2">
            Side-by-side comparison
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Relative 1–5 scores (educational judgement, not measurements).
          </Typography>
        </Box>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Architecture</TableCell>
              {Object.entries(SCORE_LABELS).map(([k, v]) => (
                <TableCell key={k} title={v.help}>
                  {v.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {playgroundConfigs.map((c) => (
              <TableRow key={c.id} selected={c.id === configId} hover onClick={() => select(c.id)} sx={{ cursor: 'pointer' }}>
                <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{c.name}</TableCell>
                {(Object.keys(SCORE_LABELS) as (keyof PlaygroundConfig['scores'])[]).map((k) => (
                  <TableCell key={k} sx={{ minWidth: 120 }}>
                    <ScoreBar value={c.scores[k]} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Stack>
  );
}
