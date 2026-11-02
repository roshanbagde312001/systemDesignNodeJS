import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { Alert, Box, Button, Container, Paper, Stack, TextField, Typography } from '@mui/material';
import { useState, type FormEvent } from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { HttpError } from '../../data/api';

export default function AdminLoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await login(email, password);
      navigate((location.state as { from?: string } | null)?.from ?? '/admin', { replace: true });
    } catch (err) {
      if (err instanceof HttpError && err.status === 401) setError('Incorrect email or password.');
      else if (err instanceof HttpError && err.status === 429) setError('Too many attempts. Please wait a few minutes.');
      else setError('Could not reach the API. Is the backend running? (npm run dev:api)');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Container maxWidth="xs" sx={{ py: 10 }}>
      <Helmet>
        <title>Admin login | System Design Academy</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <Paper sx={{ p: 4 }}>
        <Stack alignItems="center" spacing={1} sx={{ mb: 3 }}>
          <LockOutlinedIcon color="primary" />
          <Typography variant="h3" component="h1">
            Admin sign in
          </Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            Content management requires the backend API.
          </Typography>
        </Stack>
        <Box component="form" onSubmit={submit} noValidate>
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField label="Email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required fullWidth />
            <TextField label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required fullWidth />
            <Button type="submit" variant="contained" size="large" disabled={busy || !email || !password}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </Stack>
        </Box>
      </Paper>
    </Container>
  );
}
