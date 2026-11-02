import CloseIcon from '@mui/icons-material/Close';
import type { DiagramNode, FlowStep, NodeKind } from '../../shared';
import { Box, Chip, Divider, Drawer, IconButton, Stack, Tab, Tabs, Typography } from '@mui/material';
import { useState, type ReactNode } from 'react';
import { usePreferences } from '../../context/PreferencesContext';
import { fontMono } from '../../theme/theme';
import { NODE_KIND_META } from './nodeKinds';

function DetailList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="overline" color="text.secondary">
        {title}
      </Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.5, '& li': { fontSize: '0.9rem', my: 0.5 } }}>
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </Box>
    </Box>
  );
}

/** Explains one component: responsibility, inputs, outputs, technology and failure modes. */
export function DetailsDrawer({ node, onClose, extra }: { node: DiagramNode | undefined; onClose: () => void; extra?: (n: DiagramNode) => ReactNode }) {
  const meta = node ? NODE_KIND_META[node.kind] : undefined;
  return (
    <Drawer anchor="right" open={!!node} onClose={onClose} PaperProps={{ sx: { width: { xs: '100%', sm: 400 }, p: 3 } }}>
      {node && meta && (
        <Box role="region" aria-label={`${node.label} details`}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box sx={{ width: 40, height: 40, borderRadius: 1, display: 'grid', placeItems: 'center', bgcolor: `${meta.color}22`, color: meta.color }}>
                <meta.Icon aria-hidden />
              </Box>
              <Box>
                <Typography variant="h4" component="h2">
                  {node.label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {meta.label}
                </Typography>
              </Box>
            </Stack>
            <IconButton onClick={onClose} aria-label="Close details">
              <CloseIcon />
            </IconButton>
          </Stack>

          <Box sx={{ mt: 2.5, p: 1.5, borderRadius: 1, bgcolor: 'action.hover', borderLeft: 3, borderColor: 'secondary.main' }}>
            <Typography variant="overline" color="secondary">
              In plain English
            </Typography>
            <Typography>{node.simple}</Typography>
          </Box>

          <Box sx={{ mt: 2 }}>
            <Typography variant="overline" color="text.secondary">
              Responsibility
            </Typography>
            <Typography variant="body2">{node.details.responsibility}</Typography>
          </Box>
          <DetailList title="Inputs" items={node.details.inputs} />
          <DetailList title="Outputs" items={node.details.outputs} />
          {node.details.technologies.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="overline" color="text.secondary">
                Technology choices
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mt: 0.5 }}>
                {node.details.technologies.map((t) => (
                  <Chip key={t} size="small" label={t} variant="outlined" />
                ))}
              </Stack>
            </Box>
          )}
          <DetailList title="What can go wrong" items={node.details.failureModes.filter(Boolean)} />
          {extra && (
            <>
              <Divider sx={{ my: 2.5 }} />
              {extra(node)}
            </>
          )}
        </Box>
      )}
    </Drawer>
  );
}

function Mono({ children }: { children: string }) {
  return (
    <Box component="pre" sx={{ m: 0, p: 1.5, fontFamily: fontMono, fontSize: '0.78rem', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', bgcolor: 'action.hover', borderRadius: 1, maxHeight: 220, overflow: 'auto' }}>
      {children}
    </Box>
  );
}

/** Explanation of the active step, with example request/response/log. */
export function StepPanel({ step, index, total, nodes }: { step: FlowStep | undefined; index: number; total: number; nodes: DiagramNode[] }) {
  const { readingMode } = usePreferences();
  const tabs = step ? (['request', 'response', 'log'] as const).filter((k) => step[k]) : [];
  const [chosen, setTab] = useState<(typeof tabs)[number]>();
  // Fall back to the first available tab when the chosen one doesn't exist for this step.
  const tab = chosen && tabs.includes(chosen) ? chosen : tabs[0];

  if (!step) {
    return (
      <Box sx={{ p: 2 }} aria-live="polite">
        <Typography color="text.secondary">
          Press <b>Play</b> or <b>Next</b> to follow a request through the system one step at a time. Click any box to learn what it does.
        </Typography>
      </Box>
    );
  }
  const label = (id: string) => nodes.find((n) => n.id === id)?.label ?? id;
  return (
    <Box sx={{ p: 2 }} aria-live="polite">
      <Typography variant="overline" color="primary">
        Step {index + 1} of {total} · {label(step.from)} → {label(step.to)}
      </Typography>
      <Typography variant="h5" component="p" sx={{ mb: 1 }}>
        {step.title}
      </Typography>
      {step.simple && (
        <Typography sx={{ mb: 1, fontWeight: readingMode === 'quick' ? 400 : 500 }} color={readingMode === 'quick' ? 'text.primary' : 'secondary.main'}>
          {step.simple}
        </Typography>
      )}
      {(readingMode === 'deep' || !step.simple) && (
        <Typography variant="body2" color="text.secondary">
          {step.explanation}
        </Typography>
      )}
      {tabs.length > 0 && tab && readingMode === 'deep' && (
        <Box sx={{ mt: 1.5 }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ minHeight: 32, '& .MuiTab-root': { minHeight: 32, py: 0.5 } }} aria-label="Example data for this step">
            {tabs.map((t) => (
              <Tab key={t} value={t} label={t === 'log' ? 'Logs' : t[0].toUpperCase() + t.slice(1)} />
            ))}
          </Tabs>
          <Box sx={{ mt: 1 }}>
            <Mono>{step[tab] ?? ''}</Mono>
          </Box>
        </Box>
      )}
    </Box>
  );
}

export function Legend({ kinds, traffic }: { kinds: NodeKind[]; traffic?: boolean }) {
  return (
    <Box component="figure" aria-label="Diagram legend" sx={{ m: 0, display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center', fontSize: '0.78rem', color: 'text.secondary' }}>
      {kinds.map((k) => {
        const m = NODE_KIND_META[k];
        return (
          <Stack key={k} direction="row" spacing={0.5} alignItems="center" title={m.simple}>
            <m.Icon sx={{ fontSize: 15, color: m.color }} aria-hidden />
            <span>{m.label}</span>
          </Stack>
        );
      })}
      <Stack direction="row" spacing={0.75} alignItems="center">
        <Box sx={{ width: 22, borderTop: 2, borderColor: 'text.secondary' }} />
        <span>sync call</span>
      </Stack>
      <Stack direction="row" spacing={0.75} alignItems="center">
        <Box sx={{ width: 22, borderTop: 2, borderStyle: 'dashed', borderColor: 'text.secondary' }} />
        <span>async / event</span>
      </Stack>
      {traffic ? (
        <>
          {[
            ['secondary.main', 'healthy'],
            ['warning.main', 'busy (> 80%)'],
            ['error.main', 'overloaded / failing'],
          ].map(([c, l]) => (
            <Stack key={l} direction="row" spacing={0.75} alignItems="center">
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: c }} />
              <span>{l}</span>
            </Stack>
          ))}
          <span>• moving dots = requests</span>
        </>
      ) : (
        <Stack direction="row" spacing={0.75} alignItems="center">
          <Box sx={{ width: 22, borderTop: 3, borderColor: 'primary.main' }} />
          <span>active step</span>
        </Stack>
      )}
    </Box>
  );
}
