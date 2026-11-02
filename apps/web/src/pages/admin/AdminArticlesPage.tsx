import AddIcon from '@mui/icons-material/Add';
import type { ArticleSummary } from '@sda/shared';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
} from '@mui/material';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { EmptyState } from '../../components/common';
import { useAuth } from '../../context/AuthContext';
import { useAsync } from '../../data/hooks';

type AdminArticle = ArticleSummary & { id: string };

export default function AdminArticlesPage() {
  const { authFetch } = useAuth();
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const list = useAsync(() => authFetch<{ data: AdminArticle[] }>(`/admin/articles?limit=100${status ? `&status=${status}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`), [status, q]);
  const [toDelete, setToDelete] = useState<AdminArticle>();
  const [error, setError] = useState<string>();

  const act = async (fn: () => Promise<unknown>) => {
    setError(undefined);
    try {
      await fn();
      list.reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }} alignItems={{ sm: 'center' }}>
        <TextField size="small" label="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        <TextField size="small" select label="Status" value={status} onChange={(e) => setStatus(e.target.value)} sx={{ minWidth: 140 }}>
          <MenuItem value="">All</MenuItem>
          <MenuItem value="draft">Draft</MenuItem>
          <MenuItem value="published">Published</MenuItem>
        </TextField>
        <Box sx={{ flexGrow: 1 }} />
        <Button component={RouterLink} to="/admin/articles/new" variant="contained" startIcon={<AddIcon />}>
          New article
        </Button>
      </Stack>
      {(error || list.error) && <Alert severity="error" sx={{ mb: 2 }}>{error ?? list.error?.message}</Alert>}
      {list.loading && !list.data ? (
        <Skeleton variant="rounded" height={300} />
      ) : list.data?.data.length === 0 ? (
        <EmptyState title="No articles" description="Create your first article, or run the seed script." />
      ) : (
        <Paper sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Updated</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {list.data?.data.map((a) => (
                <TableRow key={a.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{a.title}</TableCell>
                  <TableCell>{a.category}</TableCell>
                  <TableCell>
                    <Chip size="small" label={a.status} color={a.status === 'published' ? 'success' : 'default'} />
                  </TableCell>
                  <TableCell>{a.updatedAt ? new Date(a.updatedAt).toLocaleDateString() : '—'}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    <Button size="small" component={RouterLink} to={`/admin/articles/${a.id}`}>
                      Edit
                    </Button>
                    {a.status === 'published' ? (
                      <Button size="small" onClick={() => act(() => authFetch(`/admin/articles/${a.id}/unpublish`, { method: 'POST' }))}>
                        Unpublish
                      </Button>
                    ) : (
                      <Button size="small" onClick={() => act(() => authFetch(`/admin/articles/${a.id}/publish`, { method: 'POST' }))}>
                        Publish
                      </Button>
                    )}
                    <Button size="small" color="error" onClick={() => setToDelete(a)}>
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
      <Dialog open={!!toDelete} onClose={() => setToDelete(undefined)}>
        <DialogTitle>Delete article?</DialogTitle>
        <DialogContent>
          <DialogContentText>“{toDelete?.title}” will be permanently deleted. This cannot be undone.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setToDelete(undefined)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              const id = toDelete!.id;
              setToDelete(undefined);
              act(() => authFetch(`/admin/articles/${id}`, { method: 'DELETE' }));
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
