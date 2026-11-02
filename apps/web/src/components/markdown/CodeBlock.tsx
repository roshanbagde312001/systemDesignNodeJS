import CheckIcon from '@mui/icons-material/Check';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { Box, IconButton, Tooltip, Typography, useTheme } from '@mui/material';
import { Highlight, themes } from 'prism-react-renderer';
import { useState } from 'react';
import { fontMono } from '../../theme/theme';

const LABELS: Record<string, string> = { ts: 'TypeScript', js: 'JavaScript', json: 'JSON', sql: 'SQL', bash: 'Shell', http: 'HTTP', text: 'Text' };

export function CodeBlock({ code, language = 'text', title }: { code: string; language?: string; title?: string }) {
  const theme = useTheme();
  const [copied, setCopied] = useState(false);
  const prismTheme = theme.palette.mode === 'dark' ? themes.nightOwl : themes.github;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard can be unavailable (insecure context) */
    }
  };

  return (
    <Box sx={{ my: 2, border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden', bgcolor: prismTheme.plain.backgroundColor }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1.5, py: 0.25, borderBottom: 1, borderColor: 'divider', bgcolor: 'action.hover' }}>
        <Typography variant="caption" sx={{ fontFamily: fontMono, color: 'text.secondary' }}>
          {title ?? LABELS[language] ?? language}
        </Typography>
        <Tooltip title={copied ? 'Copied' : 'Copy code'}>
          <IconButton size="small" onClick={copy} aria-label="Copy code">
            {copied ? <CheckIcon fontSize="inherit" /> : <ContentCopyIcon fontSize="inherit" />}
          </IconButton>
        </Tooltip>
      </Box>
      <Highlight code={code.replace(/\n$/, '')} language={language} theme={prismTheme}>
        {({ style, tokens, getLineProps, getTokenProps }) => (
          <Box
            component="pre"
            tabIndex={0}
            sx={{ ...style, m: 0, p: 2, overflowX: 'auto', fontFamily: fontMono, fontSize: '0.83rem', lineHeight: 1.65, background: 'transparent' }}
          >
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })}>
                {line.map((token, k) => (
                  <span key={k} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </Box>
        )}
      </Highlight>
    </Box>
  );
}
