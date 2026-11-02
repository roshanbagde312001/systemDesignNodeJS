import { alpha, createTheme, type PaletteMode } from '@mui/material/styles';

const fontSans = '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const fontMono = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

/** Brand tokens shared by MUI components and React Flow diagrams. */
export const brand = {
  blue: '#3b82f6',
  blueLight: '#2563eb',
  teal: '#14b8a6',
  tealLight: '#0d9488',
  amber: '#f59e0b',
  red: '#ef4444',
  violet: '#8b5cf6',
};

export function buildTheme(mode: PaletteMode) {
  const dark = mode === 'dark';
  const bg = dark ? '#0b1220' : '#f7f9fc';
  const paper = dark ? '#111a2e' : '#ffffff';
  const border = dark ? '#1f2a44' : '#e2e8f0';

  return createTheme({
    palette: {
      mode,
      primary: { main: dark ? brand.blue : brand.blueLight },
      secondary: { main: dark ? brand.teal : brand.tealLight },
      warning: { main: brand.amber },
      error: { main: brand.red },
      background: { default: bg, paper },
      divider: border,
      text: dark ? { primary: '#e6edf7', secondary: '#94a3b8' } : { primary: '#0f172a', secondary: '#475569' },
    },
    shape: { borderRadius: 8 },
    typography: {
      fontFamily: fontSans,
      h1: { fontSize: 'clamp(2rem, 4vw + 1rem, 3.25rem)', fontWeight: 750, letterSpacing: '-0.03em', lineHeight: 1.1 },
      h2: { fontSize: 'clamp(1.5rem, 2vw + 0.8rem, 2rem)', fontWeight: 700, letterSpacing: '-0.02em' },
      h3: { fontSize: '1.35rem', fontWeight: 650, letterSpacing: '-0.01em' },
      h4: { fontSize: '1.15rem', fontWeight: 650 },
      h5: { fontSize: '1rem', fontWeight: 650 },
      h6: { fontSize: '0.9rem', fontWeight: 650 },
      body1: { fontSize: '1rem', lineHeight: 1.7 },
      body2: { fontSize: '0.9rem', lineHeight: 1.6 },
      button: { textTransform: 'none', fontWeight: 600 },
      overline: { fontWeight: 700, letterSpacing: '0.08em' },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: { backgroundColor: bg },
          '::selection': { background: alpha(brand.blue, 0.35) },
          // Visible keyboard focus everywhere
          ':focus-visible': { outline: `2px solid ${brand.blue}`, outlineOffset: 2 },
          code: { fontFamily: fontMono },
          'html': { scrollPaddingTop: 80 },
        },
      },
      MuiPaper: { defaultProps: { elevation: 0 }, styleOverrides: { root: { backgroundImage: 'none', border: `1px solid ${border}` } } },
      MuiAppBar: { styleOverrides: { root: { border: 'none', borderBottom: `1px solid ${border}` } } },
      MuiCard: { defaultProps: { elevation: 0 }, styleOverrides: { root: { border: `1px solid ${border}` } } },
      MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: { root: { borderRadius: 6 } } },
      MuiChip: { styleOverrides: { root: { fontWeight: 600, borderRadius: 6 } } },
      MuiTooltip: { styleOverrides: { tooltip: { fontSize: '0.85rem', maxWidth: 320, lineHeight: 1.5 } } },
      MuiDrawer: { styleOverrides: { paper: { border: 'none' } } },
      MuiLink: { defaultProps: { underline: 'hover' } },
    },
  });
}
