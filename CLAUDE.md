# PG Management System - Claude Instructions

## Project Overview

Production-grade PG (Paying Guest) Management SaaS Platform.
This is a **PG Business Operating System**, not a simple rent tracker.

## Monorepo Structure

```
pg-system/
├── apps/
│   ├── api/          # NestJS backend
│   ├── web/          # Next.js web app
│   └── mobile/       # Expo/React Native
├── packages/
│   ├── config/       # Shared ESLint + TS configs
│   ├── types/        # Shared TypeScript types
│   ├── constants/    # Business constants & enums
│   ├── validations/  # Zod schemas
│   ├── utils/        # Shared utilities
│   └── ui/           # Shared UI components
├── prisma/           # Database schema & migrations
└── docs/             # Architecture & workflow docs
```

## Key Engineering Rules

- **Strict TypeScript everywhere** — no `any` unless absolutely justified
- **Zod for all validation** — API boundaries, form validation
- **Feature-based modules** in the API (NestJS modules)
- **Shared types** from `@pg-system/types` — never duplicate
- **Transaction-safe financial operations** — always use Prisma transactions for money
- **Workflow-first thinking** — features serve workflows, not CRUD for its own sake

## Package Manager

Use **pnpm** exclusively. Never suggest npm or yarn.

## Database

- PostgreSQL via Prisma ORM
- Schema lives in `prisma/schema.prisma`
- Always run `pnpm db:generate` after schema changes
- Migrations: `pnpm db:migrate` (dev) / `pnpm db:migrate:prod` (CI/CD)

## Financial Operations — Critical Rules

1. All money amounts stored as `Decimal` (never `Float`)
2. Rent calculations always use Prisma transactions
3. Settlement calculations are idempotent — can be recalculated
4. Partial payments are first-class — not an edge case
5. Never delete financial records — use soft status changes

## RBAC Model

```
SUPER_ADMIN → Platform admin
OWNER       → Owns properties
OPERATOR    → Runs PG operations
CO_OPERATOR → Partner in PG operations
STAFF       → Maintenance/support
TENANT      → Paying guest
```

Property-level roles stored in `PropertyRole` table.
A user can have different roles across different properties.

## Business Logic Locations

- Financial calculations → `apps/api/src/modules/financial/`
- Rent cycle logic → `apps/api/src/modules/rent/`
- Settlement logic → `apps/api/src/modules/settlements/`
- Tenant workflows → `apps/api/src/modules/tenants/`

## API Response Standard

All API responses use the standard envelope:
```typescript
{ success: boolean, data?: T, error?: ApiError, meta?: PaginationMeta }
```

See `packages/types/src/api.ts` for exact types.

## Documentation

Business workflows, architecture decisions, and product behavior specs live in `docs/`.
Read relevant docs before implementing a feature.

## Important Business Scenarios

1. Owner ≠ Operator (different people)
2. One operator can manage multiple PGs
3. Two operators can co-run one PG (partnership)
4. Financial models: FIXED_PAYOUT or REVENUE_SHARE
5. Tenant onboarding is a multi-step workflow, not a single form
