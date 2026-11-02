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
| **Admin CMS** | Login; article create/edit/preview/publish/unpublish/delete; categories and tags; system design metadata including diagram image references; learning paths |
| **API** | Versioned REST (`/api/v1`) with Zod validation, central error handling, pagination, filtering, rate limiting, structured logs, and health/readiness probes |

## Project structure

```
.
├── apps/
│   ├── web/                 React + TypeScript + Vite + MUI frontend
│   │   ├── src/components/  diagram/ (React Flow viewer), markdown/, layout/, design/
│   │   ├── src/pages/       public pages + admin/
│   │   ├── src/data/        API client with bundled-content fallback
│   │   └── scripts/         sitemap generator
│   └── api/                 Express + Mongoose backend
│       └── src/
│           ├── config/      env validation (Zod)
│           ├── models/      Mongoose schemas + indexes
│           ├── repositories/ data access (only place with queries)
│           ├── services/    business logic
│           ├── controllers/ HTTP ↔ service mapping
│           ├── middleware/  validation, auth, rate limit, caching, errors
│           ├── routes/      /api/v1 routers
│           └── seed/        idempotent seed script
├── packages/
│   ├── shared/              types, Zod schemas, search/filter logic (used by web AND api)
│   └── content/             all seeded content: designs, articles, glossary, paths, playground
├── deploy/                  Dockerfiles + Nginx config
├── docker-compose.yml
└── .github/workflows/ci.yml
```

The content package is used in two places. The **seed script** loads it into MongoDB, and the **frontend bundles it as a fallback**, so the site still works when the API is down. The footer shows which source is in use ("Content source: live API" or "bundled content").

## Quick start (frontend only, no database)

Requires Node.js 20+ (22 recommended).

```bash
npm install
npm run dev          # http://localhost:5173
```

All public pages work immediately from bundled content. The admin area needs the API.

## Full local setup (frontend + API + MongoDB)

```bash
npm install

# 1. Start MongoDB (Docker), or use your own instance / MongoDB Atlas
docker compose up -d mongo

# 2. Configure the API
cp apps/api/.env.example apps/api/.env
#    edit apps/api/.env: set JWT_ACCESS_SECRET (openssl rand -base64 48) and ADMIN_EMAIL / ADMIN_PASSWORD

# 3. Seed the database (content + first admin user). Safe to re-run.
npm run seed                      # or: npm run seed -w @sda/api -- --reset

# 4. Run both apps (two terminals)
npm run dev:api                   # http://localhost:4000  (health: /health, /ready)
npm run dev                       # http://localhost:5173  (proxies /api to :4000)
```

Admin: <http://localhost:5173/admin>. Sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

## Tests

```bash
npm test                          # web + api
npm test -w @sda/web              # Vitest + React Testing Library
npm test -w @sda/api              # Vitest + Supertest + in-memory MongoDB
npm run typecheck
```

- **Web (31 tests)**: Markdown rendering and XSS safety; glossary, callout and diagram syntax; search, filtering and sorting; content integrity (every flow step and edge points at a real node); diagram node details, step navigation, autoplay, sequence view and failure state; cache hit vs miss simulator; design page Quick read; offline fallback; 404s; admin login and redirect.
- **API (27 tests)**: health and readiness; listing, filtering, sorting and pagination; validation errors with field details; malformed JSON; unknown routes; security headers; login, refresh-token rotation (reuse rejected) and logout; admin authorization (none, forged token); article CRUD, publish/unpublish visibility, HTML stripping, duplicate slugs and invalid ids; category referential integrity; design metadata edits; login rate limiting.

The first API test run downloads a MongoDB binary (~80 MB) for `mongodb-memory-server`.

## Deployment (Docker + Nginx)

```bash
cp .env.example .env              # set JWT_ACCESS_SECRET, ADMIN_*, PUBLIC_URL
docker compose up -d --build
docker compose run --rm api node dist/seed.js
# → http://localhost:8080
```

- **web**: a multi-stage build that produces static files served by Nginx. Nginx handles the SPA fallback, gzip, immutable caching for fingerprinted `/assets`, `no-cache` for `index.html`, and security headers including CSP. It also reverse-proxies `/api` to the API container. Because the site and API share an origin, there are no CORS preflights and `SameSite=Strict` cookies work.
- **api**: a multi-stage build. `tsup` bundles the workspace packages, and the runtime image contains only production dependencies and runs as a non-root user with a healthcheck. It shuts down gracefully on SIGTERM.
- **mongo**: `mongo:7` with a named volume. In production, prefer a managed replica set such as MongoDB Atlas with backups.
- **CI** (`.github/workflows/ci.yml`): `npm ci` → typecheck → web tests → API tests → build → Docker image builds. Add a registry login and `push: true` to publish images.

Put TLS in front of Nginx using your load balancer, Caddy, or certbot.

## Design decisions worth knowing

**Authentication.** The admin uses a short-lived JWT access token (15 min) held **in memory only**, plus a refresh token in an `httpOnly`, `SameSite=Strict`, path-scoped cookie. Refresh tokens are stored **hashed** and **rotated** on every use, so a stolen, already-used token is rejected. Login is rate-limited (10 failures per 15 minutes) and takes the same time whether or not the email exists. Roles: `admin` and `editor`. Only admins can manage categories or delete paths and tags.

**Sanitization.** Plain-text fields (titles, summaries) have HTML stripped on the server. Markdown bodies are stored unchanged, because code samples contain `<` and `>`. They are rendered **without raw HTML** and passed through `rehype-sanitize`, so script injection is impossible; a test covers this.

**Caching and invalidation.**
- Public API GETs send `Cache-Control: public, max-age=60, stale-while-revalidate=300`. An admin edit becomes visible within about 1 minute, with no manual purge needed. Shorten `max-age` in `middleware/index.ts` if you need faster propagation.
- Admin and auth responses are `no-store`.
- Build assets are fingerprinted and cached for a year. `index.html` is always revalidated, so a deploy is picked up on the next navigation.

**Validation consistency.** The same Zod schemas in `packages/shared` validate admin forms in the browser and requests in the API. Mongoose schemas mirror the same limits as a last line of defence.

**Indexes.** Unique `slug` on every collection; `{status, category, publishedAt}` and `{status, popularity}` for listings; weighted text indexes for search; and `refreshTokens.hash` for refresh lookups. `autoIndex` is off in production, and the seed script runs `syncIndexes()`.

**Rate limiting** uses an in-memory store, which is correct for a single API instance. If you run several instances, switch to a Redis store such as `rate-limit-redis`.

## Planned (not implemented yet)

- The video streaming, ride-hailing and notification designs. They appear in the UI with a "Planned" label.
- Articles on sharding, replication, distributed tracing, zero-downtime deploys, API versioning and event-driven architecture in depth. These are also labelled as planned.
- File upload for diagram images. The admin currently stores a **URL reference** to an externally hosted image.
- Bookmarks and newsletter subscriptions.
