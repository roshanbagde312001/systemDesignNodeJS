import { useTheme } from '@mui/material';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type Edge, type EdgeProps } from '@xyflow/react';
import { memo } from 'react';
import { formatRate, type EdgeStatus } from '../playground/simulate';

export type TrafficEdgeData = { rps: number; status: EdgeStatus; running: boolean; async?: boolean };
export type TrafficFlowEdge = Edge<TrafficEdgeData, 'traffic'>;

/** An edge with moving "request" dots: more traffic = thicker line, more and faster dots. */
export const TrafficEdge = memo(function TrafficEdge(props: EdgeProps<TrafficFlowEdge>) {
  const theme = useTheme();
  const { id, data, markerEnd } = props;
  const [path, labelX, labelY] = getSmoothStepPath(props);
  const rps = data?.rps ?? 0;
  const status = data?.status ?? 'idle';
  const color =
    status === 'error' ? theme.palette.error.main : status === 'busy' ? theme.palette.warning.main : status === 'ok' ? theme.palette.secondary.main : theme.palette.text.disabled;
  const magnitude = Math.log10(rps + 1); // 0 … ~4.5
  const dots = rps > 0 ? Math.min(6, 1 + Math.floor(magnitude * 1.3)) : 0;
  const duration = Math.max(0.9, 3.2 - magnitude * 0.5);

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={{ stroke: color, strokeWidth: 1 + Math.min(5, magnitude * 1.2), strokeDasharray: data?.async ? '6 4' : undefined, opacity: rps > 0 ? 0.85 : 0.35 }}
      />
      {data?.running &&
        Array.from({ length: dots }, (_, i) => (
          <circle key={i} r={3.5} fill={color} data-testid="traffic-dot">
            <animateMotion dur={`${duration}s`} begin={`-${(i * duration) / dots}s`} repeatCount="indefinite" path={path} />
          </circle>
        ))}
      {rps > 0 && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              fontSize: 10,
              fontWeight: 700,
              padding: '1px 5px',
              borderRadius: 4,
              color,
              background: theme.palette.background.paper,
              border: `1px solid ${color}`,
              pointerEvents: 'none',
            }}
          >
            {formatRate(rps)}/s
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});
