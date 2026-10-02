# Build context: repository root
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/protocol/package.json packages/protocol/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --workspace @corelayer/protocol --workspace @corelayer/server --include-workspace-root
COPY packages/protocol packages/protocol
COPY server server
RUN npm run build -w @corelayer/protocol && npm run build -w @corelayer/server \
 && npm prune --omit=dev --workspace @corelayer/protocol --workspace @corelayer/server

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/packages/protocol/package.json packages/protocol/package.json
COPY --from=build /app/packages/protocol/dist packages/protocol/dist
COPY --from=build /app/server/package.json server/package.json
COPY --from=build /app/server/dist server/dist
USER node
EXPOSE 3000
CMD ["node", "server/dist/index.js"]
