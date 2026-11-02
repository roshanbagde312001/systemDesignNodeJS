import SearchIcon from '@mui/icons-material/Search';
import { DIFFICULTIES, type Category, type Difficulty, type SearchFilters, type Searchable } from '@sda/shared';
import { Button, FormControl, InputAdornment, InputLabel, MenuItem, Select, Stack, TextField } from '@mui/material';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

const SORTS = [
  { value: 'newest', label: 'Newest' },
  { value: 'popular', label: 'Most popular' },
  { value: 'reading-time', label: 'Shortest read' },
] as const;

/** Filters stored in the URL so results are shareable and survive refresh. */
export function useFilterParams(): [SearchFilters, (patch: Partial<SearchFilters>) => void, () => void] {
  const [params, setParams] = useSearchParams();
  const filters: SearchFilters = {
    q: params.get('q') ?? undefined,
    category: params.get('category') ?? undefined,
    difficulty: (DIFFICULTIES as readonly string[]).includes(params.get('difficulty') ?? '') ? (params.get('difficulty') as Difficulty) : undefined,
    technology: params.get('technology') ?? undefined,
    pattern: params.get('pattern') ?? undefined,
    sort: (params.get('sort') as SearchFilters['sort']) ?? 'newest',
  };
  const update = (patch: Partial<SearchFilters>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, String(v));
      else next.delete(k);
    }
    setParams(next, { replace: true });
  };
  const clear = () => setParams(new URLSearchParams(), { replace: true });
  return [filters, update, clear];
}

function Picker({ label, value, options, onChange }: { label: string; value?: string; options: { value: string; label: string }[]; onChange: (v?: string) => void }) {
  const id = `filter-${label.toLowerCase().replace(/\s/g, '-')}`;
  return (
    <FormControl size="small" sx={{ minWidth: 150 }}>
      <InputLabel id={id}>{label}</InputLabel>
      <Select labelId={id} label={label} value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
        <MenuItem value="">
          <em>Any</em>
        </MenuItem>
        {options.map((o) => (
          <MenuItem key={o.value} value={o.value}>
            {o.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

export function FilterBar({ items, categories, filters, onChange, onClear }: { items: Searchable[]; categories: Category[]; filters: SearchFilters; onChange: (p: Partial<SearchFilters>) => void; onClear: () => void }) {
  const { technologies, patterns, usedCategories } = useMemo(() => {
    const t = new Set<string>();
    const p = new Set<string>();
    const c = new Set<string>();
    items.forEach((i) => {
      i.technologies.forEach((x) => t.add(x));
      i.patterns.forEach((x) => p.add(x));
      c.add(i.category);
    });
    return { technologies: [...t].sort(), patterns: [...p].sort(), usedCategories: c };
  }, [items]);

  const active = !!(filters.q || filters.category || filters.difficulty || filters.technology || filters.pattern);

  return (
    <Stack spacing={1.5} sx={{ mb: 3 }}>
      <TextField
        size="small"
        value={filters.q ?? ''}
        onChange={(e) => onChange({ q: e.target.value })}
        placeholder="Search by title, technology or pattern…"
        inputProps={{ 'aria-label': 'Filter by keyword' }}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        sx={{ maxWidth: 520 }}
      />
      <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
        <Picker label="Category" value={filters.category} onChange={(v) => onChange({ category: v })} options={categories.filter((c) => usedCategories.has(c.slug)).map((c) => ({ value: c.slug, label: c.name }))} />
        <Picker label="Difficulty" value={filters.difficulty} onChange={(v) => onChange({ difficulty: v as Difficulty | undefined })} options={DIFFICULTIES.map((d) => ({ value: d, label: d }))} />
        <Picker label="Technology" value={filters.technology} onChange={(v) => onChange({ technology: v })} options={technologies.map((t) => ({ value: t, label: t }))} />
        <Picker label="Pattern" value={filters.pattern} onChange={(v) => onChange({ pattern: v })} options={patterns.map((t) => ({ value: t, label: t }))} />
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel id="filter-sort">Sort by</InputLabel>
          <Select labelId="filter-sort" label="Sort by" value={filters.sort ?? 'newest'} onChange={(e) => onChange({ sort: e.target.value as SearchFilters['sort'] })}>
            {SORTS.map((s) => (
              <MenuItem key={s.value} value={s.value}>
                {s.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {active && (
          <Button onClick={onClear} size="small">
            Clear filters
          </Button>
        )}
      </Stack>
    </Stack>
  );
}
