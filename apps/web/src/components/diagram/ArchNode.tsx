import type { DiagramNode } from '@sda/shared';
import { Box, Typography, alpha, useTheme } from '@mui/material';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { memo } from 'react';
import { formatRate, type NodeMetrics } from '../playground/simulate';
import { NODE_KIND_META } from './nodeKinds';

export type ArchNodeState = 'idle' | 'active' | 'source' | 'failed' | 'dimmed' | 'busy' | 'overloaded';

export type ArchNodeData = {
  node: DiagramNode;
  state: ArchNodeState;
  onSelect: (id: string) => void;
  /** Live load figures, shown in traffic-simulation mode. */
  metrics?: NodeMetrics;
};

export type ArchFlowNode = Node<ArchNodeData, 'arch'>;

const SIDES = [
  { id: 't', position: Position.Top },
  { id: 'r', position: Position.Right },
  { id: 'b', position: Position.Bottom },
  { id: 'l', position: Position.Left },
] as const;

function LoadBar({ metrics }: { metrics: NodeMetrics }) {
  const theme = useTheme();
  const { utilization, status, inRps, capacity, backlogRate } = metrics;
  const color =
    status === 'failed' || status === 'overloaded' ? theme.palette.error.main : status === 'busy' ? theme.palette.warning.main : theme.palette.secondary.main;
  const pct = Number.isFinite(utilization) ? Math.round(utilization * 100) : 0;
  const text =
    status === 'failed'
      ? inRps > 0 ? `${formatRate(inRps)}/s failing` : 'down'
      : backlogRate > 0
        ? `${formatRate(capacity)}/s · +${formatRate(backlogRate)}/s waiting`
        : Number.isFinite(capacity) && capacity > 0
          ? `${formatRate(inRps)} / ${formatRate(capacity)} req/s`
          : `${formatRate(inRps)} req/s`;
  return (
    <Box sx={{ mt: 0.75 }}>
      {Number.isFinite(capacity) && capacity > 0 && (
        <Box sx={{ height: 5, borderRadius: 3, bgcolor: alpha(color, 0.18), overflow: 'hidden' }} aria-hidden>
          <Box sx={{ height: '100%', width: `${Math.min(100, pct)}%`, bgcolor: color, transition: 'width .4s' }} />
        </Box>
      )}
      <Typography sx={{ fontSize: 10.5, fontWeight: 700, mt: 0.4, color, lineHeight: 1.2 }}>
        {text}
        {Number.isFinite(capacity) && capacity > 0 && status !== 'failed' ? ` · ${pct}%` : ''}
      </Typography>
    </Box>
  );
}

/** Diagram box. It is a real <button> so it works with keyboard and screen readers. */
export const ArchNode = memo(function ArchNode({ data }: NodeProps<ArchFlowNode>) {
  const theme = useTheme();
  const { node, state, onSelect, metrics } = data;
  const meta = NODE_KIND_META[node.kind];
  const failed = state === 'failed';
  const highlight =
    state === 'active'
      ? theme.palette.primary.main
      : state === 'source'
        ? theme.palette.secondary.main
        : state === 'overloaded'
          ? theme.palette.error.main
          : state === 'busy'
            ? theme.palette.warning.main
            : undefined;
  const borderColor = failed ? theme.palette.error.main : highlight ?? alpha(meta.color, 0.55);

  return (
    <>
      {SIDES.map((s) => (
        <Handle key={`s-${s.id}`} id={`s-${s.id}`} type="source" position={s.position} isConnectable={false} style={{ opacity: 0 }} />
      ))}
      {SIDES.map((s) => (
        <Handle key={`t-${s.id}`} id={`t-${s.id}`} type="target" position={s.position} isConnectable={false} style={{ opacity: 0 }} />
      ))}
      <Box
        component="button"
        type="button"
        onClick={() => onSelect(node.id)}
        aria-label={`${node.label}: ${node.description}.${metrics ? ` Status ${metrics.status}.` : ''} Open details.`}
        data-state={state}
        data-testid={`node-${node.id}`}
        className="nodrag nopan"
        sx={{
          all: 'unset',
          boxSizing: 'border-box',
          cursor: 'pointer',
          width: 170,
          display: 'flex',
          gap: 1,
          alignItems: 'flex-start',
          p: 1.25,
          borderRadius: 1.5,
          bgcolor: failed ? alpha(theme.palette.error.main, 0.12) : state === 'overloaded' ? alpha(theme.palette.error.main, 0.06) : 'background.paper',
          border: `1.5px solid ${borderColor}`,
          boxShadow: highlight ? `0 0 0 4px ${alpha(highlight, 0.22)}` : 'none',
          opacity: state === 'dimmed' ? 0.45 : 1,
          transition: 'box-shadow .2s, opacity .2s, border-color .2s',
          animation: state === 'overloaded' ? 'sda-pulse 1.2s ease-in-out infinite' : 'none',
          '@keyframes sda-pulse': { '50%': { boxShadow: `0 0 0 7px ${alpha(theme.palette.error.main, 0.12)}` } },
          '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
          '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
          '&:hover': { borderColor: highlight ?? meta.color },
        }}
      >
        <Box sx={{ flexShrink: 0, width: 30, height: 30, borderRadius: 1, display: 'grid', placeItems: 'center', bgcolor: alpha(meta.color, 0.15), color: meta.color }}>
          <meta.Icon sx={{ fontSize: 18 }} aria-hidden />
        </Box>
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 650, lineHeight: 1.25, color: failed ? 'error.main' : 'text.primary', textDecoration: failed ? 'line-through' : 'none' }}>
            {node.label}
          </Typography>
          {!metrics && <Typography sx={{ fontSize: 11, lineHeight: 1.3, color: 'text.secondary', mt: 0.25 }}>{failed ? 'FAILED (simulated)' : node.description}</Typography>}
          {metrics && <LoadBar metrics={metrics} />}
        </Box>
      </Box>
    </>
  );
});
