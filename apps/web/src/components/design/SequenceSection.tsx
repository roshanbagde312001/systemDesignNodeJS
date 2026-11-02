import type { Diagram } from '../../shared';
import { Box, Tab, Tabs, Typography } from '@mui/material';
import { useState } from 'react';
import { SequenceDiagram } from '../diagram/SequenceDiagram';

/** One sequence diagram per flow; click a message to read what happens at that step. */
export function SequenceSection({ diagram }: { diagram: Diagram }) {
  const [flowIdx, setFlowIdx] = useState(0);
  const [step, setStep] = useState(-1);
  const flow = diagram.flows[flowIdx];
  if (!flow) return null;
  const s = flow.steps[step];
  return (
    <Box sx={{ my: 2 }}>
      <Tabs
        value={flowIdx}
        onChange={(_, v) => {
          setFlowIdx(v);
          setStep(-1);
        }}
        variant="scrollable"
        allowScrollButtonsMobile
        aria-label="Choose a flow"
        sx={{ mb: 1.5 }}
      >
        {diagram.flows.map((f, i) => (
          <Tab key={f.id} value={i} label={f.name} />
        ))}
      </Tabs>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {flow.description} Click a message to see what happens.
      </Typography>
      <SequenceDiagram flow={flow} nodes={diagram.nodes} activeStep={step} onSelectStep={setStep} />
      {s && (
        <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 1, bgcolor: 'action.hover' }} aria-live="polite">
          <Typography fontWeight={650}>
            {step + 1}. {s.title}
          </Typography>
          {s.simple && <Typography color="secondary.main">{s.simple}</Typography>}
          <Typography variant="body2" color="text.secondary">
            {s.explanation}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
