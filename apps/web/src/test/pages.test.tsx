import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { __resetApiState } from '../data/api';
import { apiOffline, jsonResponse, renderApp } from './utils';

beforeEach(() => {
  __resetApiState();
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
});
afterEach(() => vi.unstubAllGlobals());

describe('system design page', () => {
  it('renders all 22 sections from bundled content when the API is offline', async () => {
    apiOffline();
    renderApp('/system-design/url-shortener');
    expect(await screen.findByRole('heading', { level: 1, name: 'URL Shortener' })).toBeInTheDocument();
    expect(screen.getByText('The 60-second version')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /Problem statement/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /Summary and related designs/ })).toBeInTheDocument();
    expect(screen.getAllByRole('complementary', { name: 'In plain English' })).toHaveLength(22);
    expect(screen.getByTestId('content-source')).toHaveTextContent('bundled content');
  });

  it('Quick read hides technical detail until requested', async () => {
    apiOffline();
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

  it('shows a not-found page for unknown designs from a healthy API', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => (url.includes('/system-designs/') ? jsonResponse({ error: { code: 'NOT_FOUND', message: 'nope' } }, 404) : jsonResponse({ data: [] }))));
    renderApp('/system-design/does-not-exist');
    expect(await screen.findByText(/couldn’t find that system design/)).toBeInTheDocument();
  });
});

describe('article page', () => {
  it('renders an article with plain-English intro, headings and a table of contents', async () => {
    apiOffline();
    renderApp('/concepts/redis-caching');
    expect(await screen.findByRole('heading', { level: 1, name: /Caching with Redis/ })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'In plain English' })).toHaveTextContent(/sticky note/);
    expect(screen.getByRole('heading', { name: /Pattern 1: Cache-aside/ })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Table of contents' })).toBeInTheDocument();
  });
});

describe('search page', () => {
  it('filters results from the URL query and shows an empty state', async () => {
    apiOffline();
    renderApp('/search?q=kafka');
    await waitFor(() => expect(screen.getByRole('tab', { name: /^All \(/ })).not.toHaveTextContent('All (0)'));
    expect(screen.getByRole('link', { name: /Message Queues and Kafka/ })).toBeInTheDocument();
  });

  it('shows a helpful empty state', async () => {
    apiOffline();
    renderApp('/search?q=zzzz-nothing');
    expect(await screen.findByText(/No results for “zzzz-nothing”/)).toBeInTheDocument();
  });
});

describe('admin area', () => {
  it('redirects to login when there is no session', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: { code: 'NO_REFRESH_TOKEN', message: 'Not signed in' } }, 401)));
    renderApp('/admin');
    expect(await screen.findByRole('heading', { name: 'Admin sign in' })).toBeInTheDocument();
  });

  it('signs in and lists articles with publish controls', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/auth/refresh')) return jsonResponse({ error: { code: 'NO_REFRESH_TOKEN', message: 'x' } }, 401);
      if (url.endsWith('/auth/login')) return jsonResponse({ accessToken: 't', user: { id: '1', email: 'a@b.co', name: 'A', role: 'admin' } });
      if (url.includes('/admin/articles')) return jsonResponse({ data: [{ id: 'a1', slug: 's', title: 'Draft one', status: 'draft', category: 'caching', updatedAt: '2026-10-01' }] });
      return jsonResponse({ data: [] });
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderApp('/admin');
    await screen.findByRole('heading', { name: 'Admin sign in' });
    await user.type(screen.getByLabelText(/Email/), 'a@b.co');
    await user.type(screen.getByLabelText(/Password/), 'password123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Draft one')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument();
    const listCall = fetchMock.mock.calls.find(([u]) => String(u).includes('/admin/articles'));
    expect(listCall?.[1]?.headers).toMatchObject({ Authorization: 'Bearer t' });
  });

  it('shows a clear error for wrong credentials', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => (url.endsWith('/auth/login') ? jsonResponse({ error: { code: 'INVALID_CREDENTIALS', message: 'x' } }, 401) : jsonResponse({ error: { code: 'X', message: 'x' } }, 401))));
    const user = userEvent.setup();
    renderApp('/admin/login');
    await user.type(screen.getByLabelText(/Email/), 'a@b.co');
    await user.type(screen.getByLabelText(/Password/), 'wrongpass1');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Incorrect email or password.')).toBeInTheDocument();
  });
});
