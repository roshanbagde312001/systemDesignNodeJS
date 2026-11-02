import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { DIFFICULTIES, learningPathInputSchema, type LearningPath, type LearningPathStep } from '@sda/shared';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
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

type AdminPath = LearningPath & { id?: string };
const blankStep = (): LearningPathStep => ({ title: '', kind: 'article', ref: '', note: '' });

export default function AdminPathsPage() {
  const { authFetch } = useAuth();
  const paths = useAsync(() => authFetch<{ data: AdminPath[] }>('/admin/learning-paths'), []);
  const [edit, setEdit] = useState<AdminPath>();
  const [error, setError] = useState<string>();

  const save = async () => {
    if (!edit) return;
    const { id, ...rest } = edit;
    const parsed = learningPathInputSchema.safeParse({ ...rest, status: rest.status === 'published' ? 'published' : 'draft' });
    if (!parsed.success) return setError(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
    try {
      await authFetch(id ? `/admin/learning-paths/${id}` : '/admin/learning-paths', { method: id ? 'PATCH' : 'POST', body: JSON.stringify(parsed.data) });
      setEdit(undefined);
      setError(undefined);
      paths.reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const remove = async (id: string) => {
    try {
      await authFetch(`/admin/learning-paths/${id}`, { method: 'DELETE' });
      paths.reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const setStep = (i: number, patch: Partial<LearningPathStep>) => setEdit((p) => p && { ...p, steps: p.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) });

  return (
    <Box>
      <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setEdit({ slug: '', title: '', description: '', audience: '', difficulty: 'Beginner', status: 'draft', steps: [blankStep()] })}
        >
          New learning path
        </Button>
      </Stack>
      {(error || paths.error) && <Alert severity="error" sx={{ mb: 2 }}>{error ?? paths.error?.message}</Alert>}
      <Paper sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>Steps</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paths.data?.data.map((p) => (
              <TableRow key={p.id} hover>
                <TableCell sx={{ fontWeight: 600 }}>{p.title}</TableCell>
                <TableCell>{p.steps.length}</TableCell>
                <TableCell>
                  <Chip size="small" label={p.status} color={p.status === 'published' ? 'success' : 'default'} />
                </TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                  <Button size="small" onClick={() => setEdit(p)}>
                    Edit
                  </Button>
                  <Button size="small" color="error" onClick={() => p.id && remove(p.id)}>
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={!!edit} onClose={() => setEdit(undefined)} fullWidth maxWidth="md">
        <DialogTitle>{edit?.id ? 'Edit learning path' : 'New learning path'}</DialogTitle>
        {edit && (
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr' } }}>
                <TextField label="Title" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
                <TextField label="Slug" value={edit.slug} onChange={(e) => setEdit({ ...edit, slug: e.target.value })} />
              </Box>
              <TextField label="Description" value={edit.description} multiline minRows={2} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr 1fr' } }}>
                <TextField label="Audience" value={edit.audience} onChange={(e) => setEdit({ ...edit, audience: e.target.value })} />
                <TextField select label="Difficulty" value={edit.difficulty} onChange={(e) => setEdit({ ...edit, difficulty: e.target.value as AdminPath['difficulty'] })}>
                  {DIFFICULTIES.map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                </TextField>
                <TextField select label="Status" value={edit.status === 'published' ? 'published' : 'draft'} onChange={(e) => setEdit({ ...edit, status: e.target.value as AdminPath['status'] })}>
                  <MenuItem value="draft">Draft</MenuItem>
                  <MenuItem value="published">Published</MenuItem>
                </TextField>
              </Box>
              <Typography variant="h5" component="h3">
                Steps
              </Typography>
              {edit.steps.map((s, i) => (
                <Stack key={i} direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }}>
                  <TextField size="small" label={`Step ${i + 1} title`} value={s.title} onChange={(e) => setStep(i, { title: e.target.value })} sx={{ flex: 2 }} />
                  <TextField size="small" select label="Kind" value={s.kind} onChange={(e) => setStep(i, { kind: e.target.value as LearningPathStep['kind'] })} sx={{ minWidth: 120 }}>
                    <MenuItem value="article">Article</MenuItem>
                    <MenuItem value="design">Design</MenuItem>
                    <MenuItem value="playground">Playground</MenuItem>
                  </TextField>
                  <TextField size="small" label="Slug / ref" value={s.ref} onChange={(e) => setStep(i, { ref: e.target.value })} sx={{ flex: 1 }} />
                  <TextField size="small" label="Note" value={s.note} onChange={(e) => setStep(i, { note: e.target.value })} sx={{ flex: 2 }} />
                  <IconButton aria-label={`Remove step ${i + 1}`} onClick={() => setEdit({ ...edit, steps: edit.steps.filter((_, j) => j !== i) })}>
                    <DeleteOutlineIcon />
                  </IconButton>
                </Stack>
              ))}
              <Button startIcon={<AddIcon />} onClick={() => setEdit({ ...edit, steps: [...edit.steps, blankStep()] })} sx={{ alignSelf: 'flex-start' }}>
                Add step
              </Button>
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
