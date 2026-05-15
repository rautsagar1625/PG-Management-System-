# ── Stage 1: Install dependencies ────────────────────────────────────────────
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

# Copy workspace manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/types/package.json       ./packages/types/
COPY packages/constants/package.json   ./packages/constants/
COPY packages/utils/package.json       ./packages/utils/
COPY packages/validations/package.json ./packages/validations/
COPY packages/config/package.json      ./packages/config/
COPY apps/api/package.json             ./apps/api/

RUN pnpm install --frozen-lockfile

# ── Stage 2: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

COPY --from=deps /app/node_modules        ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules

# Copy source
COPY packages/ ./packages/
COPY apps/api/  ./apps/api/
COPY prisma/    ./prisma/
COPY tsconfig.json ./

# Generate Prisma client
RUN pnpm --filter @pg-system/api exec prisma generate --schema=../../prisma/schema.prisma

# Build NestJS
RUN pnpm --filter @pg-system/api build

# ── Stage 3: Production runtime ───────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

ENV NODE_ENV=production

# Only the files needed to run
COPY --from=builder /app/node_modules                         ./node_modules
COPY --from=builder /app/apps/api/node_modules                ./apps/api/node_modules
COPY --from=builder /app/apps/api/dist                        ./apps/api/dist
COPY --from=builder /app/prisma                               ./prisma
COPY --from=builder /app/apps/api/package.json                ./apps/api/package.json
COPY package.json pnpm-workspace.yaml ./

# Entrypoint: run migrations then start
COPY apps/api/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 3001
ENTRYPOINT ["/docker-entrypoint.sh"]
