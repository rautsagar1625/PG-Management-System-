# PG Management System — Roadmap

> **Last updated:** 2026-05-26  
> **Branch:** staging (17 commits ahead of main)  
> **State:** ~98% complete — all features implemented, API + web + mobile all compile clean, 144 tests passing

---

## What's Done

### ✅ Sprint 1 — Core Platform
- NestJS + Fastify + Prisma monorepo bootstrap
- Auth (JWT access/refresh tokens, password reset, email verification)
- Multi-property RBAC (`OWNER / OPERATOR / CO_OPERATOR / STAFF / TENANT`)
- PostgreSQL schema (27 models) + migrations
- BullMQ job queues (rent-cycle, overdue, notifications)
- Email via Resend, Expo push notifications, rate limiting

### ✅ Sprint 2 — Financial Engine
- Rent cycle generation + overdue marking (scheduled jobs)
- Partial payment support, idempotent settlement recalculation
- Settlement engine: `REVENUE_SHARE` + `FIXED_PAYOUT` models
- PDF receipts via Puppeteer

### ✅ Sprint 3 — Tenant Lifecycle
- Multi-step tenant onboarding (`LEAD → ACTIVE`)
- Bed allocation, room transfer, move-out with financial preview

### ✅ Sprint 4 — Feature Expansion
- Lead CRM, Food menu, Attendance tracking, Autopay configuration
- Rental agreements (PDF + tenant/owner digital signing)
- WhatsApp notifications via Twilio
- KYC document upload + operator verification
- Razorpay payment gateway (live keys + webhook)

### ✅ Sprint 5 — Web App
- 15 dashboard pages — Properties, Rooms (with detail), Tenants (with detail), Collections, Settlements (with detail), Leads, Complaints, Attendance, Food Menu, Autopay, Overdue, Analytics, Audit Logs, Settings
- Property detail: Overview + Rooms + Tenants + Financials + Performance + **Team** tabs
- Tenant detail: Overview + Rent + Payments + History + KYC + Agreements tabs
- Multi-step property creation wizard

### ✅ Sprint 6 — Mobile App
- Expo/React Native: all 9 operator screens + 8 tenant screens
- Razorpay checkout wired in tenant payments screen
- KYC camera/gallery upload with `expo-image-picker`
- Add Tenant FAB + modal on operator tenants screen
- Record Payment modal on operator collections screen
- Push notification deep-linking via `expo-router`
- `useOperatorProperty` hook + multi-property chip strip

### ✅ Sprint 7 — Observability
- Sentry (API + web + mobile), Prometheus metrics
- `GET /health` + `GET /jobs/queues` (BullMQ depth metrics)
- Grafana dashboard JSON

### ✅ Sprint 8 — Completion & Hardening
- Notification preferences: JSONB schema + full-stack API + React Query UI
- WhatsApp status + test-message endpoint + Integrations tab in Settings
- CI/CD: staging branch in GitHub Actions push/PR triggers
- Deployment: `render.yaml` Blueprint + `.env.staging` + `apps/web/.env.example`
- Tests: 144 passing across 9 spec files (dashboard, leads, complaints, kyc added)
- Code quality sweep: replaced all `console.log`, `as any`, raw `Error` throws, typed catch clauses

---

## Genuinely Remaining (~2 days)

### 🚀 Staging → Production Deployment

This is the only real work left. Everything else is code-complete.

**Checklist before go-live:**

- [ ] **Merge staging → main** (17 commits pending; CI validates the branch)
- [ ] **Provision Render.com** using `render.yaml` — set all env vars in Render dashboard
  - Copy from `apps/api/.env.staging` (fill in real secrets)
  - Copy from `apps/web/.env.example` (set `NEXT_PUBLIC_API_URL` to production API URL)
- [ ] **Run DB migration** — `pnpm db:migrate:prod` against production Postgres
- [ ] **Seed initial admin** — create first SUPER_ADMIN user via seed script or direct DB
- [ ] **Configure Twilio** — replace sandbox `+14155238886` with a verified sender number
- [ ] **Verify Razorpay webhooks** — set webhook URL to `https://api.yourdomain.com/api/v1/razorpay/webhook`
- [ ] **Set Sentry DSN** — real project DSNs for API, web, and mobile builds
- [ ] **Smoke test** — login → create property + rooms → onboard tenant → record payment → generate receipt → run settlement → send WhatsApp reminder

### 🔬 Nice-to-Have (polish, not blocking launch)

| Item | Effort | Notes |
|------|--------|-------|
| API Swagger `@ApiResponse` decorators | 1 day | Add typed response schemas to all endpoints |
| E2E Playwright test coverage | 2–3 days | Auth + tenant workflow + payment flow |
| Load test (k6) | 0.5 day | 50 concurrent ops, verify no N+1 queries under load |
| Mobile app store submission | 1 day | App Store + Play Store listing + screenshots |

---

## Architecture Quick Reference

```
pg-system/
├── apps/api/      NestJS + Fastify — 29 modules, 87+ endpoints, 144 tests
├── apps/web/      Next.js 14 App Router — 15 dashboard pages (all complete)
├── apps/mobile/   Expo 51 — 9 operator + 8 tenant screens (all complete)
├── prisma/        27 models, 10 migrations
└── packages/      types, constants, validations, utils, ui
```

**Job queues:** `rent-cycle-queue` (monthly), `overdue-queue` (daily), `notifications-queue` (email + push)  
**Cache:** Redis via `CacheService.wrap()` — dashboard TTL 2 min, property perf TTL 5 min  
**Observability:** Sentry + Prometheus + `/health` + `/jobs/queues`  
**Deploy target:** Render.com (see `render.yaml`) — Singapore region, Postgres 16, Redis noeviction  
**CI:** GitHub Actions on push/PR to `main`, `develop`, `staging` — lint + typecheck + test + Docker build
