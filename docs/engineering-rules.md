# Engineering Rules

Standards for all code in this monorepo. Applies to every developer and all AI-generated code.

---

## Language Rules

- **Strict TypeScript only** — `"strict": true` in all tsconfigs
- **No `any` types** — use `unknown` and narrow, or define an explicit type
- **No implicit `any`** — TypeScript errors must be fixed, not suppressed with `@ts-ignore`
- **Shared types first** — before defining a new type, check `@pg-system/types`

---

## Naming Conventions

| Context | Convention | Example |
|---|---|---|
| Files | kebab-case | `tenant-workflow.service.ts` |
| Components | PascalCase | `TenantCard.tsx` |
| Variables/functions | camelCase | `recordPayment()` |
| DB tables | snake_case | `rent_cycles` |
| API endpoints | kebab-case | `/api/rent/mark-overdue` |
| Env vars | SCREAMING_SNAKE | `DATABASE_URL` |
| Constants | SCREAMING_SNAKE | `MAX_SHARING_CAPACITY` |

---

## Module Structure

Every backend module must follow this layout:

```
modules/<module-name>/
├── <module>.controller.ts
├── <module>.service.ts
├── <module>.module.ts
└── (additional services if needed, e.g. tenant-workflow.service.ts)
```

DTOs are defined directly in the service file for Phase 1. Extract to `dto/` when a module grows past 3 DTOs.

---

## Backend Rules

- **Thin controllers** — controllers handle routing, auth guards, and parameter extraction only
- **Business logic in services** — all orchestration, validation, and state decisions belong in the service layer
- **Prisma in services** — do not call `this.prisma` from controllers
- **DB transactions mandatory** for all financial operations:
  - Rent payment recording
  - Deposit adjustments
  - Settlement calculation
  - Any write that touches two or more tables
- **DTO validation mandatory** — use `class-validator` decorators; the global `ValidationPipe` enforces this

---

## Financial Safety Rules

These are non-negotiable:

1. All monetary values use `Prisma.Decimal` — never JavaScript `number` for money
2. All money stored as `Decimal(10,2)` in PostgreSQL — never `Float` or `Real`
3. Any operation that reads and writes financial state uses `prisma.$transaction`
4. Historical records (rent cycles, settlements, financial models) are **immutable** — create new records, never update old ones
5. Settlement calculations produce a JSON breakdown for audit trail
6. Overpayments are tracked as credit — never silently discarded

---

## Frontend Rules

- **React Query for all server state** — no manual fetch calls in components
- **Shared validation schemas** — forms use `@pg-system/validations` schemas, not ad-hoc validation
- **Shared UI components** — check `@pg-system/ui` before creating a new component
- **No business logic in components** — data transformation belongs in hooks or utilities

---

## API Response Rules

Every endpoint returns the standard envelope:

```typescript
// Success
{ success: true, data: T }

// Error
{ success: false, message: string, errors?: string[] }
```

The global `ResponseInterceptor` handles success wrapping. Throw NestJS HTTP exceptions for errors — the global `AllExceptionsFilter` formats them.

---

## Git Rules

Branch naming:
```
feature/<module-name>
bugfix/<description>
refactor/<description>
docs/<description>
```

Commit message format:
```
feat(module): description
fix(module): description
refactor(module): description
docs: description
chore: description
```

---

## Pull Request Rules

Every PR must include:

1. **Purpose** — what problem this solves
2. **API changes** — new or modified endpoints
3. **DB changes** — new migrations or schema changes
4. **Edge cases handled** — non-happy paths tested
5. **Screenshots** — for UI changes

---

## What Not To Do

- Do not add `any` to fix a TypeScript error — fix the type
- Do not write financial logic outside a Prisma transaction
- Do not put business logic in controllers
- Do not use `Float` for money in the database
- Do not update historical financial records — create new ones
- Do not duplicate types that exist in `@pg-system/types`
- Do not skip DTO validation
