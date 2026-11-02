import { playgroundConfigs } from '@sda/content/src/playground';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { simulate } from '../components/playground/simulate';
import { diffEvents, explain, TrafficLab } from '../components/playground/TrafficLab';
import PlaygroundPage from '../pages/PlaygroundPage';
import { renderWithProviders } from './utils';

const cfg = (id: string) => playgroundConfigs.find((c) => c.id === id)!;
const run = (id: string, rps: number, failed: string[] = [], hitRatio?: number) => {
  const c = cfg(id);
  return simulate(c.diagram, c.traffic, { rps, failed: new Set(failed), hitRatio });
};

describe('traffic simulation engine', () => {
  it('every config has a valid traffic model, scenarios and request flows', () => {
    for (const c of playgroundConfigs) {
      const ids = new Set(c.diagram.nodes.map((n) => n.id));
      expect(ids.has(c.traffic.entry)).toBe(true);
      Object.keys(c.traffic.nodes).forEach((id) => expect(ids.has(id), `${c.id}: ${id}`).toBe(true));
      Object.keys(c.traffic.edges ?? {}).forEach((eid) => expect(c.diagram.edges.some((e) => e.id === eid), `${c.id}: ${eid}`).toBe(true));
      expect(c.scenarios.length).toBeGreaterThan(0);
      expect(c.diagram.flows.length).toBeGreaterThan(0);
      for (const f of c.diagram.flows) for (const s of f.steps) expect(ids.has(s.from) && ids.has(s.to), `${c.id}/${f.id}`).toBe(true);
    }
  });

  it('a single server overloads past its capacity', () => {
    const ok = run('single', 400);
    expect(ok.failedRps).toBe(0);
    expect(ok.nodes.api.status).toBe('ok');
    const spike = run('single', 1600);
    expect(spike.nodes.api.status).toBe('overloaded');
    expect(spike.failedRps).toBe(800);
    expect(spike.bottleneck).toBe('api');
    expect(spike.latencyMs).toBeGreaterThan(ok.latencyMs);
  });

  it('a load balancer reroutes traffic around a failed instance', () => {
    const r = run('load-balanced', 1500, ['api2']);
    expect(r.edges['lb->api2'].rps).toBe(0);
    expect(r.nodes.api1.inRps).toBe(750);
    expect(r.nodes.api3.inRps).toBe(750);
    expect(r.failedRps).toBe(0);
  });

  it('the cache hit ratio controls database load, and Redis failure falls back to the database', () => {
    expect(run('redis', 4000, [], 0.9).nodes.db.inRps).toBeCloseTo(400);
    expect(run('redis', 4000, [], 0).nodes.db.status).toBe('overloaded');
    const redisDown = run('redis', 2000, ['redis'], 0.9);
    expect(redisDown.nodes.db.inRps).toBeCloseTo(2000);
    expect(redisDown.failedRps).toBe(0); // fallback works — just slower and heavier on the DB
  });

  it('a queue turns excess work into backlog instead of user errors', () => {
    const r = run('queue', 1000);
    expect(r.failedRps).toBe(0);
    expect(r.backlogRate).toBe(700);
    expect(r.nodes.worker.status).toBe('overloaded');
    expect(run('queue', 300, ['worker']).failedRps).toBe(0);
    expect(run('queue', 300, ['queue']).failedRps).toBeGreaterThan(0); // can't enqueue → users see errors
    expect(run('queue', 100).drainRate).toBe(200);
  });

  it('microservices isolate failures', () => {
    const r = run('microservices', 500, ['payments']);
    expect(r.nodes.users.status).toBe('ok');
    expect(r.failedRps).toBeCloseTo(500 * 0.6 * 0.3);
  });

  it('explains the situation in plain English and generates events', () => {
    const c = cfg('single');
    expect(explain(c, run('single', 1600)).title).toMatch(/Node.js server is the bottleneck/);
    expect(explain(c, run('single', 200, ['db'])).title).toMatch(/MongoDB is down/);
    const events = diffEvents(c, run('single', 200), run('single', 1600));
    expect(events[0]).toMatchObject({ severity: 'error' });
    expect(events[0].text).toMatch(/overloaded/);
  });
});

describe('TrafficLab', () => {
  it('shows live load and reacts to scenarios and failures', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TrafficLab config={cfg('load-balanced')} />);
    expect(screen.getByText('Everything is healthy')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Huge spike' }));
    expect(screen.getByText(/MongoDB replica set is the bottleneck/)).toBeInTheDocument();
    expect(screen.getByText(/What to watch:/)).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Event log' })).getAllByText(/overloaded/).length).toBeGreaterThan(0);
    expect(screen.getByTestId('node-db')).toHaveAttribute('data-state', 'overloaded');

    await user.click(screen.getByRole('button', { name: 'Reset' }));
    const group = screen.getByRole('group', { name: 'Break a component' });
    await user.click(within(group).getByRole('button', { name: /Node.js #2/ }));
    expect(screen.getByTestId('node-api2')).toHaveAttribute('data-state', 'failed');
    expect(screen.getByText(/load balancer stopped sending it traffic/)).toBeInTheDocument();
  });

  it('pauses and resumes the traffic', async () => {
    // (Edges, and so the moving dots, are only laid out in a real browser — jsdom can't measure them.)
    const user = userEvent.setup();
    renderWithProviders(<TrafficLab config={cfg('single')} />);
    await user.click(screen.getByRole('button', { name: 'Pause traffic' }));
    expect(screen.getByRole('button', { name: 'Start traffic' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start traffic' }));
    expect(screen.getByRole('button', { name: 'Pause traffic' })).toBeInTheDocument();
  });

  it('offers a step-by-step "follow one request" mode', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PlaygroundPage />, '/playground');
    await user.click(screen.getByRole('radio', { name: /Load-balanced/ }));
    await user.click(screen.getByRole('button', { name: /Follow one request/ }));
    await user.click(screen.getByRole('button', { name: 'Next step' }));
    expect(screen.getByText('Request reaches the load balancer')).toBeInTheDocument();
  });
});
