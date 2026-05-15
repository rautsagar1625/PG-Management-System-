# ── Stage 1: Install dependencies ────────────────────────────────────────────
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/types/package.json       ./packages/types/
COPY packages/constants/package.json   ./packages/constants/
COPY packages/utils/package.json       ./packages/utils/
COPY packages/validations/package.json ./packages/validations/
COPY packages/config/package.json      ./packages/config/
COPY apps/web/package.json             ./apps/web/

RUN pnpm install --frozen-lockfile

# ── Stage 2: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

COPY --from=deps /app/node_modules        ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules

COPY packages/ ./packages/
COPY apps/web/  ./apps/web/
COPY tsconfig.json ./

# NEXT_PUBLIC_API_URL is baked in at build time.
# Pass it via --build-arg so the browser JS has the correct URL.
ARG NEXT_PUBLIC_API_URL=http://localhost:3001/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN pnpm --filter @pg-system/web build

# ── Stage 3: Production runtime ───────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# next start --standalone only needs these three directories
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static      ./apps/web/.next/static
COPY --from=builder /app/apps/web/public            ./apps/web/public

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
