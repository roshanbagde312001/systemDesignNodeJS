import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { Box, Stack, Typography } from '@mui/material';

/**
 * Tiny text-to-diagram renderer for articles.
 * Syntax: "Client -> Load Balancer -> API #1 | API #2 -> Database"
 *   "->" separates steps, "|" stacks alternatives within one step.
 */
export function parseFlowChain(source: string): string[][] {
  return source
    .trim()
    .split('->')
    .map((step) => step.split('|').map((s) => s.trim()).filter(Boolean))
    .filter((step) => step.length > 0);
}

export function FlowChain({ source }: { source: string }) {
  const steps = parseFlowChain(source);
  return (
    <Box
      role="img"
      aria-label={`Diagram: ${steps.map((s) => s.join(' or ')).join(', then ')}`}
      sx={{ my: 2.5, p: 2, border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}
    >
      {steps.map((step, i) => (
        <Stack key={i} direction="row" alignItems="center" spacing={1}>
          <Stack spacing={0.75}>
            {step.map((label) => (
              <Box key={label} sx={{ px: 1.5, py: 0.75, borderRadius: 1, border: 1, borderColor: i === 0 ? 'secondary.main' : 'primary.main', bgcolor: 'action.hover' }}>
                <Typography variant="body2" fontWeight={600}>
                  {label}
                </Typography>
              </Box>
            ))}
          </Stack>
          {i < steps.length - 1 && <ArrowForwardIcon fontSize="small" sx={{ color: 'text.secondary' }} aria-hidden />}
        </Stack>
      ))}
    </Box>
  );
}
