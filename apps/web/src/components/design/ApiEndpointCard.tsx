import type { ApiEndpoint } from '@sda/shared';
import { Box, Chip, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { fontMono } from '../../theme/theme';
import { CodeBlock } from '../markdown/CodeBlock';

const METHOD_COLOR = { GET: 'success', POST: 'primary', PUT: 'warning', PATCH: 'warning', DELETE: 'error' } as const;

export function MethodChip({ method }: { method: ApiEndpoint['method'] }) {
  return <Chip size="small" color={METHOD_COLOR[method]} label={method} sx={{ fontFamily: fontMono, minWidth: 64 }} />;
}

const langOf = (s: string) => (s.trimStart().startsWith('{') || s.trimStart().startsWith('[') ? 'json' : 'text');

export function ApiEndpointCard({ endpoint, compact }: { endpoint: ApiEndpoint; compact?: boolean }) {
  return (
    <Paper sx={{ my: 2, overflow: 'hidden' }}>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ px: 2, py: 1.25, bgcolor: 'action.hover', flexWrap: 'wrap' }} useFlexGap>
        <MethodChip method={endpoint.method} />
        <Typography component="code" sx={{ fontFamily: fontMono, fontSize: '0.9rem', fontWeight: 600, wordBreak: 'break-all' }}>
          {endpoint.path}
        </Typography>
      </Stack>
      <Box sx={{ px: 2, py: 1.5 }}>
        <Typography fontWeight={600}>{endpoint.summary}</Typography>
        {endpoint.auth && (
          <Typography variant="body2" color="text.secondary">
            Auth: {endpoint.auth}
          </Typography>
        )}
        {!compact && (
          <>
            {endpoint.request && <CodeBlock code={endpoint.request} language={langOf(endpoint.request)} title="Request body" />}
            {endpoint.response && <CodeBlock code={endpoint.response} language={langOf(endpoint.response)} title="Response" />}
            {endpoint.errors.length > 0 && (
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small" aria-label={`Error responses for ${endpoint.method} ${endpoint.path}`}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Status</TableCell>
                      <TableCell>Error code</TableCell>
                      <TableCell>When</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {endpoint.errors.map((e) => (
                      <TableRow key={e.code}>
                        <TableCell sx={{ fontFamily: fontMono }}>{e.status}</TableCell>
                        <TableCell sx={{ fontFamily: fontMono, fontSize: '0.8rem' }}>{e.code}</TableCell>
                        <TableCell>{e.when}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
          </>
        )}
      </Box>
    </Paper>
  );
}
