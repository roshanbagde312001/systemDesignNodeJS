import { CONTENT_STATUSES, DIFFICULTIES, systemDesignMetaUpdateSchema, type SystemDesignSummary } from '@sda/shared';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useAsync } from '../../data/hooks';

type AdminDesign = SystemDesignSummary & { id: string };
const list = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

export default function AdminDesignsPage() {
  const { authFetch } = useAuth();
  const designs = useAsync(() => authFetch<{ data: AdminDesign[] }>('/admin/system-designs'), []);
  const [edit, setEdit] = useState<AdminDesign>();
  const [error, setError] = useState<string>();

  const save = async () => {
    if (!edit) return;
    const { id, title, tagline, summary, category, difficulty, readingMinutes, technologies, patterns, tags, status, diagramImageUrl } = edit;
    const parsed = systemDesignMetaUpdateSchema.safeParse({ title, tagline, summary, category, difficulty, readingMinutes, technologies, patterns, tags, status, diagramImageUrl: diagramImageUrl ?? '' });
    if (!parsed.success) return setError(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
    try {
      await authFetch(`/admin/system-designs/${id}`, { method: 'PATCH', body: JSON.stringify(parsed.data) });
      setEdit(undefined);
      setError(undefined);
      designs.reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Edit design metadata here. Long-form sections, diagrams and flows are versioned in the <code>packages/content</code> module and loaded by the seed script.
      </Typography>
      {(error || designs.error) && <Alert severity="error" sx={{ mb: 2 }}>{error ?? designs.error?.message}</Alert>}
      <Paper sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>Difficulty</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Diagram image</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {designs.data?.data.map((d) => (
              <TableRow key={d.id} hover>
                <TableCell sx={{ fontWeight: 600 }}>{d.title}</TableCell>
                <TableCell>{d.difficulty}</TableCell>
                <TableCell>
                  <Chip size="small" label={d.status} color={d.status === 'published' ? 'success' : 'default'} />
                </TableCell>
                <TableCell>{d.diagramImageUrl ? 'Referenced' : '—'}</TableCell>
                <TableCell align="right">
                  <Button size="small" onClick={() => setEdit(d)}>
                    Edit metadata
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={!!edit} onClose={() => setEdit(undefined)} fullWidth maxWidth="md">
        <DialogTitle>Edit “{edit?.title}”</DialogTitle>
        {edit && (
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Title" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
              <TextField label="Tagline" value={edit.tagline} onChange={(e) => setEdit({ ...edit, tagline: e.target.value })} />
              <TextField label="Summary" value={edit.summary} multiline minRows={2} onChange={(e) => setEdit({ ...edit, summary: e.target.value })} />
              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr 1fr' } }}>
                <TextField label="Category slug" value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} />
                <TextField select label="Difficulty" value={edit.difficulty} onChange={(e) => setEdit({ ...edit, difficulty: e.target.value as AdminDesign['difficulty'] })}>
                  {DIFFICULTIES.map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                </TextField>
                <TextField label="Reading minutes" type="number" value={edit.readingMinutes} onChange={(e) => setEdit({ ...edit, readingMinutes: Number(e.target.value) })} />
                <TextField select label="Status" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value as AdminDesign['status'] })}>
                  {CONTENT_STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </TextField>
              </Box>
              <TextField label="Technologies (comma separated)" value={edit.technologies.join(', ')} onChange={(e) => setEdit({ ...edit, technologies: list(e.target.value) })} />
              <TextField label="Patterns (comma separated)" value={edit.patterns.join(', ')} onChange={(e) => setEdit({ ...edit, patterns: list(e.target.value) })} />
              <TextField label="Tags (comma separated)" value={edit.tags.join(', ')} onChange={(e) => setEdit({ ...edit, tags: list(e.target.value) })} />
              <TextField
                label="Architecture diagram image URL (optional)"
                value={edit.diagramImageUrl ?? ''}
                onChange={(e) => setEdit({ ...edit, diagramImageUrl: e.target.value })}
                helperText="Reference an externally hosted static diagram (e.g. an exported PNG/SVG). The interactive diagram is unaffected."
              />
            </Stack>
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={() => setEdit(undefined)}>Cancel</Button>
          <Button variant="contained" onClick={save}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
