import { screen } from '@testing-library/react';
import { expandGlossary, extractHeadings, Markdown } from '../components/markdown/Markdown';
import { parseFlowChain } from '../components/markdown/FlowChain';
import { renderWithProviders } from './utils';

describe('Markdown rendering', () => {
  it('renders headings with anchor ids, code blocks and tables', () => {
    renderWithProviders(<Markdown>{'## Cache aside\n\nText\n\n```ts\nconst a = 1;\n```\n\n| A | B |\n|---|---|\n| 1 | 2 |'}</Markdown>);
    expect(screen.getByRole('heading', { name: 'Cache aside' })).toHaveAttribute('id', 'cache-aside');
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('turns [!TIP] blockquotes into labelled callouts', () => {
    renderWithProviders(<Markdown>{'> [!TIP]\n> Add jitter to TTLs.'}</Markdown>);
    expect(screen.getByRole('complementary', { name: 'Tip' })).toHaveTextContent('Add jitter to TTLs.');
    expect(screen.queryByText(/\[!TIP\]/)).not.toBeInTheDocument();
  });

  it('renders [[glossary]] terms as links to the glossary', () => {
    renderWithProviders(<Markdown>{'Use a [[cache]] and a [[load-balancer|load balancer]].'}</Markdown>);
    expect(screen.getByRole('link', { name: 'cache' })).toHaveAttribute('href', '/glossary#cache');
    expect(screen.getByRole('link', { name: 'load balancer' })).toHaveAttribute('href', '/glossary#load-balancer');
  });

  it('renders ```diagram fences as flow diagrams', () => {
    renderWithProviders(<Markdown>{'```diagram\nClient -> API -> Redis | MongoDB\n```'}</Markdown>);
    expect(screen.getByRole('img', { name: /Client, then API, then Redis or MongoDB/ })).toBeInTheDocument();
  });

  it('never renders raw HTML (XSS protection)', () => {
    const { container } = renderWithProviders(<Markdown>{'Hello <script>alert(1)</script><img src=x onerror="alert(1)">'}</Markdown>);
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });

  it('extracts headings for the table of contents, ignoring code fences', () => {
    expect(extractHeadings('## One\n```\n## not a heading\n```\n### Two')).toEqual([
      { id: 'one', text: 'One', level: 2 },
      { id: 'two', text: 'Two', level: 3 },
    ]);
  });

  it('expands glossary syntax and parses flow chains', () => {
    expect(expandGlossary('[[ttl|TTL]]')).toBe('[TTL](/glossary#ttl)');
    expect(parseFlowChain('A -> B | C -> D')).toEqual([['A'], ['B', 'C'], ['D']]);
  });
});
