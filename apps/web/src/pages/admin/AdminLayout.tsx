import { Box, Button, Container, Stack, Tab, Tabs, Typography } from '@mui/material';
import { Helmet } from 'react-helmet-async';
import { Link as RouterLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const TABS = [
  { label: 'Articles', to: '/admin' },
  { label: 'Categories & tags', to: '/admin/taxonomy' },
  { label: 'System designs', to: '/admin/designs' },
  { label: 'Learning paths', to: '/admin/learning-paths' },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const current = TABS.slice().reverse().find((t) => location.pathname.startsWith(t.to))?.to ?? '/admin';

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Helmet>
        <title>Admin | System Design Academy</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1}>
        <Box>
          <Typography variant="h2" component="h1">
            Content admin
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Signed in as {user?.email} ({user?.role})
          </Typography>
        </Box>
        <Button
          onClick={async () => {
            await logout();
            navigate('/admin/login');
          }}
        >
          Sign out
        </Button>
      </Stack>
      <Tabs value={current} variant="scrollable" allowScrollButtonsMobile sx={{ my: 3, borderBottom: 1, borderColor: 'divider' }}>
        {TABS.map((t) => (
          <Tab key={t.to} value={t.to} label={t.label} component={RouterLink} to={t.to} />
        ))}
      </Tabs>
      <Outlet />
    </Container>
  );
}
