FROM node:22-bookworm-slim

WORKDIR /app
ARG POSTGRES_MAJOR=18
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl openssh-client \
    && mkdir -p /usr/share/postgresql-common/pgdg \
    && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
       -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
    && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" \
       > /etc/apt/sources.list.d/pgdg.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends postgresql-client-${POSTGRES_MAJOR} \
    && rm -rf /var/lib/apt/lists/*
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
