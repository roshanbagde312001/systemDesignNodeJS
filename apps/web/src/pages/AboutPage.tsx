import { Box, Container, Link, Paper, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { SectionHeader, Seo } from '../components/common';

const PRINCIPLES = [
  { title: 'Simple first, deep second', body: 'Every page starts with an everyday analogy and plain-English summaries. Switch to Deep dive only when you are ready for the details.' },
  { title: 'Explain the why', body: 'We explain why each component exists and what it costs, not just which technology is used.' },
  { title: 'Interactive, not static', body: 'Diagrams are clickable and requests can be replayed step by step, so you can see how data moves.' },
  { title: 'Honest about uncertainty', body: 'Designs are hypothetical and labelled as such. Estimates are marked as assumptions. Simulations are educational, not measurements.' },
];

export default function AboutPage() {
  return (
    <Container maxWidth="md" sx={{ py: 5 }}>
      <Seo title="About" path="/about" description="Why System Design Academy exists and how it teaches system design to beginners and intermediate developers." />
      <SectionHeader eyebrow="About" title="Learn how real systems are built — without drowning in jargon" />
      <Typography sx={{ fontSize: '1.08rem' }}>
        System Design Academy is an interactive knowledge platform for junior and intermediate backend developers, and for anyone curious about how apps like chat, video and online stores work behind the scenes. It is built to be understood quickly by someone with no background, and still be useful when preparing for system design interviews.
      </Typography>
      <Box sx={{ mt: 4, display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        {PRINCIPLES.map((p) => (
          <Paper key={p.title} sx={{ p: 2.5 }}>
            <Typography variant="h5" component="h2">
              {p.title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {p.body}
            </Typography>
          </Paper>
        ))}
      </Box>
      <Typography variant="h3" component="h2" sx={{ mt: 6, mb: 1.5 }}>
        How to use this site
      </Typography>
      <Box component="ol" sx={{ pl: 3, '& li': { mb: 1 } }}>
        <li>
          Brand new? Follow <Link component={RouterLink} to="/learning-paths/start-from-zero">Start from zero</Link>.
        </li>
        <li>Open a system design in <b>Quick read</b> mode and play the request flow on the diagram.</li>
        <li>Switch to <b>Deep dive</b> for APIs, schemas, code and trade-offs.</li>
        <li>
          Hover underlined words, or open the <Link component={RouterLink} to="/glossary">glossary</Link>.
        </li>
        <li>
          Break things on purpose in the <Link component={RouterLink} to="/playground">playground</Link>.
        </li>
      </Box>
      <Typography variant="h3" component="h2" sx={{ mt: 6, mb: 1.5 }}>
        Built with
      </Typography>
      <Typography color="text.secondary">
        React, TypeScript, Vite, Material UI, React Flow and React Router on the frontend; Node.js, Express, MongoDB/Mongoose and Zod on the backend; Docker, Nginx and GitHub Actions for delivery.
      </Typography>
    </Container>
  );
}
