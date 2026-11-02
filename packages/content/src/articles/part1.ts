import type { Article } from '@sda/shared';
import { md } from '../helpers';

export const eventLoop: Article = {
  slug: 'nodejs-event-loop',
  title: 'The Node.js Event Loop, Explained Simply',
  summary: 'How one JavaScript thread serves thousands of concurrent requests, what the phases are, and how to avoid blocking it.',
  simple: 'Node.js has one waiter serving many tables. The waiter never stands around waiting for the kitchen — they take an order, hand it to the kitchen, and serve other tables. When food is ready, the kitchen rings a bell and the waiter delivers it. If the waiter stops to cook something themselves, every table waits. That is "blocking the event loop".',
  category: 'nodejs-internals',
  tags: ['nodejs', 'interview'],
  technologies: ['Node.js', 'libuv'],
  patterns: ['Non-blocking I/O'],
  difficulty: 'Beginner',
  readingMinutes: 12,
  publishedAt: '2026-08-12',
  popularity: 1500,
  status: 'published',
  related: ['horizontal-vs-vertical-scaling', 'message-queues-kafka'],
  body: md`
    ## Why this matters

    Node.js runs your JavaScript on a **single thread**, yet a single Node process can handle thousands of concurrent connections. The trick is the [[event-loop|event loop]]: Node never waits for slow I/O (network, disk, database). It starts the operation, registers a callback, and moves on.

    \`\`\`diagram
    Request arrives -> JS handler runs -> DB query handed to OS -> Loop serves other requests -> DB replies -> Callback runs -> Response sent
    \`\`\`

    ## The pieces

    - **Call stack** — the JavaScript currently executing. Only one thing at a time.
    - **libuv** — a C library that talks to the operating system for async network I/O and runs a small **thread pool** (default 4 threads) for things the OS can't do asynchronously: file system, DNS lookups, \`crypto.pbkdf2\`, \`zlib\`.
    - **Queues** — callbacks waiting to run when the stack is empty.

    ## The phases of one loop iteration

    | Phase | What runs there |
    |---|---|
    | timers | \`setTimeout\` / \`setInterval\` callbacks whose time has come |
    | pending callbacks | some deferred system callbacks (e.g. TCP errors) |
    | poll | **most I/O callbacks**; waits here for new events if nothing else is due |
    | check | \`setImmediate\` callbacks |
    | close callbacks | e.g. \`socket.on('close')\` |

    Between every callback, Node drains two **microtask** queues: first \`process.nextTick\`, then **Promise** callbacks (\`.then\`, code after \`await\`).

    \`\`\`js
    console.log('1: sync');
    setTimeout(() => console.log('5: timeout'), 0);
    setImmediate(() => console.log('6: immediate'));
    Promise.resolve().then(() => console.log('3: promise'));
    process.nextTick(() => console.log('2: nextTick'));
    console.log('1b: sync');
    // Output: 1: sync, 1b: sync, 2: nextTick, 3: promise, then timeout/immediate
    // (timeout vs immediate order can vary when scheduled from the main module)
    \`\`\`

    ## Blocking the loop — the #1 Node performance bug

    While your code runs synchronously, **nothing else** happens: no other request is served, no timer fires.

    \`\`\`js
    app.get('/report', (req, res) => {
      // ❌ 2 seconds of CPU work: every other user waits 2 seconds too
      const result = heavyComputation(req.query.n);
      res.json(result);
    });
    \`\`\`

    > [!WARNING]
    > Common accidental blockers: \`JSON.parse\` on huge payloads, synchronous \`fs.*Sync\` calls in request handlers, catastrophic regexes, \`bcrypt\` with a sync API, and big loops over arrays.

    **Fixes**

    1. Move CPU-heavy work to **worker threads** or a separate service/queue.
    2. Stream large data instead of loading it whole.
    3. Break long loops into chunks with \`setImmediate\` between them.
    4. Use the async versions of APIs.

    \`\`\`js
    import { Worker } from 'node:worker_threads';

    app.get('/report', (req, res, next) => {
      const worker = new Worker(new URL('./report-worker.js', import.meta.url), { workerData: req.query.n });
      worker.once('message', (result) => res.json(result));
      worker.once('error', next);
    });
    \`\`\`

    ## Measuring it

    Monitor **event loop lag/utilization** in production. Node exposes it directly:

    \`\`\`js
    import { monitorEventLoopDelay } from 'node:perf_hooks';
    const h = monitorEventLoopDelay({ resolution: 20 });
    h.enable();
    setInterval(() => console.log('p99 loop delay ms', h.percentile(99) / 1e6), 10_000);
    \`\`\`

    > [!TIP]
    > A p99 loop delay above ~50–100 ms is a strong hint that something is blocking. Pair it with a CPU profile (\`node --cpu-prof\`) to find the culprit.

    ## Using all CPU cores

    One Node process uses one core for JavaScript. To use 8 cores, run 8 processes: the \`cluster\` module, PM2, or (most commonly today) multiple containers behind a [[load-balancer|load balancer]].

    ## Key takeaways

    - Node is great for **I/O-bound** work (APIs, proxies, real-time) because it never waits idle.
    - It is poor at long **CPU-bound** work on the main thread — offload it.
    - Microtasks (nextTick, Promises) run before the loop moves on; a runaway microtask chain can starve I/O.
  `,
};

export const redisCaching: Article = {
  slug: 'redis-caching',
  title: 'Caching with Redis: Patterns, Pitfalls and Invalidation',
  summary: 'Cache-aside, write-through and write-behind; TTLs, eviction, stampedes and how to keep cached data correct.',
  simple: 'A cache is a sticky note on your desk. Instead of walking to the filing cabinet (the database) every time someone asks for a phone number, you write the popular ones on a sticky note. It is much faster — but if someone changes their number, you must remember to update or throw away the sticky note.',
  category: 'caching',
  tags: ['redis', 'caching', 'interview'],
  technologies: ['Redis', 'Node.js'],
  patterns: ['Caching', 'Cache-aside'],
  difficulty: 'Beginner',
  readingMinutes: 14,
  publishedAt: '2026-08-20',
  popularity: 1320,
  status: 'published',
  related: ['database-indexing', 'rate-limiting-algorithms'],
  body: md`
    ## Why cache?

    A typical database query takes 2–20 ms; a Redis read on the same network takes well under 1 ms. If the same data is read far more often than it changes, a [[cache]] cuts [[latency]] and protects the database from load.

    \`\`\`diagram
    Client -> API -> Redis (hit? return) -> Database (on miss) -> Save to Redis -> Return
    \`\`\`

    ## Pattern 1: Cache-aside (lazy loading) — the default

    The application checks the cache, falls back to the database, then fills the cache.

    \`\`\`ts
    async function getProduct(id: string) {
      const key = \`product:\${id}\`;
      const hit = await redis.get(key);
      if (hit) return JSON.parse(hit);

      const product = await Product.findById(id).lean();
      if (product) await redis.set(key, JSON.stringify(product), 'EX', 300); // 5 min TTL
      return product;
    }

    async function updateProduct(id: string, changes: Partial<ProductDoc>) {
      await Product.updateOne({ _id: id }, changes);
      await redis.del(\`product:\${id}\`); // invalidate AFTER the DB write succeeds
    }
    \`\`\`

    **Pros**: only caches what's actually used; cache failure isn't fatal. **Cons**: first request after expiry is slow; brief staleness is possible.

    ## Pattern 2: Write-through

    Every write updates the database **and** the cache synchronously. Reads are always warm, but writes are slower and you cache data nobody may read.

    ## Pattern 3: Write-behind (write-back)

    Writes go to the cache and are flushed to the database asynchronously. Very fast writes, but **data loss risk** if the cache dies before flushing. Use only for data you can afford to lose (view counters, for example).

    ## Invalidation: the hard part

    > [!NOTE]
    > "There are only two hard things in Computer Science: cache invalidation and naming things." — Phil Karlton

    Strategies, from simplest to strongest:

    1. **[[ttl|TTL]] only** — data may be stale for up to the TTL. Good for "popular products" lists.
    2. **Delete on write** (shown above) + TTL as a safety net. The default for most apps.
    3. **Versioned keys** — \`product:42:v7\`; bump the version on change and old keys age out.
    4. **Event-driven invalidation** — services publish \`product.updated\` events; a consumer deletes keys. Needed when many services write the same data.

    > [!WARNING]
    > Delete, don't update, the cache on writes. Two concurrent writers updating the cache can leave it holding the older value, while deletes always converge.

    ## Eviction

    Redis has finite memory. Set \`maxmemory\` and a policy:
    - \`allkeys-lru\` — evict least recently used keys (great default for caches).
    - \`volatile-ttl\` — evict keys closest to expiry.
    - \`noeviction\` — return errors when full (for Redis used as a primary store, not a cache).

    ## Cache stampede (thundering herd)

    A hot key expires and 5,000 concurrent requests all miss and hit the database at once.

    **Fixes**
    - **Jitter**: \`TTL = 300 + random(0..60)\` so keys don't expire together.
    - **Request coalescing**: only one request rebuilds; others wait for it.
    - **Early refresh**: refresh in the background shortly before expiry.

    \`\`\`ts
    const inflight = new Map<string, Promise<unknown>>();
    function once<T>(key: string, fn: () => Promise<T>): Promise<T> {
      if (!inflight.has(key)) inflight.set(key, fn().finally(() => inflight.delete(key)));
      return inflight.get(key) as Promise<T>;
    }
    // usage: await once(\`product:\${id}\`, () => loadFromDbAndCache(id));
    \`\`\`

    ## What NOT to cache

    - Data where staleness causes harm: stock levels used for purchasing decisions, account balances, permissions right after a change.
    - Highly personalized data with a low hit rate — you pay memory for nothing.

    ## Metrics to watch

    Hit ratio (\`keyspace_hits / (hits + misses)\`), memory usage, evictions/sec, and p99 latency of Redis calls. A falling hit ratio after a deploy often means a key-format change.
  `,
};

export const rateLimiting: Article = {
  slug: 'rate-limiting-algorithms',
  title: 'Rate Limiting Algorithms: Fixed Window, Sliding Window and Token Bucket',
  summary: 'Protect APIs from abuse and overload. Compare the main algorithms and implement them with Redis and Express.',
  simple: 'Rate limiting is like a nightclub bouncer with a clicker: "only 100 people per hour". Different algorithms are just different ways of counting — per clock hour, over the last 60 minutes, or by handing out tokens that refill slowly.',
  category: 'security',
  tags: ['rate-limiting', 'redis', 'express', 'interview'],
  technologies: ['Redis', 'Express', 'Node.js'],
  patterns: ['Rate limiting'],
  difficulty: 'Intermediate',
  readingMinutes: 13,
  publishedAt: '2026-09-08',
  popularity: 1100,
  status: 'published',
  related: ['redis-caching', 'circuit-breakers'],
  body: md`
    ## Why rate limit?

    - Stop brute-force attacks on login.
    - Prevent one noisy client from starving everyone else.
    - Protect expensive endpoints and downstream dependencies.
    - Enforce pricing tiers ("1,000 requests/day on the free plan").

    When a client exceeds its limit, respond **\`429 Too Many Requests\`** with a \`Retry-After\` header.

    ## 1. Fixed window counter

    Count requests per key in the current window (e.g. per minute).

    \`\`\`ts
    async function fixedWindow(key: string, limit: number, windowSec: number) {
      const bucket = \`rl:\${key}:\${Math.floor(Date.now() / 1000 / windowSec)}\`;
      const count = await redis.incr(bucket);
      if (count === 1) await redis.expire(bucket, windowSec);
      return count <= limit;
    }
    \`\`\`

    **Simple and cheap.** Flaw: bursts at window edges — 100 requests at 12:00:59 plus 100 at 12:01:00 = 200 in two seconds.

    ## 2. Sliding window log

    Store a timestamp per request (Redis sorted set), remove those older than the window, count the rest. **Exact**, but memory grows with the limit.

    ## 3. Sliding window counter

    Approximate the sliding window by weighting the previous fixed window:

    \`estimated = current + previous × (1 − elapsedFractionOfCurrentWindow)\`

    Nearly as smooth as the log, with O(1) memory. A great default.

    ## 4. Token bucket

    A bucket holds up to **B** tokens and refills at **R** tokens/second. Each request takes one token; empty bucket → reject. Allows short **bursts** up to B while enforcing an average rate R. Used widely by API providers.

    \`\`\`diagram
    Refill R tokens/sec -> Bucket (max B) -> Request takes 1 token -> Empty? 429
    \`\`\`

    ## 5. Leaky bucket

    Requests enter a queue that drains at a constant rate. Smooths output perfectly — good for protecting a fragile downstream — but adds queueing delay.

    | Algorithm | Bursts | Memory | Accuracy | Typical use |
    |---|---|---|---|---|
    | Fixed window | Edge bursts | O(1) | Low | Simple quotas |
    | Sliding log | No | O(limit) | Exact | Low limits, security |
    | Sliding counter | Small | O(1) | High | General APIs |
    | Token bucket | Controlled | O(1) | High | Public APIs |
    | Leaky bucket | None (queued) | O(queue) | High | Smoothing to downstream |

    ## Distributed rate limiting

    With 10 API instances, in-memory counters give each client 10× the limit. Keep counters in **Redis** so all instances share them, and make check-and-increment **atomic** (a Lua script or \`MULTI\`), otherwise concurrent requests race past the limit.

    ## In Express

    \`\`\`ts
    import rateLimit from 'express-rate-limit';

    // Strict limit for login to slow down password guessing
    app.use('/api/v1/auth/login', rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false }));
    // General API limit
    app.use('/api/v1', rateLimit({ windowMs: 60_000, limit: 300 }));
    \`\`\`

    For multiple instances, plug in a Redis store (e.g. \`rate-limit-redis\`).

    > [!TIP]
    > Choose the key carefully: per user ID when authenticated, per IP otherwise. Behind a proxy, set \`app.set('trust proxy', 1)\` so Express sees the real client IP — and only trust proxies you control.
  `,
};

export const databaseIndexing: Article = {
  slug: 'database-indexing',
  title: 'Database Indexing: How Indexes Make Queries Fast (and Writes Slower)',
  summary: 'B-trees, compound indexes, the ESR rule, covered queries, and how to read an explain plan in MongoDB.',
  simple: 'Finding a word in a 1,000-page book without an index means reading every page. With the index at the back, you jump straight to page 412. A database index works the same way — but every time you add a page, the index must be updated too, so too many indexes slow down writing.',
  category: 'databases',
  tags: ['mongodb', 'interview'],
  technologies: ['MongoDB', 'PostgreSQL'],
  patterns: ['Indexing'],
  difficulty: 'Intermediate',
  readingMinutes: 13,
  publishedAt: '2026-09-15',
  popularity: 990,
  status: 'published',
  related: ['redis-caching', 'cap-theorem'],
  body: md`
    ## Without an index: the collection scan

    Query \`{ email: 'a@x.com' }\` on 10 million users with no index → the database reads **all 10 million documents** (COLLSCAN). With an [[index]] on \`email\` → a handful of page reads (IXSCAN).

    ## How it works: the B-tree

    Most indexes are B-trees: sorted, balanced trees where each node holds many keys. A lookup walks from the root to a leaf — about **log(n)** steps. For 10 million entries that's only 3–4 levels. Because keys are sorted, the same index also serves **range queries** and **sorting**.

    \`\`\`diagram
    Root [M] -> Branch [D | H] -> Leaf [E, F, G] -> Document pointer
    \`\`\`

    ## Compound indexes and order

    A compound index \`{ customerId: 1, createdAt: -1 }\` is sorted by customer, then by date within each customer. It supports:

    - \`find({ customerId })\` ✅ (prefix)
    - \`find({ customerId }).sort({ createdAt: -1 })\` ✅ (no in-memory sort)
    - \`find({ createdAt: { $gt: d } })\` ❌ (not a prefix — can't jump in)

    **The ESR rule** for ordering fields: **E**quality fields first, then **S**ort fields, then **R**ange fields.

    \`\`\`js
    // Query: status = 'PAID', newest first, total > 5000
    db.orders.createIndex({ status: 1, createdAt: -1, totalCents: 1 });
    \`\`\`

    ## Read the explain plan

    \`\`\`js
    db.orders.find({ status: 'PAID' }).sort({ createdAt: -1 }).explain('executionStats');
    \`\`\`

    Look for:
    - \`IXSCAN\` (good) vs \`COLLSCAN\` (bad on big collections).
    - \`totalDocsExamined\` close to \`nReturned\` → efficient.
    - A \`SORT\` stage → the index isn't providing the order.

    ## Covered queries

    If the query only filters and returns fields that are **in the index**, the database never reads the documents at all.

    \`\`\`js
    db.users.createIndex({ email: 1, name: 1 });
    db.users.find({ email: 'a@x.com' }, { _id: 0, email: 1, name: 1 }); // covered
    \`\`\`

    ## The cost of indexes

    > [!WARNING]
    > Every index must be updated on every insert, update and delete that touches its fields. Ten indexes can make writes several times slower and consume significant RAM.

    - Index the queries you actually run (check slow query logs / profiler).
    - Remove unused indexes (\`$indexStats\` in MongoDB, \`pg_stat_user_indexes\` in PostgreSQL).
    - Low-cardinality fields alone (e.g. a boolean) are rarely useful indexes.

    ## Special index types

    - **Unique** — enforce uniqueness (\`email\`, \`slug\`).
    - **TTL** (MongoDB) — auto-delete documents after a date.
    - **Partial / sparse** — index only documents matching a filter.
    - **Text** — keyword search (for serious search, use a search engine).
    - **Geospatial** — "drivers near me".

    ## In Mongoose

    \`\`\`ts
    const ArticleSchema = new Schema({ slug: { type: String, unique: true }, status: String, category: String, publishedAt: Date });
    ArticleSchema.index({ status: 1, category: 1, publishedAt: -1 }); // list published by category, newest first
    \`\`\`

    > [!TIP]
    > In production, disable \`autoIndex\` and create indexes deliberately during deploys — building a large index can be expensive.
  `,
};
