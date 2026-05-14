# Tenant Onboarding Workflow

## Purpose

Standardize the tenant move-in process from initial lead to active bed assignment with rent cycle activation.

---

## Actors

| Actor | Role |
|---|---|
| Operator / Staff | Creates lead, manages each transition |
| Tenant | Provides documents, pays deposit |
| System | Activates rent cycle, sends notifications |

---

## Trigger

Operator creates a new tenant lead via dashboard or mobile app.

---

## State Machine

```
LEAD
  └─→ VISIT_SCHEDULED
        └─→ VISITED
              └─→ ROOM_FINALIZED
                    ├─→ DEPOSIT_PENDING   (deposit not collected)
                    ├─→ KYC_PENDING       (KYC not submitted)
                    └─→ ACTIVE            (all conditions met)
                          └─→ NOTICE_PERIOD
                                └─→ MOVED_OUT
```

---

## Step-by-Step Flow

### Step 1: Create Lead

**Action**: Operator creates a new tenant record.

**Required data**:
- Name
- Phone number (unique per property)
- Emergency contact name and phone
- Source (walkin, referral, online)

**System behavior**:
- Creates `Tenant` record with `status = LEAD`
- Assigns to current property
- Sends welcome notification (optional)

**Validation**:
- Phone number not already active in this property

---

### Step 2: Schedule Visit

**Action**: `POST /api/tenants/:id/schedule-visit`

**Required data**: `scheduledDate` (future date)

**System behavior**:
- Status → `VISIT_SCHEDULED`
- Records `visitScheduledAt`
- Sends reminder notification to operator on visit day

---

### Step 3: Mark Visited

**Action**: `POST /api/tenants/:id/mark-visited`

**System behavior**:
- Status → `VISITED`
- Records `visitedAt`

---

### Step 4: Finalize Room

**Action**: `POST /api/tenants/:id/finalize-room`

**Required data**: `bedId`

**System behavior**:
- Validates bed exists and is not already occupied
- Status → `ROOM_FINALIZED`
- Records `bedId` on tenant (not yet assigned)

**Validation**:
- Bed must belong to the same property
- Bed must not have an active `TenantBedAssignment`

---

### Step 5: Move In

**Action**: `POST /api/tenants/:id/move-in`

**Required data**:
```json
{
  "moveInDate": "2024-02-01",
  "depositAmount": 10000,
  "depositPaid": true,
  "kycSubmitted": true
}
```

**System behavior (Prisma transaction)**:
1. Validate deposit and KYC conditions
2. Status → `ACTIVE` (or `DEPOSIT_PENDING` / `KYC_PENDING` if conditions unmet)
3. Create `TenantBedAssignment` (`isActive = true`, `startDate = moveInDate`)
4. Update `Tenant.depositBalance = depositAmount`
5. Update room occupancy status
6. Create first `RentCycle` (pro-rated if mid-month)
7. Send move-in confirmation notification

**Condition routing**:
- If `depositPaid = false` → status = `DEPOSIT_PENDING`
- If `kycSubmitted = false` → status = `KYC_PENDING`
- If both true → status = `ACTIVE`

---

## Edge Cases

### Bed Unavailable at Finalization

- Check before `finalizeRoom` — if bed is occupied, throw `BadRequestException`
- Operator must select a different bed

### Duplicate Tenant (Same Phone)

- Validation in `create`: if ACTIVE tenant with same phone exists in the property, reject with error
- Historical `MOVED_OUT` tenants with same phone are allowed (returning tenant)

### Missing KYC

- Tenant can be moved to `KYC_PENDING` state
- KYC documents uploaded separately (Phase 2 feature)
- `moveIn` called again with `kycSubmitted = true` once uploaded — status transitions to `ACTIVE`

### Deposit Not Collected

- Tenant moves to `DEPOSIT_PENDING`
- Operator records deposit separately once collected
- Triggers transition to `ACTIVE`

### Bed Becomes Full After Assignment

- After bed assignment, check room occupancy: count active assignments vs. `sharingCapacity`
- Room status updated: `AVAILABLE` → `PARTIALLY_OCCUPIED` → `FULLY_OCCUPIED`

---

## Required Data Summary

| Field | Required For | Validation |
|---|---|---|
| `name` | Lead creation | Non-empty string |
| `phone` | Lead creation | 10-digit mobile number |
| `emergencyContactName` | Lead creation | Non-empty string |
| `emergencyContactPhone` | Lead creation | 10-digit mobile number |
| `scheduledDate` | Schedule visit | Future date |
| `bedId` | Finalize room | Valid UUID, available bed |
| `moveInDate` | Move-in | Valid date |
| `depositAmount` | Move-in | Non-negative decimal |
| `depositPaid` | Move-in | Boolean |
| `kycSubmitted` | Move-in | Boolean |

---

## System Updates Per Step

| Step | DB Writes |
|---|---|
| Create lead | `Tenant` created |
| Schedule visit | `Tenant.status`, `visitScheduledAt` |
| Mark visited | `Tenant.status`, `visitedAt` |
| Finalize room | `Tenant.status`, `Tenant.currentBedId` |
| Move in | `Tenant.status`, `TenantBedAssignment` created, `RentCycle` created, room status updated |

---

## Notification Behavior

| Event | Recipient | Message |
|---|---|---|
| Visit scheduled | Operator | "Visit scheduled for [Name] on [date]" |
| Move-in confirmed | Tenant | "Welcome to [Property]. Your rent cycle starts [date]." |
| Deposit pending | Operator | "Deposit pending for [Name]. Collect before activating." |
