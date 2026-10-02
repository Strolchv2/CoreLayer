# Build context: repository root (the client embeds docs/public)
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/protocol/package.json packages/protocol/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --workspace @corelayer/protocol --workspace @corelayer/client --include-workspace-root
COPY packages/protocol packages/protocol
COPY client client
COPY docs docs
RUN npm run build -w @corelayer/protocol && npm run build -w @corelayer/client

FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY infra/nginx/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/client/dist /usr/share/nginx/html
EXPOSE 8080 8443
