import { simulatorDiagram } from '../content/playground';
import type { Diagram } from '../shared';
import { Alert, Box, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { useMemo, useState } from 'react';
import { ArchitectureViewer } from './diagram/ArchitectureViewer';

type Scenario = 'hit' | 'miss';

/**
 * Educational request-lifecycle simulation: client → load balancer → Express → service → Redis / MongoDB.
 * Wraps the ArchitectureViewer and adds a cache hit vs miss comparison.
 */
export function RequestSimulator({ diagram = simulatorDiagram, height = 380 }: { diagram?: Diagram; height?: number }) {
  const [scenario, setScenario] = useState<Scenario>('hit');
  const scoped = useMemo<Diagram>(() => ({ ...diagram, flows: diagram.flows.filter((f) => f.id === scenario) }), [diagram, scenario]);
  const hit = diagram.flows.find((f) => f.id === 'hit');
  const miss = diagram.flows.find((f) => f.id === 'miss');
  const touchesDb = (id?: string) => diagram.flows.find((f) => f.id === id)?.steps.some((s) => s.to === 'db') ?? false;

  return (
    <Stack spacing={2}>
      <Alert severity="info" variant="outlined">
        This is an <b>educational simulation</b> with example data. It does not show live production traffic, and the timings are illustrative.
      </Alert>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
        <Typography fontWeight={600}>Choose a scenario:</Typography>
        <ToggleButtonGroup exclusive size="small" color="primary" value={scenario} onChange={(_, v) => v && setScenario(v)} aria-label="Cache scenario">
          <ToggleButton value="hit">Cache hit</ToggleButton>
          <ToggleButton value="miss">Cache miss</ToggleButton>
        </ToggleButtonGroup>
      </Stack>
      <ArchitectureViewer key={scenario} diagram={scoped} height={height} />
      {hit && miss && (
        <Paper sx={{ overflowX: 'auto' }}>
          <Box sx={{ p: 2, pb: 0 }}>
            <Typography variant="h5" component="h3">
              Cache hit vs cache miss
            </Typography>
            <Typography variant="body2" color="text.secondary">
              A <b>hit</b> means the answer was already in fast memory. A <b>miss</b> means we had to go to the database, then remember the answer for next time.
            </Typography>
          </Box>
          <Table size="small" sx={{ mt: 1 }}>
            <TableHead>
              <TableRow>
                <TableCell />
                <TableCell>Cache hit</TableCell>
                <TableCell>Cache miss</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>Steps</TableCell>
                <TableCell>{hit.steps.length}</TableCell>
                <TableCell>{miss.steps.length}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Database queried?</TableCell>
                <TableCell>{touchesDb('hit') ? 'Yes' : 'No'}</TableCell>
                <TableCell>{touchesDb('miss') ? 'Yes' : 'No'}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Illustrative server time</TableCell>
                <TableCell>≈ 3 ms</TableCell>
                <TableCell>≈ 10 ms</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Effect on the database</TableCell>
                <TableCell>None</TableCell>
                <TableCell>One indexed read, plus a cache write</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Paper>
      )}
    </Stack>
  );
}
