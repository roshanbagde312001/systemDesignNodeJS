import BoltIcon from '@mui/icons-material/Bolt';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import type { PlaygroundConfig, TrafficScenario } from '../../content/playground';
import type { DiagramNode } from '../../shared';
import {
  Alert,
  Box,
  Button,
  Chip,
  LinearProgress,
  Paper,
  Slider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArchitectureViewer } from '../diagram/ArchitectureViewer';
import { NODE_KIND_META } from '../diagram/nodeKinds';
import { formatRate, simulate, type NodeMetrics, type SimResult } from './simulate';

const TICK_MS = 500;

export interface LabEvent {
  id: number;
  at: number;
  severity: 'success' | 'info' | 'warning' | 'error';
  text: string;
}

const FIX_HINTS: Partial<Record<DiagramNode['kind'], string>> = {
  service: 'Run more copies of it behind a load balancer (try “Load-balanced instances”), or make each request cheaper.',
  database: 'Put a cache in front of it (try “Node.js with Redis”), add read replicas, or split the data (sharding).',
  worker: 'Add more workers. Meanwhile the queue keeps every job safe, so nothing is lost.',
  loadBalancer: 'Run several load-balancer nodes — managed load balancers do this for you.',
  apiGateway: 'Run more gateway instances.',
  cache: 'Add more Redis nodes (a Redis cluster).',
};

/** Context-aware advice: don't suggest adding a cache to an architecture that already has one. */
function fixHint(config: PlaygroundConfig, kind: DiagramNode['kind']) {
  if (kind === 'database' && config.diagram.nodes.some((n) => n.kind === 'cache')) {
    return 'Keep the cache warm (a high hit ratio protects the database), pre-load popular data after restarts, and add read replicas.';
  }
  return FIX_HINTS[kind] ?? 'add capacity here.';
}

const pct = (u: number) => (Number.isFinite(u) ? `${Math.round(u * 100)}%` : '—');

/** Plain-English summary of the current state of the system. */
export function explain(config: PlaygroundConfig, r: SimResult): { severity: LabEvent['severity']; title: string; body: string } {
  const label = (id: string) => config.diagram.nodes.find((n) => n.id === id)?.label ?? id;
  const kind = (id: string) => config.diagram.nodes.find((n) => n.id === id)!.kind;
  if (r.incomingRps === 0)
    return { severity: 'info', title: 'No traffic', body: 'Move the traffic slider or pick a scenario to send requests into the system.' };

  const down = Object.entries(r.nodes).find(([, m]) => m.status === 'failed' && m.inRps > 0 && m.userFacing);
  if (down && r.failedRps > 0) {
    return {
      severity: 'error',
      title: `${label(down[0])} is down`,
      body: `Requests that need it can’t be answered, so about ${pct(r.errorRate)} of all requests fail. Redundancy (more than one copy) is how real systems survive this.`,
    };
  }
  const b = r.bottleneck ? r.nodes[r.bottleneck] : undefined;
  if (b && r.bottleneck && b.utilization > 1) {
    return {
      severity: 'error',
      title: `${label(r.bottleneck)} is the bottleneck`,
      body: `It receives ${formatRate(b.inRps)} requests/s but can only handle ${formatRate(b.capacity)}/s. Extra requests wait in line, slow everyone down, and ${formatRate(r.failedRps)}/s fail. Fix: ${fixHint(config, kind(r.bottleneck))}`,
    };
  }
  if (r.backlogRate > 0) {
    return {
      severity: 'warning',
      title: 'Work is piling up in the queue',
      body: `Users still get instant replies, but jobs arrive ${formatRate(r.backlogRate)}/s faster than workers finish them. The queue stores them safely until workers catch up. Fix: ${FIX_HINTS.worker}`,
    };
  }
  const degraded = Object.entries(r.nodes).find(([, m]) => m.status === 'failed' && m.inRps === 0);
  if (b && r.bottleneck && b.utilization > 0.8) {
    return {
      severity: 'warning',
      title: `${label(r.bottleneck)} is getting busy (${pct(b.utilization)})`,
      body: 'Everything still works, but response times rise sharply as a component approaches 100%. Engineers usually add capacity around 70–80% to keep headroom for spikes.',
    };
  }
  return {
    severity: 'success',
    title: degraded ? `Healthy — even with ${label(degraded[0])} down` : 'Everything is healthy',
    body: `${degraded ? 'Traffic was routed around the failed component. ' : ''}The busiest part is ${r.bottleneck ? `${label(r.bottleneck)} at ${pct(b!.utilization)}` : 'nothing yet'}. Push the traffic slider higher to find the breaking point.`,
  };
}

/** Turns a change between two simulation results into human-readable events. */
export function diffEvents(config: PlaygroundConfig, prev: SimResult | undefined, next: SimResult): Omit<LabEvent, 'id' | 'at'>[] {
  if (!prev) return [];
  const events: Omit<LabEvent, 'id' | 'at'>[] = [];
  const balancedBy = (id: string) => config.diagram.edges.some((e) => e.target === id && config.traffic.nodes[e.source]?.balance);
  for (const n of config.diagram.nodes) {
    const a = prev.nodes[n.id];
    const b = next.nodes[n.id];
    if (!a || !b || a.status === b.status) continue;
    if (b.status === 'failed') {
      events.push({
        severity: 'error',
        text: balancedBy(n.id)
          ? `${n.label} went down. The load balancer stopped sending it traffic and spread the load over the healthy copies.`
          : b.userFacing
            ? `${n.label} went down. Requests that need it now fail.`
            : `${n.label} went down. Users don’t notice directly, but background work stops.`,
      });
    } else if (a.status === 'failed') {
      events.push({ severity: 'success', text: `${n.label} is back up and receiving traffic again.` });
    } else if (b.status === 'overloaded') {
      events.push({
        severity: 'error',
        text:
          b.backlogRate > 0
            ? `${n.label} can’t keep up: ${formatRate(b.backlogRate)} jobs/s are waiting in the queue (nothing is lost).`
            : `${n.label} is overloaded at ${pct(b.utilization)} — requests are queuing and some fail.`,
      });
    } else if (b.status === 'busy' && a.status !== 'overloaded') {
      events.push({ severity: 'warning', text: `${n.label} is getting busy (${pct(b.utilization)}). Response times are rising.` });
    } else if ((b.status === 'ok' || b.status === 'idle') && (a.status === 'overloaded' || a.status === 'busy')) {
      events.push({ severity: 'success', text: `${n.label} is healthy again (${pct(b.utilization)}).` });
    }
  }
  return events;
}

function useTrafficLab(config: PlaygroundConfig) {
  const [rps, setRps] = useState(config.traffic.defaultRps);
  const [failed, setFailed] = useState<string[]>([]);
  const [hitRatio, setHitRatio] = useState(config.traffic.hitRatio);
  const [running, setRunning] = useState(true);
  const [clock, setClock] = useState({ seconds: 0, served: 0, failed: 0, backlog: 0 });
  const [events, setEvents] = useState<LabEvent[]>([]);
  const nextId = useRef(0);
  const prevResult = useRef<SimResult>();
  const clockRef = useRef(clock);
  clockRef.current = clock;

  const result = useMemo(() => simulate(config.diagram, config.traffic, { rps, failed: new Set(failed), hitRatio }), [config, rps, failed, hitRatio]);

  const log = useCallback((items: Omit<LabEvent, 'id' | 'at'>[]) => {
    if (items.length === 0) return;
    setEvents((ev) => [...items.map((i) => ({ ...i, id: nextId.current++, at: clockRef.current.seconds })).reverse(), ...ev].slice(0, 30));
  }, []);

  useEffect(() => {
    log(diffEvents(config, prevResult.current, result));
    prevResult.current = result;
  }, [config, result, log]);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      const dt = TICK_MS / 1000;
      setClock((c) => ({
        seconds: c.seconds + dt,
        served: c.served + result.servedRps * dt,
        failed: c.failed + result.failedRps * dt,
        backlog: Math.max(0, c.backlog + (result.backlogRate > 0 ? result.backlogRate : -result.drainRate) * dt),
      }));
    }, TICK_MS);
    return () => clearInterval(t);
  }, [running, result]);

  const reset = () => {
    setRps(config.traffic.defaultRps);
    setFailed([]);
    setHitRatio(config.traffic.hitRatio);
    setClock({ seconds: 0, served: 0, failed: 0, backlog: 0 });
    setEvents([]);
    prevResult.current = undefined;
    setRunning(true);
  };

  const toggleFailure = (id: string) => setFailed((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));

  const applyScenario = (s: TrafficScenario) => {
    setRps(s.rps);
    setFailed(s.failed ?? []);
    if (s.hitRatio !== undefined) setHitRatio(s.hitRatio);
    else setHitRatio(config.traffic.hitRatio);
    setRunning(true);
    log([
      {
        severity: 'info',
        text: `Scenario “${s.label}”: ${formatRate(s.rps)} requests/s${s.failed?.length ? `, ${s.failed.length} component(s) broken` : ''}.`,
      },
    ]);
  };

  return { rps, setRps, failed, toggleFailure, hitRatio, setHitRatio, running, setRunning, clock, events, log, result, reset, applyScenario };
}

function StatTile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'error' | 'warning' | 'success' }) {
  return (
    <Paper sx={{ p: 1.5, borderColor: tone ? `${tone}.main` : undefined }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: '1.4rem', fontWeight: 750, lineHeight: 1.2, color: tone ? `${tone}.main` : 'text.primary' }}>{value}</Typography>
      {sub && (
        <Typography variant="caption" color="text.secondary">
          {sub}
        </Typography>
      )}
    </Paper>
  );
}

const SEVERITY_ICON = { success: CheckCircleOutlineIcon, info: InfoOutlinedIcon, warning: WarningAmberIcon, error: ErrorOutlineIcon };

function StatusChip({ m }: { m: NodeMetrics }) {
  const map = {
    idle: ['idle', 'default'],
    ok: ['healthy', 'success'],
    busy: ['busy', 'warning'],
    overloaded: ['overloaded', 'error'],
    failed: ['down', 'error'],
  } as const;
  const [label, color] = map[m.status];
  return <Chip size="small" label={label} color={color} variant={m.status === 'ok' || m.status === 'idle' ? 'outlined' : 'filled'} />;
}

/** Live traffic simulation for one playground architecture. */
export function TrafficLab({ config }: { config: PlaygroundConfig }) {
  const theme = useTheme();
  const lab = useTrafficLab(config);
  const { result } = lab;
  const [scenario, setScenario] = useState<TrafficScenario>();
  const summary = explain(config, result);
  const breakable = config.diagram.nodes.filter((n) => n.id !== config.traffic.entry);
  const hasQueue = Object.values(config.traffic.nodes).some((n) => n.buffer);
  const label = (id: string) => config.diagram.nodes.find((n) => n.id === id)?.label ?? id;

  const SummaryIcon = SEVERITY_ICON[summary.severity];

  return (
    <Stack spacing={2.5}>
      <Box sx={{ display: 'grid', gap: 2.5 }}>
        {/* Diagram */}
        <Box sx={{ minWidth: 0 }}>
          <ArchitectureViewer
            key={config.id}
            diagram={config.diagram}
            height={460}
            failedNodeIds={lab.failed}
            traffic={{ nodes: result.nodes, edges: result.edges, running: lab.running }}
            detailsExtra={(node) => {
              const m = result.nodes[node.id];
              return (
                <Box>
                  {m && node.id !== config.traffic.entry && (
                    <>
                      <Typography variant="overline" color="text.secondary">
                        Live load (illustrative)
                      </Typography>
                      <Table size="small" sx={{ mb: 2 }}>
                        <TableBody>
                          <TableRow>
                            <TableCell>Requests coming in</TableCell>
                            <TableCell align="right">{formatRate(m.inRps)}/s</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Can handle</TableCell>
                            <TableCell align="right">{Number.isFinite(m.capacity) ? `${formatRate(m.capacity)}/s` : 'stores everything'}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>How busy</TableCell>
                            <TableCell align="right">{pct(m.utilization)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Time spent here</TableCell>
                            <TableCell align="right">{m.latencyMs.toFixed(1)} ms</TableCell>
                          </TableRow>
                          {m.droppedRps > 0 && (
                            <TableRow>
                              <TableCell>Failing</TableCell>
                              <TableCell align="right" sx={{ color: 'error.main' }}>
                                {formatRate(m.droppedRps)}/s
                              </TableCell>
                            </TableRow>
                          )}
                          {m.backlogRate > 0 && (
                            <TableRow>
                              <TableCell>Waiting in queue</TableCell>
                              <TableCell align="right" sx={{ color: 'warning.main' }}>
                                +{formatRate(m.backlogRate)}/s
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </>
                  )}
                  <Typography variant="overline" color="error">
                    What if this fails?
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1.5 }}>
                    {config.failureImpact[node.id] ?? 'Requests that depend on this component fail or slow down until it recovers.'}
                  </Typography>
                  {node.id !== config.traffic.entry && (
                    <Button
                      variant={lab.failed.includes(node.id) ? 'outlined' : 'contained'}
                      color="error"
                      startIcon={<WarningAmberIcon />}
                      onClick={() => lab.toggleFailure(node.id)}
                    >
                      {lab.failed.includes(node.id) ? 'Restore component' : 'Simulate failure'}
                    </Button>
                  )}
                </Box>
              );
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Each moving dot is a stream of requests. Thicker lines carry more traffic. Click any box for its live numbers.
          </Typography>
        </Box>

        {/* Controls */}
        <Paper
          sx={{ p: 2, display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, alignItems: 'start' }}
          component="section"
          aria-label="Simulation controls"
        >
          <Box>
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              <Button
                variant="contained"
                startIcon={lab.running ? <PauseIcon /> : <PlayArrowIcon />}
                onClick={() => lab.setRunning((r) => !r)}
                aria-label={lab.running ? 'Pause traffic' : 'Start traffic'}
              >
                {lab.running ? 'Pause' : 'Start'}
              </Button>
              <Button
                startIcon={<RestartAltIcon />}
                onClick={() => {
                  lab.reset();
                  setScenario(undefined);
                }}
              >
                Reset
              </Button>
            </Stack>

            <Typography id="traffic-slider" fontWeight={650}>
              Traffic: {formatRate(lab.rps)} requests/second
            </Typography>
            <Slider
              aria-labelledby="traffic-slider"
              value={lab.rps}
              min={0}
              max={config.traffic.maxRps}
              step={config.traffic.maxRps / 100}
              onChange={(_, v) => lab.setRps(v as number)}
              onChangeCommitted={(_, v) => lab.log([{ severity: 'info', text: `Traffic changed to ${formatRate(v as number)} requests/s.` }])}
              valueLabelDisplay="auto"
              valueLabelFormat={(v) => `${formatRate(v)}/s`}
              marks={[
                { value: 0, label: '0' },
                { value: config.traffic.maxRps, label: formatRate(config.traffic.maxRps) },
              ]}
            />

            {lab.hitRatio !== undefined && (
              <>
                <Typography id="hit-slider" fontWeight={650} sx={{ mt: 1 }}>
                  Cache hit ratio: {Math.round(lab.hitRatio * 100)}%
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  How often the answer is already in Redis. The rest goes to the database.
                </Typography>
                <Slider
                  aria-labelledby="hit-slider"
                  value={lab.hitRatio}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(_, v) => lab.setHitRatio(v as number)}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(v) => `${Math.round(v * 100)}%`}
                />
              </>
            )}
          </Box>
          <Box>
            <Typography fontWeight={650}>Break a component</Typography>
            <Typography variant="caption" color="text.secondary">
              Click to make it fail; click again to restore it.
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mt: 1 }} role="group" aria-label="Break a component">
              {breakable.map((n) => {
                const down = lab.failed.includes(n.id);
                const Icon = NODE_KIND_META[n.kind].Icon;
                return (
                  <Chip
                    key={n.id}
                    icon={<Icon />}
                    label={n.label}
                    size="small"
                    color={down ? 'error' : 'default'}
                    variant={down ? 'filled' : 'outlined'}
                    onClick={() => lab.toggleFailure(n.id)}
                    aria-pressed={down}
                    sx={{ textDecoration: down ? 'line-through' : 'none' }}
                  />
                );
              })}
            </Stack>
          </Box>
          <Box>
            <Typography fontWeight={650}>Try a scenario</Typography>
            <Stack spacing={1} sx={{ mt: 1 }}>
              {config.scenarios.map((s) => (
                <Button
                  key={s.label}
                  variant={scenario?.label === s.label ? 'contained' : 'outlined'}
                  color="secondary"
                  startIcon={<BoltIcon />}
                  onClick={() => {
                    lab.applyScenario(s);
                    setScenario(s);
                  }}
                  sx={{ justifyContent: 'flex-start' }}
                >
                  {s.label}
                </Button>
              ))}
            </Stack>
            {scenario && (
              <Alert severity="info" variant="outlined" sx={{ mt: 1.5 }}>
                <b>What to watch:</b> {scenario.description}
              </Alert>
            )}
          </Box>
        </Paper>
      </Box>

      {/* What's happening */}
      <Alert severity={summary.severity} icon={<SummaryIcon />} aria-live="polite">
        <Typography fontWeight={700}>{summary.title}</Typography>
        <Typography variant="body2">{summary.body}</Typography>
      </Alert>

      {/* Health dashboard */}
      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr 1fr', md: `repeat(${hasQueue ? 5 : 4}, 1fr)` } }} aria-label="System health">
        <StatTile label="Requests coming in" value={`${formatRate(result.incomingRps)}/s`} />
        <StatTile
          label="Answered successfully"
          value={`${formatRate(result.servedRps)}/s`}
          tone={result.failedRps > 0 ? undefined : 'success'}
          sub={`${formatRate(lab.clock.served)} total`}
        />
        <StatTile
          label="Failing"
          value={`${formatRate(result.failedRps)}/s`}
          sub={`${Math.round(result.errorRate * 100)}% of requests · ${formatRate(lab.clock.failed)} total`}
          tone={result.failedRps > 0 ? 'error' : undefined}
        />
        <StatTile
          label="Response time (illustrative)"
          value={result.incomingRps > 0 ? `${Math.round(result.latencyMs)} ms` : '—'}
          tone={result.latencyMs > 150 ? 'error' : result.latencyMs > 60 ? 'warning' : undefined}
          sub="grows fast as parts fill up"
        />
        {hasQueue && (
          <StatTile
            label="Jobs waiting in queue"
            value={formatRate(lab.clock.backlog)}
            tone={result.backlogRate > 0 ? 'warning' : undefined}
            sub={
              result.backlogRate > 0
                ? `growing +${formatRate(result.backlogRate)}/s`
                : lab.clock.backlog > 0
                  ? `draining −${formatRate(result.drainRate)}/s`
                  : 'empty'
            }
          />
        )}
      </Box>

      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: '3fr 2fr' } }}>
        {/* Per-component detail */}
        <Paper sx={{ overflowX: 'auto' }}>
          <Typography variant="h5" component="h3" sx={{ p: 2, pb: 1 }}>
            Component load
          </Typography>
          <Table size="small" aria-label="Component load">
            <TableHead>
              <TableRow>
                <TableCell>Component</TableCell>
                <TableCell align="right">In</TableCell>
                <TableCell align="right">Limit</TableCell>
                <TableCell sx={{ minWidth: 140 }}>Busy</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {breakable.map((n) => {
                const m = result.nodes[n.id];
                const u = Number.isFinite(m.utilization) ? Math.min(1, m.utilization) : 1;
                const color = m.status === 'overloaded' || m.status === 'failed' ? 'error' : m.status === 'busy' ? 'warning' : 'secondary';
                return (
                  <TableRow key={n.id} sx={{ bgcolor: needsAttention(m) ? alpha(theme.palette.error.main, 0.06) : undefined }}>
                    <TableCell sx={{ fontWeight: 600 }}>{n.label}</TableCell>
                    <TableCell align="right">{formatRate(m.inRps)}/s</TableCell>
                    <TableCell align="right">
                      {Number.isFinite(m.capacity) ? `${formatRate(m.capacity)}/s` : config.traffic.nodes[n.id]?.buffer ? 'buffers' : '—'}
                    </TableCell>
                    <TableCell>
                      {Number.isFinite(config.traffic.nodes[n.id]?.capacity ?? Infinity) && !config.traffic.nodes[n.id]?.buffer ? (
                        <Stack direction="row" spacing={1} alignItems="center">
                          <LinearProgress
                            variant="determinate"
                            value={u * 100}
                            color={color}
                            sx={{ flexGrow: 1, height: 6, borderRadius: 3 }}
                            aria-label={`${n.label} utilization`}
                          />
                          <Typography variant="caption" sx={{ minWidth: 36 }}>
                            {pct(m.utilization)}
                          </Typography>
                        </Stack>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          n/a
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusChip m={m} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Paper>

        {/* Event log */}
        <Paper sx={{ p: 2, maxHeight: 360, overflowY: 'auto' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="baseline">
            <Typography variant="h5" component="h3">
              What just happened
            </Typography>
            <Typography variant="caption" color="text.secondary">
              t = {lab.clock.seconds.toFixed(0)}s
            </Typography>
          </Stack>
          {lab.events.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Change the traffic, break a component or try a scenario — events will appear here.
            </Typography>
          ) : (
            <Box component="ol" sx={{ listStyle: 'none', p: 0, m: 0, mt: 1 }} aria-label="Event log" aria-live="polite">
              {lab.events.map((e) => {
                const Icon = SEVERITY_ICON[e.severity];
                return (
                  <Box component="li" key={e.id} sx={{ display: 'flex', gap: 1, py: 0.75, borderBottom: 1, borderColor: 'divider' }}>
                    <Icon fontSize="small" color={e.severity} sx={{ mt: 0.25 }} aria-hidden />
                    <Box>
                      <Typography variant="body2">{e.text}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        at {e.at.toFixed(0)}s
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}
        </Paper>
      </Box>

      {result.bottleneck && (
        <Typography variant="body2" color="text.secondary">
          Current busiest component:{' '}
          <Tooltip title="The part closest to its limit — the first thing to break when traffic grows.">
            <b>{label(result.bottleneck)}</b>
          </Tooltip>{' '}
          ({pct(result.nodes[result.bottleneck].utilization)}). All capacities are illustrative teaching numbers, not benchmarks.
        </Typography>
      )}
    </Stack>
  );
}

const needsAttention = (m: NodeMetrics) => m.status === 'overloaded' || (m.status === 'failed' && m.inRps > 0);
