# syntax=docker/dockerfile:1

# ── Build stage ───────────────────────────────────────────────────────────────
# Bundles the backend + frontend with esbuild. `better-sqlite3`/`tsdav` are kept
# external by the bundle, so they (and only they, plus their deps) must survive in
# node_modules for the runtime stage — hence `npm prune --omit=dev` at the end.
# Node 25 is required (Temporal API behaviour); build tools are present so
# better-sqlite3 can compile from source if no prebuilt binary exists for this ABI.
FROM node:25-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update \
	&& apt-get install -y --no-install-recommends python3 make g++ \
	&& rm -rf /var/lib/apt/lists/*

# Install with the lockfile first, copying only manifests so this layer caches
# until dependencies actually change. Workspace manifests are needed for the graph.
COPY package.json package-lock.json ./
COPY src/backend/package.json src/backend/
COPY src/frontend/package.json src/frontend/
COPY src/shared/package.json src/shared/
RUN npm ci

# The version string + commit hash baked into the bundles (see scripts/esbuild.ts). The build context
# has no .git, so CI computes them and passes them through; an argless local build falls back to `dev`.
ARG MITRA_VERSION
ARG MITRA_COMMIT
ENV MITRA_VERSION=$MITRA_VERSION MITRA_COMMIT=$MITRA_COMMIT

# Build (esbuild reads tsconfig.json for the `shared` path alias).
COPY tsconfig.json ./
COPY assets ./assets
COPY scripts ./scripts
COPY src ./src
RUN npm run build

# Strip dev dependencies — leaves the runtime externals (better-sqlite3, tsdav, …).
RUN npm prune --omit=dev

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:25-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Built artifacts + the pruned production dependency tree. Both stages share the
# same base image, so the prebuilt better-sqlite3 native binary is ABI-compatible.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/out ./out
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

# SQLite database lives here; mount a volume to persist it across container updates.
RUN mkdir -p /app/data
VOLUME /app/data

EXPOSE 3000

# Liveness/readiness for orchestrators and `docker ps`. slim images ship no curl, so probe with
# Node's built-in http (node -e runs CommonJS, so require() is fine). Honors MITRA_PORT, defaulting
# to the container-internal 3000. start-period covers ORM init + schema sync at boot.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
	CMD node -e "const p=process.env.MITRA_PORT||3000;require('http').get('http://127.0.0.1:'+p+'/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

# Links the image to its repo on GHCR (README, permissions) and stamps metadata.
LABEL org.opencontainers.image.source="https://github.com/a11delavar/mitra"
LABEL org.opencontainers.image.description="Mitra — an open, self-hostable calendar & task planner that unifies your events, to-dos, and the calendars you already use."
LABEL org.opencontainers.image.licenses="AGPL-3.0-only"

CMD ["node", "out/server/server.mjs"]
