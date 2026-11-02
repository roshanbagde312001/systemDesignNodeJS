import '@xyflow/react/dist/style.css';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ReplayIcon from '@mui/icons-material/Replay';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import ViewTimelineIcon from '@mui/icons-material/ViewTimeline';
import type { Diagram, DiagramEdge, DiagramNode } from '@sda/shared';
import {
  Box,
  Chip,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
} from '@xyflow/react';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import type { EdgeMetrics, NodeMetrics } from '../playground/simulate';
import { ArchNode, type ArchFlowNode, type ArchNodeState } from './ArchNode';
import { TrafficEdge } from './TrafficEdge';
import { DetailsDrawer, Legend, StepPanel } from './panels';
import { SequenceDiagram } from './SequenceDiagram';
import { useFlowPlayback } from './useFlowPlayback';

const nodeTypes = { arch: ArchNode };
const edgeTypes = { traffic: TrafficEdge };
const NODE_W = 170;
const NODE_H = 64;

/** Picks the box sides to connect so arrows don't cross through nodes. */
function handlesFor(a: DiagramNode, b: DiagramNode) {
  const dx = b.position.x - a.position.x;
  const dy = b.position.y - a.position.y;
  if (Math.abs(dx) >= Math.abs(dy) * 1.2) return dx >= 0 ? ['s-r', 't-l'] : ['s-l', 't-r'];
  return dy >= 0 ? ['s-b', 't-t'] : ['s-t', 't-b'];
}

export interface ArchitectureViewerProps {
  diagram: Diagram;
  height?: number;
  /** Node ids shown as failed (used by the playground). */
  failedNodeIds?: string[];
  /** Extra content in the details drawer, e.g. "simulate failure" controls. */
  detailsExtra?: (node: DiagramNode) => ReactNode;
  /** Hide flow controls even if the diagram has flows. */
  hideFlows?: boolean;
  initialFlowId?: string;
  /** Live traffic simulation: per-node load and per-edge request rates. */
  traffic?: { nodes: Record<string, NodeMetrics>; edges: Record<string, EdgeMetrics>; running: boolean };
}

export function ArchitectureViewer(props: ArchitectureViewerProps) {
  return (
    <ReactFlowProvider>
      <Viewer {...props} />
    </ReactFlowProvider>
  );
}

function Viewer({ diagram, height = 460, failedNodeIds = [], detailsExtra, hideFlows, initialFlowId, traffic }: ArchitectureViewerProps) {
  const theme = useTheme();
  const { fitView } = useReactFlow();
  const flows = hideFlows || traffic ? [] : diagram.flows;
  const [flowId, setFlowId] = useState(initialFlowId ?? flows[0]?.id);
  const flow = flows.find((f) => f.id === flowId);
  const playback = useFlowPlayback(flow);
  const [view, setView] = useState<'architecture' | 'sequence'>('architecture');
  const [selectedId, setSelectedId] = useState<string>();
  const byId = useMemo(() => new Map(diagram.nodes.map((n) => [n.id, n])), [diagram.nodes]);
  const active = playback.activeStep;

  const stateOf = useCallback(
    (id: string): ArchNodeState => {
      if (failedNodeIds.includes(id)) return 'failed';
      if (traffic) {
        const status = traffic.nodes[id]?.status;
        return status === 'overloaded' ? 'overloaded' : status === 'busy' ? 'busy' : status === 'idle' ? 'dimmed' : 'idle';
      }
      if (!active) return 'idle';
      if (active.to === id) return 'active';
      if (active.from === id) return 'source';
      return 'dimmed';
    },
    [active, failedNodeIds, traffic],
  );

  const nodes: ArchFlowNode[] = useMemo(
    () =>
      diagram.nodes.map((n) => ({
        id: n.id,
        type: 'arch',
        position: n.position,
        width: NODE_W,
        height: traffic ? NODE_H + 12 : NODE_H,
        data: { node: n, state: stateOf(n.id), onSelect: setSelectedId, metrics: traffic?.nodes[n.id] },
        draggable: false,
        selectable: false,
      })),
    [diagram.nodes, stateOf, traffic],
  );

  const edges: Edge[] = useMemo(() => {
    const isActive = (e: DiagramEdge) => !!active && ((e.source === active.from && e.target === active.to) || (e.source === active.to && e.target === active.from));
    return diagram.edges
      .filter((e) => byId.has(e.source) && byId.has(e.target))
      .map((e) => {
        const [sourceHandle, targetHandle] = handlesFor(byId.get(e.source)!, byId.get(e.target)!);
        const on = isActive(e);
        const broken = failedNodeIds.includes(e.source) || failedNodeIds.includes(e.target);
        const color = on ? theme.palette.primary.main : broken ? theme.palette.error.main : theme.palette.text.secondary;
        if (traffic) {
          const m = traffic.edges[e.id] ?? { rps: 0, status: 'idle' as const };
          const c = m.status === 'error' ? theme.palette.error.main : m.status === 'busy' ? theme.palette.warning.main : m.status === 'ok' ? theme.palette.secondary.main : theme.palette.text.disabled;
          return {
            id: e.id,
            source: e.source,
            target: e.target,
            sourceHandle,
            targetHandle,
            type: 'traffic',
            data: { rps: m.rps, status: m.status, running: traffic.running, async: e.async },
            markerEnd: { type: MarkerType.ArrowClosed, color: c, width: 16, height: 16 },
          } satisfies Edge;
        }
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle,
          targetHandle,
          label: e.label,
          animated: on || (!active && !!e.async),
          type: 'smoothstep',
          markerEnd: { type: MarkerType.ArrowClosed, color, width: 18, height: 18 },
          style: { stroke: color, strokeWidth: on ? 2.5 : 1.25, strokeDasharray: e.async && !on ? '6 4' : undefined, opacity: active && !on ? 0.35 : broken ? 0.6 : 1 },
          labelStyle: { fill: theme.palette.text.secondary, fontSize: 11 },
          labelBgStyle: { fill: theme.palette.background.paper },
          zIndex: on ? 10 : 0,
        } satisfies Edge;
      });
  }, [diagram.edges, byId, active, failedNodeIds, theme, traffic]);

  const kinds = useMemo(() => [...new Set(diagram.nodes.map((n) => n.kind))], [diagram.nodes]);
  const resetView = () => {
    playback.reset();
    fitView({ padding: 0.15, duration: 300 });
  };

  return (
    <Paper sx={{ overflow: 'hidden' }} data-testid="architecture-viewer">
      {/* Header: title + flow + view controls */}
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography variant="h6" component="p">
            {diagram.title}
          </Typography>
          {diagram.hypothetical && (
            <Tooltip title="An illustrative design for learning. It is not the verified internal architecture of any company.">
              <Chip size="small" color="warning" variant="outlined" label="Hypothetical" />
            </Tooltip>
          )}
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          {flows.length > 0 && (
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel id="flow-select-label">Request flow</InputLabel>
              <Select labelId="flow-select-label" label="Request flow" value={flowId ?? ''} onChange={(e) => setFlowId(e.target.value)}>
                {flows.map((f) => (
                  <MenuItem key={f.id} value={f.id}>
                    {f.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {flows.length > 0 && (
            <ToggleButtonGroup size="small" exclusive value={view} onChange={(_, v) => v && setView(v)} aria-label="Diagram view">
              <ToggleButton value="architecture" aria-label="Architecture view">
                <AccountTreeIcon fontSize="small" sx={{ mr: 0.5 }} /> Architecture
              </ToggleButton>
              <ToggleButton value="sequence" aria-label="Sequence view">
                <ViewTimelineIcon fontSize="small" sx={{ mr: 0.5 }} /> Sequence
              </ToggleButton>
            </ToggleButtonGroup>
          )}
        </Stack>
      </Stack>

      {/* Canvas */}
      {view === 'architecture' ? (
        <Box sx={{ height, bgcolor: 'background.default', '& .react-flow__attribution': { display: 'none' } }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={{ padding: 0.15, maxZoom: 1.1 }}
            minZoom={0.3}
            maxZoom={2}
            // Without a click handler React Flow sets pointer-events: none on non-draggable, non-selectable nodes.
            onNodeClick={(_, n) => setSelectedId(n.id)}
            nodesConnectable={false}
            nodesDraggable={false}
            elementsSelectable={false}
            proOptions={{ hideAttribution: true }}
            colorMode={theme.palette.mode}
            aria-label={`Interactive diagram: ${diagram.title}`}
          >
            <Background variant={BackgroundVariant.Dots} gap={18} size={1} color={theme.palette.divider} bgColor={theme.palette.background.default} />
            <Controls showInteractive={false} position="bottom-right" />
          </ReactFlow>
        </Box>
      ) : (
        flow && (
          <Box sx={{ p: 1.5, bgcolor: 'background.default' }}>
            <SequenceDiagram flow={flow} nodes={diagram.nodes} activeStep={playback.step} onSelectStep={playback.goTo} />
          </Box>
        )
      )}

      {/* Playback */}
      {flow && (
        <>
          <Divider />
          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ px: 1.5, py: 1, flexWrap: 'wrap' }} role="toolbar" aria-label="Request flow playback">
            <Tooltip title="Previous step">
              <span>
                <IconButton onClick={playback.prev} disabled={playback.step <= 0} aria-label="Previous step">
                  <SkipPreviousIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={playback.playing ? 'Pause' : 'Play'}>
              <IconButton onClick={playback.togglePlay} color="primary" aria-label={playback.playing ? 'Pause' : 'Play'}>
                {playback.playing ? <PauseIcon /> : <PlayArrowIcon />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Next step">
              <span>
                <IconButton onClick={playback.next} disabled={playback.step >= playback.total - 1} aria-label="Next step">
                  <SkipNextIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Reset flow and fit diagram to screen">
              <IconButton onClick={resetView} aria-label="Reset diagram">
                <ReplayIcon />
              </IconButton>
            </Tooltip>
            {view === 'architecture' && (
              <Tooltip title="Fit to screen">
                <IconButton onClick={() => fitView({ padding: 0.15, duration: 300 })} aria-label="Fit to screen">
                  <FitScreenIcon />
                </IconButton>
              </Tooltip>
            )}
            <Box sx={{ flexGrow: 1 }} />
            <Box sx={{ display: 'flex', gap: 0.5 }} aria-hidden>
              {flow.steps.map((_, i) => (
                <Box
                  key={i}
                  onClick={() => playback.goTo(i)}
                  sx={{ width: 18, height: 6, borderRadius: 1, cursor: 'pointer', bgcolor: i <= playback.step ? 'primary.main' : 'action.selected' }}
                />
              ))}
            </Box>
          </Stack>
          <Divider />
          <StepPanel step={playback.activeStep} index={playback.step} total={playback.total} nodes={diagram.nodes} />
        </>
      )}

      {!flow && view === 'architecture' && (
        <Stack direction="row" justifyContent="flex-end" sx={{ px: 1.5, py: 0.5, borderTop: 1, borderColor: 'divider' }}>
          <Tooltip title="Fit to screen">
            <IconButton onClick={() => fitView({ padding: 0.15, duration: 300 })} aria-label="Fit to screen" size="small">
              <FitScreenIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      )}

      <Divider />
      <Box sx={{ px: 1.5, py: 1.25 }}>
        <Legend kinds={kinds} traffic={!!traffic} />
      </Box>

      <DetailsDrawer node={selectedId ? byId.get(selectedId) : undefined} onClose={() => setSelectedId(undefined)} extra={detailsExtra} />
    </Paper>
  );
}
