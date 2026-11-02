import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from './utils';

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
});

describe('system design page', () => {
  it('renders all 22 sections from bundled content', async () => {
    renderApp('/system-design/url-shortener');
    expect(await screen.findByRole('heading', { level: 1, name: 'URL Shortener' })).toBeInTheDocument();
    expect(screen.getByText('The 60-second version')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /Problem statement/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /Summary and related designs/ })).toBeInTheDocument();
    expect(screen.getAllByRole('complementary', { name: 'In plain English' })).toHaveLength(22);
  });

  it('Quick read hides technical detail until requested', async () => {
    const user = userEvent.setup();
    renderApp('/system-design/url-shortener');
    await screen.findByRole('heading', { level: 1, name: 'URL Shortener' });
    expect(screen.getByText(/Back-of-the-envelope math/)).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Quick read' })[0]);
    expect(screen.queryByText(/Back-of-the-envelope math/)).not.toBeInTheDocument();

    const capacity = screen.getByRole('region', { name: 'Capacity estimation' });
    await user.click(within(capacity).getByRole('button', { name: 'Show technical details' }));
    expect(screen.getByText(/Back-of-the-envelope math/)).toBeInTheDocument();
  });

  it('shows a not-found page for unknown designs', async () => {
    renderApp('/system-design/does-not-exist');
    expect(await screen.findByText(/couldn’t find that system design/)).toBeInTheDocument();
  });
});

describe('article page', () => {
  it('renders an article with plain-English intro, headings and a table of contents', async () => {
    renderApp('/concepts/redis-caching');
    expect(await screen.findByRole('heading', { level: 1, name: /Caching with Redis/ })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'In plain English' })).toHaveTextContent(/sticky note/);
    expect(screen.getByRole('heading', { name: /Pattern 1: Cache-aside/ })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Table of contents' })).toBeInTheDocument();
  });
});

describe('search page', () => {
  it('filters results from the URL query and shows an empty state', async () => {
    renderApp('/search?q=kafka');
    await waitFor(() => expect(screen.getByRole('tab', { name: /^All \(/ })).not.toHaveTextContent('All (0)'));
    expect(screen.getByRole('link', { name: /Message Queues and Kafka/ })).toBeInTheDocument();
  });

  it('shows a helpful empty state', async () => {
    renderApp('/search?q=zzzz-nothing');
    expect(await screen.findByText(/No results for “zzzz-nothing”/)).toBeInTheDocument();
  });
});
