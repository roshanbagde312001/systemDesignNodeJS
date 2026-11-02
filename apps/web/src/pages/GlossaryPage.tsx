import SearchIcon from '@mui/icons-material/Search';
import { glossary } from '@sda/content/src/glossary';
import { Box, Container, InputAdornment, Paper, TextField, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { EmptyState, SectionHeader, Seo } from '../components/common';

export default function GlossaryPage() {
  const [q, setQ] = useState('');
  const { hash } = useLocation();
  const terms = useMemo(() => {
    const sorted = [...glossary].sort((a, b) => a.term.localeCompare(b.term));
    const s = q.trim().toLowerCase();
    return s ? sorted.filter((t) => `${t.term} ${t.simple} ${t.detail}`.toLowerCase().includes(s)) : sorted;
  }, [q]);

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [hash]);

  return (
    <Container maxWidth="md" sx={{ py: 5 }}>
      <Seo title="Glossary" path="/glossary" description="Plain-English definitions of system design and backend engineering terms." />
      <SectionHeader eyebrow="Jargon buster" title="Glossary" description="Every technical word on this site, explained in one simple sentence first — then a little more detail." />
      <TextField
        fullWidth
        size="small"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Filter terms…"
        inputProps={{ 'aria-label': 'Filter glossary terms' }}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        sx={{ mb: 3 }}
      />
      {terms.length === 0 && <EmptyState title="No matching terms" />}
      <Box component="dl" sx={{ m: 0, display: 'grid', gap: 1.5 }}>
        {terms.map((t) => (
          <Paper
            key={t.slug}
            id={t.slug}
            sx={{ p: 2, scrollMarginTop: 88, borderColor: hash === `#${t.slug}` ? 'primary.main' : undefined }}
          >
            <Typography component="dt" variant="h5">
              {t.term}
            </Typography>
            <Box component="dd" sx={{ m: 0 }}>
              <Typography sx={{ mt: 0.5 }}>{t.simple}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                {t.detail}
              </Typography>
            </Box>
          </Paper>
        ))}
      </Box>
    </Container>
  );
}
