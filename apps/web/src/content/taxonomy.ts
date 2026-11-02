import type { Category, Tag } from '../shared';

export const categories: Category[] = [
  // Backend concept categories
  { slug: 'nodejs-internals', name: 'Node.js internals', kind: 'concept', description: 'How Node.js runs your code: the event loop, libuv, streams and worker threads.' },
  { slug: 'api-design', name: 'API design', kind: 'concept', description: 'Designing REST APIs that are predictable, versioned, paginated and safe to retry.' },
  { slug: 'databases', name: 'Databases', kind: 'concept', description: 'Indexes, replication, sharding, transactions and choosing between SQL and NoSQL.' },
  { slug: 'distributed-systems', name: 'Distributed systems', kind: 'concept', description: 'What changes when your app runs on many machines: consistency, CAP, consensus and failures.' },
  { slug: 'caching', name: 'Caching', kind: 'concept', description: 'Keeping frequently used data close and fast, and keeping it correct.' },
  { slug: 'message-queues', name: 'Message queues', kind: 'concept', description: 'Doing work later and decoupling services with queues and event streams.' },
  { slug: 'security', name: 'Security', kind: 'concept', description: 'Authentication, authorization, rate limiting and protecting user data.' },
  { slug: 'scalability', name: 'Scalability', kind: 'concept', description: 'Handling more users: vertical vs horizontal scaling, load balancing and statelessness.' },
  { slug: 'observability', name: 'Observability', kind: 'concept', description: 'Knowing what your system is doing through logs, metrics and traces.' },
  { slug: 'devops', name: 'DevOps and deployment', kind: 'concept', description: 'Shipping safely: containers, CI/CD, zero-downtime deploys and rollbacks.' },
  // System design categories
  { slug: 'web-infrastructure', name: 'Web infrastructure', kind: 'design', description: 'Core building blocks of the web such as URL shorteners and CDNs.' },
  { slug: 'messaging', name: 'Messaging', kind: 'design', description: 'Real-time chat and communication systems.' },
  { slug: 'e-commerce', name: 'E-commerce', kind: 'design', description: 'Shopping carts, orders, payments and inventory.' },
  { slug: 'media-streaming', name: 'Media streaming', kind: 'design', description: 'Uploading, processing and streaming video and audio.' },
  { slug: 'marketplace', name: 'Marketplaces', kind: 'design', description: 'Two-sided platforms that match supply and demand in real time.' },
  { slug: 'platform-services', name: 'Platform services', kind: 'design', description: 'Shared internal services such as notifications and payments.' },
];

export const tags: Tag[] = [
  'redis', 'mongodb', 'kafka', 'nodejs', 'express', 'websockets', 'cdn', 'load-balancing', 'sharding',
  'replication', 'rate-limiting', 'idempotency', 'event-driven', 'microservices', 'saga', 'caching', 'interview',
].map((slug) => ({ slug, name: slug }));
