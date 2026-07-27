# syntax=docker/dockerfile:1

ARG NODE_VERSION=22

# ---- base ----
FROM node:${NODE_VERSION}-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app

# ---- deps ----
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/auth/package.json ./apps/auth/
RUN pnpm install --frozen-lockfile

# ---- build ----
FROM deps AS builder
ARG VITE_BRAND_NAME
ARG VITE_BRAND_LOGIN_KICKER
ENV VITE_BRAND_NAME=$VITE_BRAND_NAME \
    VITE_BRAND_LOGIN_KICKER=$VITE_BRAND_LOGIN_KICKER
COPY apps/web ./apps/web
COPY apps/auth ./apps/auth
RUN pnpm --filter=web build \
 && pnpm --filter=auth build \
 && pnpm --filter=auth deploy --prod --legacy /pruned \
 # Alpine では musl のみ必要。未使用の gnu / better-sqlite3 / 型定義を削除
 && rm -rf \
      /pruned/src \
      /pruned/README.md \
      /pruned/drizzle.config.ts \
      /pruned/tsconfig.json \
      /pruned/.env.example \
      /pruned/node_modules/.pnpm/@libsql+linux-x64-gnu@* \
      /pruned/node_modules/.pnpm/@libsql+linux-arm64-gnu@* \
      /pruned/node_modules/.pnpm/better-sqlite3@* \
      /pruned/node_modules/.pnpm/@types+* \
 && find /pruned/node_modules -type f \( -name '*.md' -o -name '*.map' -o -name 'LICENSE*' -o -name 'CHANGELOG*' \) -delete \
 && find /pruned/node_modules -type d -empty -delete

# ---- runtime (auth prod deps + web static only) ----
FROM node:${NODE_VERSION}-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app

COPY --from=builder /pruned ./
COPY --from=builder /app/apps/auth/dist ./dist
COPY --from=builder /app/apps/auth/database/migrations ./database/migrations
# index.ts resolves ../../web/dist from dist/ → /web/dist
COPY --from=builder /app/apps/web/dist /web/dist

EXPOSE 3001
CMD ["node", "dist/index.js"]
