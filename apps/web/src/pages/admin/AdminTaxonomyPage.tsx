import type { Category, Tag } from '@sda/shared';
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
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useAsync } from '../../data/hooks';

type WithId<T> = T & { id: string };
const DIFFICULTY_NOTE = 'Difficulty levels are fixed (Beginner, Intermediate, Advanced) and validated by both the frontend and API schemas.';

export default function AdminTaxonomyPage() {
  const { authFetch } = useAuth();
  const cats = useAsync(() => authFetch<{ data: WithId<Category>[] }>('/admin/categories'), []);
  const tags = useAsync(() => authFetch<{ data: WithId<Tag>[] }>('/admin/tags'), []);
  const [editCat, setEditCat] = useState<Partial<WithId<Category>>>();
  const [newTag, setNewTag] = useState('');
  const [error, setError] = useState<string>();

  const run = async (fn: () => Promise<unknown>, reload: () => void) => {
    setError(undefined);
    try {
      await fn();
      reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const saveCat = () => {
    const { id, ...body } = editCat!;
    setEditCat(undefined);
    run(() => authFetch(id ? `/admin/categories/${id}` : '/admin/categories', { method: id ? 'PATCH' : 'POST', body: JSON.stringify(body) }), cats.reload);
  };

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: '3fr 2fr' } }}>
        <Paper sx={{ p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h4" component="h2">
              Categories
            </Typography>
            <Button variant="contained" size="small" onClick={() => setEditCat({ kind: 'concept', slug: '', name: '', description: '' })}>
              Add category
            </Button>
          </Stack>
          <List dense>
            {cats.data?.data.map((c) => (
              <ListItem
                key={c.id}
                divider
                secondaryAction={
                  <>
                    <IconButton aria-label={`Edit ${c.name}`} onClick={() => setEditCat(c)}>
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                    <IconButton aria-label={`Delete ${c.name}`} onClick={() => run(() => authFetch(`/admin/categories/${c.id}`, { method: 'DELETE' }), cats.reload)}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </>
                }
              >
                <ListItemText primary={<>{c.name} <Chip size="small" label={c.kind} sx={{ ml: 1 }} /></>} secondary={c.description} />
              </ListItem>
            ))}
          </List>
        </Paper>
        <Stack spacing={3}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h4" component="h2">
              Tags
            </Typography>
            <Stack direction="row" spacing={1} sx={{ my: 1.5 }}>
              <TextField size="small" label="New tag" value={newTag} onChange={(e) => setNewTag(e.target.value.toLowerCase())} />
              <Button
                variant="outlined"
                disabled={!newTag.trim()}
                onClick={() => {
                  const slug = newTag.trim().replace(/\s+/g, '-');
                  setNewTag('');
                  run(() => authFetch('/admin/tags', { method: 'POST', body: JSON.stringify({ slug, name: slug }) }), tags.reload);
                }}
              >
                Add
              </Button>
            </Stack>
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {tags.data?.data.map((t) => (
                <Chip key={t.id} label={t.name} onDelete={() => run(() => authFetch(`/admin/tags/${t.id}`, { method: 'DELETE' }), tags.reload)} />
              ))}
            </Stack>
          </Paper>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h4" component="h2">
              Difficulty levels
            </Typography>
            <Stack direction="row" spacing={1} sx={{ my: 1.5 }}>
              {['Beginner', 'Intermediate', 'Advanced'].map((d) => (
                <Chip key={d} label={d} variant="outlined" />
              ))}
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {DIFFICULTY_NOTE}
            </Typography>
          </Paper>
        </Stack>
      </Box>

      <Dialog open={!!editCat} onClose={() => setEditCat(undefined)} fullWidth maxWidth="sm">
        <DialogTitle>{editCat?.id ? 'Edit category' : 'New category'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Name" value={editCat?.name ?? ''} onChange={(e) => setEditCat((c) => ({ ...c, name: e.target.value }))} />
            <TextField label="Slug" value={editCat?.slug ?? ''} onChange={(e) => setEditCat((c) => ({ ...c, slug: e.target.value }))} helperText="lowercase-with-hyphens" />
            <TextField label="Description" value={editCat?.description ?? ''} onChange={(e) => setEditCat((c) => ({ ...c, description: e.target.value }))} multiline minRows={2} />
            <TextField select label="Kind" value={editCat?.kind ?? 'concept'} onChange={(e) => setEditCat((c) => ({ ...c, kind: e.target.value as Category['kind'] }))}>
              <MenuItem value="concept">Backend concept</MenuItem>
              <MenuItem value="design">System design</MenuItem>
              <MenuItem value="pattern">Architecture pattern</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditCat(undefined)}>Cancel</Button>
          <Button variant="contained" onClick={saveCat}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
