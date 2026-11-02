import type { SystemDesign } from '@sda/shared';
import { at, edge, md, node, sections } from '../helpers';

export const urlShortener: SystemDesign = {
  slug: 'url-shortener',
  title: 'URL Shortener',
  tagline: 'Turn long links into short codes and redirect billions of clicks quickly.',
  summary:
    'Design a service like a typical link shortener: create short codes, redirect with low latency, survive viral traffic spikes and collect click analytics without slowing redirects down.',
  category: 'web-infrastructure',
  difficulty: 'Beginner',
  readingMinutes: 25,
  technologies: ['Node.js', 'Express', 'MongoDB', 'Redis', 'Kafka', 'Nginx', 'CDN'],
  patterns: ['Caching', 'Read-heavy optimization', 'Asynchronous processing', 'Key generation'],
  tags: ['redis', 'mongodb', 'caching', 'interview', 'nodejs'],
  publishedAt: '2026-09-02',
  popularity: 980,
  status: 'published',
  analogy: {
    title: 'It works like a coat-check counter',
    story: md`
      You hand the attendant a big, bulky coat (the long URL). They hang it up and give you a tiny ticket with a number (the short code).
      Later, anyone holding that ticket can walk up, show the number, and get pointed to the exact coat.

      - **Creating a link** = handing over the coat and getting a ticket.
      - **Clicking a link** = showing the ticket and being sent to the coat.
      - **The cache** = the attendant remembering the most popular tickets so they don't walk to the back room every time.
      - **Analytics** = a clipboard where someone quietly tallies how often each ticket is shown — without making the line slower.

      That's the whole system. Everything else in this page is about making that counter fast, reliable and able to serve millions of people at once.
    `,
  },
  sections: sections({
    problem: {
      simple: 'People want to share long, ugly web addresses as short ones. We need to create short links and, when someone clicks one, send them to the original page almost instantly.',
      body: md`
        Long URLs are hard to share in messages, printed material and social posts. A URL shortener maps a long URL such as
        \`https://shop.example.com/products/shoes?color=red&utm_source=newsletter\` to a short one like \`https://sho.rt/aZ3kQ9x\`.

        The interesting engineering is not storing the mapping — it's that **redirects outnumber creations roughly 100 to 1**,
        a single link can go viral and receive millions of clicks in minutes, and every redirect must feel instant.

        > [!NOTE]
        > This is a hypothetical, educational design. It is not the verified internal architecture of any real company.
      `,
    },
    functional: {
      simple: 'What the system must DO: make a short link, redirect clicks, optionally let users pick a custom name or expiry date, and count clicks.',
      body: md`
        Functional requirements describe **behaviour** — what a user can do.

        1. **Shorten**: given a long URL, return a unique short code.
        2. **Redirect**: \`GET /{code}\` responds with an HTTP redirect to the original URL.
        3. **Custom alias** (optional): users may request \`sho.rt/summer-sale\` if it's free.
        4. **Expiry** (optional): a link can stop working after a date.
        5. **Analytics**: link owners can see click counts by day, country and referrer.
        6. **Manage**: owners can list and delete their links.

        Out of scope for this version: link previews, QR codes, team workspaces.
      `,
    },
    'non-functional': {
      simple: 'How WELL the system must work: redirects must be very fast, the service should almost never be down, and a short code must never point to the wrong page.',
      body: md`
        Non-functional requirements describe **qualities** — how well the system behaves.

        | Quality | Target | Why it matters |
        |---|---|---|
        | Redirect [[latency]] | p99 < 50 ms at the server | A redirect is an extra hop before the real page loads |
        | [[availability|Availability]] | 99.99% for redirects | Broken links on printed flyers can't be fixed |
        | Durability | A created link is never lost | Users share links permanently |
        | Correctness | A code never maps to two URLs | Wrong redirects are a security problem |
        | Scalability | Handle 10× spikes from viral links | Traffic is very uneven |

        Notice the asymmetry: **redirects need higher availability than creation**. If creation is briefly down users can retry; if redirects are down every link on the internet pointing to us breaks.
      `,
    },
    assumptions: {
      simple: 'Before doing math we write down our guesses, like "100 million new links per month". Being clear about guesses is more important than the exact numbers.',
      body: md`
        > [!ASSUMPTION]
        > All numbers below are **illustrative estimates** for an interview-style exercise, not measurements.

        - 100 million new links per month.
        - Read:write ratio of **100:1** → ~10 billion redirects per month.
        - Links are kept for 5 years by default.
        - Average long URL is ~200 bytes; a stored record with metadata is ~500 bytes.
        - Short codes use [[base62|Base62]] characters (\`0-9a-zA-Z\`).
        - Traffic follows a power law: ~20% of links get ~80% of clicks.

        **Constraints**: codes must be short (≤ 7 chars), unguessable enough to prevent enumeration of private links, and redirects must not depend on the analytics pipeline being healthy.
      `,
    },
    capacity: {
      simple: 'We do quick math to see how big the system must be. Result: lots of reads (about 4,000 clicks per second on average), few writes, and only a few terabytes of storage — so speeding up reads is the main job.',
      body: md`
        > [!ASSUMPTION]
        > Back-of-the-envelope math. Round aggressively; the goal is the order of magnitude.

        **Writes**: 100M / month ÷ (30 × 86,400 s) ≈ **40 creations/s** (peak ~200/s).

        **Reads**: 40 × 100 ≈ **4,000 redirects/s** average, ~20,000/s at peak.

        **Storage**: 100M × 12 months × 5 years = 6 billion links × 500 B ≈ **3 TB**. Comfortable for a sharded database.

        **Code length**: 62⁷ ≈ 3.5 trillion combinations ≫ 6 billion → **7 characters** is plenty.

        **Cache**: if 20% of daily-active links serve 80% of traffic, caching ~20M hot links × 500 B ≈ **10 GB** of Redis — fits in memory on a small cluster.

        **Bandwidth**: 20,000 redirects/s × ~500 B response ≈ 10 MB/s. Not a concern.

        **Conclusion**: this is a **read-heavy, latency-sensitive** system with modest storage. Design priorities: caching, horizontal scaling of stateless redirect servers, and keeping slow work off the redirect path.
      `,
    },
    'high-level': {
      simple: 'Clicks go through a traffic spreader to many identical small servers. Those servers first check a fast memory (Redis); only if the link isn\'t there do they ask the database. Click counting happens separately in the background.',
      body: md`
        The system splits into two paths with very different needs:

        - **Write path** (create link): API → ID generator → database. Low volume, must be correct.
        - **Read path** (redirect): load balancer → stateless redirect service → Redis → database on miss. High volume, must be fast.
        - **Analytics path**: redirect service publishes a click event to a [[queue|message queue]] and returns immediately; workers aggregate clicks later.

        Why separate paths? Because they scale differently. We may run 3 creation instances and 30 redirect instances. And the analytics pipeline can fall behind for an hour without a single user noticing — that's the point of making it [[async|asynchronous]].
      `,
    },
    diagram: {
      simple: 'Click any box to learn what it does. Press Play to watch a request travel through the system step by step.',
      body: md`
        The interactive diagram below is a **hypothetical architecture** for this design. Use the flow selector to compare a cache hit, a cache miss and link creation.
      `,
    },
    components: {
      simple: 'Each box has one job: the load balancer spreads traffic, the Node.js service handles requests, Redis remembers popular links, MongoDB stores every link permanently, and the queue plus worker count clicks in the background.',
      body: md`
        | Component | Responsibility | Why this choice |
        |---|---|---|
        | DNS + CDN | Resolve \`sho.rt\`, terminate TLS near users, optionally cache 301s | Cuts latency for global users |
        | Load balancer | Distribute requests, health-check instances | Lets us add/remove servers freely |
        | Link service (Node.js) | Validate input, create codes, perform redirects | Node handles many concurrent I/O-bound requests efficiently |
        | Key generation | Hand out unique IDs in batches | Avoids collisions without a database round trip per link |
        | Redis | Cache \`code → url\` for hot links | Sub-millisecond reads; hot set fits in memory |
        | MongoDB | Durable store of all links | Simple key lookups, easy sharding on \`code\` |
        | Kafka | Buffer click events | Redirects never wait for analytics |
        | Analytics worker + store | Aggregate clicks per link/day/country | Columnar store is efficient for counting |
        | Monitoring | Metrics, logs, traces, alerts | You can't fix what you can't see |
      `,
    },
    api: {
      simple: 'The API is a small menu: one request to create a link, one to visit a link, one to see its stats and one to delete it.',
      body: md`
        Versioned REST API under \`/api/v1\`. Redirects live at the root (\`/{code}\`) because short URLs must stay short.

        **Why 302 and not 301?** A \`301 Moved Permanently\` is cached by browsers forever, which is faster but means we never see repeat clicks (breaking analytics) and can't change or expire the link. We default to \`302 Found\`, and offer 301 as an opt-in for users who don't need analytics.
      `,
    },
    database: {
      simple: 'We store each link as one record: the short code, the original address, who made it and when it expires. The short code is the "key" we look up by, so we index it.',
      body: md`
        The access pattern is almost entirely **"get URL by code"** — a key-value lookup. A document store like MongoDB (or a wide-column store like Cassandra) fits well. We don't need joins.

        \`\`\`ts
        // models/Link.ts (Mongoose)
        const LinkSchema = new Schema({
          code:      { type: String, required: true, unique: true },   // shard key
          longUrl:   { type: String, required: true, maxlength: 2048 },
          ownerId:   { type: Schema.Types.ObjectId, ref: 'User', index: true },
          expiresAt: { type: Date },
          redirectType: { type: Number, enum: [301, 302], default: 302 },
        }, { timestamps: true });

        // Let MongoDB delete expired links automatically
        LinkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
        \`\`\`

        **Indexes**
        - \`code\` (unique) — every redirect uses it.
        - \`ownerId + createdAt\` — "list my links" dashboard.
        - \`expiresAt\` TTL index — automatic clean-up.

        **Sharding**: hash-shard on \`code\`. Codes are random, so data and traffic spread evenly and every lookup goes to exactly one shard.

        **Analytics data** lives in a separate store (e.g. ClickHouse) as \`(code, day, country, referrer, clicks)\` rows — it's write-heavy and aggregated, a completely different pattern from the link table.
      `,
    },
    lifecycle: {
      simple: 'When you click a short link: your browser finds our server, the server checks Redis, (if needed) asks the database, sends you a "go here instead" reply, and drops a note in the queue so the click gets counted later.',
      body: md`
        **Redirect, step by step**

        1. Browser resolves \`sho.rt\` via [[dns|DNS]] → nearest edge/CDN.
        2. TLS terminates at the edge; request forwarded to the [[load-balancer|load balancer]].
        3. LB picks a healthy link-service instance (round robin / least connections).
        4. Service validates the code format (\`/^[0-9a-zA-Z]{4,16}$/\`) — reject junk before touching storage.
        5. \`GET link:{code}\` from Redis.
           - **Hit** → go to step 7.
           - **Miss** → query MongoDB by \`code\`; if found, write to Redis with a [[ttl|TTL]]; if not found, cache a short "not found" marker to protect the DB from repeated bad lookups.
        6. Check expiry. Expired → \`410 Gone\`.
        7. Publish \`{code, ts, ip-country, referrer, ua}\` to Kafka **without awaiting** the acknowledgement on the response path.
        8. Respond \`302 Location: <longUrl>\`.

        \`\`\`ts
        // routes/redirect.ts
        router.get('/:code', async (req, res, next) => {
          try {
            const link = await linkService.resolve(req.params.code); // cache-aside lookup
            if (!link) return res.status(404).send('Link not found');
            if (link.expiresAt && link.expiresAt < new Date()) return res.status(410).send('Link expired');

            clickEvents.publish({ code: link.code, ts: Date.now(), referrer: req.get('referer') })
              .catch((err) => req.log.warn({ err }, 'click event dropped')); // never block the redirect

            res.redirect(link.redirectType, link.longUrl);
          } catch (err) { next(err); }
        });
        \`\`\`
      `,
    },
    sequence: {
      simple: 'These pictures show the same journeys as a timeline: who talks to whom, in what order.',
      body: md`Each sequence below is generated from the same flow data that drives the interactive diagram, so the two views always agree.`,
    },
    caching: {
      simple: 'Popular links are kept in Redis (fast memory). We check there first. If it\'s not there, we read from the database and save a copy in Redis for next time.',
      body: md`
        **Pattern: cache-aside (lazy loading).** The application reads the [[cache]] first and fills it on a miss.

        \`\`\`ts
        async function resolve(code: string) {
          const cached = await redis.get(\`link:\${code}\`);
          if (cached === 'NULL') return null;           // negative cache
          if (cached) return JSON.parse(cached);

          const link = await Link.findOne({ code }).lean();
          await redis.set(\`link:\${code}\`, link ? JSON.stringify(link) : 'NULL', 'EX', link ? 86_400 : 60);
          return link;
        }
        \`\`\`

        **Why it works so well here**: links almost never change after creation, so staleness is rare.

        **Invalidation**: on delete or update we \`DEL link:{code}\`. Because the TTL is 24 h, even a missed invalidation self-heals within a day. For deleted malicious links, we also push the code to a small blocklist checked before the cache.

        **Eviction**: Redis \`maxmemory-policy allkeys-lru\` — least recently used links fall out, popular ones stay.

        **Hot key / thundering herd**: when a viral link expires from cache, thousands of requests could miss at once. Mitigations: request coalescing (one in-flight DB read per code per instance) and adding small random jitter to TTLs.
      `,
    },
    scaling: {
      simple: 'The Node.js servers remember nothing between requests, so we can run as many copies as we need. When traffic grows we just add more copies behind the load balancer.',
      body: md`
        - **Stateless service** → [[horizontal-scaling|horizontal scaling]] with an autoscaler on CPU and request rate.
        - **Separate deployments** for redirect and management traffic, so a bug in the dashboard can't hurt redirects.
        - **Redis Cluster** with replicas; reads can go to replicas.
        - **MongoDB sharded** on hashed \`code\`, each shard a 3-node replica set.
        - **Edge caching**: for 301 links (and optionally short-TTL 302s), the CDN serves the redirect without reaching origin at all.

        **Generating unique codes at scale** is the classic sub-problem:

        | Approach | How | Trade-off |
        |---|---|---|
        | Hash long URL (MD5 → first 7 chars) | Deterministic | Collisions need retry loops; same URL → same code |
        | Random 7 chars + uniqueness check | Simple | Extra DB read per write; rises as the space fills |
        | **Counter + Base62** (chosen) | Each instance leases a block of 10,000 IDs from a counter (Redis \`INCRBY\` or a DB) and encodes them | No collisions, no per-write coordination; codes are sequential, so we shuffle bits/encrypt the ID to avoid guessable codes |
      `,
    },
    async: {
      simple: 'Counting clicks is slow-ish work, so the server just drops a note ("someone clicked aZ3kQ9x") into a queue and moves on. A background worker reads the notes and updates the totals.',
      body: md`
        Click analytics is the perfect [[async]] workload: high volume, tolerant of delay, and not needed to answer the user.

        - Redirect service → Kafka topic \`clicks\` (partitioned by \`code\`).
        - Analytics workers consume in batches of ~1,000 events, aggregate in memory, and bulk-insert into the analytics store every few seconds.
        - If workers fall behind, Kafka retains events (e.g. 7 days) — we catch up later. **No user-visible impact.**
        - At-least-once delivery means a click might be counted twice after a worker crash. For analytics that's acceptable; for billing it would not be.

        If Kafka itself is unavailable, the producer buffers in memory briefly and then drops events with a metric — we deliberately choose **availability of redirects over completeness of analytics**.
      `,
    },
    security: {
      simple: 'We stop people from creating harmful links, from guessing private links, and from flooding us with requests. Creating links requires logging in; clicking does not.',
      body: md`
        - **Authentication**: creating/managing links uses short-lived [[jwt|JWT]] access tokens + refresh tokens; redirects are public.
        - **[[rate-limiting|Rate limiting]]**: e.g. 50 creations/hour per user and 10/hour per anonymous IP, enforced with a Redis sliding window at the gateway.
        - **Malicious URLs**: check new URLs against a safe-browsing/blocklist service; scan asynchronously and disable flagged links.
        - **Open-redirect abuse**: only allow \`http(s)\` schemes; reject \`javascript:\` and \`data:\` URLs.
        - **Enumeration**: non-sequential codes so attackers can't walk through every link.
        - **Input validation** with Zod at the API boundary; length limits on URLs and aliases.
      `,
    },
    failures: {
      simple: 'We plan for things breaking. If Redis dies we read from the database (slower, still works). If the click queue dies we skip counting for a while. Redirects keep working either way.',
      body: md`
        | Failure | Impact | Recovery |
        |---|---|---|
        | One service instance crashes | LB health check removes it within seconds | Autoscaler replaces it |
        | Redis node down | More cache misses → more DB load | Replica promoted; DB sized to survive a cold cache for short periods; circuit-break Redis calls with a timeout |
        | MongoDB primary down | Writes fail ~10 s during election; cached redirects still work | Replica set elects new primary automatically |
        | Kafka unavailable | Click events dropped/buffered | Redirects unaffected by design; alert on drop rate |
        | Bad deploy | Errors spike | Canary + automatic rollback on error-rate SLO |
        | Region outage | Users in region affected | Multi-region active-passive for reads; DNS failover |

        **Key principle**: every dependency on the redirect path has a **timeout** (e.g. Redis 20 ms, Mongo 200 ms). A slow dependency is worse than a dead one because it ties up connections.
      `,
    },
    observability: {
      simple: 'We keep an eye on the system with numbers (how many redirects, how fast), logs (what happened) and traces (the path of one request). Alarms wake someone up when things go wrong.',
      body: md`
        **Metrics** (Prometheus): redirect RPS, p50/p95/[[p99]] latency, cache hit ratio (target > 95%), DB query latency, 404/410 rates, Kafka consumer lag.

        **Logs** (structured JSON with pino): one line per request with \`requestId\`, \`code\`, \`status\`, \`durationMs\`, \`cache: hit|miss\`. Never log full URLs with query strings if they could contain personal data.

        **Traces** (OpenTelemetry): spans for \`redis.get\`, \`mongo.findOne\`, \`kafka.publish\` — instantly shows whether a slow redirect was cache or DB.

        **Alerts (SLO-based)**: page when the 5-minute redirect error rate > 0.1% or p99 > 100 ms; ticket when consumer lag > 10 minutes.
      `,
    },
    deployment: {
      simple: 'Everything runs in containers. New versions roll out gradually to a few servers first, and roll back automatically if errors go up.',
      body: md`
        - Docker images built in CI; deployed to Kubernetes (or ECS) across **3 availability zones**.
        - Separate deployments: \`link-redirect\` (many replicas) and \`link-api\` (few replicas).
        - Managed Redis and MongoDB (or self-hosted operators) with backups and point-in-time recovery.
        - **Canary releases**: 5% of traffic → watch error rate and latency for 10 minutes → 100%.
        - Config and secrets via environment variables from a secret manager — never baked into images.
      `,
    },
    tradeoffs: {
      simple: 'Every choice has a cost. For example, using a 302 redirect lets us count every click but is a bit slower than a 301. We write these choices down and explain them.',
      body: md`
        **Bottlenecks**: hot keys on a single Redis shard (mitigate with local in-process LRU caches of ~10k entries), and the ID counter (mitigated by block leasing).

        **Trade-offs we made**
        - **302 vs 301**: analytics + editability over raw speed.
        - **Eventual analytics**: counts may lag by seconds to minutes — fine for dashboards.
        - **NoSQL over SQL**: we gave up joins and multi-row transactions, which we don't need here.

        **Alternatives**
        - *PostgreSQL* is completely viable up to billions of rows with proper indexing and partitioning; pick it if your team knows it best.
        - *DynamoDB/Cassandra* for fully managed, massive write scaling.
        - *Serverless edge functions* with a global KV store can do the redirect entirely at the edge.
      `,
    },
    interview: {
      simple: 'Practice questions interviewers commonly ask about this design, with short model answers.',
      body: md`Try answering out loud before expanding each answer.`,
    },
    summary: {
      simple: 'A URL shortener is a giant, fast lookup table. Make reads fast with caching, keep servers stateless so you can add more, and do click counting in the background.',
      body: md`
        **Key takeaways**
        1. Identify the read:write ratio first — it drives the whole design.
        2. Cache-aside with Redis makes redirects fast; negative caching protects the database.
        3. Counter + Base62 with leased blocks generates unique codes without coordination per request.
        4. Keep analytics asynchronous so it can never slow down or break redirects.
        5. Every dependency on the hot path needs a timeout and a fallback.
      `,
    },
  }),
  diagram: {
    title: 'URL shortener — hypothetical architecture',
    hypothetical: true,
    nodes: [
      node('client', 'client', 'Browser / App', 'Clicks or creates short links', 'The person clicking the link, using their browser or phone.', at(0, 2), {
        responsibility: 'Sends HTTP requests and follows redirects.',
        inputs: ['User clicks', 'User submits long URL'],
        outputs: ['GET /{code}', 'POST /api/v1/links'],
        technologies: ['Any browser', 'Mobile app'],
        failureModes: ['Slow mobile network', 'Retries on timeout may create duplicate links (use idempotency keys)'],
      }),
      node('dns', 'dns', 'DNS', 'Resolves sho.rt', 'Turns the name "sho.rt" into the address of our nearest server.', at(1, 0.5), {
        responsibility: 'Maps the domain to edge/load balancer IPs; supports geo-routing and failover.',
        inputs: ['Domain lookup'],
        outputs: ['IP address of nearest edge'],
        technologies: ['Route 53', 'Cloudflare DNS'],
        failureModes: ['DNS provider outage (use two providers)', 'High TTL slows failover'],
      }),
      node('cdn', 'cdn', 'CDN / Edge', 'TLS + cached 301s', 'Servers close to the user that answer quickly and block bad traffic.', at(1, 2), {
        responsibility: 'Terminates TLS near users, absorbs DDoS, can cache permanent redirects.',
        inputs: ['HTTPS requests'],
        outputs: ['Cached redirects', 'Forwarded requests to origin'],
        technologies: ['Cloudflare', 'CloudFront', 'Fastly'],
        failureModes: ['Stale cached redirect after link deletion — purge via API'],
      }),
      node('lb', 'loadBalancer', 'Load Balancer', 'Spreads traffic', 'A traffic officer sending each request to a server that is free and healthy.', at(2, 2), {
        responsibility: 'Distributes requests across healthy instances using health checks.',
        inputs: ['Requests from edge'],
        outputs: ['Requests to link-service instances'],
        technologies: ['Nginx', 'AWS ALB', 'HAProxy'],
        failureModes: ['LB itself must be redundant (managed LBs are multi-AZ)', 'Misconfigured health checks remove all instances'],
      }),
      node('api', 'service', 'Link Service', 'Node.js + Express', 'The program that creates links and sends people to the right page.', at(3, 2), {
        responsibility: 'Validates input, creates codes, resolves codes via cache-aside, publishes click events.',
        inputs: ['HTTP requests'],
        outputs: ['302 redirects', 'JSON responses', 'Click events'],
        technologies: ['Node.js', 'Express', 'Zod', 'pino'],
        failureModes: ['Event-loop blocking from CPU work', 'Memory leaks', 'Exhausted DB connection pool'],
      }),
      node('keygen', 'service', 'Key Generator', 'Leases ID blocks', 'Hands out unique numbers so two links never get the same code.', at(4, 0.5), {
        responsibility: 'Provides ranges of unique integers that services encode as Base62 codes.',
        inputs: ['Lease request (e.g. 10,000 IDs)'],
        outputs: ['ID range [start, end)'],
        technologies: ['Redis INCRBY', 'Database sequence'],
        failureModes: ['If down, existing leases keep working; new leases fail', 'Lost leases waste IDs (acceptable)'],
      }),
      node('redis', 'cache', 'Redis Cache', 'code → longUrl', 'Super-fast memory that remembers popular links.', at(4, 2), {
        responsibility: 'Serves hot link lookups in under a millisecond.',
        inputs: ['GET/SET link:{code}'],
        outputs: ['Cached link or miss'],
        technologies: ['Redis Cluster', 'LRU eviction'],
        failureModes: ['Node loss → miss storm on DB', 'Hot key overload on one shard'],
      }),
      node('db', 'database', 'MongoDB', 'Sharded by code', 'The permanent filing cabinet that stores every link ever made.', at(5, 2), {
        responsibility: 'Durable source of truth for all links.',
        inputs: ['findOne({code})', 'insertOne(link)'],
        outputs: ['Link documents'],
        technologies: ['MongoDB replica sets', 'Hashed sharding'],
        failureModes: ['Primary election (~10 s write unavailability)', 'Slow queries without index'],
      }),
      node('kafka', 'queue', 'Kafka', 'clicks topic', 'A to-do list of clicks waiting to be counted.', at(4, 3.5), {
        responsibility: 'Buffers click events durably so analytics never slows redirects.',
        inputs: ['Click events'],
        outputs: ['Batches to analytics workers'],
        technologies: ['Kafka', 'Amazon Kinesis', 'Redpanda'],
        failureModes: ['Broker down → events buffered/dropped', 'Consumer lag grows'],
      }),
      node('worker', 'worker', 'Analytics Worker', 'Aggregates clicks', 'A background helper that adds up clicks and saves totals.', at(5, 3.5), {
        responsibility: 'Consumes click events, aggregates counts, writes to analytics store.',
        inputs: ['Click events'],
        outputs: ['Aggregated rows'],
        technologies: ['Node.js consumer', 'ClickHouse'],
        failureModes: ['Crash mid-batch → at-least-once duplicates', 'Poison message blocks partition (use DLQ)'],
      }),
      node('monitor', 'monitoring', 'Monitoring', 'Metrics, logs, traces', 'Dashboards and alarms that tell engineers when something is wrong.', at(3, 0.5), {
        responsibility: 'Collects telemetry and alerts on SLO violations.',
        inputs: ['Metrics', 'Logs', 'Traces'],
        outputs: ['Dashboards', 'Pages/alerts'],
        technologies: ['Prometheus', 'Grafana', 'OpenTelemetry', 'Loki'],
        failureModes: ['Alert fatigue', 'Monitoring outage hides incidents'],
      }),
    ],
    edges: [
      edge('client', 'dns', 'lookup'),
      edge('client', 'cdn', 'HTTPS'),
      edge('cdn', 'lb'),
      edge('lb', 'api'),
      edge('api', 'keygen', 'lease IDs'),
      edge('api', 'redis', 'GET/SET'),
      edge('api', 'db', 'on miss / insert'),
      edge('api', 'kafka', 'click event', true),
      edge('kafka', 'worker', 'consume', true),
      edge('api', 'monitor', 'telemetry', true),
    ],
    flows: [
      {
        id: 'redirect-hit',
        name: 'Redirect — cache hit',
        description: 'A popular link is found in Redis; the database is never touched.',
        steps: [
          { from: 'client', to: 'dns', title: 'Find the server', explanation: 'The browser resolves sho.rt to the nearest edge IP. Usually answered from the OS or resolver cache.', simple: 'The browser looks up where sho.rt lives.', request: 'DNS A? sho.rt', response: 'sho.rt. 60 IN A 203.0.113.10' },
          { from: 'client', to: 'cdn', title: 'Request the short link', explanation: 'An HTTPS GET for the code arrives at the edge, which terminates TLS.', simple: 'The browser asks for the short link.', request: 'GET /aZ3kQ9x HTTP/2\nHost: sho.rt' },
          { from: 'cdn', to: 'lb', title: 'Forward to origin', explanation: 'The 302 is not cached at the edge, so the request is forwarded to our load balancer.', simple: 'The edge passes the request to our data center.' },
          { from: 'lb', to: 'api', title: 'Pick a healthy server', explanation: 'The load balancer chooses an instance using least-connections among instances passing health checks.', simple: 'The traffic officer sends it to a free server.', log: 'lb upstream=link-svc-7 status=selected' },
          { from: 'api', to: 'redis', title: 'Check the cache', explanation: 'GET link:aZ3kQ9x returns the cached record in ~0.3 ms.', simple: 'The server checks its fast memory — and finds the link!', request: 'GET link:aZ3kQ9x', response: '{"longUrl":"https://shop.example.com/products/shoes?color=red","redirectType":302}', log: '{"level":"info","code":"aZ3kQ9x","cache":"hit","ms":0.3}' },
          { from: 'api', to: 'kafka', title: 'Record the click (async)', explanation: 'A click event is published without waiting, so analytics can never slow the redirect.', simple: 'It drops a note: “someone clicked this”, without waiting.', request: '{"code":"aZ3kQ9x","ts":1767225600000,"country":"IN"}' },
          { from: 'api', to: 'client', title: 'Send the redirect', explanation: 'The service replies with 302 and the Location header. Total server time ≈ 2 ms.', simple: 'The browser is told: “go to this real address”.', response: 'HTTP/2 302\nLocation: https://shop.example.com/products/shoes?color=red\nCache-Control: private, max-age=0', log: '{"level":"info","method":"GET","path":"/aZ3kQ9x","status":302,"durationMs":2.1}' },
        ],
      },
      {
        id: 'redirect-miss',
        name: 'Redirect — cache miss',
        description: 'A rarely used link is not cached, so the database is queried and the cache is filled.',
        steps: [
          { from: 'client', to: 'cdn', title: 'Request the short link', explanation: 'HTTPS GET arrives at the edge.', simple: 'The browser asks for the short link.', request: 'GET /Qm81xYz HTTP/2\nHost: sho.rt' },
          { from: 'cdn', to: 'lb', title: 'Forward to origin', explanation: 'Edge forwards to the load balancer.', simple: 'The request travels to our data center.' },
          { from: 'lb', to: 'api', title: 'Pick a healthy server', explanation: 'Load balancer selects an instance.', simple: 'A free server is chosen.' },
          { from: 'api', to: 'redis', title: 'Check the cache — miss', explanation: 'The key is not in Redis (never cached, or evicted by LRU).', simple: 'Fast memory doesn\'t have it.', request: 'GET link:Qm81xYz', response: '(nil)', log: '{"level":"info","code":"Qm81xYz","cache":"miss"}' },
          { from: 'api', to: 'db', title: 'Query the database', explanation: 'findOne({ code }) uses the unique index on code, hitting exactly one shard. ~5 ms.', simple: 'The server checks the permanent filing cabinet.', request: 'db.links.findOne({ code: "Qm81xYz" })', response: '{ code: "Qm81xYz", longUrl: "https://blog.example.com/a-long-article", redirectType: 302 }', log: '{"level":"debug","op":"mongo.findOne","ms":5.2}' },
          { from: 'api', to: 'redis', title: 'Fill the cache', explanation: 'Store the result with a 24 h TTL (plus jitter) so the next request is a hit.', simple: 'It saves a copy in fast memory for next time.', request: 'SET link:Qm81xYz "{...}" EX 86400' },
          { from: 'api', to: 'kafka', title: 'Record the click (async)', explanation: 'Fire-and-forget click event.', simple: 'Drops a “clicked” note.' },
          { from: 'api', to: 'client', title: 'Send the redirect', explanation: '302 with Location. Total ≈ 8 ms — slower than a hit, still fast.', simple: 'The browser is sent to the real page.', response: 'HTTP/2 302\nLocation: https://blog.example.com/a-long-article', log: '{"level":"info","path":"/Qm81xYz","status":302,"durationMs":8.4,"cache":"miss"}' },
        ],
      },
      {
        id: 'create',
        name: 'Create a short link',
        description: 'An authenticated user shortens a long URL.',
        steps: [
          { from: 'client', to: 'cdn', title: 'Submit the long URL', explanation: 'POST with a JSON body and a bearer token; includes an Idempotency-Key so retries don\'t create duplicates.', simple: 'The user asks us to shorten a link.', request: 'POST /api/v1/links\nAuthorization: Bearer eyJ...\nIdempotency-Key: 7f1c...\n\n{"longUrl":"https://shop.example.com/products/shoes?color=red"}' },
          { from: 'cdn', to: 'lb', title: 'Forward', explanation: 'API traffic is never cached at the edge.', simple: 'The request travels to us.' },
          { from: 'lb', to: 'api', title: 'Route to the API', explanation: 'The LB routes /api/* to the management deployment.', simple: 'It reaches a server.' },
          { from: 'api', to: 'keygen', title: 'Get a unique ID', explanation: 'The instance usually has IDs left in its leased block, so this is often an in-memory operation; when exhausted it leases 10,000 more.', simple: 'We grab a unique number so no two links clash.', request: 'INCRBY idgen:links 10000', response: '(integer) 125830000', log: '{"level":"info","msg":"leased id block","start":125820000}' },
          { from: 'api', to: 'db', title: 'Save the link', explanation: 'The ID is scrambled and Base62-encoded into a 7-character code, then inserted. The unique index guarantees correctness even if something goes wrong.', simple: 'We turn the number into a short code and save it permanently.', request: 'db.links.insertOne({ code: "aZ3kQ9x", longUrl: "...", ownerId: "u_42" })', response: '{ acknowledged: true }' },
          { from: 'api', to: 'client', title: 'Return the short URL', explanation: '201 Created with the new resource. Caching is skipped: new links are rarely hit immediately and cache-aside will fill it on first click.', simple: 'The user gets their short link.', response: 'HTTP/2 201\n{"code":"aZ3kQ9x","shortUrl":"https://sho.rt/aZ3kQ9x","longUrl":"https://shop.example.com/..."}', log: '{"level":"info","method":"POST","path":"/api/v1/links","status":201,"durationMs":14}' },
        ],
      },
    ],
  },
  apis: [
    {
      method: 'POST',
      path: '/api/v1/links',
      summary: 'Create a short link',
      auth: 'Bearer token; Idempotency-Key header recommended',
      request: '{\n  "longUrl": "https://shop.example.com/products/shoes?color=red",\n  "customAlias": "red-shoes",\n  "expiresAt": "2027-01-01T00:00:00Z"\n}',
      response: 'HTTP 201 Created\n{\n  "code": "red-shoes",\n  "shortUrl": "https://sho.rt/red-shoes",\n  "longUrl": "https://shop.example.com/products/shoes?color=red",\n  "expiresAt": "2027-01-01T00:00:00Z",\n  "createdAt": "2026-09-02T10:00:00Z"\n}',
      errors: [
        { status: 400, code: 'VALIDATION_ERROR', when: 'URL is malformed, not http(s), or too long' },
        { status: 401, code: 'UNAUTHENTICATED', when: 'Missing or expired token' },
        { status: 409, code: 'ALIAS_TAKEN', when: 'Custom alias already exists' },
        { status: 422, code: 'URL_BLOCKED', when: 'URL is on a malware/phishing blocklist' },
        { status: 429, code: 'RATE_LIMITED', when: 'Too many links created; see Retry-After header' },
      ],
    },
    {
      method: 'GET',
      path: '/{code}',
      summary: 'Redirect to the long URL',
      auth: 'Public',
      response: 'HTTP 302 Found\nLocation: https://shop.example.com/products/shoes?color=red',
      errors: [
        { status: 404, code: 'NOT_FOUND', when: 'Code does not exist' },
        { status: 410, code: 'GONE', when: 'Link expired or was disabled' },
      ],
    },
    {
      method: 'GET',
      path: '/api/v1/links/{code}/stats?from=2026-09-01&to=2026-09-30',
      summary: 'Get click analytics for a link',
      auth: 'Bearer token (owner only)',
      response: '{\n  "code": "red-shoes",\n  "totalClicks": 18234,\n  "byDay": [{ "date": "2026-09-01", "clicks": 512 }],\n  "topCountries": [{ "country": "IN", "clicks": 9100 }],\n  "dataFreshnessSeconds": 45\n}',
      errors: [
        { status: 403, code: 'FORBIDDEN', when: 'Caller does not own the link' },
        { status: 404, code: 'NOT_FOUND', when: 'Code does not exist' },
      ],
    },
    {
      method: 'DELETE',
      path: '/api/v1/links/{code}',
      summary: 'Delete a link (and invalidate caches)',
      auth: 'Bearer token (owner only)',
      response: 'HTTP 204 No Content',
      errors: [
        { status: 403, code: 'FORBIDDEN', when: 'Caller does not own the link' },
        { status: 404, code: 'NOT_FOUND', when: 'Code does not exist' },
      ],
    },
  ],
  interviewQuestions: [
    { question: 'How do you generate unique short codes without collisions?', answer: 'Use a distributed counter where each instance leases a block of IDs (e.g. 10,000 at a time), then Base62-encode. Scramble the ID (e.g. with a reversible permutation) so codes are not sequential. A unique index on code is the final safety net.' },
    { question: 'Why use a 302 instead of a 301 redirect?', answer: 'Browsers cache 301s permanently, so we lose repeat-click analytics and can never change or expire the link. 302 keeps control on the server at the cost of one extra round trip per click.' },
    { question: 'What happens if Redis goes down?', answer: 'Requests fall through to MongoDB. The database must be provisioned to survive the miss storm briefly, Redis calls need tight timeouts, and the cluster should promote a replica. Local in-process caches can soften the blow.' },
    { question: 'How would you handle a link that suddenly gets 1 million clicks per minute?', answer: 'It will be a cache hit almost always; the risk is a hot Redis shard. Add a small in-process LRU cache per instance, replicate the hot key, and serve permanent redirects from the CDN where allowed.' },
    { question: 'How do you prevent abuse such as phishing links?', answer: 'Rate limit creation, require auth for higher limits, check URLs against blocklists at creation and asynchronously re-scan, allow only http(s) schemes, and provide a fast takedown path that also purges caches.' },
  ],
  related: ['messaging-system', 'ecommerce-orders'],
};
