FROM node:22-bookworm-slim AS build

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json backend/package.json
COPY backend/prisma backend/prisma
COPY backend/prisma.config.ts backend/prisma.config.ts
COPY frontend/package.json frontend/package.json
RUN pnpm install --frozen-lockfile

COPY frontend frontend
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_SITE_EMAIL
ENV NEXT_PUBLIC_SITE_EMAIL=$NEXT_PUBLIC_SITE_EMAIL
RUN test -n "$NEXT_PUBLIC_API_URL"
RUN test -n "$NEXT_PUBLIC_SITE_URL" -a -n "$NEXT_PUBLIC_SITE_EMAIL"
RUN pnpm --filter web run build

FROM node:22-bookworm-slim
WORKDIR /app
RUN corepack enable
COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/frontend/node_modules frontend/node_modules
COPY --from=build /app/frontend/.next frontend/.next
COPY --from=build /app/frontend/public frontend/public

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["pnpm", "--filter", "web", "run", "start"]
