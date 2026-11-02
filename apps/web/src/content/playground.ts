import type { Diagram, DiagramNode, Flow, FlowStep, NodeKind } from '../shared';
import { at, edge, node } from './helpers';

export interface PlaygroundConfig {
  id: string;
  name: string;
  simple: string;
  description: string;
  /**
   * Relative 1–5 scores. These are educational judgements for comparison,
   * NOT benchmark results.
   */
  scores: { complexity: number; scalability: number; resilience: number; operationalCost: number };
  /** Rough, illustrative capacity description — not a measured number. */
  capacityNote: string;
  bottlenecks: string[];
  tradeoffs: string[];
  /** What happens if a given node fails (keyed by node id). */
  failureImpact: Record<string, string>;
  diagram: Diagram;
  /** Illustrative capacities used by the live traffic simulation (not benchmarks). */
  traffic: TrafficModel;
  /** One-click guided experiments. */
  scenarios: TrafficScenario[];
}

/** How one component behaves under load in the traffic simulation. */
export interface TrafficNodeSpec {
  /** Requests (or jobs) per second it can handle — an illustrative teaching number. */
  capacity: number;
  /** Time spent inside this component per request when it is not busy. */
  latencyMs: number;
  /** Spreads traffic evenly across its healthy targets (load balancers). */
  balance?: boolean;
  /** Accepts everything and stores it for later (message queues). */
  buffer?: boolean;
}

export interface TrafficEdgeSpec {
  /** Fraction of the source's traffic sent along this edge (default 1). 'miss' = 1 − cache hit ratio. */
  ratio?: number | 'miss';
  /** Use a different ratio when a node has failed, e.g. every read goes to the DB when Redis is down. */
  whenFailed?: { node: string; ratio: number };
  /** Failure of the target does not fail the user's request (there is a fallback). */
  optional?: boolean;
  /** An async edge whose failure still fails the user's request (e.g. "can't enqueue the job"). */
  required?: boolean;
}

export interface TrafficModel {
  entry: string;
  defaultRps: number;
  maxRps: number;
  /** Default cache hit ratio (0–1) for architectures with a cache. */
  hitRatio?: number;
  nodes: Record<string, TrafficNodeSpec>;
  /** Keyed by edge id ("source->target"). */
  edges?: Record<string, TrafficEdgeSpec>;
}

export interface TrafficScenario {
  label: string;
  /** What to watch for, in plain English. */
  description: string;
  rps: number;
  failed?: string[];
  hitRatio?: number;
}

const d = (kind: NodeKind, id: string, label: string, description: string, simple: string, col: number, row: number, failure: string): DiagramNode =>
  node(id, kind, label, description, simple, at(col, row), {
    responsibility: description, inputs: [], outputs: [], technologies: [], failureModes: [failure],
  });

const diagram = (title: string, nodes: DiagramNode[], edges: ReturnType<typeof edge>[]): Diagram => ({ title, hypothetical: true, nodes, edges, flows: [] });

const baseConfigs: Omit<PlaygroundConfig, 'traffic' | 'scenarios'>[] = [
  {
    id: 'single',
    name: 'Single Node.js server',
    simple: 'One program on one computer does everything. Simple — but if it breaks, the whole app is down.',
    description: 'One Node.js process serving HTTP and talking directly to the database. The typical starting point.',
    scores: { complexity: 1, scalability: 1, resilience: 1, operationalCost: 1 },
    capacityNote: 'Uses one CPU core for JavaScript. Fine for prototypes and small internal tools.',
    bottlenecks: ['A single CPU core runs all JavaScript', 'Any CPU-heavy request blocks every other request', 'Database connections from one process'],
    tradeoffs: ['Easiest to build, debug and deploy', 'No redundancy: a crash or deploy means downtime'],
    failureImpact: {
      api: 'Total outage. Every user gets connection errors until the process restarts.',
      db: 'All requests that need data fail. The server is up but useless.',
      client: 'Only that user is affected.',
    },
    diagram: diagram('Single Node.js server', [
      d('client', 'client', 'Users', 'Browsers and apps', 'People using the app.', 0, 1, 'Only affects that user'),
      d('service', 'api', 'Node.js server', 'One process, one core', 'One program doing all the work.', 1.5, 1, 'Crash = full outage'),
      d('database', 'db', 'MongoDB', 'Single instance', 'Where data is stored.', 3, 1, 'Data unavailable'),
    ], [edge('client', 'api', 'HTTP'), edge('api', 'db', 'queries')]),
  },
  {
    id: 'cluster',
    name: 'Node.js cluster (one machine)',
    simple: 'Same computer, but now several copies of the program run side by side, one per CPU core.',
    description: 'The cluster module (or PM2) forks one worker per CPU core on a single machine; the primary process distributes connections.',
    scores: { complexity: 2, scalability: 2, resilience: 2, operationalCost: 1 },
    capacityNote: 'Uses all CPU cores of one machine. Survives a single worker crash, not a machine failure.',
    bottlenecks: ['Still limited to one machine', 'In-memory state is not shared between workers', 'Shared database'],
    tradeoffs: ['Cheap way to use all cores', 'Workers must be stateless (no in-memory sessions)', 'Machine is still a single point of failure'],
    failureImpact: {
      w1: 'Other workers keep serving; the primary forks a replacement. Users barely notice.',
      primary: 'All workers go down with it — full outage on this machine.',
      db: 'All data-dependent requests fail.',
    },
    diagram: diagram('Node.js cluster', [
      d('client', 'client', 'Users', 'Browsers and apps', 'People using the app.', 0, 1.5, ''),
      d('loadBalancer', 'primary', 'Cluster primary', 'Distributes connections', 'A manager handing requests to the workers.', 1.2, 1.5, 'Takes all workers down'),
      d('service', 'w1', 'Worker 1', 'Core 1', 'Copy #1 of the app.', 2.4, 0.5, 'Replaced automatically'),
      d('service', 'w2', 'Worker 2', 'Core 2', 'Copy #2 of the app.', 2.4, 1.5, 'Replaced automatically'),
      d('service', 'w3', 'Worker 3', 'Core 3', 'Copy #3 of the app.', 2.4, 2.5, 'Replaced automatically'),
      d('database', 'db', 'MongoDB', 'Shared', 'Where data is stored.', 3.6, 1.5, 'Data unavailable'),
    ], [edge('client', 'primary'), edge('primary', 'w1'), edge('primary', 'w2'), edge('primary', 'w3'), edge('w1', 'db'), edge('w2', 'db'), edge('w3', 'db')]),
  },
  {
    id: 'load-balanced',
    name: 'Load-balanced instances',
    simple: 'Several computers each run the app, and a traffic officer (load balancer) spreads users between them.',
    description: 'Multiple stateless Node.js instances on separate machines/containers behind a load balancer, with a replicated database.',
    scores: { complexity: 3, scalability: 4, resilience: 4, operationalCost: 2 },
    capacityNote: 'Add instances to grow request capacity roughly linearly — until the database becomes the limit.',
    bottlenecks: ['Database becomes the main bottleneck', 'Load balancer must itself be redundant'],
    tradeoffs: ['Survives instance failures; zero-downtime rolling deploys', 'Requires stateless services and shared session storage'],
    failureImpact: {
      api1: 'Health checks remove it within seconds; the other instances absorb the traffic.',
      lb: 'If the load balancer is not redundant, everything is unreachable — use a managed, multi-zone LB.',
      db: 'Primary fails over to a replica in a few seconds; writes pause briefly.',
    },
    diagram: diagram('Load-balanced instances', [
      d('client', 'client', 'Users', 'Browsers and apps', 'People using the app.', 0, 1.5, ''),
      d('loadBalancer', 'lb', 'Load balancer', 'Health-checked routing', 'Traffic officer spreading requests.', 1.2, 1.5, 'Must be redundant'),
      d('service', 'api1', 'Node.js #1', 'Container', 'A copy of the app.', 2.4, 0.5, ''),
      d('service', 'api2', 'Node.js #2', 'Container', 'A copy of the app.', 2.4, 1.5, ''),
      d('service', 'api3', 'Node.js #3', 'Container', 'A copy of the app.', 2.4, 2.5, ''),
      d('database', 'db', 'MongoDB replica set', 'Primary + 2 replicas', 'Data stored with backup copies.', 3.6, 1.5, 'Failover'),
    ], [edge('client', 'lb'), edge('lb', 'api1'), edge('lb', 'api2'), edge('lb', 'api3'), edge('api1', 'db'), edge('api2', 'db'), edge('api3', 'db')]),
  },
  {
    id: 'redis',
    name: 'Node.js with Redis',
    simple: 'Same as before, plus a super-fast memory (Redis) that remembers popular answers so the database does less work.',
    description: 'Load-balanced instances with a Redis cache (cache-aside) and shared sessions/rate-limit counters.',
    scores: { complexity: 3, scalability: 4, resilience: 4, operationalCost: 3 },
    capacityNote: 'For read-heavy workloads with a high cache hit ratio, the database sees only a fraction of reads.',
    bottlenecks: ['Hot keys concentrated on one Redis shard', 'Write-heavy workloads gain little', 'Cache stampedes on expiry'],
    tradeoffs: ['Much lower read latency and DB load', 'New problems: invalidation, staleness, another system to run'],
    failureImpact: {
      redis: 'Every read becomes a cache miss: latency rises and DB load spikes. Size the DB for it and use short timeouts.',
      db: 'Cached reads keep working; writes and misses fail.',
      api1: 'Removed from rotation; others continue.',
    },
    diagram: diagram('Node.js with Redis', [
      d('client', 'client', 'Users', 'Browsers and apps', 'People using the app.', 0, 1.5, ''),
      d('loadBalancer', 'lb', 'Load balancer', 'Health-checked routing', 'Traffic officer.', 1.2, 1.5, ''),
      d('service', 'api1', 'Node.js #1', 'Stateless', 'A copy of the app.', 2.4, 1, ''),
      d('service', 'api2', 'Node.js #2', 'Stateless', 'A copy of the app.', 2.4, 2, ''),
      d('cache', 'redis', 'Redis', 'Cache + sessions', 'Fast memory for popular data.', 3.6, 0.6, 'Miss storm'),
      d('database', 'db', 'MongoDB', 'Replica set', 'Permanent storage.', 3.6, 2.4, ''),
    ], [edge('client', 'lb'), edge('lb', 'api1'), edge('lb', 'api2'), edge('api1', 'redis'), edge('api2', 'redis'), edge('api1', 'db', 'on miss'), edge('api2', 'db', 'on miss')]),
  },
  {
    id: 'queue',
    name: 'Node.js with a message queue',
    simple: 'Slow jobs (emails, image resizing) are dropped into a to-do list and handled later by helper programs, so users don\'t wait.',
    description: 'The API enqueues background jobs to a broker; separate worker processes consume them with retries and a dead-letter queue.',
    scores: { complexity: 3, scalability: 4, resilience: 4, operationalCost: 3 },
    capacityNote: 'API latency stays low during spikes; the queue absorbs bursts and workers catch up.',
    bottlenecks: ['Worker throughput (scale workers on queue depth)', 'Poison messages without a DLQ'],
    tradeoffs: ['Fast responses and spike absorption', 'Eventual results; consumers must be idempotent; harder debugging'],
    failureImpact: {
      queue: 'New jobs can\'t be enqueued: the API must fail or buffer. Existing durable jobs survive broker restarts.',
      worker: 'Jobs pile up in the queue but nothing is lost; they\'re processed when workers return.',
      api: 'Users can\'t submit work; queued jobs continue processing.',
    },
    diagram: diagram('Node.js with a message queue', [
      d('client', 'client', 'Users', 'Browsers and apps', 'People using the app.', 0, 1, ''),
      d('service', 'api', 'Node.js API', 'Enqueues jobs', 'Takes the request and says "got it".', 1.3, 1, ''),
      d('queue', 'queue', 'Queue', 'RabbitMQ / SQS / Kafka', 'A to-do list of jobs.', 2.6, 1, 'Can\'t enqueue'),
      d('worker', 'worker', 'Workers', 'Process jobs', 'Helpers doing slow work in the background.', 3.9, 1, 'Jobs wait'),
      d('database', 'db', 'MongoDB', 'Results', 'Permanent storage.', 2.6, 2.3, ''),
    ], [edge('client', 'api'), edge('api', 'queue', 'enqueue', true), edge('queue', 'worker', 'consume', true), edge('worker', 'db'), edge('api', 'db')]),
  },
  {
    id: 'microservices',
    name: 'Microservices',
    simple: 'The app is split into several small apps (users, orders, payments), each with its own database, behind one front door.',
    description: 'An API gateway routes to independently deployed services that own their data and communicate via HTTP and events.',
    scores: { complexity: 5, scalability: 5, resilience: 4, operationalCost: 5 },
    capacityNote: 'Each service scales independently, but every request may cross several network hops.',
    bottlenecks: ['Network latency between services', 'Chatty synchronous call chains', 'Distributed data consistency'],
    tradeoffs: ['Independent deploys and scaling per team', 'Requires mature observability, CI/CD and on-call; sagas instead of transactions'],
    failureImpact: {
      gateway: 'Front door is down: total outage. Run it redundantly.',
      orders: 'Ordering fails, but browsing and accounts still work (graceful degradation).',
      payments: 'Orders can\'t complete; with a circuit breaker, the rest of the site stays responsive.',
      broker: 'Async workflows stall; synchronous requests continue.',
    },
    diagram: diagram('Microservices', [
      d('client', 'client', 'Users', 'Browsers and apps', 'People using the app.', 0, 1.5, ''),
      d('apiGateway', 'gateway', 'API Gateway', 'Auth, routing', 'The front door.', 1.2, 1.5, 'Total outage'),
      d('service', 'users', 'User service', 'Own DB', 'Handles accounts.', 2.4, 0.3, ''),
      d('service', 'orders', 'Order service', 'Own DB', 'Handles orders.', 2.4, 1.5, ''),
      d('service', 'payments', 'Payment service', 'Own DB', 'Handles payments.', 2.4, 2.7, ''),
      d('queue', 'broker', 'Event broker', 'Kafka', 'Noticeboard for events.', 3.6, 1.5, 'Async stalls'),
      d('monitoring', 'obs', 'Observability', 'Tracing across services', 'Dashboards to follow requests.', 3.6, 0.3, ''),
    ], [edge('client', 'gateway'), edge('gateway', 'users'), edge('gateway', 'orders'), edge('orders', 'payments', 'HTTP'), edge('orders', 'broker', 'events', true), edge('payments', 'broker', 'events', true), edge('orders', 'obs', 'traces', true)]),
  },
];

/** Repositions a diagram's nodes (same nodes, edges and flows) — e.g. a compact layout for narrow containers. */
export function relayout(diagram: Diagram, positions: Record<string, [col: number, row: number]>): Diagram {
  return { ...diagram, nodes: diagram.nodes.map((n) => (positions[n.id] ? { ...n, position: at(...positions[n.id]) } : n)) };
}

/** Generic diagram used by the request lifecycle simulator. */
export const simulatorDiagram: Diagram = {
  title: 'Request lifecycle — educational simulation',
  hypothetical: true,
  nodes: [
    node('client', 'client', 'Client', 'Browser', 'The user\'s browser asking for a product page.', at(0, 1), { responsibility: 'Sends the HTTP request.', inputs: ['User action'], outputs: ['GET /api/v1/products/42'], technologies: ['Browser'], failureModes: ['Network timeout'] }),
    node('lb', 'loadBalancer', 'Load balancer', 'Nginx', 'Traffic officer choosing a server.', at(1, 1), { responsibility: 'Routes to a healthy instance.', inputs: ['HTTP request'], outputs: ['Proxied request'], technologies: ['Nginx'], failureModes: ['No healthy upstreams → 502'] }),
    node('api', 'service', 'Express API', 'Route + controller', 'Receives the request and validates it.', at(2, 1), { responsibility: 'Parses, authenticates and validates input; calls the service layer.', inputs: ['HTTP request'], outputs: ['JSON response'], technologies: ['Express', 'Zod'], failureModes: ['Unhandled errors → 500 (centralized error handler)'] }),
    node('svc', 'service', 'Service layer', 'Business logic', 'Decides where to get the data from.', at(3, 1), { responsibility: 'Implements business rules; uses cache-aside.', inputs: ['Validated input'], outputs: ['Domain object'], technologies: ['TypeScript'], failureModes: ['Slow dependency without timeout'] }),
    node('redis', 'cache', 'Redis', 'Cache', 'Fast memory with popular answers.', at(4, 0.2), { responsibility: 'Serves cached products.', inputs: ['GET product:42'], outputs: ['Cached JSON or nil'], technologies: ['Redis'], failureModes: ['Down → all misses'] }),
    node('db', 'database', 'MongoDB', 'Source of truth', 'Permanent storage.', at(4, 1.8), { responsibility: 'Stores products.', inputs: ['findById'], outputs: ['Document'], technologies: ['MongoDB'], failureModes: ['Slow query without index'] }),
  ],
  edges: [edge('client', 'lb'), edge('lb', 'api'), edge('api', 'svc'), edge('svc', 'redis'), edge('svc', 'db')],
  flows: [
    {
      id: 'hit', name: 'Cache hit', description: 'The product is already in Redis.',
      steps: [
        { from: 'client', to: 'lb', title: 'Browser sends the request', explanation: 'The browser requests product 42.', simple: 'You open a product page.', request: 'GET /api/v1/products/42\nAccept: application/json' },
        { from: 'lb', to: 'api', title: 'Load balancer picks a server', explanation: 'Nginx proxies to a healthy Express instance and adds X-Request-Id.', simple: 'A free server is chosen.', log: 'nginx: upstream=api-2:3000 request_id=8c1f' },
        { from: 'api', to: 'svc', title: 'Validate and call the service', explanation: 'The route validates :id with Zod and the controller calls productService.get(42).', simple: 'The server checks the request makes sense.', log: '{"level":"info","requestId":"8c1f","route":"GET /products/:id"}' },
        { from: 'svc', to: 'redis', title: 'Look in the cache — HIT', explanation: 'GET product:42 returns cached JSON in ~0.4 ms. The database is never touched.', simple: 'Found it in fast memory!', request: 'GET product:42', response: '{"id":42,"name":"Red running shoes","priceCents":12998}', log: '{"level":"debug","cache":"hit","key":"product:42","ms":0.4}' },
        { from: 'api', to: 'client', title: 'Respond', explanation: '200 OK with the product. Total server time ≈ 3 ms.', simple: 'The page shows the product quickly.', response: 'HTTP/1.1 200 OK\nContent-Type: application/json\n\n{"id":42,"name":"Red running shoes","priceCents":12998}', log: '{"level":"info","requestId":"8c1f","status":200,"durationMs":3}' },
      ],
    },
    {
      id: 'miss', name: 'Cache miss', description: 'The product is not cached, so it is loaded from MongoDB and cached.',
      steps: [
        { from: 'client', to: 'lb', title: 'Browser sends the request', explanation: 'The browser requests product 77.', simple: 'You open a product page.', request: 'GET /api/v1/products/77' },
        { from: 'lb', to: 'api', title: 'Load balancer picks a server', explanation: 'Proxied to a healthy instance.', simple: 'A free server is chosen.' },
        { from: 'api', to: 'svc', title: 'Validate and call the service', explanation: 'Input validated; service called.', simple: 'The request is checked.' },
        { from: 'svc', to: 'redis', title: 'Look in the cache — MISS', explanation: 'GET product:77 returns nil.', simple: 'Not in fast memory.', request: 'GET product:77', response: '(nil)', log: '{"level":"debug","cache":"miss","key":"product:77"}' },
        { from: 'svc', to: 'db', title: 'Query MongoDB', explanation: 'findById uses the _id index. ~6 ms.', simple: 'Look it up in permanent storage.', request: 'db.products.findOne({ _id: 77 })', response: '{ _id: 77, name: "Trail backpack", priceCents: 8999 }', log: '{"level":"debug","op":"mongo.findOne","ms":6.1}' },
        { from: 'svc', to: 'redis', title: 'Save to cache', explanation: 'SET with a 5-minute TTL (plus jitter) so the next request is a hit.', simple: 'Save a copy in fast memory for next time.', request: 'SET product:77 "{...}" EX 312' },
        { from: 'api', to: 'client', title: 'Respond', explanation: '200 OK. Total ≈ 10 ms — slower than a hit, and it puts load on the DB.', simple: 'The page shows the product (a little slower this time).', response: 'HTTP/1.1 200 OK\n\n{"id":77,"name":"Trail backpack","priceCents":8999}', log: '{"level":"info","status":200,"durationMs":10,"cache":"miss"}' },
      ],
    },
  ],
};

/** The simulator diagram folded into a 3-column layout that fits the homepage hero. */
export const simulatorDiagramCompact = relayout(simulatorDiagram, {
  client: [0, 0],
  lb: [1, 0],
  api: [2, 0],
  svc: [2, 1.5],
  redis: [1, 1],
  db: [1, 2],
});

/* ------------------------------------------------------------------ */
/* Live traffic models, scenarios and step-by-step request flows.       */
/* All capacities are ILLUSTRATIVE teaching numbers, not benchmarks.    */
/* ------------------------------------------------------------------ */
type Extra = Pick<PlaygroundConfig, 'traffic' | 'scenarios'> & { flows: Flow[] };
const st = (from: string, to: string, title: string, simple: string, explanation: string, extra: Partial<FlowStep> = {}): FlowStep => ({ from, to, title, simple, explanation, ...extra });

const extras: Record<string, Extra> = {
  single: {
    traffic: { entry: 'client', defaultRps: 200, maxRps: 3000, nodes: { api: { capacity: 800, latencyMs: 20 }, db: { capacity: 3000, latencyMs: 5 } } },
    scenarios: [
      { label: 'Quiet day', description: 'Everything is comfortable. Notice how much spare room the server has.', rps: 100 },
      { label: 'Launch day spike', description: 'Watch the single server turn red: it can only do so much, so extra requests wait and then fail.', rps: 1500 },
      { label: 'Database crashes', description: 'The server is still running, but nearly every request needs data, so users see errors.', rps: 200, failed: ['db'] },
    ],
    flows: [
      {
        id: 'request', name: 'One request', description: 'A page load on a single server.',
        steps: [
          st('client', 'api', 'Request arrives', 'Your browser asks the one server for a page.', 'The only Node.js process accepts the TCP connection and runs the route handler on its event loop.', { request: 'GET /api/products/42' }),
          st('api', 'db', 'Read from the database', 'The server asks the database for the product.', 'One indexed query. While it waits, the event loop serves other users.', { request: 'db.products.findOne({ _id: 42 })', log: '{"op":"findOne","ms":5}' }),
          st('api', 'client', 'Respond', 'The page arrives.', 'Simple and fast — but every request depends on this one process staying alive.', { response: 'HTTP/1.1 200 OK' }),
        ],
      },
    ],
  },
  cluster: {
    traffic: {
      entry: 'client', defaultRps: 600, maxRps: 5000,
      nodes: { primary: { capacity: 20000, latencyMs: 1, balance: true }, w1: { capacity: 800, latencyMs: 20 }, w2: { capacity: 800, latencyMs: 20 }, w3: { capacity: 800, latencyMs: 20 }, db: { capacity: 3000, latencyMs: 5 } },
    },
    scenarios: [
      { label: 'Busy day', description: 'Three workers share the load, so each stays green where one server would be red.', rps: 1500 },
      { label: 'One worker crashes', description: 'The primary sends traffic only to the two survivors. They get busier, but nothing is down.', rps: 1500, failed: ['w1'] },
      { label: 'Beyond one machine', description: 'All workers are overloaded. Adding cores on one machine has a limit — the next step is more machines.', rps: 3500 },
    ],
    flows: [
      {
        id: 'request', name: 'One request', description: 'How the cluster primary hands work to a worker.',
        steps: [
          st('client', 'primary', 'Connection arrives', 'Your request reaches the machine.', 'The cluster primary process owns the listening port.'),
          st('primary', 'w2', 'Handed to a worker', 'The manager gives it to a free worker (one per CPU core).', 'By default the primary distributes connections round-robin to worker processes.', { log: '{"primary":"dispatch","worker":2}' }),
          st('w2', 'db', 'Worker reads data', 'The worker fetches the data.', 'Each worker has its own connection pool to the shared database.'),
          st('w2', 'client', 'Respond', 'The page arrives.', 'Other workers were serving other users at the same time — that is the speed-up.'),
        ],
      },
    ],
  },
  'load-balanced': {
    traffic: {
      entry: 'client', defaultRps: 1000, maxRps: 6000,
      nodes: { lb: { capacity: 50000, latencyMs: 1, balance: true }, api1: { capacity: 1500, latencyMs: 20 }, api2: { capacity: 1500, latencyMs: 20 }, api3: { capacity: 1500, latencyMs: 20 }, db: { capacity: 3000, latencyMs: 5 } },
    },
    scenarios: [
      { label: 'Lose one server', description: 'Health checks remove the dead server and the other two take its share. Users barely notice.', rps: 1500, failed: ['api2'] },
      { label: 'Huge spike', description: 'The servers cope, but the shared database turns red — it is now the bottleneck. (That is why the next design adds a cache.)', rps: 4000 },
      { label: 'Database crashes', description: 'More servers do not help if they all depend on one database.', rps: 1000, failed: ['db'] },
    ],
    flows: [
      {
        id: 'request', name: 'One request', description: 'Normal routing through a load balancer.',
        steps: [
          st('client', 'lb', 'Request reaches the load balancer', 'Your request arrives at the traffic officer.', 'The LB keeps a list of healthy instances from health checks every few seconds.', { request: 'GET /api/products/42' }),
          st('lb', 'api2', 'Pick a healthy server', 'It sends you to the least busy server.', 'Least-connections routing picks api #2.', { log: 'upstream=api2 status=selected' }),
          st('api2', 'db', 'Read data', 'The server fetches data.', 'All instances share the same database replica set.'),
          st('api2', 'client', 'Respond', 'The page arrives.', 'The response goes back through the LB to the browser.'),
        ],
      },
      {
        id: 'failover', name: 'Server crash — failover', description: 'What happens when the chosen server dies mid-request.',
        steps: [
          st('client', 'lb', 'Request arrives', 'Your request reaches the load balancer.', 'Same as before.'),
          st('lb', 'api1', 'Send to api #1 — it has crashed', 'The chosen server does not answer.', 'The connection is refused / times out. The LB marks api #1 unhealthy.', { log: 'upstream=api1 error=ECONNREFUSED' }),
          st('lb', 'api3', 'Retry on a healthy server', 'The load balancer quietly tries another server.', 'Safe for idempotent requests like GET. api #1 stays out of rotation until health checks pass again.', { log: 'upstream=api3 retry=1 status=200' }),
          st('api3', 'db', 'Read data', 'The data is fetched.', 'Normal processing.'),
          st('api3', 'client', 'Respond', 'You get your page — slightly slower, but no error.', 'This is what redundancy buys you.'),
        ],
      },
    ],
  },
  redis: {
    traffic: {
      entry: 'client', defaultRps: 2000, maxRps: 6000, hitRatio: 0.9,
      nodes: { lb: { capacity: 50000, latencyMs: 1, balance: true }, api1: { capacity: 3000, latencyMs: 8 }, api2: { capacity: 3000, latencyMs: 8 }, redis: { capacity: 50000, latencyMs: 0.5 }, db: { capacity: 3000, latencyMs: 6 } },
      edges: {
        'api1->redis': { optional: true },
        'api2->redis': { optional: true },
        'api1->db': { ratio: 'miss', whenFailed: { node: 'redis', ratio: 1 } },
        'api2->db': { ratio: 'miss', whenFailed: { node: 'redis', ratio: 1 } },
      },
    },
    scenarios: [
      { label: 'Huge spike, warm cache', description: '90% of reads come from Redis, so the database only sees a trickle and stays green.', rps: 4000, hitRatio: 0.9 },
      { label: 'Cold cache after restart', description: 'Hit ratio drops to 0%: every request falls through to the database, which turns red.', rps: 4000, hitRatio: 0 },
      { label: 'Redis crashes', description: 'The app keeps working (it falls back to the DB) but the database is suddenly overwhelmed.', rps: 4000, failed: ['redis'] },
    ],
    flows: [
      {
        id: 'hit', name: 'Cache hit', description: 'The answer is already in Redis.',
        steps: [
          st('client', 'lb', 'Request arrives', 'You open a product page.', 'Routed by the load balancer.'),
          st('lb', 'api1', 'Pick a server', 'A free server is chosen.', 'Stateless instance; any one can answer.'),
          st('api1', 'redis', 'Check the cache — HIT', 'Found in fast memory!', 'GET product:42 returns cached JSON in under a millisecond.', { request: 'GET product:42', response: '{"id":42,"name":"Red shoes"}', log: '{"cache":"hit","ms":0.4}' }),
          st('api1', 'client', 'Respond', 'Very fast — the database was never touched.', 'Total ≈ 3 ms.'),
        ],
      },
      {
        id: 'miss', name: 'Cache miss', description: 'The answer is not cached yet.',
        steps: [
          st('client', 'lb', 'Request arrives', 'You open a rarely visited page.', 'Routed by the load balancer.'),
          st('lb', 'api2', 'Pick a server', 'A free server is chosen.', 'Stateless instance.'),
          st('api2', 'redis', 'Check the cache — MISS', 'Not in fast memory.', 'GET returns nil.', { request: 'GET product:77', response: '(nil)' }),
          st('api2', 'db', 'Read the database', 'Look it up in permanent storage.', 'Indexed query, ~6 ms.', { request: 'db.products.findOne({ _id: 77 })' }),
          st('api2', 'redis', 'Save to cache', 'Remember it for next time.', 'SET with a TTL so the next request is a hit.', { request: 'SET product:77 "{...}" EX 300' }),
          st('api2', 'client', 'Respond', 'A bit slower this time.', 'Total ≈ 10 ms.'),
        ],
      },
    ],
  },
  queue: {
    traffic: {
      entry: 'client', defaultRps: 200, maxRps: 3000,
      nodes: { api: { capacity: 2000, latencyMs: 5 }, queue: { capacity: 100000, latencyMs: 1, buffer: true }, worker: { capacity: 300, latencyMs: 120 }, db: { capacity: 3000, latencyMs: 5 } },
      edges: { 'api->queue': { required: true }, 'api->db': { ratio: 0.2 } },
    },
    scenarios: [
      { label: 'Newsletter blast', description: 'Jobs arrive faster than workers can handle. The API stays fast; the backlog grows safely in the queue.', rps: 1000 },
      { label: 'Workers crash', description: 'Users still get instant "accepted" replies. Jobs simply wait in the queue until workers return.', rps: 300, failed: ['worker'] },
      { label: 'Queue goes down', description: 'Now the API cannot accept new jobs, so users see errors.', rps: 300, failed: ['queue'] },
    ],
    flows: [
      {
        id: 'job', name: 'Background job', description: 'A photo upload whose resizing happens later.',
        steps: [
          st('client', 'api', 'Upload a photo', 'You upload a profile photo.', 'The API validates the upload and stores the original.', { request: 'POST /api/photos' }),
          st('api', 'queue', 'Add a job to the queue', 'The server writes a to-do note: "resize photo 81".', 'Publishing to the broker takes ~2 ms.', { request: '{"type":"photo.resize","photoId":81}' }),
          st('api', 'client', 'Reply immediately', 'You get "Got it!" right away — no waiting.', '202 Accepted. The slow part has not happened yet.', { response: 'HTTP/1.1 202 Accepted' }),
          st('queue', 'worker', 'A worker picks up the job', 'A helper takes the note off the list.', 'Workers pull jobs at their own pace; extra jobs wait safely.', { log: '{"worker":3,"job":"photo.resize","attempt":1}' }),
          st('worker', 'db', 'Save the result', 'The resized photo is recorded.', 'The worker acknowledges the job only after success, so a crash means it is retried.'),
        ],
      },
    ],
  },
  microservices: {
    traffic: {
      entry: 'client', defaultRps: 500, maxRps: 4000,
      nodes: {
        gateway: { capacity: 20000, latencyMs: 2 },
        users: { capacity: 2000, latencyMs: 15 },
        orders: { capacity: 1200, latencyMs: 25 },
        payments: { capacity: 300, latencyMs: 150 },
        broker: { capacity: 50000, latencyMs: 1, buffer: true },
        obs: { capacity: 10000, latencyMs: 1 },
      },
      edges: { 'gateway->users': { ratio: 0.4 }, 'gateway->orders': { ratio: 0.6 }, 'orders->payments': { ratio: 0.3 } },
    },
    scenarios: [
      { label: 'Flash sale', description: 'The order and payment services turn red, while the user service stays green — each part scales separately.', rps: 2000 },
      { label: 'Payment provider down', description: 'Checkouts fail, but browsing and accounts keep working. One failure does not take everything down.', rps: 500, failed: ['payments'] },
      { label: 'Order service down', description: 'Ordering is broken, yet sign-in and profiles still work.', rps: 500, failed: ['orders'] },
    ],
    flows: [
      {
        id: 'checkout', name: 'Checkout', description: 'One order crossing several services.',
        steps: [
          st('client', 'gateway', 'Place order', 'You press "Buy".', 'The gateway checks your login token and routes /orders to the order service.', { request: 'POST /api/orders' }),
          st('gateway', 'orders', 'Order service takes over', 'The order service creates your order.', 'It owns its own database.'),
          st('orders', 'payments', 'Charge the card', 'The order service asks the payment service to charge you.', 'A network call with a timeout and circuit breaker.', { log: '{"svc":"payments","ms":140,"status":"authorized"}' }),
          st('orders', 'broker', 'Announce "order placed"', 'It posts the news on the noticeboard.', 'Shipping, email and analytics react later, independently.', { request: '{"type":"order.placed","orderId":"o_17"}' }),
          st('orders', 'client', 'Confirm', 'You see "Order confirmed!".', 'Several services cooperated over the network for one click.'),
        ],
      },
    ],
  },
};

export const playgroundConfigs: PlaygroundConfig[] = baseConfigs.map((c) => {
  const x = extras[c.id];
  return { ...c, traffic: x.traffic, scenarios: x.scenarios, diagram: { ...c.diagram, flows: x.flows } };
});
