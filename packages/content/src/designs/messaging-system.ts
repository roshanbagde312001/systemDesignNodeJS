import type { SystemDesign } from '@sda/shared';
import { at, edge, md, node, sections } from '../helpers';

export const messagingSystem: SystemDesign = {
  slug: 'messaging-system',
  title: 'Messaging Application (WhatsApp-like)',
  tagline: 'Deliver one-to-one and group messages in real time, even when people go offline.',
  summary:
    'Design a WhatsApp-style chat app: persistent WebSocket connections, message ordering, delivery receipts, offline delivery with push notifications, group fan-out and media sharing.',
  category: 'messaging',
  difficulty: 'Intermediate',
  readingMinutes: 35,
  technologies: ['Node.js', 'WebSockets', 'Redis', 'Kafka', 'Cassandra', 'MongoDB', 'S3', 'CDN'],
  patterns: ['Event-driven architecture', 'Publish/subscribe', 'Fan-out', 'Asynchronous processing'],
  tags: ['websockets', 'redis', 'kafka', 'event-driven', 'interview'],
  publishedAt: '2026-09-18',
  popularity: 1240,
  status: 'published',
  analogy: {
    title: 'It works like a post office with a phone line to every house',
    story: md`
      Imagine a post office that keeps an **open phone line** to every house that's currently awake.

      - When you send a message, you hand it to the post office over your phone line. The clerk **writes it in a ledger first** (so it's never lost), then gives you a ✓ ("we've got it").
      - The clerk checks a whiteboard that says **which clerk is holding which house's phone line**, and passes the message to that clerk, who reads it down the line to your friend → ✓✓ ("delivered").
      - If your friend's house is asleep (offline), the message stays in the ledger and the post office sends a **doorbell ring** (push notification). When they wake up, they collect everything waiting for them.
      - For a **group chat**, the clerk makes one copy per member.
      - **Photos** don't go through the clerk at all — they go to a big warehouse (object storage), and the message just contains the warehouse shelf number.

      That's a messaging system: open lines, a ledger, a whiteboard of who's connected, and a doorbell for people who aren't.
    `,
  },
  sections: sections({
    problem: {
      simple: 'People want to send messages that arrive instantly, in the right order, and are never lost — even if the other person\'s phone is off.',
      body: md`
        Build a mobile-first chat application supporting one-to-one and group conversations with real-time delivery, receipts and media.

        What makes this hard isn't sending a message — it's doing so for **hundreds of millions of always-connected devices**, guaranteeing that a message is **never lost and never shown twice**, keeping order within a conversation, and handling phones that go in and out of coverage constantly.

        > [!NOTE]
        > This is a hypothetical, educational design inspired by public descriptions of chat products. It is not the verified internal architecture of WhatsApp or any other company.
      `,
    },
    functional: {
      simple: 'Users can send messages to one person or a group, see when messages are sent/delivered/read, get messages they missed while offline, see who is online, and share photos.',
      body: md`
        1. **1:1 messaging** with text.
        2. **Group messaging** (up to 256 members in this design).
        3. **Delivery states**: sent ✓, delivered ✓✓, read (blue ✓✓).
        4. **Offline delivery**: messages wait and are delivered on reconnect; a push notification is sent.
        5. **Presence**: online / last seen.
        6. **Media**: images and short videos.
        7. **Chat history** synced across reconnects.

        Out of scope: voice/video calls, end-to-end encryption key exchange details (mentioned under security), stories.
      `,
    },
    'non-functional': {
      simple: 'Messages should arrive in well under a second, never get lost, show up in the right order, and the app should keep working even when parts of the system fail.',
      body: md`
        | Quality | Target | Why |
        |---|---|---|
        | Delivery [[latency]] | < 200 ms p99 when both users online (same region) | Chat must feel like conversation |
        | Durability | Zero message loss after the ✓ | Users trust "sent" to mean saved |
        | Ordering | Per-conversation order preserved | Out-of-order replies make no sense |
        | Exactly-once *display* | No duplicates on screen | Retries happen constantly on mobile |
        | [[availability|Availability]] | 99.99% | Communication is critical |
        | Scale | 100M concurrent connections | Each is a long-lived socket |

        Note the subtle one: networks can't guarantee exactly-once **delivery**, so we design for at-least-once delivery + **client-side deduplication by message ID** to achieve exactly-once display.
      `,
    },
    assumptions: {
      simple: 'We guess the numbers: 500 million daily users, each sending about 40 messages a day, and at most 100 million connected at the same moment.',
      body: md`
        > [!ASSUMPTION]
        > Illustrative numbers for an interview-style exercise.

        - 500M daily active users (DAU); 100M concurrently connected at peak.
        - 40 messages sent per user per day → 20B messages/day.
        - Average text message ~100 bytes payload, ~300 bytes stored with metadata.
        - 10% of messages contain media, average 200 KB after compression.
        - Messages retained on the server until delivered to all recipients, plus 30 days of history for multi-device sync.
        - Groups capped at 256 members to bound fan-out.
      `,
    },
    capacity: {
      simple: 'The math says: about 230,000 messages per second on average, a few terabytes of text per day, and a LOT of open connections — so connection handling is the hardest part.',
      body: md`
        > [!ASSUMPTION]
        > Rounded estimates.

        **Messages**: 20B / 86,400 ≈ **230k msgs/s** average, ~700k/s peak.

        **Text storage**: 20B × 300 B ≈ **6 TB/day**; 30 days ≈ 180 TB (before replication).

        **Media**: 2B media msgs × 200 KB ≈ **400 TB/day** → object storage + CDN, never the message DB.

        **Connections**: if one gateway server holds ~100k idle WebSockets (memory-bound, ~20–50 KB each), 100M connections ≈ **1,000 gateway servers** plus headroom.

        **Conclusion**: the hard parts are (1) connection management at massive scale, (2) a write-heavy message store partitioned by conversation, and (3) media served by a CDN.
      `,
    },
    'high-level': {
      simple: 'Phones keep an open line (WebSocket) to "gateway" servers. A chat service saves each message and finds which gateway the receiver is connected to. Offline people get a push notification. Photos go to a separate storage warehouse.',
      body: md`
        - **Gateway servers** hold persistent [[websocket|WebSocket]] connections. They're deliberately thin: authenticate, frame/unframe messages, forward.
        - **Chat service** (stateless) handles the business logic: validate, assign sequence number, persist, route.
        - **Session registry** (Redis): \`userId → gatewayId\` so we know where to deliver.
        - **Message store**: write-optimized, partitioned by \`conversationId\`.
        - **Kafka** decouples persistence from fan-out, group expansion, push notifications and analytics.
        - **Push service** sends APNs/FCM notifications to offline devices.
        - **Media**: clients upload directly to object storage with a pre-signed URL; messages carry only the media reference.

        Why separate gateways from chat logic? Gateways are **stateful** (they own sockets) and are painful to restart; chat logic changes often. Splitting them lets us deploy chat logic many times a day without disconnecting 100M phones.
      `,
    },
    diagram: {
      simple: 'Click a box to see what it does. Choose a flow and press Play to watch a message travel from one phone to another.',
      body: md`Hypothetical architecture. Compare the online, offline and media flows.`,
    },
    components: {
      simple: 'Gateways hold the open lines, the chat service decides where messages go, Redis remembers who is connected where, the message store keeps the ledger, Kafka passes work to helpers, and the push service rings doorbells.',
      body: md`
        | Component | Responsibility | Why this choice |
        |---|---|---|
        | L4 load balancer | Spread new TCP/WebSocket connections | L4 is cheap for long-lived connections |
        | WebSocket gateway (Node.js) | Hold sockets, auth on connect, heartbeat, forward frames | Node's event loop handles 100k mostly-idle sockets per process well |
        | Chat service | Validate, dedupe, order, persist, route | Stateless → easy to scale and deploy |
        | Redis (sessions/presence) | \`user → gateway\`, last-seen, typing state | Fast, TTL-based, tolerant of loss |
        | Message store | Durable message log per conversation | Wide-column stores (Cassandra/ScyllaDB) excel at append-heavy partitioned writes |
        | User/group DB (MongoDB) | Profiles, group membership | Low volume, flexible documents |
        | Kafka | Async fan-out, push, analytics | Durable buffer; replays on failure |
        | Push worker | Send APNs/FCM to offline devices | Isolates third-party slowness |
        | Object storage + CDN | Store and serve media | Cheap, durable, globally cached |
      `,
    },
    api: {
      simple: 'Real-time messages travel over the WebSocket as small JSON "events". Ordinary requests like loading history or getting an upload link use normal REST endpoints.',
      body: md`
        Two interfaces:

        **1. WebSocket protocol** (\`wss://chat.example.com/ws\`), JSON frames for clarity (production systems often use a binary protocol to save bandwidth):

        \`\`\`json
        // client → server
        { "type": "message.send", "clientMsgId": "c-9f2e", "conversationId": "conv_17", "body": "On my way!" }

        // server → sender (ack = ✓)
        { "type": "message.ack", "clientMsgId": "c-9f2e", "messageId": "m_88123", "seq": 412, "ts": 1767225600123 }

        // server → recipient
        { "type": "message.new", "messageId": "m_88123", "conversationId": "conv_17", "seq": 412, "from": "u_1", "body": "On my way!" }

        // recipient → server (✓✓ / read)
        { "type": "receipt", "messageId": "m_88123", "status": "delivered" }
        \`\`\`

        **2. REST** for request/response operations, shown below.
      `,
    },
    database: {
      simple: 'Messages are stored grouped by conversation and sorted by a sequence number, so loading a chat means reading one neat, ordered slice. Users and groups live in a separate, smaller database.',
      body: md`
        **Messages** — partitioned by conversation so one chat's history lives together and reads are a single sequential scan:

        \`\`\`sql
        -- Cassandra / ScyllaDB (CQL)
        CREATE TABLE messages (
          conversation_id text,
          seq            bigint,       -- per-conversation, monotonically increasing
          message_id     text,
          sender_id      text,
          body           text,
          media_ref      text,
          created_at     timestamp,
          PRIMARY KEY ((conversation_id), seq)
        ) WITH CLUSTERING ORDER BY (seq DESC);
        \`\`\`

        **Access pattern**: "latest 50 messages in conv_17" and "messages in conv_17 after seq 380" — both are fast range reads within one partition.

        **Inbox / pending deliveries** — per-user queue of undelivered message IDs, deleted on delivery receipt:

        \`\`\`sql
        CREATE TABLE pending (user_id text, message_id text, conversation_id text, seq bigint,
          PRIMARY KEY ((user_id), conversation_id, seq));
        \`\`\`

        **Users and groups** (MongoDB):

        \`\`\`ts
        const GroupSchema = new Schema({
          name: String,
          memberIds: { type: [String], validate: (v: string[]) => v.length <= 256 },
          admins: [String],
        });
        GroupSchema.index({ memberIds: 1 }); // "which groups am I in?"
        \`\`\`

        **Why not just MongoDB for messages?** It can work at smaller scale. At ~700k writes/s, a log-structured store partitioned by conversation gives predictable write throughput and cheap range reads. Choose based on your scale and team expertise.
      `,
    },
    lifecycle: {
      simple: 'You press send → your phone sends it over the open line → the server saves it and replies ✓ → it looks up which server your friend is on → that server pushes it to their phone → their phone replies "delivered" → you see ✓✓.',
      body: md`
        1. Sender's app sends \`message.send\` with a client-generated \`clientMsgId\` (for dedupe on retry).
        2. Gateway forwards to the chat service with the authenticated \`userId\` (never trust IDs from the payload).
        3. Chat service checks membership, dedupes by \`(senderId, clientMsgId)\`, assigns the next \`seq\` for the conversation.
        4. Message is written to the message store (quorum write) **before** acknowledging.
        5. Ack (✓) returned to sender.
        6. Event published to Kafka \`messages\` topic (partitioned by \`conversationId\` to keep order).
        7. Router consumer looks up recipient in Redis: \`GET session:u_2 → gw-42\`.
        8. **Online** → forward to gateway gw-42 → pushed down recipient's socket. **Offline** → enqueue push notification.
        9. Recipient app sends a \`delivered\` receipt; it's routed back to the sender (✓✓) and the pending entry is removed.

        \`\`\`ts
        // gateway.ts — minimal WebSocket gateway using 'ws'
        wss.on('connection', async (socket, req) => {
          const user = await authenticate(req);            // verify JWT from query/header
          await redis.set(\`session:\${user.id}\`, GATEWAY_ID, 'EX', 90);
          const heartbeat = setInterval(() => redis.expire(\`session:\${user.id}\`, 90), 30_000);

          socket.on('message', async (raw) => {
            const frame = frameSchema.safeParse(JSON.parse(raw.toString()));
            if (!frame.success) return socket.send(JSON.stringify({ type: 'error', code: 'BAD_FRAME' }));
            await chatService.handle(user.id, frame.data);   // persist, ack, route
          });

          socket.on('close', () => { clearInterval(heartbeat); redis.del(\`session:\${user.id}\`); });
        });
        \`\`\`
      `,
    },
    sequence: {
      simple: 'Timelines showing exactly who talks to whom when a message is sent.',
      body: md`Generated from the same flows as the interactive diagram.`,
    },
    caching: {
      simple: 'We keep "who is online and on which server" in Redis, plus recent messages and group member lists, because these are read constantly.',
      body: md`
        - **Session registry**: \`session:{userId} → gatewayId\` with a 90 s TTL refreshed by heartbeats. If a gateway dies, entries simply expire — no cleanup job needed.
        - **Presence**: \`lastseen:{userId}\` updated at most once every 30 s per user to avoid write storms.
        - **Group membership**: cached per group; invalidated on membership change events.
        - **Recent messages**: the latest ~50 messages of active conversations cached so opening a chat is instant.

        What we **don't** cache: the authoritative message log. The ✓ must mean "durably stored", so writes go to the database first.
      `,
    },
    scaling: {
      simple: 'We add more gateway servers to hold more open lines, and more chat servers to process more messages. The database is split by conversation so each piece handles part of the load.',
      body: md`
        - **Gateways** scale horizontally by connection count. An L4 load balancer spreads new connections; on scale-down, gateways drain by asking clients to reconnect gradually (with jitter to avoid a reconnect storm).
        - **Chat service** is [[stateless]] → autoscale on CPU/RPS.
        - **Message store** is [[shard|sharded]] by \`conversationId\` (consistent hashing); add nodes to grow.
        - **Kafka** partitions by \`conversationId\` → per-conversation ordering with parallelism across conversations.
        - **Group fan-out**: a 256-member group message becomes ≤ 256 deliveries; done by consumers, not on the send path. Very large "broadcast channels" would use a pull model instead (members fetch) — a different design.
        - **Multi-region**: users connect to the nearest region; cross-region messages are forwarded between regions over a backbone.
      `,
    },
    async: {
      simple: 'After saving the message, the slow and optional jobs — copying it for every group member, sending push notifications, counting stats — are handed to background workers through Kafka.',
      body: md`
        Consumers of the \`messages\` topic:

        | Consumer | Job | If it's slow… |
        |---|---|---|
        | Router | Deliver to online recipients via their gateway | Delivery is delayed (we monitor this tightly) |
        | Group fan-out | Expand group message to members | Group messages arrive late |
        | Push worker | APNs/FCM for offline recipients | Notifications are late; messages still wait safely |
        | Analytics | Counts, abuse signals | Nobody notices |

        **Ordering**: one partition per conversation key means a single consumer handles a conversation at a time, preserving \`seq\` order.

        **Retries**: push providers fail often; push worker retries with exponential backoff and moves poison messages to a dead-letter queue.
      `,
    },
    security: {
      simple: 'Only logged-in users can connect, users can only post into chats they belong to, and messages are encrypted so that only the people in the chat can read them.',
      body: md`
        - **Auth on connect**: the WebSocket handshake carries a short-lived [[jwt|JWT]]; the gateway validates it and attaches \`userId\` to the socket. Tokens are refreshed over REST and the socket re-authenticates.
        - **Authorization**: the chat service checks membership of \`conversationId\` on every send — never trust the client.
        - **End-to-end encryption (E2EE)**: in an E2EE design (e.g. the Signal protocol), the server only stores ciphertext and routes it; it can't read messages. This affects features: server-side search and moderation become impossible, so they move to the client.
        - **Transport**: TLS everywhere (\`wss://\`).
        - **Abuse**: [[rate-limiting|rate limits]] per user/conversation, spam detection on metadata, block/report flows.
        - **Media**: pre-signed upload URLs expire in minutes and are scoped to one object key.
      `,
    },
    failures: {
      simple: 'Phones lose signal, servers crash and networks hiccup. The app resends messages it didn\'t get a ✓ for, the server ignores duplicates, and nothing is lost because everything is saved before it\'s confirmed.',
      body: md`
        | Failure | What happens | Recovery |
        |---|---|---|
        | Phone loses signal mid-send | No ack received | Client retries with same \`clientMsgId\`; server dedupes |
        | Gateway crashes | Its ~100k sockets drop | Clients reconnect with jittered backoff to other gateways; sessions re-registered; pending messages synced from \`lastSeq\` |
        | Redis session entry stale | Router sends to wrong/dead gateway | Gateway returns "not here"; router falls back to pending + push |
        | Message store node down | Quorum writes still succeed (RF=3, QUORUM) | Hinted handoff + repair |
        | Kafka consumer lag | Deliveries delayed | Autoscale consumers; alert on lag |
        | Push provider outage | No notifications | Messages wait in pending; delivered on next app open |

        **Reconnect sync**: on reconnect, the client sends the last \`seq\` it has per conversation; the server returns everything newer. This single mechanism handles crashes, offline periods and multi-device catch-up.
      `,
    },
    observability: {
      simple: 'We watch how many people are connected, how long messages take to arrive, and how far behind the background workers are.',
      body: md`
        **Key metrics**: concurrent connections per gateway, message send→deliver latency (p50/p99), ack latency, Kafka consumer lag per topic, push success rate, reconnect rate (a spike means something is wrong).

        **Tracing**: propagate a \`traceId\` inside the message envelope so a single message can be traced across gateway → chat service → Kafka → router → gateway.

        **Logs**: never log message bodies (privacy). Log IDs, sizes, timings.

        **SLO example**: 99.9% of messages between online users delivered within 1 s over a 30-day window.
      `,
    },
    deployment: {
      simple: 'Gateways are updated slowly and carefully because restarting them disconnects people. The chat logic can be updated many times a day.',
      body: md`
        - Gateways: rolling deploys at a slow rate (e.g. 2% of fleet at a time), each draining connections gracefully over minutes.
        - Chat/router/push services: standard canary deploys.
        - Kafka and message store on dedicated nodes across 3 availability zones.
        - Separate regional clusters; global user directory to find a user's home region.
      `,
    },
    tradeoffs: {
      simple: 'We chose a design that is great for small chats and groups up to 256 people. Giant broadcast channels or perfect global ordering would need different trade-offs.',
      body: md`
        **Bottlenecks**: connection memory on gateways; hot group conversations; reconnect storms after a mass disconnect.

        **Trade-offs**
        - **Push (server sends) vs pull (client polls)**: push gives instant delivery but requires holding millions of connections. Long polling is simpler but wastes requests.
        - **Per-conversation ordering, not global**: global order would need a single sequencer — a bottleneck. Users only care about order within a chat.
        - **At-least-once + dedupe**: simpler and more robust than trying to build exactly-once delivery.
        - **E2EE**: maximum privacy, but removes server-side search and moderation.

        **Alternatives**: MQTT instead of raw WebSockets (designed for flaky mobile networks); Server-Sent Events for one-way updates; a managed pub/sub service for smaller apps.
      `,
    },
    interview: { simple: 'Common interview questions about chat systems, with short answers.', body: md`Try answering before you expand.` },
    summary: {
      simple: 'A chat app is open lines (WebSockets) + a ledger (message store) + a whiteboard of who\'s where (Redis) + background helpers (Kafka). Save first, confirm second, retry safely.',
      body: md`
        1. Separate stateful connection gateways from stateless chat logic.
        2. Persist before acknowledging; ✓ means durable.
        3. Order per conversation with sequence numbers; dedupe with client message IDs.
        4. Use a session registry to route to the right gateway, and push notifications for offline users.
        5. Sync on reconnect using the last seen sequence number.
      `,
    },
  }),
  diagram: {
    title: 'Messaging application — hypothetical architecture',
    hypothetical: true,
    nodes: [
      node('sender', 'client', 'Sender (Alice)', 'Mobile app', 'Alice’s phone, sending a message.', at(0, 1), {
        responsibility: 'Composes messages, keeps a WebSocket open, retries unacknowledged messages.',
        inputs: ['User input', 'Server events'], outputs: ['message.send frames', 'receipts'],
        technologies: ['iOS/Android app', 'Local SQLite outbox'],
        failureModes: ['Network drops', 'App killed by OS'],
      }),
      node('lb', 'loadBalancer', 'L4 Load Balancer', 'TCP connections', 'Spreads new phone connections across gateway servers.', at(1, 1.5), {
        responsibility: 'Distributes long-lived TCP/WebSocket connections across gateways.',
        inputs: ['TCP connections'], outputs: ['Connections to gateways'],
        technologies: ['AWS NLB', 'HAProxy', 'Envoy'],
        failureModes: ['Uneven connection distribution after scale-out'],
      }),
      node('gateway', 'apiGateway', 'WebSocket Gateway', 'Holds open sockets', 'Servers that keep an open line to each phone.', at(2, 1.5), {
        responsibility: 'Authenticates connections, holds sockets, heartbeats, forwards frames to chat service.',
        inputs: ['WebSocket frames'], outputs: ['Frames to chat service', 'Events to devices'],
        technologies: ['Node.js', 'ws / uWebSockets.js'],
        failureModes: ['Crash drops all its connections', 'Memory exhaustion'],
      }),
      node('chat', 'service', 'Chat Service', 'Validate, order, persist', 'The brain that saves each message and decides where it goes.', at(3, 1.5), {
        responsibility: 'Checks membership, dedupes, assigns seq, persists, publishes events.',
        inputs: ['Send requests'], outputs: ['Acks', 'Kafka events'],
        technologies: ['Node.js', 'Express (REST)', 'Zod'],
        failureModes: ['DB write timeouts → no ack → client retries'],
      }),
      node('redis', 'cache', 'Redis Sessions', 'user → gateway', 'A whiteboard showing which gateway each online person is connected to.', at(3, 0), {
        responsibility: 'Session registry, presence, typing indicators.',
        inputs: ['SET/GET session:{user}'], outputs: ['Gateway ID'],
        technologies: ['Redis Cluster'],
        failureModes: ['Stale entries after gateway crash (TTL fixes it)'],
      }),
      node('store', 'database', 'Message Store', 'Partitioned by conversation', 'The ledger: every message is written here before Alice sees ✓.', at(4, 2.8), {
        responsibility: 'Durable, ordered message log and pending deliveries.',
        inputs: ['Insert message', 'Range reads by seq'], outputs: ['Messages'],
        technologies: ['Cassandra', 'ScyllaDB'],
        failureModes: ['Node loss (tolerated with RF=3)', 'Hot partition for very active groups'],
      }),
      node('kafka', 'queue', 'Kafka', 'messages topic', 'A conveyor belt carrying saved messages to the helpers.', at(4, 1.5), {
        responsibility: 'Durable event log for routing, fan-out, push and analytics.',
        inputs: ['Message events'], outputs: ['Events to consumers'],
        technologies: ['Kafka'],
        failureModes: ['Consumer lag', 'Partition leader election'],
      }),
      node('router', 'worker', 'Delivery Router', 'Finds recipient gateway', 'A helper that finds the right gateway and hands the message over.', at(5, 1), {
        responsibility: 'Looks up sessions and forwards messages to gateways, or to the push worker.',
        inputs: ['Message events'], outputs: ['Deliveries to gateways', 'Push jobs'],
        technologies: ['Node.js Kafka consumer'],
        failureModes: ['Gateway unreachable → fall back to pending + push'],
      }),
      node('push', 'worker', 'Push Worker', 'APNs / FCM', 'Rings the phone’s doorbell (notification) when the app is closed.', at(5, 2.5), {
        responsibility: 'Sends push notifications to offline devices with retries.',
        inputs: ['Push jobs'], outputs: ['APNs/FCM requests'],
        technologies: ['Node.js', 'APNs', 'Firebase Cloud Messaging'],
        failureModes: ['Provider throttling', 'Invalid device tokens'],
      }),
      node('storage', 'storage', 'Object Storage + CDN', 'Photos & videos', 'A huge warehouse for photos and videos, with copies near users.', at(1, 3), {
        responsibility: 'Stores media uploaded directly by clients; CDN serves downloads.',
        inputs: ['Pre-signed PUT'], outputs: ['Media via CDN URLs'],
        technologies: ['Amazon S3', 'CloudFront'],
        failureModes: ['Upload interrupted (use multipart/resumable uploads)'],
      }),
      node('receiver', 'client', 'Receiver (Bob)', 'Mobile app', 'Bob’s phone, receiving the message.', at(6, 1.5), {
        responsibility: 'Receives events, dedupes by messageId, sends receipts.',
        inputs: ['message.new events', 'Push notifications'], outputs: ['Receipts'],
        technologies: ['iOS/Android app'],
        failureModes: ['Offline', 'Duplicate delivery (deduped locally)'],
      }),
      node('monitor', 'monitoring', 'Monitoring', 'Lag, latency, connections', 'Dashboards and alarms for engineers.', at(6, 0), {
        responsibility: 'Tracks delivery latency, connection counts, consumer lag.',
        inputs: ['Metrics', 'Traces', 'Logs'], outputs: ['Alerts'],
        technologies: ['Prometheus', 'Grafana', 'OpenTelemetry'],
        failureModes: ['Missing per-message trace context'],
      }),
    ],
    edges: [
      edge('sender', 'lb', 'wss'),
      edge('lb', 'gateway'),
      edge('gateway', 'chat', 'frames'),
      edge('chat', 'store', 'persist'),
      edge('chat', 'kafka', 'publish', true),
      edge('chat', 'redis'),
      edge('kafka', 'router', 'consume', true),
      edge('router', 'redis', 'lookup'),
      edge('router', 'gateway', 'deliver'),
      edge('kafka', 'push', 'consume', true),
      edge('router', 'push', 'offline', true),
      edge('push', 'receiver', 'notification', true),
      edge('gateway', 'receiver', 'wss'),
      edge('sender', 'storage', 'upload'),
      edge('router', 'monitor', 'telemetry', true),
    ],
    flows: [
      {
        id: 'online',
        name: 'Send message — recipient online',
        description: 'Alice sends a message to Bob, who has the app open.',
        steps: [
          { from: 'sender', to: 'lb', title: 'Send over the open socket', explanation: 'Alice\'s app already has a WebSocket open. It sends a message.send frame with a clientMsgId for safe retries.', simple: 'Alice presses send.', request: '{"type":"message.send","clientMsgId":"c-9f2e","conversationId":"conv_17","body":"On my way!"}' },
          { from: 'lb', to: 'gateway', title: 'Existing connection', explanation: 'The frame flows over the TCP connection the L4 load balancer already pinned to gateway gw-07.', simple: 'It travels down Alice\'s open line.' },
          { from: 'gateway', to: 'chat', title: 'Forward with identity', explanation: 'The gateway attaches the authenticated userId from the handshake — never the payload — and forwards to the chat service.', simple: 'The gateway passes it on and says it\'s really from Alice.', log: '{"gw":"gw-07","user":"u_1","type":"message.send","bytes":96}' },
          { from: 'chat', to: 'store', title: 'Persist first', explanation: 'Membership check, dedupe, seq = 412 assigned, quorum write to the message store.', simple: 'The message is written in the ledger so it can never be lost.', request: 'INSERT INTO messages (conversation_id, seq, message_id, sender_id, body) VALUES (\'conv_17\', 412, \'m_88123\', \'u_1\', \'On my way!\')', log: '{"op":"store.insert","conv":"conv_17","seq":412,"ms":4.1}' },
          { from: 'chat', to: 'gateway', title: 'Ack to sender (✓)', explanation: 'Only after the write succeeds does Alice get her ✓.', simple: 'Alice sees one tick ✓.', response: '{"type":"message.ack","clientMsgId":"c-9f2e","messageId":"m_88123","seq":412}' },
          { from: 'chat', to: 'kafka', title: 'Publish event', explanation: 'Event published to the messages topic, partitioned by conversationId to preserve order.', simple: 'The message is put on the conveyor belt for delivery.' },
          { from: 'kafka', to: 'router', title: 'Router consumes', explanation: 'The delivery router reads the event.', simple: 'A delivery helper picks it up.' },
          { from: 'router', to: 'redis', title: 'Where is Bob?', explanation: 'Look up Bob\'s session to find his gateway.', simple: 'It checks the whiteboard: Bob is on gateway 42.', request: 'GET session:u_2', response: '"gw-42"' },
          { from: 'router', to: 'gateway', title: 'Forward to Bob\'s gateway', explanation: 'Internal RPC to gw-42 with the message.', simple: 'It hands the message to Bob\'s gateway.' },
          { from: 'gateway', to: 'receiver', title: 'Push down the socket', explanation: 'gw-42 writes the frame to Bob\'s socket. Bob\'s app dedupes by messageId and renders it, then sends a delivered receipt that flows back to Alice (✓✓).', simple: 'Bob sees the message; Alice sees ✓✓.', response: '{"type":"message.new","messageId":"m_88123","conversationId":"conv_17","seq":412,"from":"u_1","body":"On my way!"}', log: '{"gw":"gw-42","user":"u_2","delivered":"m_88123","e2eMs":63}' },
        ],
      },
      {
        id: 'offline',
        name: 'Send message — recipient offline',
        description: 'Bob\'s phone is off; the message waits and a push notification is sent.',
        steps: [
          { from: 'sender', to: 'lb', title: 'Send', explanation: 'Same as before: message.send frame.', simple: 'Alice presses send.' },
          { from: 'lb', to: 'gateway', title: 'To Alice\'s gateway', explanation: 'Over the existing connection.', simple: 'Down the open line.' },
          { from: 'gateway', to: 'chat', title: 'Forward', explanation: 'With authenticated identity.', simple: 'Passed to the brain.' },
          { from: 'chat', to: 'store', title: 'Persist + pending', explanation: 'Message stored, and a row added to Bob\'s pending table.', simple: 'Saved in the ledger, and marked "waiting for Bob".' },
          { from: 'chat', to: 'kafka', title: 'Publish event', explanation: 'Alice receives her ✓ and the event is published.', simple: 'Alice sees ✓; message goes on the belt.' },
          { from: 'kafka', to: 'router', title: 'Router consumes', explanation: 'Router reads the event.', simple: 'Delivery helper picks it up.' },
          { from: 'router', to: 'redis', title: 'Where is Bob? — nowhere', explanation: 'No session key: Bob has no live connection.', simple: 'The whiteboard says Bob isn\'t connected.', request: 'GET session:u_2', response: '(nil)' },
          { from: 'router', to: 'push', title: 'Request a push', explanation: 'A push job is enqueued with only minimal content (or none, for privacy/E2EE).', simple: 'Ask the doorbell helper to ring Bob\'s phone.' },
          { from: 'push', to: 'receiver', title: 'Notification', explanation: 'APNs/FCM wakes Bob\'s device. When Bob opens the app, it reconnects and syncs everything after its last seq.', simple: 'Bob\'s phone buzzes. When he opens the app, the message is downloaded.', request: 'POST https://fcm.googleapis.com/v1/projects/app/messages:send\n{"message":{"token":"…","notification":{"title":"Alice","body":"New message"}}}', log: '{"push":"fcm","user":"u_2","status":200}' },
        ],
      },
      {
        id: 'media',
        name: 'Send a photo',
        description: 'Media goes straight to object storage; the message carries only a reference.',
        steps: [
          { from: 'sender', to: 'lb', title: 'Ask for an upload URL', explanation: 'REST call POST /api/v1/media/upload-url returns a pre-signed URL valid for 5 minutes.', simple: 'Alice\'s app asks: "where can I put this photo?"', request: 'POST /api/v1/media/upload-url\n{"contentType":"image/jpeg","size":245112}', response: '{"uploadUrl":"https://media.example-bucket.s3.amazonaws.com/u_1/abc.jpg?X-Amz-Signature=...","mediaRef":"u_1/abc.jpg"}' },
          { from: 'sender', to: 'storage', title: 'Upload directly', explanation: 'The phone uploads the (compressed, encrypted) file straight to object storage. Our servers never carry the bytes.', simple: 'The photo goes straight to the warehouse.', request: 'PUT <uploadUrl>\nContent-Type: image/jpeg\n<binary>' },
          { from: 'lb', to: 'gateway', title: 'Send the message', explanation: 'A normal message.send with mediaRef instead of (or alongside) text.', simple: 'Then a normal message is sent with the warehouse shelf number.', request: '{"type":"message.send","conversationId":"conv_17","mediaRef":"u_1/abc.jpg"}' },
          { from: 'gateway', to: 'chat', title: 'Persist and route', explanation: 'Stored and routed exactly like a text message.', simple: 'Saved and delivered like any message.' },
          { from: 'gateway', to: 'receiver', title: 'Recipient downloads via CDN', explanation: 'Bob\'s app receives the reference and downloads the file from the nearest CDN edge.', simple: 'Bob\'s phone fetches the photo from a nearby copy.' },
        ],
      },
    ],
  },
  apis: [
    {
      method: 'GET', path: '/api/v1/conversations/{id}/messages?before=412&limit=50', summary: 'Load chat history (paginated by seq)', auth: 'Bearer token (member only)',
      response: '{\n  "messages": [{ "messageId": "m_88123", "seq": 412, "from": "u_1", "body": "On my way!", "createdAt": "..." }],\n  "nextBefore": 362\n}',
      errors: [{ status: 403, code: 'NOT_A_MEMBER', when: 'Caller is not in the conversation' }, { status: 404, code: 'NOT_FOUND', when: 'Conversation does not exist' }],
    },
    {
      method: 'POST', path: '/api/v1/conversations/{id}/messages', summary: 'Send a message via REST (fallback when the socket is unavailable)', auth: 'Bearer token',
      request: '{ "clientMsgId": "c-9f2e", "body": "On my way!" }',
      response: 'HTTP 201\n{ "messageId": "m_88123", "seq": 412 }',
      errors: [{ status: 400, code: 'VALIDATION_ERROR', when: 'Empty or oversized body' }, { status: 403, code: 'NOT_A_MEMBER', when: 'Not a member' }, { status: 429, code: 'RATE_LIMITED', when: 'Sending too fast' }],
    },
    {
      method: 'POST', path: '/api/v1/groups', summary: 'Create a group', auth: 'Bearer token',
      request: '{ "name": "Weekend trip", "memberIds": ["u_2", "u_3"] }',
      response: 'HTTP 201\n{ "conversationId": "grp_51", "members": 3 }',
      errors: [{ status: 400, code: 'TOO_MANY_MEMBERS', when: 'More than 256 members' }],
    },
    {
      method: 'POST', path: '/api/v1/media/upload-url', summary: 'Get a pre-signed media upload URL', auth: 'Bearer token',
      request: '{ "contentType": "image/jpeg", "size": 245112 }',
      response: '{ "uploadUrl": "https://...signed...", "mediaRef": "u_1/abc.jpg", "expiresIn": 300 }',
      errors: [{ status: 413, code: 'TOO_LARGE', when: 'File exceeds size limit' }, { status: 415, code: 'UNSUPPORTED_TYPE', when: 'Content type not allowed' }],
    },
  ],
  interviewQuestions: [
    { question: 'How do you guarantee messages are not lost?', answer: 'Persist to a replicated store with a quorum write before acknowledging. The client keeps unacked messages in a local outbox and retries with the same client message ID; the server dedupes.' },
    { question: 'How do you keep messages in order?', answer: 'Assign a per-conversation monotonically increasing sequence number at write time and partition Kafka by conversation ID so one consumer handles a conversation in order. Clients sort by seq.' },
    { question: 'How does the server know which gateway a user is connected to?', answer: 'A session registry in Redis maps userId → gatewayId with a TTL refreshed by heartbeats. Entries expire automatically if a gateway dies.' },
    { question: 'What happens when a gateway with 100k connections crashes?', answer: 'Clients reconnect with exponential backoff and jitter to other gateways, re-register sessions, and sync missed messages using their last seen seq per conversation.' },
    { question: 'How would you support a channel with 1 million subscribers?', answer: 'Switch from push fan-out on write to fan-out on read: store the message once, notify subscribers lightly (or not at all), and let clients pull the latest messages, with heavy caching.' },
  ],
  related: ['url-shortener', 'ecommerce-orders'],
};
