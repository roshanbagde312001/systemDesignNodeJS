# syntax=docker/dockerfile:1
# ---------- build ----------
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/content/package.json packages/content/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace @sda/web --include-workspace-root --ignore-scripts
COPY tsconfig.base.json ./
COPY packages packages
COPY apps/web apps/web
ARG VITE_SITE_URL=http://localhost:8080
ARG VITE_GITHUB_URL
ARG VITE_LINKEDIN_URL
ARG VITE_CONTACT_EMAIL
ENV VITE_SITE_URL=$VITE_SITE_URL VITE_GITHUB_URL=$VITE_GITHUB_URL VITE_LINKEDIN_URL=$VITE_LINKEDIN_URL VITE_CONTACT_EMAIL=$VITE_CONTACT_EMAIL
RUN npm run build -w @sda/web

# ---------- serve ----------
FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=3s CMD wget -qO- http://127.0.0.1/healthz || exit 1
