# PG Management SaaS

A production-grade Paying Guest (PG) Management SaaS platform built for real-world PG business operations in India. Inspired by RentOk — built to exceed it.

---

## What This System Does

Manages the complete lifecycle of PG operations:

- Multi-property management under a single account
- Owner/operator separation with financial model configuration
- Tenant lifecycle: lead → onboarding → active → move-out
- Rent collection, receipts, and ledger management
- Complaint and maintenance workflows
- Financial settlements: fixed payout and revenue share
- Mobile app for tenants and staff

---

## Tech Stack

| Layer | Technology |
|---|---|
| Web Dashboard | Next.js 14, React 18, Tailwind CSS |
| Mobile App | React Native, Expo |
| Backend | NestJS, Fastify adapter |
| Database | PostgreSQL, Prisma ORM |
| Auth | JWT + Refresh Token rotation |
| Monorepo | Turborepo, pnpm workspaces |
| Language | TypeScript (strict) |

---

## Monorepo Structure

```
/
├── apps/
│   ├── api/          → NestJS Backend API
│   ├── web/          → Admin & Operator Dashboard (Next.js)
│   └── mobile/       → Tenant + Manager Mobile App (Expo)
├── packages/
│   ├── types/        → @pg-system/types
│   ├── constants/    → @pg-system/constants
│   ├── validations/  → @pg-system/validations
│   ├── utils/        → @pg-system/utils
│   ├── config/       → @pg-system/config
│   └── ui/           → @pg-system/ui
├── prisma/
│   └── schema.prisma
└── docs/
    ├── architecture/
    ├── workflows/
    ├── api-specs/
    └── product-behavior/
```

---

## API Modules (Phase 1)

| Module | Description |
|---|---|
| Auth | JWT login, register, refresh token |
| Properties | Multi-property CRUD + role assignment |
| Rooms | Room + bed management |
| Tenants | Full tenant lifecycle state machine |
| Rent | Cycle generation, payment recording, receipts |
| Financial | Financial model configuration |
| Settlements | Owner settlement calculation |
| Complaints | Complaint lifecycle + comments |
| Dashboard | Aggregated stats per property |
| Notifications | Tenant and staff notifications |

---

## RBAC (Property-Scoped)

| Role | Access |
|---|---|
| OWNER | Full visibility + financial config |
| OPERATOR | Operational management + rent collection |
| CO_OPERATOR | Shared ops access |
| STAFF | Daily ops + complaints |
| TENANT | Self-access only |

---

## Financial Models

| Model | Description |
|---|---|
| FIXED_PAYOUT | Owner receives fixed monthly amount; operator keeps rest |
| REVENUE_SHARE | Profit split by configured percentage |
| OWNER_OPERATED | Single owner operates; no split required |

---

## Core Principles

- **Workflow-first**: business workflows defined before code
- **Transaction-safe**: all financial operations use Prisma transactions
- **Shared types**: zero duplication between frontend and backend
- **Modular**: each business domain is an independent NestJS module
- **Auditable**: all financial and tenant state changes are logged

---

## Commands

```bash
# Install dependencies
pnpm install

# Run all apps in dev
pnpm dev

# Run API only
pnpm dev --filter=@pg-system/api

# Run web only
pnpm dev --filter=@pg-system/web

# Build all
pnpm build

# Lint all
pnpm lint

# Type check
pnpm type-check

# DB migrations
pnpm db:migrate

# DB studio
pnpm db:studio
```

---

## Documentation

- [Architecture](docs/architecture/README.md)
- [Workflows](docs/workflows/README.md)
- [API Specs](docs/api-specs/README.md)
- [Product Behavior](docs/product-behavior/README.md)
- [Engineering Rules](docs/engineering-rules.md)
