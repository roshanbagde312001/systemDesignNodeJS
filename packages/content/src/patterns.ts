export interface ArchitecturePattern {
  slug: string;
  name: string;
  simple: string;
  description: string;
  useWhen: string[];
  avoidWhen: string[];
  /** Slugs of designs/articles that demonstrate the pattern. */
  seenIn: { kind: 'design' | 'article'; slug: string }[];
  flow: string;
}

export const architecturePatterns: ArchitecturePattern[] = [
  {
    slug: 'layered-monolith',
    name: 'Layered (modular) monolith',
    simple: 'One app, neatly organised into rooms: routes → controllers → services → data access. Everything is deployed together.',
    description: 'A single deployable application with clear internal module boundaries. Calls between modules are function calls, and one database gives real transactions.',
    useWhen: ['Small to medium teams', 'New products where requirements change fast', 'You need simple ACID transactions'],
    avoidWhen: ['Many teams constantly block each other on deploys', 'Parts of the system need wildly different scaling'],
    seenIn: [{ kind: 'article', slug: 'horizontal-vs-vertical-scaling' }],
    flow: 'Route -> Controller -> Service -> Repository -> Database',
  },
  {
    slug: 'microservices',
    name: 'Microservices',
    simple: 'The app is split into many small apps, each owning one job and its own data, talking over the network.',
    description: 'Independently deployable services organised around business capabilities, each with its own datastore. Enables team autonomy at the cost of distributed-systems complexity.',
    useWhen: ['Many teams need to deploy independently', 'Domains have different scaling or reliability needs'],
    avoidWhen: ['Small team', 'Unclear domain boundaries', 'No investment in observability and automation'],
    seenIn: [{ kind: 'design', slug: 'ecommerce-orders' }],
    flow: 'API Gateway -> Order Service | Inventory Service | Payment Service',
  },
  {
    slug: 'event-driven',
    name: 'Event-driven architecture',
    simple: 'Services announce "this happened" and anyone interested reacts — like posting news on a noticeboard instead of phoning everyone.',
    description: 'Producers publish immutable events to a broker; consumers subscribe and react asynchronously. Decouples services in time and knowledge.',
    useWhen: ['Many systems react to the same business fact', 'Work can be done asynchronously', 'You need an audit trail or replay'],
    avoidWhen: ['The caller needs an immediate answer', 'The team can\'t yet operate a broker and debug async flows'],
    seenIn: [{ kind: 'design', slug: 'messaging-system' }, { kind: 'article', slug: 'message-queues-kafka' }],
    flow: 'Producer -> Event broker -> Consumer A | Consumer B | Consumer C',
  },
  {
    slug: 'cache-aside',
    name: 'Cache-aside',
    simple: 'Check the fast sticky note first; if the answer isn\'t there, look in the filing cabinet and write a new sticky note.',
    description: 'The application reads from the cache, falls back to the database on a miss, and populates the cache. Writes invalidate cache entries.',
    useWhen: ['Read-heavy workloads', 'Data that changes rarely relative to reads'],
    avoidWhen: ['Data must never be stale for decisions (balances, stock for purchase)'],
    seenIn: [{ kind: 'design', slug: 'url-shortener' }, { kind: 'article', slug: 'redis-caching' }],
    flow: 'API -> Cache (hit) | Database (miss) -> Populate cache',
  },
  {
    slug: 'saga',
    name: 'Saga',
    simple: 'A multi-step process where each step knows how to undo itself if a later step fails.',
    description: 'Manages a business transaction across services as a sequence of local transactions with compensating actions, coordinated by an orchestrator or by events.',
    useWhen: ['A workflow spans several services or external APIs', 'Distributed transactions are impossible or too costly'],
    avoidWhen: ['Everything lives in one database — just use a transaction'],
    seenIn: [{ kind: 'design', slug: 'ecommerce-orders' }],
    flow: 'Create order -> Reserve stock -> Charge payment -> (fail? release stock)',
  },
  {
    slug: 'circuit-breaker',
    name: 'Circuit breaker',
    simple: 'If a service keeps failing, stop calling it for a bit and use a backup answer.',
    description: 'Wraps remote calls and trips open after a failure threshold, failing fast until a cool-down allows trial requests.',
    useWhen: ['Calling remote dependencies that can become slow or unavailable'],
    avoidWhen: ['Local in-process calls'],
    seenIn: [{ kind: 'article', slug: 'circuit-breakers' }],
    flow: 'Caller -> Breaker (closed/open/half-open) -> Dependency or Fallback',
  },
  {
    slug: 'transactional-outbox',
    name: 'Transactional outbox',
    simple: 'Write the "announcement" into the same notebook, at the same moment, as the change itself — then post it later.',
    description: 'Persist events in an outbox table within the same transaction as the state change; a relay publishes them to the broker, avoiding dual-write inconsistency.',
    useWhen: ['You update a database and must publish an event reliably'],
    avoidWhen: ['Losing an occasional event is acceptable (e.g. analytics)'],
    seenIn: [{ kind: 'design', slug: 'ecommerce-orders' }],
    flow: 'Service -> DB transaction (row + outbox) -> Relay -> Broker',
  },
  {
    slug: 'pub-sub-fanout',
    name: 'Publish/subscribe fan-out',
    simple: 'One message, many receivers — like a group chat where one post reaches every member.',
    description: 'A message published once is delivered to many subscribers; fan-out can happen on write (push copies) or on read (subscribers pull).',
    useWhen: ['Notifications, chat groups, feeds'],
    avoidWhen: ['Huge audiences with push fan-out — switch to fan-out on read'],
    seenIn: [{ kind: 'design', slug: 'messaging-system' }],
    flow: 'Publisher -> Topic -> Subscriber 1 | Subscriber 2 | Subscriber N',
  },
];
