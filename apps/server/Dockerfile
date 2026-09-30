# syntax=docker/dockerfile:1.7
# ---------------------------------------------------------------------------
# CV Studio – Backend (REST API + serverseitige PDF-Erzeugung mit Chromium)
# Build-Kontext: Repository-Wurzel
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci --no-audit --no-fund

# Render-Bundle (render.html + Vorlagen + Schriften) und Server bauen
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
COPY apps/server apps/server
RUN npm run build --workspace @cv-studio/web \
 && npm run build --workspace @cv-studio/server

# Produktionsabhängigkeiten des Servers
FROM node:22-bookworm-slim AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev --workspace @cv-studio/server --include-workspace-root=false --no-audit --no-fund

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    STORAGE_DIR=/data \
    RENDER_BUNDLE_DIR=/app/web-dist \
    PORT=4000
WORKDIR /app
# pg_dump für Backups, Chromium (Headless Shell) inkl. Systembibliotheken für die PDF-Erzeugung
RUN apt-get update \
 && apt-get install -y --no-install-recommends postgresql-client ca-certificates tini \
 && rm -rf /var/lib/apt/lists/*
COPY --from=prod-deps /app/node_modules ./node_modules
RUN npx --yes playwright-core@1.56.1 install --with-deps chromium-headless-shell \
 && rm -rf /var/lib/apt/lists/* /root/.npm
COPY --from=build /app/apps/server/dist ./dist
COPY --from=build /app/apps/server/package.json ./package.json
COPY --from=build /app/apps/web/dist ./web-dist
# Unprivilegierter Benutzer (Sandbox-Einstellung für Chromium: CHROMIUM_NO_SANDBOX, siehe docker-compose.yml)
RUN groupadd --system cvstudio && useradd --system --gid cvstudio --home /app cvstudio \
 && mkdir -p /data && chown -R cvstudio:cvstudio /data
USER cvstudio
VOLUME ["/data"]
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/index.js"]
