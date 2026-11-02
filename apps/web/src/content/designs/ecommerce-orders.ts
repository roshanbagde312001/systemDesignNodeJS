import type { SystemDesign } from '../../shared';
import { at, edge, md, node, sections } from '../helpers';

export const ecommerceOrders: SystemDesign = {
  slug: 'ecommerce-orders',
  title: 'E-commerce Order Management',
  tagline: 'Take orders, reserve stock and charge customers exactly once — even when things fail halfway.',
  summary:
    'Design the order pipeline of an online store: cart to checkout, inventory reservation, payment with idempotency, the saga pattern for multi-step workflows, and event-driven fulfilment.',
  category: 'e-commerce',
  difficulty: 'Advanced',
  readingMinutes: 35,
  technologies: ['Node.js', 'Express', 'MongoDB', 'Redis', 'Kafka', 'Stripe-like PSP', 'Nginx'],
  patterns: ['Saga', 'Idempotency', 'Event-driven architecture', 'Microservices', 'Transactional outbox'],
  tags: ['saga', 'idempotency', 'microservices', 'kafka', 'interview'],
  publishedAt: '2026-10-06',
  popularity: 870,
  status: 'published',
  analogy: {
    title: 'It works like a restaurant taking a big catering order',
    story: md`
      You call a restaurant to order food for a party.

      1. The host **writes your order on a ticket** and gives it a number (order created, status *pending*).
      2. The kitchen **checks the pantry and sets the ingredients aside** so nobody else uses them (inventory reserved).
      3. The cashier **charges your card** (payment). If you call back because the line dropped, the cashier sees the same ticket number and **doesn't charge you twice** (idempotency).
      4. If the card is declined, the kitchen **puts the ingredients back** and the ticket is marked cancelled (saga compensation — the "undo" step).
      5. Once paid, the ticket is pinned on the board and the **delivery team, the receipt printer and the loyalty desk each read it** and do their own jobs (events to downstream services).

      Every step can fail, so every step has a clear way to undo itself. That's the heart of order management.
    `,
  },
  sections: sections({
    problem: {
      simple: 'When someone buys something online, several things must all happen together: save the order, hold the items, take the money. If one fails, the others must be undone. We must never charge twice or sell more than we have.',
      body: md`
        Placing an order touches multiple systems — orders, inventory, payments, shipping, notifications — that are owned by different teams and often live in different services and databases.

        The core challenge: **keep these systems consistent without a single database transaction across all of them**, while users retry on flaky connections, payment providers time out, and flash sales send 50× normal traffic.

        > [!NOTE]
        > Hypothetical, educational design. Not the verified internal architecture of Amazon or any specific retailer.
      `,
    },
    functional: {
      simple: 'Customers can check out a cart, pay, see their order status and cancel. The system must hold stock, take payment, and tell shipping and email systems about the order.',
      body: md`
        1. **Checkout**: convert a cart into an order with prices locked at checkout time.
        2. **Inventory reservation**: hold stock for 15 minutes while payment happens.
        3. **Payment**: authorize and capture via an external payment service provider (PSP).
        4. **Order status**: \`PENDING → RESERVED → PAID → FULFILLING → SHIPPED → DELIVERED\`, or \`CANCELLED\`/\`FAILED\`.
        5. **Cancellation and refunds** before shipment.
        6. **Notifications**: emails/SMS on status changes.
        7. **Order history** for customers; order search for support staff.
      `,
    },
    'non-functional': {
      simple: 'Never charge twice, never oversell, never lose an order. Checkout should be fast and the store should stay up during big sales.',
      body: md`
        | Quality | Target | Why |
        |---|---|---|
        | Correctness | No double charge, no overselling | Money and trust |
        | Durability | No accepted order is lost | Legal and financial records |
        | [[latency|Latency]] | Checkout p99 < 1.5 s (PSP-dependent) | Slow checkout loses sales |
        | [[availability|Availability]] | 99.95% for checkout | Downtime = lost revenue |
        | Peak load | 20× baseline during sales | Black Friday traffic |
        | Auditability | Every state change recorded | Disputes, accounting |

        **Consistency choice**: orders and payments need strong guarantees per order; downstream systems (email, analytics, recommendations) can be eventually consistent.
      `,
    },
    assumptions: {
      simple: 'We guess: 2 million orders a day normally, about 3 items each, and up to 20 times more traffic during a big sale.',
      body: md`
        > [!ASSUMPTION]
        > Illustrative numbers.

        - 2M orders/day baseline; 20× peak during flash sales.
        - Average 3 line items per order; order document ~3 KB.
        - Product catalog and cart are separate systems (we consume them).
        - Payment is handled by an external PSP (Stripe-like) supporting idempotency keys, authorization and capture.
        - Each service owns its own database ("database per service").
      `,
    },
    capacity: {
      simple: 'Only about 23 orders per second on a normal day, but 500 per second at the peak of a sale. Storage is small. The hard part is correctness under bursts, not raw size.',
      body: md`
        > [!ASSUMPTION]
        > Rounded estimates.

        - **Orders**: 2M / 86,400 ≈ **23/s** average; peak 20× sustained over minutes ≈ **460/s**, with bursts higher.
        - **Inventory operations**: ~3 reservations per order → ~1,400/s peak, concentrated on a few hot products.
        - **Storage**: 2M × 3 KB × 365 ≈ **2.2 TB/year** of orders.
        - **Events**: ~8 status events per order → 16M events/day.

        **Conclusion**: modest throughput, but **contention** (many buyers for the same item) and **correctness across services** are the real problems.
      `,
    },
    'high-level': {
      simple: 'An API gateway receives the checkout. The order service runs the steps in order — reserve stock, take payment, confirm — like a checklist. Each finished step is announced as an event so shipping and email services can react.',
      body: md`
        We use **microservices** with a **[[saga|saga]] orchestrator** inside the Order Service:

        - **API Gateway**: auth, [[rate-limiting|rate limiting]], routing.
        - **Order Service** (orchestrator): owns the order state machine and drives the saga.
        - **Inventory Service**: reserves/releases stock with atomic conditional updates.
        - **Payment Service**: wraps the PSP; enforces [[idempotency]].
        - **Kafka**: order events for fulfilment, notifications, analytics.
        - **Transactional outbox**: guarantees events are published if and only if the DB change commits.

        **Why orchestration instead of choreography?** With choreography each service reacts to others' events — flexible but the overall flow becomes hard to see and debug. An orchestrator keeps the checkout workflow in one readable place, which matters for a money-critical path.
      `,
    },
    diagram: {
      simple: 'Click a box to learn its job. Try the "payment fails" flow to see how the system undoes the stock reservation.',
      body: md`Hypothetical architecture. Compare the happy path, the compensation path and the safe retry.`,
    },
    components: {
      simple: 'The gateway checks who you are, the order service runs the checklist, inventory holds items, payment takes money, Kafka announces what happened, and workers handle shipping and emails.',
      body: md`
        | Component | Responsibility | Why this choice |
        |---|---|---|
        | API Gateway | JWT validation, rate limits, routing | Cross-cutting concerns in one place |
        | Order Service | State machine, saga orchestration, outbox | Single owner of order truth |
        | Orders DB (MongoDB) | Orders + outbox collection | One document per order fits the aggregate; multi-document transactions for order+outbox |
        | Inventory Service + DB | Atomic reserve/release, reservation expiry | Conditional updates prevent overselling |
        | Payment Service | Authorize/capture/refund via PSP with idempotency keys | Isolates PSP quirks and secrets |
        | Redis | Idempotency key cache, rate-limit counters | Fast, TTL-based |
        | Kafka | \`order.*\` events | Decouples fulfilment, notifications, analytics |
        | Fulfilment / Notification workers | Ship orders, send emails | Can lag without blocking checkout |
      `,
    },
    api: {
      simple: 'One request places the order; others read it, cancel it, or let the payment provider tell us what happened. Every "place order" request carries a unique key so retries are safe.',
      body: md`
        The checkout endpoint **requires** an \`Idempotency-Key\` header (a UUID generated by the client per checkout attempt). The server stores the key with the response; a retry with the same key returns the stored response instead of creating a second order.

        We return \`202 Accepted\` when payment confirmation is asynchronous (e.g. 3-D Secure), and \`201 Created\` when the order completes synchronously.
      `,
    },
    database: {
      simple: 'Each order is one record containing its items, prices and status history. Inventory is a separate table per product with "available" and "reserved" counts. An "outbox" table holds events waiting to be announced.',
      body: md`
        **Order (MongoDB)** — the order is an *aggregate*: items and status history are always read with the order, so we embed them.

        \`\`\`ts
        const OrderSchema = new Schema({
          orderNumber:    { type: String, unique: true },
          customerId:     { type: String, required: true },
          status:         { type: String, enum: ['PENDING','RESERVED','PAID','FULFILLING','SHIPPED','DELIVERED','CANCELLED','FAILED'] },
          items: [{ sku: String, name: String, qty: Number, unitPriceCents: Number }],  // price locked at checkout
          totalCents:     Number,
          currency:       { type: String, default: 'USD' },
          paymentId:      String,
          idempotencyKey: { type: String, unique: true, sparse: true },
          history:        [{ status: String, at: Date, reason: String }],
          version:        { type: Number, default: 0 },   // optimistic concurrency
        }, { timestamps: true });

        OrderSchema.index({ customerId: 1, createdAt: -1 });  // "my orders"
        OrderSchema.index({ status: 1, updatedAt: 1 });       // stuck-order sweeper
        \`\`\`

        > [!TIP]
        > Store money as **integer cents**, never floating point. \`0.1 + 0.2 !== 0.3\` in JavaScript.

        **Outbox** — written in the **same transaction** as the order change:

        \`\`\`ts
        { _id, aggregateId: 'ord_123', type: 'order.paid', payload: {...}, createdAt, publishedAt: null }
        \`\`\`

        **Inventory** — one document per SKU per warehouse:

        \`\`\`ts
        { sku: 'SHOE-RED-42', warehouse: 'BLR1', available: 17, reserved: 3 }
        // plus reservations: { orderId, sku, qty, expiresAt }  (TTL-swept)
        \`\`\`
      `,
    },
    lifecycle: {
      simple: 'Checkout → check the retry key → create order as "pending" → hold stock → charge card → mark "paid" → announce it → shipping and email services do their jobs.',
      body: md`
        1. Client sends \`POST /api/v1/orders\` with cart ID and \`Idempotency-Key\`.
        2. Gateway authenticates and rate-limits.
        3. Order Service checks Redis/DB for the idempotency key. Seen → return stored response.
        4. Create order \`PENDING\` + outbox event \`order.created\` in one transaction.
        5. Call Inventory: reserve each SKU atomically.
        6. Call Payment: authorize the total with the PSP (idempotency key = \`order:{id}:auth\`).
        7. On success: order → \`PAID\` + outbox \`order.paid\` (one transaction). Respond \`201\`.
        8. Outbox relay publishes events to Kafka; fulfilment captures payment on shipment, notifications send email.

        **Atomic reservation — the anti-overselling trick**:

        \`\`\`ts
        // inventory.repository.ts
        export async function reserve(sku: string, qty: number) {
          // Only succeeds if enough stock is available — the check and the update are ONE atomic operation.
          const res = await Inventory.updateOne(
            { sku, available: { $gte: qty } },
            { $inc: { available: -qty, reserved: qty } },
          );
          if (res.modifiedCount === 0) throw new AppError(409, 'OUT_OF_STOCK', \`Not enough \${sku}\`);
        }
        \`\`\`

        A naive "read available, then write available − qty" has a race: two buyers both read 1 and both buy the last item.
      `,
    },
    sequence: { simple: 'Timelines of who calls whom during checkout.', body: md`Generated from the same flows as the interactive diagram.` },
    caching: {
      simple: 'We cache things that are read a lot and change rarely — like product details — but never cache stock levels or payments as the source of truth.',
      body: md`
        - **Product catalog / prices**: cached aggressively (CDN + Redis) for browsing. At checkout we **re-read the authoritative price** and lock it into the order.
        - **Idempotency keys**: Redis with 24 h TTL for fast duplicate detection; the unique DB index is the final guarantee.
        - **Displayed stock** ("Only 3 left!"): cached with a short TTL — it's a hint. **Reservation always hits the inventory database.**
        - **Order status page**: read-your-writes from the primary for the customer who just ordered; replicas elsewhere.

        **Rule of thumb**: cache for *display*, never for *decisions that move money or stock*.
      `,
    },
    scaling: {
      simple: 'Services scale by adding copies. For a popular item in a flash sale, we let people into a virtual waiting room and split the stock into smaller buckets so fewer buyers fight over the same record.',
      body: md`
        - Stateless services scale horizontally behind the gateway.
        - Orders DB sharded by \`customerId\` (order history queries are per customer); order lookups by number go through a small lookup index.
        - **Hot SKU contention** (flash sales): split a SKU's stock into N "buckets" (e.g. 10 documents with 10 units each) and reserve from a random bucket — N× less lock contention.
        - **Virtual waiting room** at the edge for extreme spikes: admit users at a controlled rate.
        - **Load shedding**: under overload, reject non-critical traffic (recommendations, reviews) before checkout.
        - Kafka consumers autoscale on lag.
      `,
    },
    async: {
      simple: 'Once an order is paid, the system announces it. Shipping, email and analytics each listen and do their part in the background. The "outbox" trick guarantees an announcement is never lost.',
      body: md`
        **The dual-write problem**: if we update the DB and then publish to Kafka, a crash in between leaves them inconsistent (order paid, no event → never shipped).

        **Transactional outbox** solves it:

        \`\`\`ts
        await mongoose.connection.transaction(async (session) => {
          await Order.updateOne({ _id: orderId, version }, { status: 'PAID', $inc: { version: 1 } }, { session });
          await Outbox.create([{ aggregateId: orderId, type: 'order.paid', payload }], { session });
        });
        // A relay process (or Change Streams / Debezium CDC) publishes unpublished outbox rows to Kafka,
        // then marks them published. Delivery is at-least-once → consumers must be idempotent.
        \`\`\`

        **Consumers**: fulfilment (pick/pack/ship, capture payment), notifications, analytics, loyalty points. Each stores processed event IDs to ignore duplicates.

        **Saga timeouts**: a sweeper finds orders stuck in \`RESERVED\` for > 15 minutes and compensates (release stock, void authorization).
      `,
    },
    security: {
      simple: 'Only the logged-in customer can see their orders. Card numbers never touch our servers — the payment provider handles them. Messages from the payment provider are checked for a secret signature.',
      body: md`
        - **AuthN**: [[jwt|JWT]] access tokens (15 min) + rotating refresh tokens in httpOnly cookies.
        - **AuthZ**: customers can only read their own orders (\`order.customerId === token.sub\`); support staff have scoped roles.
        - **PCI scope reduction**: card data is tokenized client-side by the PSP's SDK; our servers only see tokens.
        - **Webhooks**: verify PSP signatures (HMAC) and timestamps to block forgery and replays; process idempotently.
        - **Price tampering**: never trust prices from the client; recompute server-side.
        - **Rate limiting** on checkout and login; bot protection during drops.
      `,
    },
    failures: {
      simple: 'If payment fails, we release the held items. If the network drops, the customer retries safely with the same key. If we\'re unsure whether a payment happened, we ask the payment provider before doing anything else.',
      body: md`
        | Failure | Risk | Handling |
        |---|---|---|
        | Payment declined | Stock stuck reserved | Saga compensation: release reservation, order → \`FAILED\` |
        | PSP timeout (unknown result) | Double charge if we retry blindly | Retry with **same** PSP idempotency key, or query payment status before retrying |
        | Client retries checkout | Duplicate orders | \`Idempotency-Key\` returns original response |
        | Crash after DB commit, before event | Order never ships | Transactional outbox relay publishes later |
        | Inventory service down | Can't reserve | Fail fast with 503 + [[circuit-breaker|circuit breaker]]; don't take payment |
        | Duplicate Kafka event | Ship twice | Idempotent consumers keyed by event ID |
        | Reservation never confirmed | Stock locked forever | TTL expiry + sweeper compensation |

        **Order of operations matters**: reserve **before** charging. Refunding a customer is worse UX (and costs fees) than telling them an item is out of stock.
      `,
    },
    observability: {
      simple: 'We track how many checkouts succeed, why they fail, how many orders get stuck, and how long each step takes — and alert someone if the numbers look wrong.',
      body: md`
        - **Business metrics**: checkout conversion, orders/min, payment decline rate, oversell incidents (should be 0), stuck orders by status.
        - **Technical metrics**: per-step saga latency, PSP latency/error rate, outbox backlog age, Kafka lag.
        - **Tracing**: one trace spans gateway → order → inventory → payment; the \`orderId\` is a span attribute so support can search by it.
        - **Audit log**: the order \`history\` array plus immutable events in Kafka form an audit trail.
        - **Alerts**: payment error rate > 2% for 5 min, outbox oldest unpublished > 60 s, any oversell.
      `,
    },
    deployment: {
      simple: 'Each service is deployed separately in containers. Database changes are made in a backward-compatible way so old and new versions can run side by side during a rollout.',
      body: md`
        - Each service has its own pipeline and container image; Kubernetes across 3 AZs.
        - **Expand/contract migrations**: add new fields first, deploy code that writes both, backfill, then remove old fields — so rolling deploys never break.
        - Feature flags for risky checkout changes; canary at 1% → 10% → 100% watching conversion and error rates.
        - Payment Service runs in a restricted network segment with tighter access to secrets.
      `,
    },
    tradeoffs: {
      simple: 'Splitting into services lets teams move independently but makes everything more complicated. A small store should start with one well-organized app and split later.',
      body: md`
        **Bottlenecks**: hot SKUs, PSP latency (out of our control), outbox relay throughput.

        **Trade-offs**
        - **Saga vs distributed transaction (2PC)**: sagas avoid locking across services and survive partial outages, but intermediate states are visible (an order can be \`RESERVED\` for a while) and compensations must be designed carefully.
        - **Orchestration vs choreography**: clearer flow vs looser coupling.
        - **Reserve-then-pay vs pay-then-reserve**: we favour no-oversell over a slightly longer checkout.

        **Alternatives**
        - A **modular monolith** with one PostgreSQL database and real ACID transactions is simpler and perfectly fine up to significant scale. Many successful stores run this way.
        - Workflow engines (Temporal, AWS Step Functions) to run sagas durably instead of hand-rolling state machines.
      `,
    },
    interview: { simple: 'Practice questions about order systems, with model answers.', body: md`Answer out loud first, then compare.` },
    summary: {
      simple: 'Orders are a checklist across several systems. Make each step safe to repeat, give each step an undo, save events in the same transaction as the data, and never trust cached numbers for money or stock.',
      body: md`
        1. Model the order as a state machine owned by one service.
        2. Use a saga with compensations instead of distributed transactions.
        3. Make every write idempotent — clients, PSPs and Kafka all retry.
        4. Use atomic conditional updates to prevent overselling.
        5. Use the transactional outbox to publish events reliably.
      `,
    },
  }),
  diagram: {
    title: 'E-commerce order management — hypothetical architecture',
    hypothetical: true,
    nodes: [
      node('client', 'client', 'Customer', 'Web / mobile checkout', 'The shopper pressing "Place order".', at(0, 1.5), {
        responsibility: 'Submits checkout with an Idempotency-Key; tokenizes card via PSP SDK.',
        inputs: ['Cart', 'Payment details'], outputs: ['POST /api/v1/orders'],
        technologies: ['React', 'PSP client SDK'], failureModes: ['Double-click submit', 'Network timeout then retry'],
      }),
      node('gateway', 'apiGateway', 'API Gateway', 'Auth + rate limit', 'The front desk that checks your ID and stops floods of requests.', at(1, 1.5), {
        responsibility: 'Validates JWT, rate-limits, routes to services.',
        inputs: ['HTTPS requests'], outputs: ['Authenticated requests'],
        technologies: ['Nginx', 'Kong', 'Express middleware'], failureModes: ['Misconfigured limits block real buyers during sales'],
      }),
      node('order', 'service', 'Order Service', 'Saga orchestrator', 'The manager who runs the checklist: hold stock, take payment, confirm.', at(2, 1.5), {
        responsibility: 'Owns order state machine; orchestrates reserve → pay → confirm; writes outbox.',
        inputs: ['Checkout requests', 'PSP webhooks'], outputs: ['Calls to inventory/payment', 'Outbox events'],
        technologies: ['Node.js', 'Express', 'Mongoose'], failureModes: ['Crash mid-saga (recovered by sweeper from persisted state)'],
      }),
      node('redis', 'cache', 'Redis', 'Idempotency keys', 'Fast memory that remembers recent order requests so retries aren\'t doubled.', at(2, 0), {
        responsibility: 'Idempotency key cache and rate-limit counters.',
        inputs: ['SET NX idem:{key}'], outputs: ['Stored responses'],
        technologies: ['Redis'], failureModes: ['Loss of keys (DB unique index is the backstop)'],
      }),
      node('ordersdb', 'database', 'Orders DB', 'MongoDB + outbox', 'The permanent record of every order and its history.', at(2, 3), {
        responsibility: 'Stores orders and outbox events transactionally.',
        inputs: ['Transactions'], outputs: ['Order documents', 'Outbox rows'],
        technologies: ['MongoDB replica set'], failureModes: ['Primary failover (writes pause briefly)'],
      }),
      node('inventory', 'service', 'Inventory Service', 'Atomic reservations', 'The stockroom keeper who sets items aside for you.', at(3, 0.7), {
        responsibility: 'Reserve/release stock with conditional atomic updates; expire reservations.',
        inputs: ['reserve(sku, qty)', 'release(orderId)'], outputs: ['Reservation IDs or OUT_OF_STOCK'],
        technologies: ['Node.js', 'MongoDB'], failureModes: ['Hot-SKU contention', 'Service down → checkout fails fast'],
      }),
      node('payment', 'service', 'Payment Service', 'Wraps the PSP', 'The cashier — talks to the card company to take payment.', at(3, 2.3), {
        responsibility: 'Authorize/capture/refund via PSP using idempotency keys; verifies webhooks.',
        inputs: ['Authorize requests'], outputs: ['Payment results'],
        technologies: ['Node.js', 'Stripe-like PSP API'], failureModes: ['PSP timeout with unknown outcome'],
      }),
      node('kafka', 'queue', 'Kafka', 'order.* events', 'A noticeboard where finished steps are announced.', at(4, 1.5), {
        responsibility: 'Distributes order events to downstream consumers.',
        inputs: ['Outbox relay'], outputs: ['Events to consumers'],
        technologies: ['Kafka'], failureModes: ['Consumer lag', 'Duplicate delivery'],
      }),
      node('fulfil', 'worker', 'Fulfilment Worker', 'Pick, pack, ship', 'The warehouse team that ships the order.', at(5, 0.8), {
        responsibility: 'Creates shipments, captures payment on ship, updates status.',
        inputs: ['order.paid'], outputs: ['Shipments', 'order.shipped'],
        technologies: ['Node.js consumer', 'WMS integration'], failureModes: ['Duplicate events (idempotent by eventId)'],
      }),
      node('notify', 'worker', 'Notification Worker', 'Email / SMS', 'Sends you "order confirmed" and "shipped" messages.', at(5, 2.2), {
        responsibility: 'Sends transactional emails/SMS on status changes.',
        inputs: ['order.* events'], outputs: ['Emails', 'SMS'],
        technologies: ['Node.js', 'Email provider API'], failureModes: ['Provider outage (retry with backoff)'],
      }),
      node('monitor', 'monitoring', 'Monitoring', 'Business + tech metrics', 'Dashboards and alarms for engineers and the business.', at(4, 3), {
        responsibility: 'Tracks conversion, declines, stuck orders, latency and lag.',
        inputs: ['Metrics', 'Traces', 'Logs'], outputs: ['Alerts'],
        technologies: ['Prometheus', 'Grafana', 'OpenTelemetry'], failureModes: ['Not alerting on business metrics'],
      }),
    ],
    edges: [
      edge('client', 'gateway', 'HTTPS'),
      edge('gateway', 'order'),
      edge('order', 'redis', 'idempotency'),
      edge('order', 'ordersdb', 'tx: order + outbox'),
      edge('order', 'inventory', 'reserve / release'),
      edge('order', 'payment', 'authorize'),
      edge('ordersdb', 'kafka', 'outbox relay', true),
      edge('kafka', 'fulfil', 'order.paid', true),
      edge('kafka', 'notify', 'order.*', true),
      edge('order', 'monitor', 'telemetry', true),
    ],
    flows: [
      {
        id: 'happy',
        name: 'Place order — success',
        description: 'Stock is available and the payment is approved.',
        steps: [
          { from: 'client', to: 'gateway', title: 'Submit checkout', explanation: 'The client sends the cart ID, a payment token from the PSP SDK, and a fresh Idempotency-Key.', simple: 'The shopper clicks "Place order".', request: 'POST /api/v1/orders\nAuthorization: Bearer eyJ...\nIdempotency-Key: 2b7e-…\n\n{"cartId":"cart_88","paymentMethodToken":"pm_tok_123"}' },
          { from: 'gateway', to: 'order', title: 'Authenticate and route', explanation: 'JWT verified, rate limit checked, request forwarded with customerId.', simple: 'The front desk checks who they are and passes it on.', log: '{"gw":"checkout","sub":"cus_42","rate":"ok"}' },
          { from: 'order', to: 'redis', title: 'Check idempotency key', explanation: 'SET NX succeeds → this is a new request. (If it existed, we would return the stored response.)', simple: 'Have we seen this exact request before? No.', request: 'SET idem:2b7e-… "IN_PROGRESS" NX EX 86400', response: 'OK' },
          { from: 'order', to: 'ordersdb', title: 'Create PENDING order', explanation: 'Prices re-read from catalog and locked. Order + outbox(order.created) written in one transaction.', simple: 'A ticket is written: order #1001, pending.', request: 'tx { orders.insert({status:"PENDING", totalCents: 12998, ...}); outbox.insert({type:"order.created"}) }' },
          { from: 'order', to: 'inventory', title: 'Reserve stock', explanation: 'Atomic conditional decrement per SKU; reservation expires in 15 min if not confirmed.', simple: 'The stockroom sets the shoes aside.', request: 'POST /internal/reservations\n{"orderId":"ord_1001","items":[{"sku":"SHOE-RED-42","qty":1}]}', response: '{"reservationId":"res_77","expiresAt":"…+15m"}' },
          { from: 'order', to: 'payment', title: 'Authorize payment', explanation: 'Payment Service calls the PSP with idempotency key order:ord_1001:auth.', simple: 'The cashier charges the card.', request: 'POST /v1/payment_intents\nIdempotency-Key: order:ord_1001:auth\n{"amount":12998,"currency":"usd","payment_method":"pm_tok_123","capture_method":"manual"}', response: '{"id":"pi_9","status":"requires_capture"}', log: '{"svc":"payment","order":"ord_1001","psp":"authorized","ms":420}' },
          { from: 'order', to: 'ordersdb', title: 'Mark PAID + outbox', explanation: 'Status → PAID with optimistic version check; outbox(order.paid) in the same transaction. 201 returned to client and stored under the idempotency key.', simple: 'The ticket is marked "paid" and the customer sees "Order confirmed!".', response: 'HTTP 201\n{"orderId":"ord_1001","status":"PAID","totalCents":12998}' },
          { from: 'ordersdb', to: 'kafka', title: 'Outbox relay publishes', explanation: 'The relay reads unpublished outbox rows and publishes order.paid to Kafka.', simple: 'The news is pinned on the noticeboard.' },
          { from: 'kafka', to: 'fulfil', title: 'Fulfilment reacts', explanation: 'Warehouse system creates a shipment; payment is captured when it ships.', simple: 'The warehouse starts packing.' },
          { from: 'kafka', to: 'notify', title: 'Email the customer', explanation: 'Confirmation email sent; idempotent by event ID.', simple: 'The customer gets a confirmation email.', log: '{"svc":"notify","event":"order.paid","order":"ord_1001","email":"sent"}' },
        ],
      },
      {
        id: 'compensate',
        name: 'Payment declined — compensation',
        description: 'The card is declined, so the saga undoes the stock reservation.',
        steps: [
          { from: 'client', to: 'gateway', title: 'Submit checkout', explanation: 'Same request as the happy path.', simple: 'The shopper clicks "Place order".' },
          { from: 'gateway', to: 'order', title: 'Route', explanation: 'Authenticated and forwarded.', simple: 'Passed to the manager.' },
          { from: 'order', to: 'ordersdb', title: 'Create PENDING order', explanation: 'Order created with outbox event.', simple: 'Ticket written: pending.' },
          { from: 'order', to: 'inventory', title: 'Reserve stock', explanation: 'Reservation succeeds.', simple: 'Items set aside.' },
          { from: 'order', to: 'payment', title: 'Authorize — declined', explanation: 'PSP responds card_declined. This is a definite failure, so we compensate.', simple: 'The card is declined.', response: '{"error":{"type":"card_error","code":"card_declined"}}', log: '{"svc":"payment","order":"ord_1002","psp":"declined"}' },
          { from: 'order', to: 'inventory', title: 'Compensate: release stock', explanation: 'The compensating action for "reserve" is "release". It is idempotent: releasing twice is harmless.', simple: 'Undo! The items go back on the shelf.', request: 'DELETE /internal/reservations/res_78', response: 'HTTP 204' },
          { from: 'order', to: 'ordersdb', title: 'Mark FAILED + outbox', explanation: 'Order → FAILED with reason; outbox(order.failed). Client receives 402 with a clear message.', simple: 'Ticket marked failed; shopper is asked to try another card.', response: 'HTTP 402\n{"error":{"code":"PAYMENT_DECLINED","message":"Your card was declined."}}' },
        ],
      },
      {
        id: 'retry',
        name: 'Network timeout — safe retry',
        description: 'The client times out and retries; the idempotency key prevents a second order.',
        steps: [
          { from: 'client', to: 'gateway', title: 'First attempt (times out)', explanation: 'The order actually succeeds on the server, but the response is lost on a flaky mobile network.', simple: 'The shopper clicks; the phone loses signal before the answer arrives.' },
          { from: 'client', to: 'gateway', title: 'Retry with the same key', explanation: 'The client retries with the SAME Idempotency-Key.', simple: 'The app tries again with the same ticket number.', request: 'POST /api/v1/orders\nIdempotency-Key: 2b7e-…' },
          { from: 'gateway', to: 'order', title: 'Route', explanation: 'Forwarded.', simple: 'Passed to the manager.' },
          { from: 'order', to: 'redis', title: 'Key already completed', explanation: 'The key maps to the stored 201 response. No new order, no new charge.', simple: '"We already did this one!"', request: 'GET idem:2b7e-…', response: '{"status":201,"body":{"orderId":"ord_1001","status":"PAID"}}', log: '{"svc":"order","idempotent_replay":true}' },
          { from: 'order', to: 'client', title: 'Return the original response', explanation: 'Identical response to the first attempt. If the first attempt were still IN_PROGRESS, we would return 409 and let the client poll.', simple: 'The shopper sees the same confirmation — charged once.', response: 'HTTP 201\n{"orderId":"ord_1001","status":"PAID"}' },
        ],
      },
    ],
  },
  apis: [
    {
      method: 'POST', path: '/api/v1/orders', summary: 'Place an order from a cart', auth: 'Bearer token; Idempotency-Key header required',
      request: '{\n  "cartId": "cart_88",\n  "shippingAddressId": "addr_3",\n  "paymentMethodToken": "pm_tok_123"\n}',
      response: 'HTTP 201 Created\n{\n  "orderId": "ord_1001",\n  "status": "PAID",\n  "totalCents": 12998,\n  "currency": "USD",\n  "items": [{ "sku": "SHOE-RED-42", "qty": 1, "unitPriceCents": 12998 }]\n}',
      errors: [
        { status: 400, code: 'MISSING_IDEMPOTENCY_KEY', when: 'Header not provided' },
        { status: 402, code: 'PAYMENT_DECLINED', when: 'Card declined by the PSP' },
        { status: 409, code: 'OUT_OF_STOCK', when: 'One or more items can no longer be reserved' },
        { status: 409, code: 'REQUEST_IN_PROGRESS', when: 'Same Idempotency-Key is still being processed' },
        { status: 422, code: 'PRICE_CHANGED', when: 'Price differs from what the cart showed; client must confirm' },
        { status: 503, code: 'DEPENDENCY_UNAVAILABLE', when: 'Inventory or payment unavailable (circuit open)' },
      ],
    },
    {
      method: 'GET', path: '/api/v1/orders/{orderId}', summary: 'Get order status and history', auth: 'Bearer token (owner or support role)',
      response: '{\n  "orderId": "ord_1001",\n  "status": "SHIPPED",\n  "history": [\n    { "status": "PENDING", "at": "…" },\n    { "status": "PAID", "at": "…" },\n    { "status": "SHIPPED", "at": "…" }\n  ]\n}',
      errors: [{ status: 403, code: 'FORBIDDEN', when: 'Not your order' }, { status: 404, code: 'NOT_FOUND', when: 'Unknown order' }],
    },
    {
      method: 'POST', path: '/api/v1/orders/{orderId}/cancel', summary: 'Cancel before shipment (refund if paid)', auth: 'Bearer token (owner)',
      response: 'HTTP 202 Accepted\n{ "orderId": "ord_1001", "status": "CANCELLATION_REQUESTED" }',
      errors: [{ status: 409, code: 'ALREADY_SHIPPED', when: 'Order can no longer be cancelled' }],
    },
    {
      method: 'POST', path: '/api/v1/webhooks/psp', summary: 'Receive payment provider events', auth: 'HMAC signature header',
      request: '{ "type": "payment_intent.succeeded", "data": { "id": "pi_9", "metadata": { "orderId": "ord_1001" } } }',
      response: 'HTTP 200',
      errors: [{ status: 400, code: 'INVALID_SIGNATURE', when: 'Signature or timestamp check fails' }],
    },
  ],
  interviewQuestions: [
    { question: 'How do you prevent charging a customer twice?', answer: 'Require an Idempotency-Key per checkout, store it with the response (Redis + unique DB index), and pass deterministic idempotency keys to the PSP. On PSP timeouts, query the payment status or retry with the same key — never a new one.' },
    { question: 'How do you prevent overselling the last item?', answer: 'Use an atomic conditional update: decrement available only where available >= qty, in one operation. For hot items, split stock into buckets to reduce contention.' },
    { question: 'Why not use a distributed transaction across services?', answer: '2PC locks resources across services, blocks if the coordinator fails, and many systems (like PSPs) don\'t support it. A saga with compensating actions stays available and works with external APIs.' },
    { question: 'What is the transactional outbox and why is it needed?', answer: 'It writes the event to an outbox table in the same DB transaction as the state change; a relay publishes it to Kafka later. This avoids the dual-write problem where the DB commits but the event is lost (or vice versa).' },
    { question: 'Would you start with microservices for a new store?', answer: 'Usually not. A modular monolith with a single relational database gives real ACID transactions and far less operational burden. Split services when team size or scaling needs justify it.' },
  ],
  related: ['url-shortener', 'messaging-system'],
};
