# PG Management System — Completion Roadmap

> **Generated:** 2026-05-25  
> **Current branch:** staging  
> **Status:** Backend 100% complete · Web 70% complete · Mobile 40% complete · Infra 80% complete

---

## Executive Summary

The backend API is production-ready with 29 modules fully wired. The database schema (27 models) is solid.
The gaps are all in the **frontend (web + mobile)** and **infra provisioning**.

This roadmap is split into **4 phases**, each independently shippable.

---

## Phase 1 — Web UI: Critical Feature Gaps
**Target:** 2–3 weeks  
**Goal:** Every feature the API supports has a working web UI. Operators can do their full job from the web app.

---

### 1.1 — API Layer Fixes (prerequisite for UI work)

These are missing backend endpoints blocking Phase 1 UI work.

#### 1.1.1 — Room Edit Endpoint
**File:** `apps/api/src/modules/rooms/rooms.controller.ts`  
**Problem:** `PATCH /rooms/:id` does not exist — operator cannot edit a room's name, type, or base rent from the web.  
**Work:**
- Add `UpdateRoomDto` to `apps/api/src/modules/rooms/dto/room.dto.ts`
- Add `update()` method to `RoomsService`
- Add `@Patch(':id')` route to `RoomsController`

#### 1.1.2 — Bed Edit Endpoint
**File:** `apps/api/src/modules/beds/beds.controller.ts`  
**Problem:** No `PATCH /beds/:id` — operator cannot change bed label or status.  
**Work:**
- Add `UpdateBedDto`
- Add `update()` in `BedsService`
- Add `@Patch(':id')` in `BedsController`

#### 1.1.3 — Operator Management Endpoints
**File:** `apps/api/src/modules/properties/properties.controller.ts`  
**Problem:** `PropertyRole` model exists in DB but the controller has NO endpoints to manage property-level roles. You cannot add/remove operators from the web.  
**Work:**
- `POST   /properties/:id/roles` — assign a role to a user on this property
- `GET    /properties/:id/roles` — list all users with roles on this property
- `DELETE /properties/:id/roles/:userId` — remove a user's role from this property
- Add `PropertyRolesService` methods and DTOs

---

### 1.2 — Room Detail Page
**Route:** `/dashboard/rooms/[id]`  
**Problem:** The rooms page shows a grid but clicking a room has nowhere to go — no detail page exists.

**What to build:**
```
/dashboard/rooms/[id]
  ├── Header: Room name, type badge, floor, base rent — inline edit button
  ├── Bed Grid: Visual bed cards (AVAILABLE / OCCUPIED / RESERVED / MAINTENANCE)
  │   ├── OCCUPIED: shows tenant name + rent status chip → links to tenant detail
  │   └── AVAILABLE: shows "Allocate Bed" button
  ├── Tab: Allocation History — table of past tenants (name, dates, bed)
  └── Danger Zone: Archive room (soft-delete)
```

**Files to create:**
- `apps/web/src/app/(dashboard)/dashboard/rooms/[id]/page.tsx`
- `apps/web/src/lib/rooms-api.ts` — add `getRoom(id)`, `updateRoom(id, dto)`, `getRoomAllocations(id)`

**BedGrid component** already exists at `src/components/ui/BedGrid.tsx` — reuse it.

---

### 1.3 — Agreements UI
**Routes:** Tenant detail KYC tab + new Agreements tab  
**Problem:** `AgreementsModule` has 7 endpoints (create, send, sign-tenant, sign-owner, cancel, list, get-by-tenant). None are reachable from the web.

**What to build:**

**1.3.1 — Add "Agreements" tab on Tenant Detail page**  
File: `apps/web/src/app/(dashboard)/dashboard/tenants/[id]/page.tsx`  
- New tab: `'agreements'` alongside existing `overview | rent | payments | history | kyc`
- Tab content: `<AgreementsTab tenantId={id} />`

**AgreementsTab component:**
```
┌──────────────────────────────────────────────────┐
│ Rental Agreements                  [+ New Agreement] │
├──────────────────────────────────────────────────┤
│ Agreement #001 | ACTIVE | 01 Jan – 31 Dec 2026   │
│ Signed: Tenant ✓  Owner ✓          [Download PDF] │
├──────────────────────────────────────────────────┤
│ Agreement #002 | DRAFT | Created 15 May 2026      │
│ [Send to Tenant] [Cancel]          [Download PDF] │
└──────────────────────────────────────────────────┘
```

**States to handle:**
- `DRAFT` → show "Send to Tenant" button → `PUT /agreements/:id/send`
- `SENT` → show "Sign as Owner" button → `PUT /agreements/:id/sign-owner`
- `ACTIVE` → show "Download PDF" → `GET /pdf/...` or presigned S3 URL
- `CANCELLED` / `EXPIRED` → muted row

**1.3.2 — New Agreement modal**
- Form fields: startDate, endDate, monthlyRent (pre-filled from rent cycle), depositAmount, terms (textarea)
- Calls `POST /agreements` → creates DRAFT

**Files to create:**
- `apps/web/src/lib/agreements-api.ts`

---

### 1.4 — Move-Out UI (Polish & Dedicated Flow)
**Problem:** The API `PUT /tenants/:id/move-out` exists and there's some inline code in the tenant detail page, but it's buried. Operators need a clear 2-step confirmation with financial preview.

**What to build — Move-Out Modal (upgrade existing inline code):**
```
Step 1: Preview
┌────────────────────────────────────────────┐
│ Move-Out: Rahul Sharma (Bed 3A, Room 101)  │
├────────────────────────────────────────────┤
│ Pending Dues         ₹ 4,500              │
│ Security Deposit     ₹ 10,000             │
│ Deductions           ₹ 1,200              │
│ ──────────────────────────────            │
│ Refund to Tenant     ₹ 4,300              │
├────────────────────────────────────────────┤
│ Move-Out Date [date picker]               │
│ Notes [textarea]                          │
│               [Cancel]  [Confirm Move-Out]│
└────────────────────────────────────────────┘

Step 2: Confirmation with ConfirmModal (existing component)
```

**API used:**
- `GET /tenants/:id/move-out-preview` → populate the financial summary
- `PUT /tenants/:id/move-out` → execute

**Files to modify:**
- `apps/web/src/app/(dashboard)/dashboard/tenants/[id]/page.tsx` — refactor the existing move-out section into a proper 2-step modal

---

### 1.5 — Room Transfer UI
**Problem:** `PUT /tenants/:id/transfer-room` exists. No UI to trigger it.

**What to build — Room Transfer Modal (on Tenant Detail > Overview tab):**
```
Transfer Room
├── Current: Room 101, Bed 3A
├── New Bed selector (dropdown filtered to AVAILABLE beds in same property)
├── Reason (optional textarea)
└── [Cancel] [Transfer Now]
```

**Files to modify:**
- `apps/web/src/app/(dashboard)/dashboard/tenants/[id]/page.tsx` — add "Transfer Room" button in OverviewTab action bar, open modal
- `apps/web/src/lib/tenants-api.ts` — add `transferRoom(tenantId, dto)`

---

### 1.6 — Operator Management UI
**Problem:** No UI to see who manages a property or to add/remove operators.

**Where to surface it:** Property Detail page → new "Team" tab

**What to build:**

**1.6.1 — "Team" tab on Property Detail page**  
File: `apps/web/src/app/(dashboard)/dashboard/properties/[id]/page.tsx`  
- Add new tab: `'team'` alongside overview | rooms | tenants | financials | performance

**TeamTab component:**
```
┌───────────────────────────────────────────────────┐
│ Property Team                    [+ Add Member]   │
├───────────────────────────────────────────────────┤
│ 👤 Ravi Sharma      OWNER      Added: Jan 2025    │
│ 👤 Priya Mehta      OPERATOR   Added: Mar 2025  [✕]│
│ 👤 Suresh Kumar     STAFF      Added: Apr 2025  [✕]│
└───────────────────────────────────────────────────┘
```

**Add Member Modal:**
- Email input (search existing users OR invite by email)
- Role selector: `OPERATOR | CO_OPERATOR | STAFF`
- Calls `POST /properties/:id/roles`

**Remove:** Calls `DELETE /properties/:id/roles/:userId` with confirmation

**Files to create:**
- `apps/web/src/lib/properties-api.ts` — add `getPropertyRoles()`, `addPropertyRole()`, `removePropertyRole()`

---

## Phase 2 — Web UI: Secondary Gaps
**Target:** 1–2 weeks  
**Goal:** Power-user features and configuration. Operators can configure their workspace fully.

---

### 2.1 — Settings Page
**Route:** `/dashboard/settings`

**Sections:**
```
/dashboard/settings
  ├── Profile — name, email, phone, change password
  ├── Notifications — toggle email / push / WhatsApp per event type
  │   (rent_due, payment_received, complaint_raised, lead_inquiry)
  └── Security — active sessions, sign out all devices
```

**Files to create:**
- `apps/web/src/app/(dashboard)/dashboard/settings/page.tsx`

**Sidebar update:** Add "Settings" link to `apps/web/src/components/Sidebar.tsx`

---

### 2.2 — WhatsApp Config UI
**Problem:** Twilio WhatsApp is wired in the API but operators have no way to see status or test it.

**Where to surface it:** Settings page → new "Integrations" tab OR separate property-level settings

**What to build:**
```
Integrations
├── WhatsApp Notifications
│   ├── Status: Connected / Not configured
│   ├── Test: [Send test message to my number]
│   └── Events: toggle per event (payment received, overdue reminder, move-out)
└── Email Notifications
    ├── From address (read-only, set by admin)
    └── Toggle per event
```

**Files to create:**
- `apps/web/src/lib/whatsapp-api.ts` — `getWhatsAppStatus()`, `sendTestMessage()`
- Section in settings page

---

### 2.3 — Collections Page Enhancement
**Current state:** Collections page exists but likely just shows a list.  
**Enhancement:** Add bulk actions — "Mark all as paid", filter by property + month, export to CSV/XLSX (API already supports `GET /export/collections`).

**Files to modify:**
- `apps/web/src/app/(dashboard)/dashboard/collections/page.tsx`

---

### 2.4 — Settlement Detail Page
**Current state:** `/dashboard/settlements` shows a list.  
**Missing:** No way to see breakdown of a settlement or mark it as paid.

**Route:** `/dashboard/settlements/[id]`
```
Settlement Detail
├── Period: March 2026
├── Property: Sunshine PG, Bangalore
├── Owner: Ravi Sharma | Operator: Priya Mehta
├── Model: REVENUE_SHARE (70/30)
├── ─────────────────────────────────────────
├── Total Collections    ₹ 1,20,000
├── Operator Share (30%) ₹ 36,000
├── Owner Payout (70%)   ₹ 84,000
├── ─────────────────────────────────────────
├── Status: PENDING → [Mark as Settled] [Download PDF]
└── Transaction history below
```

**Files to create:**
- `apps/web/src/app/(dashboard)/dashboard/settlements/[id]/page.tsx`

---

## Phase 3 — Mobile App Depth
**Target:** 3–4 weeks  
**Goal:** The tenant app is a fully self-service portal. The operator app supports core daily operations on the go.

---

### 3.1 — Tenant App: Online Payment (Razorpay)
**Problem:** `payments.tsx` exists but Razorpay SDK is not wired in mobile.

**What to build:**
1. Install `react-native-razorpay` in `apps/mobile`
2. Create `apps/mobile/src/lib/razorpay.ts` — wrapper for checkout
3. Update `apps/mobile/app/(tenant)/payments.tsx`:
   - "Pay Now" button on each pending rent cycle
   - Opens Razorpay checkout → on success, call `POST /payments` to record
   - Show success/failure toast

**API used:**
- `GET /rent?tenantId=` → list cycles
- `POST /payments` → record payment (amount, mode: ONLINE, transactionRef)

---

### 3.2 — Tenant App: KYC Document Upload
**Problem:** KYC tab works on web but mobile has no upload capability.

**What to build:**
1. Add `expo-image-picker` and `expo-document-picker`
2. Create `apps/mobile/src/lib/kyc-upload.ts`:
   - Get presigned URL from `POST /files/presign`
   - Upload directly to S3/R2
   - Call `POST /kyc` with the file URL
3. Update tenant profile or add KYC screen:
   - Show current document status (PENDING / VERIFIED / REJECTED)
   - Buttons to upload Aadhaar / PAN / Photo
   - Camera capture + gallery picker

---

### 3.3 — Tenant App: Agreement Viewing
**Problem:** Agreements are generated as PDFs but tenants can't see them on mobile.

**What to build:**
1. Install `expo-web-browser` or `react-native-pdf`
2. Add agreements fetch to `apps/mobile/src/lib/api.ts`
3. Update `apps/mobile/app/(tenant)/profile.tsx` or add new screen:
   - List agreements (ACTIVE, EXPIRED)
   - "View PDF" opens in-browser viewer
   - "Sign" action for SENT agreements (calls `PUT /agreements/:id/sign-tenant`)

---

### 3.4 — Operator App: Add Tenant Flow
**Problem:** Operators can view tenant list on mobile but cannot onboard a new tenant.

**What to build — Multi-step form in mobile:**
```
Step 1: Basic Info (name, phone, email)
Step 2: Room & Bed selection (filtered available beds)
Step 3: Financials (rent, deposit amount)
Step 4: Summary → Submit
```

Calls `POST /tenants` then `PUT /tenants/:id/move-in`.

**Files to create/modify:**
- `apps/mobile/app/(operator)/tenants/new.tsx` (new screen)
- Update `apps/mobile/app/(operator)/tenants.tsx` — add FAB button

---

### 3.5 — Operator App: Record Payment Inline
**Problem:** Operators need to record cash payments on the spot (common in Indian PGs).

**What to build — Quick Pay bottom sheet on Collections screen:**
```
[Long press on tenant] → bottom sheet:
  Amount: [₹ input] (pre-filled with due amount)
  Mode:   [Cash] [UPI] [Bank Transfer]
  Ref#:   [optional]
  [Record Payment]
```

Calls `POST /payments`.

**Files to modify:**
- `apps/mobile/app/(operator)/collections.tsx` — add long-press + bottom sheet

---

### 3.6 — Push Notification Deep Linking
**Problem:** `apps/mobile/src/lib/push.ts` registers for push but notifications don't navigate to the right screen.

**What to build:**
1. Set up notification response handler in `apps/mobile/app/_layout.tsx`
2. Define deep link map:
   - `payment_received` → tenant payments screen
   - `rent_due` → tenant payments screen  
   - `complaint_update` → complaints screen
   - `new_lead` → operator leads screen
3. Use `expo-router` `router.push()` based on notification payload

---

## Phase 4 — Production Readiness
**Target:** 2 weeks  
**Goal:** The system is observable, testable, and deployed to a real environment.

---

### 4.1 — Staging Deployment
**What to provision:**

```
Infrastructure (recommended: Railway / Render / Fly.io for simplicity, or AWS/GCP for scale)

├── PostgreSQL database (managed, with daily backups)
├── Redis instance (for BullMQ)
├── API service (NestJS — Docker container from apps/api)
├── Web service (Next.js — Vercel or Docker)
├── S3-compatible storage (Cloudflare R2 — already supported by FilesModule)
└── CI/CD (GitHub Actions → auto-deploy on push to main)
```

**Files to create:**
- `.env.staging` template (with real service URLs, not localhost)
- `fly.toml` or `render.yaml` or `railway.json` — platform config
- Update `docker-compose.yml` production overrides

**Checklist:**
- [ ] DATABASE_URL → managed Postgres
- [ ] REDIS_URL → managed Redis
- [ ] RAZORPAY_KEY_ID → live keys
- [ ] RESEND_API_KEY → real API key
- [ ] SENTRY_DSN → real Sentry project
- [ ] S3 / R2 bucket created + IAM keys
- [ ] JWT_SECRET → strong random 64-char string
- [ ] CORS_ORIGIN → real web domain

---

### 4.2 — Unit & Integration Tests
**Problem:** E2E tests exist (Playwright) but no unit or integration tests for business logic.

**Priority order for API tests:**

| Module | What to test | Why |
|--------|-------------|-----|
| `rent` | `generateCycle()`, `markOverdue()` | Financial correctness |
| `settlements` | REVENUE_SHARE / FIXED_PAYOUT calculation | Money math |
| `tenants` (workflow) | State machine transitions (LEAD → ACTIVE) | Business logic |
| `payments` | Partial payment, over-payment handling | Edge cases |
| `auth` | JWT flow, refresh, password reset | Security |

**Tech:** Jest (already configured in NestJS scaffold)

**Files to create:**
- `apps/api/src/modules/rent/rent.service.spec.ts`
- `apps/api/src/modules/settlements/settlements.service.spec.ts`
- `apps/api/src/modules/tenants/tenant-workflow.service.spec.ts`
- `apps/api/src/modules/payments/payments.service.spec.ts`

---

### 4.3 — API Documentation Polish
**Current state:** Swagger is set up at `/docs` using `DocumentBuilder`.  
**Problem:** Most controllers have `@ApiOperation` but likely missing `@ApiResponse`, request/response schemas.

**Work:**
- Add `@ApiResponse({ status: 200, type: ... })` to each endpoint
- Add `@ApiProperty()` decorators to all DTOs
- Group tags properly in Swagger UI
- Export OpenAPI JSON for client SDK generation (optional)

---

### 4.4 — Performance & Rate Limiting
**Problem:** Rate limiting is configured with default values, not tuned for production load.

**Work:**
- Tune `THROTTLE_TTL` and `THROTTLE_LIMIT` per route group (auth routes stricter, read routes more lenient)
- Add DB query analysis (identify N+1 queries using Prisma query logging)
- Add response caching for dashboard aggregates (Redis)
- Load test with k6 or Artillery (target: 100 concurrent operators)

---

## Summary Table

| Phase | Focus | Est. Time | Ship Condition |
|-------|-------|-----------|----------------|
| **Phase 1** | Web UI critical gaps | 2–3 weeks | All operator workflows reachable from web |
| **Phase 2** | Web UI secondary gaps | 1–2 weeks | Settings, WhatsApp config, settlement detail |
| **Phase 3** | Mobile app depth | 3–4 weeks | Tenant self-service + operator on-the-go |
| **Phase 4** | Production readiness | 2 weeks | Deployed, tested, observable |

**Total estimated time: 8–11 weeks**

---

## Task Order Within Phase 1 (Day by Day)

```
Week 1:
  Day 1-2:  1.1 API fixes (room edit, bed edit, operator management endpoints)
  Day 3-4:  1.2 Room detail page
  Day 5:    1.3 agreements-api.ts + AgreementsTab on tenant detail

Week 2:
  Day 1-2:  1.3 New Agreement modal + PDF download
  Day 3:    1.4 Move-out modal polish (2-step with preview)
  Day 4:    1.5 Room transfer modal
  Day 5:    1.6 Operator management UI (Team tab on property detail)

Week 3 (if needed):
  Buffer + QA + bug fixes across all Phase 1 work
```

---

## Cross-Cutting Concerns (Do These Throughout)

- **After every new page:** Add it to `Sidebar.tsx` with the right icon
- **After every new API call:** Add proper loading + empty + error states
- **After every modal:** Test on mobile viewport (responsive)
- **After every financial display:** Use `formatCurrency()` from `src/lib/utils.ts`
- **No `any` types** — always type API responses against `@pg-system/types`
