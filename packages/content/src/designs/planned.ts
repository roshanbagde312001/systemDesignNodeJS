import type { SystemDesign } from '@sda/shared';

/** Designs announced on the site but not yet written. They render as clearly labelled "Planned" cards. */
function planned(meta: Pick<SystemDesign, 'slug' | 'title' | 'tagline' | 'summary' | 'category' | 'difficulty' | 'readingMinutes' | 'technologies' | 'patterns' | 'tags'>): SystemDesign {
  return {
    ...meta,
    publishedAt: '2026-12-01',
    popularity: 0,
    status: 'planned',
    analogy: { title: '', story: '' },
    sections: [],
    apis: [],
    interviewQuestions: [],
    related: [],
  };
}

export const plannedDesigns: SystemDesign[] = [
  planned({
    slug: 'video-streaming', title: 'Video Streaming Platform (YouTube-like)', tagline: 'Upload, transcode and stream video to millions with adaptive bitrate.',
    summary: 'Chunked uploads, transcoding pipelines, HLS/DASH adaptive streaming, CDN strategy and view counting at scale.',
    category: 'media-streaming', difficulty: 'Advanced', readingMinutes: 35,
    technologies: ['Node.js', 'FFmpeg', 'S3', 'CDN', 'Kafka'], patterns: ['Asynchronous processing', 'Pipeline'], tags: ['cdn', 'kafka'],
  }),
  planned({
    slug: 'ride-hailing', title: 'Ride-hailing Platform', tagline: 'Match riders with nearby drivers in real time.',
    summary: 'Geospatial indexing, real-time location updates, matching, surge pricing and trip state machines.',
    category: 'marketplace', difficulty: 'Advanced', readingMinutes: 35,
    technologies: ['Node.js', 'Redis GEO', 'Kafka', 'WebSockets'], patterns: ['Geospatial indexing', 'Event-driven architecture'], tags: ['redis', 'websockets'],
  }),
  planned({
    slug: 'notification-service', title: 'Notification Service', tagline: 'Send email, SMS and push notifications reliably, without spamming users.',
    summary: 'Multi-channel delivery, user preferences, templating, rate limiting, retries and deduplication.',
    category: 'platform-services', difficulty: 'Intermediate', readingMinutes: 25,
    technologies: ['Node.js', 'Kafka', 'Redis', 'MongoDB'], patterns: ['Publish/subscribe', 'Asynchronous processing'], tags: ['kafka', 'rate-limiting'],
  }),
];

/** Backend topics listed on the site as planned, so users can see what's coming. */
export const plannedArticleTopics = [
  { title: 'Event-driven architecture in depth', category: 'distributed-systems' },
  { title: 'Database sharding', category: 'databases' },
  { title: 'Database replication', category: 'databases' },
  { title: 'Distributed tracing with OpenTelemetry', category: 'observability' },
  { title: 'Zero-downtime deployments', category: 'devops' },
  { title: 'API versioning and pagination', category: 'api-design' },
];
