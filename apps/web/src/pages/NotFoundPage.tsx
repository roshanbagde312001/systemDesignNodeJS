import { Button, Container, Stack, Typography } from '@mui/material';
import { Helmet } from 'react-helmet-async';
import { Link as RouterLink } from 'react-router-dom';

export default function NotFoundPage({ what = 'page' }: { what?: string }) {
  return (
    <Container maxWidth="sm" sx={{ py: 12, textAlign: 'center' }}>
      <Helmet>
        <title>Not found | System Design Academy</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <Typography variant="overline" color="text.secondary">
        404
      </Typography>
      <Typography variant="h2" component="h1">
        We couldn’t find that {what}
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 1.5 }}>
        It may have moved, or it hasn’t been written yet.
      </Typography>
      <Stack direction="row" spacing={1.5} justifyContent="center" sx={{ mt: 3 }}>
        <Button component={RouterLink} to="/" variant="contained">
          Go home
        </Button>
        <Button component={RouterLink} to="/search">
          Search
        </Button>
      </Stack>
    </Container>
  );
}
