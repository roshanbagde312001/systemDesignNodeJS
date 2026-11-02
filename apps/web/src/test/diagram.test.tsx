import { urlShortener } from '../content/designs/url-shortener';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ArchitectureViewer } from '../components/diagram/ArchitectureViewer';
import { PLAYBACK_INTERVAL_MS } from '../components/diagram/useFlowPlayback';
import { RequestSimulator } from '../components/RequestSimulator';
import { renderWithProviders } from './utils';

const diagram = urlShortener.diagram!;

describe('ArchitectureViewer', () => {
  it('renders every component and labels the design as hypothetical', () => {
    renderWithProviders(<ArchitectureViewer diagram={diagram} />);
    for (const n of diagram.nodes) expect(screen.getByTestId(`node-${n.id}`)).toBeInTheDocument();
    expect(screen.getByText('Hypothetical')).toBeInTheDocument();
    expect(screen.getByRole('figure', { name: 'Diagram legend' })).toBeInTheDocument();
  });

  it('opens a details panel when a component is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ArchitectureViewer diagram={diagram} />);
    await user.click(screen.getByTestId('node-redis'));
    const panel = await screen.findByRole('region', { name: 'Redis Cache details' });
    expect(within(panel).getByText('Serves hot link lookups in under a millisecond.')).toBeInTheDocument();
    expect(within(panel).getByText('What can go wrong')).toBeInTheDocument();
    await user.click(within(panel).getByRole('button', { name: 'Close details' }));
  });

  it('steps forward and backward through a request flow and highlights the active component', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ArchitectureViewer diagram={diagram} />);
    const steps = diagram.flows[0].steps;
    expect(screen.getByRole('button', { name: 'Previous step' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Next step' }));
    expect(screen.getByText(`Step 1 of ${steps.length} · Browser / App → DNS`)).toBeInTheDocument();
    expect(screen.getByTestId(`node-${steps[0].to}`)).toHaveAttribute('data-state', 'active');
    expect(screen.getByTestId(`node-${steps[0].from}`)).toHaveAttribute('data-state', 'source');

    await user.click(screen.getByRole('button', { name: 'Next step' }));
    expect(screen.getByText(steps[1].title)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Previous step' }));
    expect(screen.getByText(steps[0].title)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reset diagram' }));
    expect(screen.getByText(/to follow a request through the system/)).toBeInTheDocument();
  });

  it('plays and pauses automatically', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithProviders(<ArchitectureViewer diagram={diagram} />);
    await user.click(screen.getByRole('button', { name: 'Play' }));
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    await act(async () => {
      vi.advanceTimersByTime(PLAYBACK_INTERVAL_MS);
    });
    expect(screen.getByText(/Step 2 of/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Pause' }));
    await act(async () => {
      vi.advanceTimersByTime(PLAYBACK_INTERVAL_MS * 3);
    });
    expect(screen.getByText(/Step 2 of/)).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('switches between architecture and sequence views', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ArchitectureViewer diagram={diagram} />);
    await user.click(screen.getByRole('button', { name: 'Sequence view' }));
    expect(screen.getByRole('img', { name: /Sequence diagram: Redirect — cache hit/ })).toBeInTheDocument();
    await user.click(screen.getByTestId('seq-step-2'));
    expect(screen.getByText(/Step 3 of/)).toBeInTheDocument();
  });

  it('shows simulated failures', () => {
    renderWithProviders(<ArchitectureViewer diagram={diagram} failedNodeIds={['redis']} />);
    expect(screen.getByTestId('node-redis')).toHaveAttribute('data-state', 'failed');
  });
});

describe('RequestSimulator', () => {
  it('compares cache hit and cache miss flows', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RequestSimulator />);
    expect(screen.getByText('educational simulation')).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /Database queried\? No Yes/ })).toBeInTheDocument();

    // Walk the hit flow to the cache step
    for (let i = 0; i < 4; i++) await user.click(screen.getByRole('button', { name: 'Next step' }));
    expect(screen.getByText('Look in the cache — HIT')).toBeInTheDocument();
    expect(screen.getByTestId('node-db')).toHaveAttribute('data-state', 'dimmed');

    await user.click(screen.getByRole('button', { name: 'Cache miss' }));
    for (let i = 0; i < 5; i++) await user.click(screen.getByRole('button', { name: 'Next step' }));
    expect(screen.getByText('Query MongoDB')).toBeInTheDocument();
    expect(screen.getByTestId('node-db')).toHaveAttribute('data-state', 'active');
  });

  it('shows example requests, responses and logs for a step', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RequestSimulator />);
    for (let i = 0; i < 4; i++) await user.click(screen.getByRole('button', { name: 'Next step' }));
    expect(screen.getByRole('tab', { name: 'Request' })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Logs' }));
    expect(screen.getByText(/"cache":"hit"/)).toBeInTheDocument();
  });
});
