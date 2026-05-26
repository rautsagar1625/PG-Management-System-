# PG Management System — Roadmap

> **Last updated:** 2026-05-26  
> **Branch:** staging (15 commits ahead of main)  
> **State:** ~95% complete — backend 100%, web 90%, mobile 80%, infra 100%

---

## What's Done

### ✅ Sprint 1 — Core Platform (completed)
- NestJS + Fastify + Prisma monorepo bootstrap
- Auth (JWT access/refresh tokens, password reset, email verification)
- Multi-property RBAC (`OWNER / OPERATOR / CO_OPERATOR / STAFF / TENANT`)
- PostgreSQL schema (27 models) + all migrations
- BullMQ job queues (rent-cycle, overdue, notifications)
- Email via Resend (`EmailModule`)
- Expo push notifications (`PushModule`)
- Rate limiting, request logging, correlation IDs

### ✅ Sprint 2 — Financial Engine (completed)
- Rent cycle generation + overdue marking (scheduled jobs)
- Partial payment support with running `remainingAmount`
- Settlement engine: `REVENUE_SHARE` + `FIXED_PAYOUT` models
- PDF receipts (Puppeteer) — `GET /receipts/:id/pdf`
- Idempotent settlement recalculation

### ✅ Sprint 3 — Tenant Lifecycle (completed)
- Multi-step tenant onboarding workflow (`LEAD → ACTIVE`)
- Bed allocation + room transfer
- Move-out workflow with financial preview + deposit handling
- Tenant state machine guards

### ✅ Sprint 4 — Feature Expansion (completed)
- Lead CRM (pipeline: NEW → QUALIFIED → VISIT → CONVERTED/LOST)
- Food menu management
- Attendance tracking
- Autopay configuration
- Rental agreements with PDF generation + tenant/owner signing
- WhatsApp notifications via Twilio
- KYC document upload + operator verification workflow
- Razorpay payment gateway (live keys)

### ✅ Sprint 5 — Web App (completed)
- Next.js dashboard with enterprise visual redesign
- Properties, Rooms, Tenants, Collections, Settlements pages
- Tenant detail: Overview, Rent, Payments, History, KYC, Agreements tabs
- Multi-step property wizard (create property with rooms + beds)
- Analytics / dashboard aggregates

### ✅ Sprint 6 — Mobile App (completed)
- Expo/React Native tenant app (home, payments, profile, complaints)
- Operator app (dashboard, tenants, rooms, collections, settlements, attendance-log, leads)
- Push notification deep-linking
- `useOperatorProperty` hook — multi-property chip strip on operator screens

### ✅ Sprint 7 — Observability (completed)
- Sentry integration (API + web + mobile) with transaction tracing
- `GET /health` detailed endpoint (DB ping, Redis ping, queue depth)
- `GET /jobs/queues` — BullMQ queue depth metrics across all 3 queues
- Prometheus metrics via `@willsoto/nestjs-prometheus`
- Grafana dashboard JSON in `docs/grafana-dashboard.json`

### ✅ Sprint 8 — Web & Mobile Feature Completion (completed)
- Notification preferences: full stack (JSONB schema + API + React Query UI)
- WhatsApp status + test-message endpoint + Integrations tab in Settings
- Settings page: Profile, Notifications, Security, Integrations tabs
- CI/CD: staging branch added to GitHub Actions push/PR triggers
- Deployment: `render.yaml` Blueprint (API + Web + Postgres 16 + Redis)
- `.env.staging` template with inline documentation
- Tests: 144 passing across 9 spec files (dashboard, leads, complaints, kyc added)

---

## What Remains

### 🔧 API Layer Gaps (small surface, high value)

| Item | File | Work |
|------|------|------|
| Room edit endpoint | `rooms.controller.ts` | `PATCH /rooms/:id` — add `UpdateRoomDto`, `RoomsService.update()` |
| Bed edit endpoint | `beds.controller.ts` | `PATCH /beds/:id` — add `UpdateBedDto`, `BedsService.update()` |
| Property role management | `properties.controller.ts` | `GET/POST/DELETE /properties/:id/roles` — add/remove operators |

---

### 🌐 Web UI Gaps

#### Room Detail Page  
**Route:** `/dashboard/rooms/[id]`  
Currently the rooms grid is read-only — clicking has nowhere to go.

```
/dashboard/rooms/[id]
  ├── Header: Room name, type, floor, base rent — inline edit
  ├── Bed Grid (reuse existing BedGrid component)
  │   ├── OCCUPIED → tenant name + rent chip → tenant detail link
  │   └── AVAILABLE → "Allocate Bed" action
  └── Allocation History tab
```

**Files to create:**
- `apps/web/src/app/(dashboard)/dashboard/rooms/[id]/page.tsx`

---

#### Property Team Tab  
**Route:** `/dashboard/properties/[id]` → new "Team" tab  
No UI to see or manage who has operator/staff roles on a property.

```
Team tab:
├── List: avatar, name, role badge, date added, remove [✕]
├── [+ Add Member] → user search → role picker → POST /properties/:id/roles
└── OWNER row is un-removable
```

**Files to create:**
- `apps/web/src/lib/properties-api.ts` (add `getPropertyRoles`, `addPropertyRole`, `removePropertyRole`)
- Add TeamTab component + tab to property detail page

---

#### Move-Out UI Polish  
The API `PUT /tenants/:id/move-out` + `GET /tenants/:id/move-out-preview` exist. The web flow currently has no structured 2-step modal.

```
Step 1 — Preview:
  Pending dues, deposit, deductions, refund amount, move-out date picker
Step 2 — ConfirmModal (existing component)
```

---

#### Settlement Detail Page  
**Route:** `/dashboard/settlements/[id]`  
Currently settlements list exists but no detail/drill-down view.

```
  Period, property, parties (owner/operator), financial model
  ├── Total collections, shares, payout amounts
  ├── Status chip + [Mark as Settled] action
  └── [Download PDF]
```

---

### 📱 Mobile Gaps

| Item | Screen | Status |
|------|--------|--------|
| Razorpay checkout wiring | `(tenant)/payments.tsx` | SDK installed, checkout not triggered |
| Add Tenant flow (multi-step) | `(operator)/tenants/new.tsx` | Screen doesn't exist |
| Record payment quick-action | `(operator)/collections.tsx` | Long-press bottom sheet missing |
| KYC document camera upload | `(tenant)/kyc.tsx` | Picker not wired |

---

### 🚀 Pre-Launch Checklist

Before promoting staging → main and going live:

- [ ] **Merge staging → main** (15 commits pending; CI now validates staging)
- [ ] **Provision Render.com** using `render.yaml` — set all env vars in Render dashboard
- [ ] **Seed production DB** — `pnpm db:migrate:prod` + run seed for initial admin user
- [ ] **Configure real Twilio number** — replace sandbox `+14155238886` with verified sender
- [ ] **Verify Razorpay webhooks** — set webhook URL to `https://api.yourdomain.com/api/v1/razorpay/webhook`
- [ ] **Set Sentry DSN** — real project DSNs for API, web, and mobile
- [ ] **Load test** — k6 or Artillery: 50 concurrent operators, 200 req/s for 5 minutes
- [ ] **Smoke test checklist** — login → create property → add tenant → record payment → generate receipt → settlement → WhatsApp reminder

---

## Timeline

| Work | Estimate |
|------|----------|
| API gaps (3 endpoints) | 0.5 day |
| Room detail page | 1 day |
| Property team tab | 1 day |
| Move-out + settlement UI | 1 day |
| Mobile Razorpay + add tenant flow | 2 days |
| Provisioning + smoke test | 1 day |
| **Total remaining** | **~7 days** |

---

## Architecture Quick Reference

```
pg-system/
├── apps/api/      NestJS + Fastify — 29 modules, 87+ endpoints
├── apps/web/      Next.js 14 App Router — 15 dashboard pages
├── apps/mobile/   Expo 51 — tenant + operator tabs
├── prisma/        27 models, 10 migrations
└── packages/      types, constants, validations, utils, ui
```

**Job queues:** `rent-cycle-queue` (monthly generation), `overdue-queue` (daily mark), `notifications-queue` (email + push)  
**Cache:** Redis via `CacheService.wrap()` — dashboard TTL 2 min, property perf TTL 5 min  
**Observability:** Sentry + Prometheus + `/health` + `/jobs/queues`  
**Deploy target:** Render.com (see `render.yaml`) — Singapore region, Postgres 16, Redis noeviction
