FROM node:22-bookworm-slim

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma prisma
COPY prisma.config.ts ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build
COPY fly-entrypoint.sh /usr/local/bin/fly-api-entrypoint
RUN chmod +x /usr/local/bin/fly-api-entrypoint

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001
ENTRYPOINT ["/usr/local/bin/fly-api-entrypoint"]
