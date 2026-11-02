import { glossary } from '../../content/glossary';
import { Box, Link, Tooltip, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';

const bySlug = new Map(glossary.map((t) => [t.slug, t]));

/** A jargon word with a dotted underline; hover/focus shows a plain-English definition. */
export function GlossaryTerm({ slug, children }: { slug: string; children: ReactNode }) {
  const term = bySlug.get(slug);
  if (!term) return <>{children}</>;
  return (
    <Tooltip
      arrow
      enterTouchDelay={0}
      title={
        <Box sx={{ p: 0.5 }}>
          <Typography variant="subtitle2" fontWeight={700}>
            {term.term}
          </Typography>
          <Typography variant="body2">{term.simple}</Typography>
        </Box>
      }
    >
      <Link
        component={RouterLink}
        to={`/glossary#${slug}`}
        underline="none"
        sx={{ color: 'inherit', borderBottom: '1px dashed', borderColor: 'secondary.main', cursor: 'help' }}
      >
        {children}
      </Link>
    </Tooltip>
  );
}
