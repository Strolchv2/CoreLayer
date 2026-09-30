# syntax=docker/dockerfile:1.7
# ---------------------------------------------------------------------------
# CV Studio – Frontend (statische Auslieferung über nginx, Proxy für /api)
# Build-Kontext: Repository-Wurzel
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci --no-audit --no-fund
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build --workspace @cv-studio/web

FROM nginx:1.27-alpine AS runtime
COPY deploy/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
# render.html wird nur serverintern für die PDF-Erzeugung benötigt
RUN rm -f /usr/share/nginx/html/render.html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
