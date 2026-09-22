FROM node:22-bookworm-slim

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json backend/package.json
COPY backend/prisma backend/prisma
COPY backend/prisma.config.ts backend/prisma.config.ts
COPY frontend/package.json frontend/package.json
RUN pnpm install --frozen-lockfile

COPY backend backend
RUN pnpm --filter api run build
COPY fly.api.entrypoint.sh /usr/local/bin/fly-api-entrypoint
RUN chmod +x /usr/local/bin/fly-api-entrypoint

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001
ENTRYPOINT ["/usr/local/bin/fly-api-entrypoint"]
