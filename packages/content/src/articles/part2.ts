import type { Article } from '@sda/shared';
import { md } from '../helpers';

export const capTheorem: Article = {
  slug: 'cap-theorem',
  title: 'CAP Theorem Without the Confusion',
  summary: 'What consistency, availability and partition tolerance really mean, why you only choose during a partition, and PACELC.',
  simple: 'Two shop branches share one stock list over a phone line. If the phone line breaks, each branch must choose: keep selling and risk both selling the last item (available but inconsistent), or stop selling until the line is fixed (consistent but unavailable). CAP says you can\'t have both while the line is down.',
  category: 'distributed-systems',
  tags: ['interview', 'replication'],
  technologies: ['MongoDB', 'Cassandra', 'PostgreSQL'],
  patterns: ['Replication'],
  difficulty: 'Intermediate',
  readingMinutes: 10,
  publishedAt: '2026-09-25',
  popularity: 1210,
  status: 'published',
  related: ['database-indexing', 'horizontal-vs-vertical-scaling'],
  body: md`
    ## The three letters

    - **C — [[consistency|Consistency]]** (linearizability): every read sees the most recent write, as if there were one copy of the data.
    - **A — [[availability|Availability]]**: every request to a non-failed node gets a (non-error) response.
    - **P — [[partition|Partition tolerance]]**: the system keeps working when the network drops messages between nodes.

    ## The real statement

    Networks *will* partition, so P isn't optional. The theorem really says: **when a partition happens, you must choose between C and A.**

    \`\`\`diagram
    Network partition -> Choose: refuse requests (CP) OR answer with possibly stale data (AP)
    \`\`\`

    - **CP**: the minority side refuses writes (or reads) to avoid divergence. *Example*: a MongoDB replica set — a primary that loses contact with the majority steps down, so writes fail on that side.
    - **AP**: every side keeps accepting requests and reconciles later. *Example*: Cassandra/DynamoDB with low consistency levels — always writable, may return stale data.

    > [!NOTE]
    > "CA" systems only exist if partitions never happen — e.g. a single-node database. Once you have replicas across a network, you're choosing between CP and AP behaviour during failures.

    ## It's a dial, not a switch

    Many databases let you choose **per operation**:

    \`\`\`js
    // MongoDB: wait for a majority of replicas to acknowledge (stronger), read only majority-committed data
    await Order.create([order], { writeConcern: { w: 'majority' } });
    const o = await Order.findById(id).readConcern('majority');

    // Cassandra: QUORUM reads + QUORUM writes overlap → read-your-writes
    // R + W > N  (e.g. N=3, R=2, W=2)
    \`\`\`

    ## PACELC: the everyday trade-off

    CAP only talks about partitions, which are rare. PACELC adds: **E**lse (no partition), choose between **L**atency and **C**onsistency. Waiting for replicas in other regions makes writes consistent but slow; acknowledging locally is fast but replicas lag.

    ## Choosing for your feature

    | Feature | Prefer | Why |
    |---|---|---|
    | Payments, inventory decrement | C | Wrong answers cost money |
    | Social feed, like counts | A | Slightly stale is fine |
    | Chat message log | C for write ack, A for presence | Never lose messages; "last seen" can lag |
    | Shopping cart | Often A | Merge carts later rather than block shopping |

    ## Interview tip

    Don't just say "we pick AP". Say **which operations** need which guarantee, what users see during a partition, and how the system reconciles afterwards (last-write-wins, version vectors, CRDTs, or manual resolution).
  `,
};

export const scaling: Article = {
  slug: 'horizontal-vs-vertical-scaling',
  title: 'Horizontal vs Vertical Scaling',
  summary: 'Scale up or scale out? Costs, limits, statelessness, and a practical path from one server to many.',
  simple: 'If a restaurant gets too busy, you can hire a faster super-chef (vertical scaling: a bigger machine) or hire more regular chefs and add more stoves (horizontal scaling: more machines). The super-chef is simpler but there\'s only one of them, and they can call in sick.',
  category: 'scalability',
  tags: ['load-balancing', 'nodejs', 'interview'],
  technologies: ['Node.js', 'Nginx', 'Redis', 'Docker'],
  patterns: ['Horizontal scaling', 'Stateless services'],
  difficulty: 'Beginner',
  readingMinutes: 9,
  publishedAt: '2026-10-01',
  popularity: 1050,
  status: 'published',
  related: ['nodejs-event-loop', 'cap-theorem'],
  body: md`
    ## Vertical scaling (scale up)

    Give the machine more CPU, RAM or faster disks.

    **Pros**: no code changes, no distributed-system problems, transactions stay simple.
    **Cons**: hardware has a ceiling, cost rises steeply at the top end, upgrades often need downtime, and it remains a [[single-point-of-failure|single point of failure]].

    ## Horizontal scaling (scale out)

    Run more copies of the service behind a [[load-balancer|load balancer]].

    **Pros**: near-linear capacity growth, redundancy, rolling deploys without downtime.
    **Cons**: requires [[stateless]] services, shared state moves to databases/caches, and debugging spans many machines.

    \`\`\`diagram
    Users -> Load Balancer -> Node.js #1 | Node.js #2 | Node.js #3 -> Shared Redis + Database
    \`\`\`

    ## Making a Node.js service stateless

    Anything stored in process memory breaks when the next request lands on a different instance.

    | In-memory thing | Move it to |
    |---|---|
    | Sessions | Signed tokens (JWT) or a Redis session store |
    | Uploaded files on local disk | Object storage (S3) |
    | In-process caches that must be shared | Redis |
    | Cron jobs | A single scheduler or a job queue with locks |
    | WebSocket rooms | A pub/sub backplane (Redis adapter) |

    \`\`\`ts
    // ❌ Works on one server, breaks on three
    const carts = new Map<string, Cart>();

    // ✅ Any instance can serve any user
    await redis.set(\`cart:\${userId}\`, JSON.stringify(cart), 'EX', 86_400);
    \`\`\`

    ## The database is usually the real limit

    App servers are easy to clone; databases are not. The usual progression:

    1. Add **indexes** and fix slow queries.
    2. Add a **cache** for hot reads.
    3. Add **read replicas** (accept [[replication]] lag on those reads).
    4. Scale the primary **vertically**.
    5. **Shard** (split data by key) — powerful but complex. Do it last.

    ## A practical path

    > [!TIP]
    > Start with one well-sized server and a managed database. Make the app stateless from day one (it costs little), so going from 1 to N instances is a config change, not a rewrite.

    1. 1 instance + managed DB → 2. 2+ instances behind a LB for redundancy → 3. Autoscaling on CPU/RPS → 4. Cache + replicas → 5. Split hot domains into services only if needed.
  `,
};

export const messageQueues: Article = {
  slug: 'message-queues-kafka',
  title: 'Message Queues and Kafka for Backend Developers',
  summary: 'Why queues exist, queue vs log, delivery guarantees, consumer groups, idempotent consumers and dead-letter queues.',
  simple: 'A message queue is the order rail in a restaurant kitchen. Waiters clip orders onto the rail and go back to customers; cooks take orders off when they\'re ready. If a cook is slow, orders wait on the rail instead of the waiter standing there. Kafka is like a rail that also keeps a copy of every order ever clipped, so you can replay them.',
  category: 'message-queues',
  tags: ['kafka', 'event-driven', 'idempotency', 'interview'],
  technologies: ['Kafka', 'RabbitMQ', 'Amazon SQS', 'Node.js'],
  patterns: ['Event-driven architecture', 'Asynchronous processing', 'Publish/subscribe'],
  difficulty: 'Intermediate',
  readingMinutes: 14,
  publishedAt: '2026-10-10',
  popularity: 1150,
  status: 'published',
  related: ['circuit-breakers', 'nodejs-event-loop'],
  body: md`
    ## What problem does a queue solve?

    Without a queue, service A calls service B directly. If B is slow, A is slow. If B is down, A fails. If traffic spikes, B falls over.

    With a [[queue|message queue]] in between:

    - **Decoupling** — A doesn't need to know who consumes the message.
    - **Buffering** — spikes wait in the queue instead of crashing B.
    - **[[async|Asynchrony]]** — the user gets a fast response; slow work happens later.
    - **Retries** — failed messages are retried without the user noticing.

    \`\`\`diagram
    API (producer) -> Queue -> Worker 1 | Worker 2 | Worker 3 (consumers)
    \`\`\`

    ## Queue vs log

    | | Traditional queue (RabbitMQ, SQS) | Log (Kafka) |
    |---|---|---|
    | After consumption | Message deleted | Message kept for the retention period |
    | Multiple consumers | Compete for messages | Each **consumer group** reads everything independently |
    | Replay | No | Yes — rewind offsets |
    | Ordering | Per queue (best-effort for some) | Per **partition** |
    | Best for | Task/job distribution | Event streams, many subscribers, replay |

    ## Kafka in 60 seconds

    - A **topic** (e.g. \`orders\`) is split into **partitions**.
    - Producers choose a partition by **key** (e.g. \`orderId\`) → all events for one key stay **in order**.
    - A **consumer group** shares partitions among its members; one partition → at most one consumer in the group.
    - Each group tracks its **offset** (position) per partition.

    ## Delivery guarantees

    - **At-most-once** — commit the offset before processing. Crash → message lost.
    - **At-least-once** — process, then commit. Crash → message processed again. **The common choice.**
    - **Exactly-once** — possible within Kafka transactions, but side effects in other systems (emails, payments) still need idempotency.

    > [!WARNING]
    > With at-least-once delivery, every consumer **must be idempotent**: processing the same message twice must not double-charge, double-email or double-ship.

    \`\`\`ts
    // An idempotent consumer using a processed-events collection with a unique index on eventId
    async function handle(event: OrderPaidEvent) {
      try {
        await ProcessedEvent.create({ eventId: event.id });   // fails on duplicate
      } catch (err) {
        if (isDuplicateKeyError(err)) return;                 // already handled — skip
        throw err;
      }
      await sendConfirmationEmail(event.orderId);
    }
    \`\`\`

    ## Retries and dead-letter queues

    Some messages fail every time (bad data — a "poison message"). Retry a few times with **exponential backoff**, then move them to a **dead-letter queue (DLQ)** for inspection, so they don't block everything behind them.

    ## A minimal producer/consumer with kafkajs

    \`\`\`ts
    import { Kafka } from 'kafkajs';
    const kafka = new Kafka({ clientId: 'orders', brokers: ['kafka:9092'] });

    const producer = kafka.producer();
    await producer.connect();
    await producer.send({ topic: 'orders', messages: [{ key: order.id, value: JSON.stringify({ type: 'order.paid', ...order }) }] });

    const consumer = kafka.consumer({ groupId: 'notifications' });
    await consumer.connect();
    await consumer.subscribe({ topic: 'orders' });
    await consumer.run({ eachMessage: async ({ message }) => handle(JSON.parse(message.value!.toString())) });
    \`\`\`

    ## When not to use a queue

    If the user needs the result **right now** (e.g. "is this username available?"), a queue just adds latency and complexity. Use queues for work that can happen later or that many systems need to react to.
  `,
};

export const circuitBreakers: Article = {
  slug: 'circuit-breakers',
  title: 'Circuit Breakers, Timeouts and Retries',
  summary: 'Stop one failing dependency from taking down your whole system: timeouts, retries with backoff and jitter, and the circuit breaker pattern.',
  simple: 'A circuit breaker in your house cuts power when something shorts, so the whole house doesn\'t catch fire. In software, if a service keeps failing, we stop calling it for a while and show a fallback instead, so the failure doesn\'t spread and the broken service gets time to recover.',
  category: 'distributed-systems',
  tags: ['microservices', 'interview'],
  technologies: ['Node.js', 'opossum'],
  patterns: ['Circuit breaker', 'Retry with backoff', 'Bulkhead'],
  difficulty: 'Intermediate',
  readingMinutes: 11,
  publishedAt: '2026-10-18',
  popularity: 760,
  status: 'published',
  related: ['message-queues-kafka', 'rate-limiting-algorithms'],
  body: md`
    ## Cascading failure

    Service A calls B. B becomes slow (not down — slow). A's requests pile up waiting, its connection pool and memory fill up, and now A is down too. Then everything that calls A goes down. One slow dependency took out the system.

    \`\`\`diagram
    B slow -> A waits -> A pool exhausted -> A fails -> A's callers fail
    \`\`\`

    ## Defence 1: Timeouts — always

    > [!WARNING]
    > Many HTTP clients have **no timeout by default** — a request can hang for minutes. Set one on every network call.

    \`\`\`ts
    const res = await fetch(url, { signal: AbortSignal.timeout(800) }); // fail after 800 ms
    \`\`\`

    Choose timeouts from the dependency's normal p99 plus headroom, and keep the whole chain within the caller's own deadline.

    ## Defence 2: Retries — carefully

    Retries fix transient blips but can **multiply load** on a struggling service ("retry storms").

    - Retry only **idempotent** operations (or ones with idempotency keys).
    - Use **exponential backoff with jitter**: wait 100 ms, 200 ms, 400 ms… each randomized.
    - Cap attempts (2–3) and respect a total deadline.

    \`\`\`ts
    async function withRetry<T>(fn: () => Promise<T>, attempts = 3, base = 100): Promise<T> {
      for (let i = 0; ; i++) {
        try { return await fn(); }
        catch (err) {
          if (i >= attempts - 1 || !isTransient(err)) throw err;
          const delay = Math.random() * base * 2 ** i;      // "full jitter"
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }
    \`\`\`

    ## Defence 3: The circuit breaker

    A [[circuit-breaker|circuit breaker]] wraps calls to a dependency and tracks failures.

    | State | Behaviour |
    |---|---|
    | **Closed** | Calls pass through; failures are counted |
    | **Open** | Failure rate crossed a threshold → calls fail **immediately** (or return a fallback) for a cool-down period |
    | **Half-open** | After cool-down, let a few trial calls through. Success → close; failure → open again |

    \`\`\`ts
    import CircuitBreaker from 'opossum';

    const breaker = new CircuitBreaker((id: string) => recommendationsClient.get(id), {
      timeout: 500,                   // treat slow calls as failures
      errorThresholdPercentage: 50,   // open when ≥50% fail…
      volumeThreshold: 20,            // …over at least 20 calls
      resetTimeout: 10_000,           // try again after 10 s
    });
    breaker.fallback(() => []);       // show no recommendations rather than an error page

    app.get('/products/:id', async (req, res) => {
      const [product, recs] = await Promise.all([getProduct(req.params.id), breaker.fire(req.params.id)]);
      res.json({ ...product, recommendations: recs });
    });
    \`\`\`

    **Benefits**: fail fast instead of piling up, give the dependency room to recover, and degrade gracefully.

    ## Defence 4: Bulkheads

    Like watertight compartments in a ship: give each dependency its own limited pool (connections, concurrency) so one slow dependency can't consume every resource.

    ## Putting it together

    Timeout (every call) → Retry (transient, idempotent, with jitter) → Circuit breaker (stop hammering) → Fallback (degrade gracefully) → Monitoring (alert when breakers open).
  `,
};
