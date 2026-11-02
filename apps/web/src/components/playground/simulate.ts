import type { TrafficModel } from '@sda/content/src/playground';
import type { Diagram, DiagramEdge } from '@sda/shared';

/*
 * Educational traffic model. It is deliberately simple so beginners can reason about it:
 *  - requests enter at the client and flow along edges (each edge carries a fraction of the traffic)
 *  - a component can handle up to `capacity` requests/s; anything above that is dropped (errors)
 *  - load balancers split traffic evenly across HEALTHY targets (failover)
 *  - queues accept everything; if workers are slower, the difference becomes a growing backlog
 *  - response time grows sharply as a component approaches 100% busy (queueing)
 * The numbers are illustrative, not measurements.
 */

export type NodeStatus = 'idle' | 'ok' | 'busy' | 'overloaded' | 'failed';
export type EdgeStatus = 'idle' | 'ok' | 'busy' | 'error';

export interface NodeMetrics {
  inRps: number;
  servedRps: number;
  droppedRps: number;
  capacity: number;
  /** in / capacity (Infinity when the component has failed but still receives traffic). */
  utilization: number;
  status: NodeStatus;
  /** Effective time spent in this component, including queueing delay. */
  latencyMs: number;
  /** Excess work stored for later instead of failing (workers behind a queue). */
  backlogRate: number;
  /** Whether a failure here fails the user's request. */
  userFacing: boolean;
}

export interface EdgeMetrics {
  rps: number;
  status: EdgeStatus;
}

export interface SimResult {
  nodes: Record<string, NodeMetrics>;
  edges: Record<string, EdgeMetrics>;
  incomingRps: number;
  servedRps: number;
  failedRps: number;
  errorRate: number;
  latencyMs: number;
  /** Busiest healthy component. */
  bottleneck?: string;
  backlogRate: number;
  /** Spare worker capacity that can work through an existing backlog (jobs/s). */
  drainRate: number;
}

export interface SimInput {
  rps: number;
  failed: ReadonlySet<string>;
  hitRatio?: number;
}

/** How much slower a component gets as it fills up (simple queueing intuition). */
export function slowdown(utilization: number) {
  if (utilization <= 0.7) return 1;
  if (utilization < 1) return 1 + ((utilization - 0.7) / 0.3) * 3; // up to 4×
  return 6; // overloaded: requests wait in line / time out
}

function topoOrder(ids: string[], edges: DiagramEdge[]) {
  const indeg = new Map(ids.map((id) => [id, 0]));
  edges.forEach((e) => indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1));
  const queue = ids.filter((id) => indeg.get(id) === 0);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const e of edges) {
      if (e.source !== id) continue;
      indeg.set(e.target, indeg.get(e.target)! - 1);
      if (indeg.get(e.target) === 0) queue.push(e.target);
    }
  }
  return order;
}

export function simulate(diagram: Diagram, model: TrafficModel, input: SimInput): SimResult {
  const { failed } = input;
  const hit = Math.min(1, Math.max(0, input.hitRatio ?? model.hitRatio ?? 0));
  const ids = diagram.nodes.map((n) => n.id);
  const edges = diagram.edges;
  const spec = (id: string) => model.nodes[id] ?? { capacity: Infinity, latencyMs: 0 };
  const espec = (e: DiagramEdge) => model.edges?.[e.id] ?? {};
  const out = (id: string) => edges.filter((e) => e.source === id);

  // Which edges carry the user's request synchronously (their failure = user-facing error)?
  const blocking = (e: DiagramEdge) => !espec(e).optional && (!e.async || !!espec(e).required);
  const userFacing = new Set<string>([model.entry]);
  const stack = [model.entry];
  while (stack.length) {
    const id = stack.pop()!;
    for (const e of out(id)) if (blocking(e) && !userFacing.has(e.target)) userFacing.add(e.target), stack.push(e.target);
  }

  const inflow: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]));
  inflow[model.entry] = Math.max(0, input.rps);
  const nodes: Record<string, NodeMetrics> = {};
  const edgeRps: Record<string, number> = {};
  let backlogRate = 0;
  let drainRate = 0;

  for (const id of topoOrder(ids, edges)) {
    const s = spec(id);
    const isFailed = failed.has(id);
    const inRps = inflow[id];
    const capacity = isFailed ? 0 : s.capacity;
    const fedByBuffer = edges.some((e) => e.target === id && spec(e.source).buffer);

    let served: number;
    if (id === model.entry) served = inRps;
    else if (s.buffer) served = isFailed ? 0 : inRps;
    else served = Math.min(inRps, capacity);
    let dropped = inRps - served;
    let backlog = 0;
    if (fedByBuffer && !s.buffer) {
      // Work the worker can't do yet waits in the queue instead of failing.
      backlog = dropped;
      dropped = 0;
      backlogRate += backlog;
    }
    if (fedByBuffer && !s.buffer && !isFailed) drainRate += Math.max(0, capacity - inRps);

    // Route served traffic onwards.
    const outs = out(id);
    if (s.balance) {
      const healthy = outs.filter((e) => !failed.has(e.target));
      outs.forEach((e) => (edgeRps[e.id] = healthy.includes(e) ? served / healthy.length : 0));
      if (healthy.length === 0 && outs.length > 0) dropped += served; // nowhere to send it
    } else {
      for (const e of outs) {
        const es = espec(e);
        let ratio = es.ratio === 'miss' ? 1 - hit : es.ratio ?? 1;
        if (es.whenFailed && failed.has(es.whenFailed.node)) ratio = es.whenFailed.ratio;
        edgeRps[e.id] = served * ratio;
      }
    }
    outs.forEach((e) => (inflow[e.target] += edgeRps[e.id]));

    const utilization = id === model.entry || s.buffer ? 0 : capacity === 0 ? (inRps > 0 ? Infinity : 0) : inRps / capacity;
    let status: NodeStatus = isFailed ? 'failed' : inRps <= 0 ? 'idle' : utilization > 1 ? 'overloaded' : utilization > 0.8 ? 'busy' : 'ok';
    if (backlog > 0 && !isFailed) status = 'overloaded';
    nodes[id] = {
      inRps,
      servedRps: served,
      droppedRps: dropped,
      capacity,
      utilization,
      status,
      latencyMs: isFailed ? 0 : s.latencyMs * slowdown(utilization),
      backlogRate: backlog,
      userFacing: userFacing.has(id),
    };
  }

  // Queues show as busy while work is piling up behind them.
  for (const id of ids) {
    if (spec(id).buffer && nodes[id].status === 'ok' && out(id).some((e) => nodes[e.target].backlogRate > 0)) nodes[id].status = 'busy';
  }

  const edgeMetrics: Record<string, EdgeMetrics> = {};
  for (const e of edges) {
    const rps = edgeRps[e.id] ?? 0;
    const t = nodes[e.target];
    const status: EdgeStatus = rps <= 0 ? 'idle' : t.status === 'failed' || (t.status === 'overloaded' && t.droppedRps > 0) ? 'error' : t.status === 'busy' || t.status === 'overloaded' ? 'busy' : 'ok';
    edgeMetrics[e.id] = { rps, status };
  }

  const incomingRps = Math.max(0, input.rps);
  const dropped = ids.filter((id) => nodes[id].userFacing).reduce((sum, id) => sum + nodes[id].droppedRps, 0);
  const failedRps = Math.min(incomingRps, dropped);

  // Expected response time: walk the synchronous path, weighting by how much traffic takes each branch.
  const memo = new Map<string, number>();
  const latencyFrom = (id: string): number => {
    if (memo.has(id)) return memo.get(id)!;
    const s = spec(id);
    const sync = out(id).filter((e) => (!e.async || espec(e).required) && !failed.has(e.target));
    let downstream = 0;
    if (s.balance) downstream = sync.length ? sync.reduce((sum, e) => sum + latencyFrom(e.target), 0) / sync.length : 0;
    else if (nodes[id].servedRps > 0) downstream = sync.reduce((sum, e) => sum + (edgeRps[e.id] / nodes[id].servedRps) * latencyFrom(e.target), 0);
    const total = nodes[id].latencyMs + downstream;
    memo.set(id, total);
    return total;
  };

  const candidates = ids.filter((id) => id !== model.entry && !spec(id).buffer && nodes[id].status !== 'failed' && nodes[id].inRps > 0);
  const bottleneck = candidates.sort((a, b) => nodes[b].utilization - nodes[a].utilization)[0];

  return {
    nodes,
    edges: edgeMetrics,
    incomingRps,
    servedRps: incomingRps - failedRps,
    failedRps,
    errorRate: incomingRps > 0 ? failedRps / incomingRps : 0,
    latencyMs: incomingRps > 0 ? latencyFrom(model.entry) : 0,
    bottleneck,
    backlogRate,
    drainRate,
  };
}

export function formatRate(n: number) {
  if (!Number.isFinite(n)) return '∞';
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n >= 10 ? String(Math.round(n)) : n.toFixed(n > 0 && n < 1 ? 1 : 0);
}
