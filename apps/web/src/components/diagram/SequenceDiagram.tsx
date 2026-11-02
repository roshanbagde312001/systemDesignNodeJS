import type { DiagramNode, Flow } from '@sda/shared';
import { Box, useTheme } from '@mui/material';
import { NODE_KIND_META } from './nodeKinds';

const COL = 150;
const ROW = 46;
const HEAD = 56;

/** Builds a UML-style sequence diagram (SVG) from flow steps. Click a message to jump to that step. */
export function SequenceDiagram({ flow, nodes, activeStep, onSelectStep }: { flow: Flow; nodes: DiagramNode[]; activeStep: number; onSelectStep?: (i: number) => void }) {
  const theme = useTheme();
  const byId = new Map(nodes.map((n) => [n.id, n]));

  // Participants in order of first appearance.
  const participants: string[] = [];
  for (const s of flow.steps) for (const id of [s.from, s.to]) if (!participants.includes(id)) participants.push(id);
  const x = (id: string) => participants.indexOf(id) * COL + COL / 2;
  const width = participants.length * COL;
  const height = HEAD + flow.steps.length * ROW + 24;
  const text = theme.palette.text.primary;
  const muted = theme.palette.text.secondary;
  const active = theme.palette.primary.main;

  return (
    <Box sx={{ overflowX: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' }} tabIndex={0}>
      <svg width={width} height={height} role="img" aria-label={`Sequence diagram: ${flow.name}`} style={{ display: 'block', fontFamily: 'Inter, sans-serif' }}>
        <defs>
          {['muted', 'active'].map((k) => (
            <marker key={k} id={`seq-arrow-${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill={k === 'active' ? active : muted} />
            </marker>
          ))}
        </defs>
        {participants.map((id) => {
          const n = byId.get(id);
          const color = n ? NODE_KIND_META[n.kind].color : muted;
          return (
            <g key={id}>
              <rect x={x(id) - 64} y={8} width={128} height={34} rx={6} fill="none" stroke={color} strokeWidth={1.5} />
              <text x={x(id)} y={30} textAnchor="middle" fontSize={12} fontWeight={600} fill={text}>
                {(n?.label ?? id).slice(0, 20)}
              </text>
              <line x1={x(id)} x2={x(id)} y1={42} y2={height - 8} stroke={muted} strokeDasharray="4 4" strokeOpacity={0.5} />
            </g>
          );
        })}
        {flow.steps.map((s, i) => {
          const y = HEAD + i * ROW + 16;
          const x1 = x(s.from);
          const x2 = x(s.to);
          const isActive = i === activeStep;
          const color = isActive ? active : muted;
          const self = x1 === x2;
          return (
            <g
              key={i}
              onClick={() => onSelectStep?.(i)}
              style={{ cursor: onSelectStep ? 'pointer' : 'default' }}
              data-testid={`seq-step-${i}`}
              aria-current={isActive ? 'step' : undefined}
            >
              <rect x={0} y={y - 18} width={width} height={ROW - 6} fill={isActive ? active : 'transparent'} fillOpacity={0.08} />
              {self ? (
                <path d={`M${x1},${y} h30 v14 h-30`} fill="none" stroke={color} strokeWidth={isActive ? 2 : 1.25} markerEnd={`url(#seq-arrow-${isActive ? 'active' : 'muted'})`} />
              ) : (
                <line x1={x1} x2={x2 + (x2 > x1 ? -2 : 2)} y1={y} y2={y} stroke={color} strokeWidth={isActive ? 2 : 1.25} markerEnd={`url(#seq-arrow-${isActive ? 'active' : 'muted'})`} />
              )}
              <text x={(x1 + x2) / 2 + (self ? 40 : 0)} y={y - 6} textAnchor={self ? 'start' : 'middle'} fontSize={11.5} fontWeight={isActive ? 700 : 500} fill={isActive ? active : text}>
                {i + 1}. {s.title}
              </text>
            </g>
          );
        })}
      </svg>
    </Box>
  );
}
