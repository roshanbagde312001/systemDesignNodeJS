import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import SearchIcon from '@mui/icons-material/Search';
import { glossary } from '../../content/glossary';
import { scoreMatch, type ArticleSummary, type SystemDesignSummary } from '../../shared';
import { Box, Dialog, InputAdornment, List, ListItemButton, ListItemIcon, ListItemText, ListSubheader, TextField, Typography } from '@mui/material';
import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../data/api';

interface Result {
  key: string;
  group: 'System designs' | 'Concepts' | 'Glossary';
  title: string;
  subtitle: string;
  to: string;
}

/** Quick, keyboard-friendly global search (opened with "/" or Ctrl/⌘+K). */
export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [designs, setDesigns] = useState<SystemDesignSummary[]>([]);
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    if (!open) return;
    api.listDesigns().then(setDesigns).catch(() => undefined);
    api.listArticles().then(setArticles).catch(() => undefined);
  }, [open]);

  const results = useMemo<Result[]>(() => {
    if (!q.trim()) return [];
    const ds = designs
      .filter((d) => d.status === 'published')
      .map((d) => ({ d, s: scoreMatch(d, q) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 5)
      .map(({ d }) => ({ key: `d-${d.slug}`, group: 'System designs' as const, title: d.title, subtitle: d.tagline, to: `/system-design/${d.slug}` }));
    const as = articles
      .map((a) => ({ a, s: scoreMatch(a, q) }))
      .filter((x) => x.s > 0)
      .sort((x, y) => y.s - x.s)
      .slice(0, 5)
      .map(({ a }) => ({ key: `a-${a.slug}`, group: 'Concepts' as const, title: a.title, subtitle: a.summary, to: `/concepts/${a.slug}` }));
    const lower = q.toLowerCase();
    const gs = glossary
      .filter((g) => g.term.toLowerCase().includes(lower) || g.simple.toLowerCase().includes(lower))
      .slice(0, 4)
      .map((g) => ({ key: `g-${g.slug}`, group: 'Glossary' as const, title: g.term, subtitle: g.simple, to: `/glossary#${g.slug}` }));
    return [...ds, ...as, ...gs];
  }, [q, designs, articles]);

  useEffect(() => setCursor(0), [q]);

  const go = (to: string) => {
    onClose();
    setQ('');
    navigate(to);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[cursor]) go(results[cursor].to);
      else if (q.trim()) go(`/search?q=${encodeURIComponent(q.trim())}`);
    }
  };

  const icon = { 'System designs': <HubOutlinedIcon />, Concepts: <ArticleOutlinedIcon />, Glossary: <MenuBookOutlinedIcon /> };
  let lastGroup = '';

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ sx: { position: 'fixed', top: { xs: 16, sm: 80 }, m: { xs: 1, sm: 2 } } }} aria-label="Search">
      <TextField
        autoFocus
        fullWidth
        placeholder="Search designs, concepts and terms…  (try “cache” or “kafka”)"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={onKeyDown}
        inputProps={{ 'aria-label': 'Search query', role: 'combobox', 'aria-expanded': results.length > 0, 'aria-controls': 'search-results' }}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>, sx: { borderRadius: 0, '& fieldset': { border: 0 } } }}
        sx={{ borderBottom: 1, borderColor: 'divider' }}
      />
      <Box sx={{ maxHeight: 420, overflowY: 'auto' }}>
        {q.trim() && results.length === 0 && (
          <Typography sx={{ p: 3 }} color="text.secondary">
            No quick matches. Press <b>Enter</b> to open the full search page with filters.
          </Typography>
        )}
        {!q.trim() && (
          <Typography sx={{ p: 3 }} color="text.secondary" variant="body2">
            Tip: press <b>/</b> or <b>Ctrl+K</b> anywhere to search. Use ↑ ↓ and Enter to navigate.
          </Typography>
        )}
        <List id="search-results" role="listbox" dense>
          {results.map((r, i) => {
            const header = r.group !== lastGroup ? <ListSubheader key={`h-${r.group}`}>{r.group}</ListSubheader> : null;
            lastGroup = r.group;
            return [
              header,
              <ListItemButton key={r.key} selected={i === cursor} onClick={() => go(r.to)} role="option" aria-selected={i === cursor}>
                <ListItemIcon sx={{ minWidth: 36 }}>{icon[r.group]}</ListItemIcon>
                <ListItemText primary={r.title} secondary={r.subtitle} secondaryTypographyProps={{ noWrap: true }} />
              </ListItemButton>,
            ];
          })}
        </List>
      </Box>
    </Dialog>
  );
}
