FROM node:22-bookworm-slim

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/auth/package.json ./apps/auth/
COPY apps/auth/drizzle.config.ts ./apps/auth/
COPY apps/auth/database ./apps/auth/

RUN pnpm install --frozen-lockfile

COPY apps/web ./apps/web
COPY apps/auth ./apps/auth

RUN pnpm run build

ENV NODE_ENV=production
ENV DB_FILE_NAME=./database/sqlite.db

WORKDIR /app/apps/auth
EXPOSE 3001

CMD ["sh", "-c", "pnpm exec drizzle-kit migrate && node dist/index.js"]
