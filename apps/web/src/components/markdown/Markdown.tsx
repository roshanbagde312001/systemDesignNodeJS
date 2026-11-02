import { slugify } from '@sda/shared';
import { Box, Link, Typography } from '@mui/material';
import { Children, isValidElement, memo, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import { Link as RouterLink } from 'react-router-dom';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { Callout, type CalloutKind } from '../Callout';
import { CodeBlock } from './CodeBlock';
import { FlowChain } from './FlowChain';
import { GlossaryTerm } from './GlossaryTerm';
import { rehypeCallouts } from './rehypeCallouts';

/** [[slug]] or [[slug|display text]] → a glossary link the renderer turns into a tooltip. */
export function expandGlossary(markdown: string): string {
  return markdown.replace(/\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g, (_m, slug: string, display?: string) => `[${display ?? slug}](/glossary#${slug})`);
}

export function textOf(node: ReactNode): string {
  return Children.toArray(node)
    .map((c) => (typeof c === 'string' || typeof c === 'number' ? String(c) : isValidElement<{ children?: ReactNode }>(c) ? textOf(c.props.children) : ''))
    .join('');
}

/** Extracts "## " and "### " headings for a table of contents (skips fenced code). */
export function extractHeadings(markdown: string): { id: string; text: string; level: 2 | 3 }[] {
  const out: { id: string; text: string; level: 2 | 3 }[] = [];
  let inFence = false;
  for (const line of markdown.split('\n')) {
    if (line.trim().startsWith('```')) inFence = !inFence;
    if (inFence) continue;
    const m = line.match(/^(##|###)\s+(.+)$/);
    if (m) {
      const text = m[2].replace(/[`*_]/g, '').trim();
      out.push({ id: slugify(text), text, level: m[1].length as 2 | 3 });
    }
  }
  return out;
}

const heading = (level: 2 | 3 | 4) =>
  function Heading({ children }: { children?: ReactNode }) {
    const id = slugify(textOf(children));
    return (
      <Typography id={id} variant={`h${level + 1}` as 'h3'} component={`h${level}`} sx={{ mt: level === 2 ? 5 : 3.5, mb: 1.5, scrollMarginTop: 88 }}>
        {children}
      </Typography>
    );
  };

const components: Components = {
  h1: heading(2),
  h2: heading(2),
  h3: heading(3),
  h4: heading(4),
  p: ({ children }) => <Typography sx={{ my: 1.5 }}>{children}</Typography>,
  a: ({ href = '', children }) => {
    if (href.startsWith('/glossary#')) return <GlossaryTerm slug={href.slice('/glossary#'.length)}>{children}</GlossaryTerm>;
    if (href.startsWith('/')) return <Link component={RouterLink} to={href}>{children}</Link>;
    return (
      <Link href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </Link>
    );
  },
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children }) => {
    const lang = /language-(\w+)/.exec(className ?? '')?.[1];
    const text = String(children ?? '');
    if (!lang && !text.includes('\n')) {
      return (
        <Box component="code" sx={{ px: 0.6, py: 0.15, borderRadius: 0.75, bgcolor: 'action.selected', fontSize: '0.86em', wordBreak: 'break-word' }}>
          {children}
        </Box>
      );
    }
    if (lang === 'diagram') return <FlowChain source={text} />;
    return <CodeBlock code={text} language={lang} />;
  },
  blockquote: (props) => {
    const kind = (props as Record<string, unknown>)['data-callout'] as CalloutKind | undefined;
    return <Callout kind={kind ?? 'note'}>{props.children}</Callout>;
  },
  table: ({ children }) => (
    <Box sx={{ overflowX: 'auto', my: 2.5, border: 1, borderColor: 'divider', borderRadius: 1 }} tabIndex={0}>
      <Box
        component="table"
        sx={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '0.9rem',
          '& th, & td': { textAlign: 'left', px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider', verticalAlign: 'top' },
          '& th': { bgcolor: 'action.hover', fontWeight: 650, whiteSpace: 'nowrap' },
          '& tr:last-of-type td': { borderBottom: 0 },
        }}
      >
        {children}
      </Box>
    </Box>
  ),
  ul: ({ children }) => <Box component="ul" sx={{ pl: 3, my: 1.5, '& li': { my: 0.5, lineHeight: 1.7 } }}>{children}</Box>,
  ol: ({ children }) => <Box component="ol" sx={{ pl: 3, my: 1.5, '& li': { my: 0.5, lineHeight: 1.7 } }}>{children}</Box>,
  hr: () => <Box component="hr" sx={{ border: 0, borderTop: 1, borderColor: 'divider', my: 4 }} />,
};

/**
 * Renders trusted or admin-authored Markdown safely: raw HTML is never rendered
 * (react-markdown ignores it) and the HTML tree is sanitized before display.
 */
export const Markdown = memo(function Markdown({ children }: { children: string }) {
  return (
    <Box sx={{ '& > :first-of-type': { mt: 0 } }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize, rehypeCallouts]} components={components}>
        {expandGlossary(children)}
      </ReactMarkdown>
    </Box>
  );
});
