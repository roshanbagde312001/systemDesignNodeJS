# System Design Academy

An interactive platform for learning system design and backend engineering. It is written to be understood by complete beginners and to stay useful for interview preparation.

Every page is **simple first, deep second**:

- **The 60-second version**: each system design opens with an everyday analogy. A URL shortener is a coat-check counter; a chat app is a post office with a phone line to every house.
- **Quick read / Deep dive toggle**: Quick read shows only plain-English summaries and diagrams. Deep dive adds APIs, schemas, code and trade-offs.
- **"In plain English" box** at the top of every section.
- **Glossary tooltips**: hover any dashed-underlined word to get a one-line definition. The full list is at `/glossary`.
- **Interactive diagrams**: click any box to see what it does, then play a request step by step.
- **"Start from zero" learning path** for people with no background.

> All architectures are **hypothetical, educational designs**. They are not the verified internal architectures of WhatsApp, YouTube, Amazon or any other company. Estimates are labelled as assumptions, and simulations are illustrative rather than measured.

---

## What's included

| Area | Details |
|---|---|
| **System designs** | URL shortener, messaging app (WhatsApp-like), e-commerce order management. Each has all 22 sections, an interactive diagram with 3 request flows, API specs, schemas and interview Q&A. Video streaming, ride-hailing and notifications are shown as *Planned*. |
| **Backend concepts** | 8 articles: Node.js event loop, Redis caching, rate limiting, database indexing, CAP theorem, horizontal vs vertical scaling, message queues/Kafka, circuit breakers |
| **Architecture patterns** | Monolith, microservices, event-driven, cache-aside, saga, circuit breaker, transactional outbox, pub/sub fan-out |
| **Interactive diagrams** | React Flow viewer with clickable nodes and a details panel (responsibility, inputs, outputs, tech, failure modes). Also: zoom, pan, fit and reset, a legend, animated request flows, previous/play/pause/next playback, and an architecture ↔ sequence view toggle. |
| **Request simulator** | Client → LB → Express → service → Redis/MongoDB, with a cache hit vs miss comparison and example requests, responses and logs |
| **Playground** | 6 architectures (single server → microservices) with a comparison table and a "simulate failure" mode for any component |
| **Search** | Global quick search (press `/` or `Ctrl+K`), plus a full search page with category, difficulty, technology and pattern filters and three sort orders |
| **Learning paths** | 6 guided paths, with per-browser progress tracking |

## Project structure

Everything lives in the frontend. There is no backend server or database: all content is bundled into the site.

```
.
├── apps/
│   └── web/                 React + TypeScript + Vite + MUI frontend
│       ├── src/components/  diagram/ (React Flow viewer), markdown/, layout/, design/
│       ├── src/pages/       pages
│       ├── src/content/     all content: designs, articles, glossary, paths, playground
│       ├── src/shared/      types and search/filter logic
│       ├── src/data/        loads content from src/content
│       └── scripts/         sitemap generator
├── deploy/                  Dockerfile + Nginx config
├── docker-compose.yml
└── .github/workflows/ci.yml
```

To add or edit content, change the files in `apps/web/src/content/` and rebuild.

## Quick start

Requires Node.js 20+ (22 recommended).

```bash
npm install
npm run dev          # http://localhost:5173
```

## Tests

```bash
npm test                          # Vitest + React Testing Library
npm run typecheck
```

Covers Markdown rendering and XSS safety; glossary, callout and diagram syntax; search, filtering and sorting; content integrity (every flow step and edge points at a real node); diagram node details, step navigation, autoplay, sequence view and failure state; cache hit vs miss simulator; design page Quick read; and 404s.

## Deployment (Docker + Nginx)

```bash
cp .env.example .env              # set PUBLIC_URL (and optional footer links)
docker compose up -d --build
# → http://localhost:8080
```

- **web**: a multi-stage build that produces static files served by Nginx. Nginx handles the SPA fallback, gzip, immutable caching for fingerprinted `/assets`, `no-cache` for `index.html`, and security headers including CSP.
- **CI** (`.github/workflows/ci.yml`): `npm ci` → typecheck → tests → build → Docker image build. Add a registry login and `push: true` to publish the image.

Because the build output is plain static files (`apps/web/dist`), you can also host it on any static host (Netlify, Vercel, GitHub Pages, S3 + CloudFront). Configure it to serve `index.html` for unknown paths.

Put TLS in front of Nginx using your load balancer, Caddy, or certbot.

## Design decisions worth knowing

**Sanitization.** Markdown bodies are rendered **without raw HTML** and passed through `rehype-sanitize`, so script injection is impossible; a test covers this.

**Caching.** Build assets are fingerprinted and cached for a year. `index.html` is always revalidated, so a deploy is picked up on the next navigation.

## Planned (not implemented yet)

- The video streaming, ride-hailing and notification designs. They appear in the UI with a "Planned" label.
- Articles on sharding, replication, distributed tracing, zero-downtime deploys, API versioning and event-driven architecture in depth. These are also labelled as planned.
- Bookmarks and newsletter subscriptions.
