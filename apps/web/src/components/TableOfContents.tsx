import { Box, LinearProgress, Link, Typography } from '@mui/material';
import { useEffect, useState } from 'react';

export interface TocItem {
  id: string;
  text: string;
  level?: 2 | 3;
}

/** Highlights the heading currently in view. */
function useActiveHeading(ids: string[]) {
  const [active, setActive] = useState<string | undefined>(ids[0]);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' || ids.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-80px 0px -70% 0px' },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [ids]);
  return active;
}

export function useReadingProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        setProgress(max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0);
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);
  return progress;
}

export function TableOfContents({ items }: { items: TocItem[] }) {
  const active = useActiveHeading(items.map((i) => i.id));
  const progress = useReadingProgress();
  return (
    <Box component="nav" aria-label="Table of contents">
      <Typography variant="overline" color="text.secondary">
        On this page
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <LinearProgress variant="determinate" value={progress} sx={{ flexGrow: 1, height: 4, borderRadius: 2 }} aria-label="Reading progress" />
        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 32 }}>
          {Math.round(progress)}%
        </Typography>
      </Box>
      <Box component="ol" sx={{ listStyle: 'none', p: 0, m: 0 }}>
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={`#${item.id}`}
              underline="none"
              aria-current={active === item.id ? 'location' : undefined}
              sx={{
                display: 'block',
                py: 0.5,
                pl: item.level === 3 ? 2.5 : 1.25,
                fontSize: '0.83rem',
                lineHeight: 1.4,
                borderLeft: 2,
                borderColor: active === item.id ? 'primary.main' : 'divider',
                color: active === item.id ? 'text.primary' : 'text.secondary',
                fontWeight: active === item.id ? 600 : 400,
                '&:hover': { color: 'text.primary' },
              }}
            >
              {item.text}
            </Link>
          </li>
        ))}
      </Box>
    </Box>
  );
}
