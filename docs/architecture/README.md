# Architecture Documentation

Core system architecture for the PG Management SaaS platform.

---

## Architecture Principles

- **Modular**: each domain is an independent NestJS module with its own controller, service, and DTOs
- **Shared domain logic**: business rules live in services, not controllers
- **Transaction-safe financial operations**: all money flows use `prisma.$transaction`
- **Clean separation of concerns**: controllers are thin; services own orchestration
- **Centralized validation**: DTOs use class-validator; shared schemas in `@pg-system/validations`
- **Shared types**: `@pg-system/types` eliminates frontend/backend type drift

---

## System Overview

```
┌─────────────────────────────────────────────┐
│              Client Apps                     │
│   apps/web (Next.js)  │  apps/mobile (Expo) │
└─────────────────────────────────────────────┘
                    │ HTTPS REST
┌─────────────────────────────────────────────┐
│              apps/api (NestJS)               │
│  Auth │ Properties │ Rooms │ Tenants         │
│  Rent │ Financial  │ Settlements             │
│  Complaints │ Dashboard │ Notifications      │
└─────────────────────────────────────────────┘
                    │ Prisma
┌─────────────────────────────────────────────┐
│           PostgreSQL Database                │
└─────────────────────────────────────────────┘
```

---

## Backend Module Map

| Module | Controller | Service | Key Responsibilities |
|---|---|---|---|
| Auth | `auth.controller.ts` | `auth.service.ts` | JWT login, register, refresh token rotation |
| Properties | `properties.controller.ts` | `properties.service.ts` | Property CRUD, role assignment |
| Rooms | `rooms.controller.ts` | `rooms.service.ts` | Room + auto-bed creation |
| Tenants | `tenants.controller.ts` | `tenants.service.ts` + `tenant-workflow.service.ts` | Tenant CRUD + state machine |
| Rent | `rent.controller.ts` | `rent.service.ts` | Cycle generation, payment recording, overdue marking |
| Financial | `financial.controller.ts` | `financial.service.ts` | Financial model lifecycle |
| Settlements | `settlements.controller.ts` | `settlements.service.ts` | Settlement calculation and history |
| Complaints | `complaints.controller.ts` | `complaints.service.ts` | Complaint lifecycle + comments |
| Dashboard | `dashboard.controller.ts` | `dashboard.service.ts` | Aggregated property stats |
| Notifications | `notifications.controller.ts` | `notifications.service.ts` | Notification delivery and read tracking |

---

## Shared Packages

| Package | Purpose |
|---|---|
| `@pg-system/types` | Shared TypeScript interfaces and enums |
| `@pg-system/constants` | Business constants (sharing capacities, status values) |
| `@pg-system/validations` | Shared Zod/class-validator schemas |
| `@pg-system/utils` | Pure utility functions (date, money, string) |
| `@pg-system/config` | Shared TypeScript and ESLint config |
| `@pg-system/ui` | Shared React components |

---

## Key Architecture Documents

| File | Content |
|---|---|
| [financial-models.md](financial-models.md) | Fixed payout, revenue share, owner-operated models |
| [rbac.md](rbac.md) | Property-scoped role-based access control |
| [ownership-model.md](ownership-model.md) | Owner/operator separation model |
| [multi-property.md](multi-property.md) | How a single account manages multiple properties |

---

## Data Architecture Rules

- All monetary values stored as `Decimal @db.Decimal(10,2)` — never `Float`
- All financial writes use `prisma.$transaction`
- Historical financial records are immutable — never updated, only superseded
- Tenant state transitions are validated before execution — invalid transitions are rejected
- Bed assignments track `isActive` — a tenant can only have one active assignment per property
