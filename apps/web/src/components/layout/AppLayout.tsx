import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import MenuIcon from '@mui/icons-material/Menu';
import SearchIcon from '@mui/icons-material/Search';
import {
  AppBar,
  Box,
  Button,
  Container,
  Divider,
  Drawer,
  IconButton,
  Link,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Suspense, useEffect, useState } from 'react';
import { Link as RouterLink, NavLink, Outlet, useLocation } from 'react-router-dom';
import { usePreferences } from '../../context/PreferencesContext';
import { useContentSource } from '../../data/hooks';
import { PageLoading } from '../common';
import { SearchDialog } from './SearchDialog';

export const NAV_ITEMS = [
  { label: 'Home', to: '/' },
  { label: 'System Designs', to: '/system-designs' },
  { label: 'Backend Concepts', to: '/concepts' },
  { label: 'Architecture Patterns', to: '/patterns' },
  { label: 'Playground', to: '/playground' },
  { label: 'Learning Paths', to: '/learning-paths' },
  { label: 'About', to: '/about' },
];

const env = import.meta.env;
const SOCIAL_LINKS = [
  { label: 'GitHub', href: env.VITE_GITHUB_URL as string | undefined },
  { label: 'LinkedIn', href: env.VITE_LINKEDIN_URL as string | undefined },
  { label: 'Contact', href: env.VITE_CONTACT_EMAIL ? `mailto:${env.VITE_CONTACT_EMAIL}` : undefined },
].filter((l): l is { label: string; href: string } => !!l.href);

function Logo() {
  return (
    <Stack component={RouterLink} to="/" direction="row" alignItems="center" spacing={1} sx={{ textDecoration: 'none', color: 'text.primary', mr: 2 }} aria-label="System Design Academy home">
      <Box component="img" src="/favicon.svg" alt="" sx={{ width: 28, height: 28 }} />
      <Typography sx={{ fontWeight: 750, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
        System Design <Box component="span" sx={{ color: 'primary.main' }}>Academy</Box>
      </Typography>
    </Stack>
  );
}

export function AppLayout() {
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('lg'));
  const { colorMode, toggleColorMode } = usePreferences();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setMenuOpen(false), [location.pathname]);
  useEffect(() => {
    if (!location.hash) window.scrollTo(0, 0);
  }, [location.pathname, location.hash]);

  // Global shortcuts: "/" and Ctrl/⌘+K open search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Link href="#main" sx={{ position: 'absolute', left: -9999, '&:focus': { left: 16, top: 12, zIndex: 2000, bgcolor: 'background.paper', p: 1 } }}>
        Skip to content
      </Link>
      <AppBar position="sticky" color="inherit" sx={{ bgcolor: 'background.default', backdropFilter: 'blur(8px)' }}>
        <Toolbar sx={{ gap: 1, minHeight: { xs: 60 } }}>
          {!desktop && (
            <IconButton edge="start" onClick={() => setMenuOpen(true)} aria-label="Open navigation menu">
              <MenuIcon />
            </IconButton>
          )}
          <Logo />
          {desktop && (
            <Box component="nav" aria-label="Main" sx={{ display: 'flex', gap: 0.25, flexGrow: 1 }}>
              {NAV_ITEMS.map((item) => (
                <Button
                  key={item.to}
                  component={NavLink}
                  to={item.to}
                  end={item.to === '/'}
                  size="small"
                  sx={{ color: 'text.secondary', px: 1.25, whiteSpace: 'nowrap', '&.active': { color: 'text.primary', bgcolor: 'action.selected' } }}
                >
                  {item.label}
                </Button>
              ))}
            </Box>
          )}
          <Box sx={{ flexGrow: desktop ? 0 : 1 }} />
          <Button
            onClick={() => setSearchOpen(true)}
            variant="outlined"
            color="inherit"
            startIcon={<SearchIcon />}
            sx={{ borderColor: 'divider', color: 'text.secondary', minWidth: 0, px: { xs: 1, sm: 1.5 }, '& .MuiButton-startIcon': { mr: { xs: 0, sm: 1 } } }}
            aria-label="Search"
          >
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
              Search
            </Box>
            <Box component="kbd" sx={{ display: { xs: 'none', md: 'inline' }, ml: 1.5, px: 0.75, fontSize: 11, border: 1, borderColor: 'divider', borderRadius: 0.5 }}>
              /
            </Box>
          </Button>
          <Tooltip title={colorMode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>
            <IconButton onClick={toggleColorMode} aria-label="Toggle color theme">
              {colorMode === 'dark' ? <LightModeOutlinedIcon /> : <DarkModeOutlinedIcon />}
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} PaperProps={{ sx: { width: 280 } }}>
        <Box sx={{ p: 2 }}>
          <Logo />
        </Box>
        <Divider />
        <List component="nav" aria-label="Main">
          {NAV_ITEMS.map((item) => (
            <ListItemButton key={item.to} component={NavLink} to={item.to} end={item.to === '/'} sx={{ '&.active': { bgcolor: 'action.selected', borderLeft: 3, borderColor: 'primary.main' } }}>
              <ListItemText primary={item.label} />
            </ListItemButton>
          ))}
          <ListItemButton component={NavLink} to="/glossary">
            <ListItemText primary="Glossary" />
          </ListItemButton>
        </List>
      </Drawer>

      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />

      <Box component="main" id="main" tabIndex={-1} sx={{ flexGrow: 1, outline: 'none' }}>
        <Suspense fallback={<Container maxWidth="lg"><PageLoading /></Container>}>
          <Outlet />
        </Suspense>
      </Box>

      <Footer />
    </Box>
  );
}

function Footer() {
  const source = useContentSource();
  const links = [
    { label: 'About', to: '/about' },
    { label: 'Glossary', to: '/glossary' },
    { label: 'Search', to: '/search' },
  ];
  return (
    <Box component="footer" sx={{ borderTop: 1, borderColor: 'divider', mt: 8, py: 5 }}>
      <Container maxWidth="lg">
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={3}>
          <Box sx={{ maxWidth: 380 }}>
            <Logo />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              Learn how real systems are built — explained simply first, then in depth. Architectures shown are hypothetical, educational designs.
            </Typography>
          </Box>
          <Stack direction="row" spacing={6}>
            <Stack spacing={1}>
              <Typography variant="overline" color="text.secondary">
                Learn
              </Typography>
              {NAV_ITEMS.slice(1, 6).map((l) => (
                <Link key={l.to} component={RouterLink} to={l.to} color="text.primary" variant="body2">
                  {l.label}
                </Link>
              ))}
            </Stack>
            <Stack spacing={1}>
              <Typography variant="overline" color="text.secondary">
                Project
              </Typography>
              {links.map((l) => (
                <Link key={l.to} component={RouterLink} to={l.to} color="text.primary" variant="body2">
                  {l.label}
                </Link>
              ))}
              {/* Social links render only when configured in .env, so there are never dead links. */}
              {SOCIAL_LINKS.map((l) => (
                <Link key={l.label} href={l.href} target={l.href.startsWith('mailto:') ? undefined : '_blank'} rel="noopener noreferrer" color="text.primary" variant="body2">
                  {l.label}
                </Link>
              ))}
            </Stack>
          </Stack>
        </Stack>
        <Divider sx={{ my: 3 }} />
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
          <Typography variant="caption" color="text.secondary">
            © {new Date().getFullYear()} System Design Academy
          </Typography>
          <Typography variant="caption" color="text.secondary" data-testid="content-source">
            Content source: {source === 'api' ? 'live API' : source === 'bundled' ? 'bundled content (API offline)' : '…'}
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}
