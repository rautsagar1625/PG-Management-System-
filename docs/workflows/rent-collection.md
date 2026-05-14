# Rent Collection Workflow

## Purpose

Handle the complete rent collection lifecycle safely: from cycle generation through payment recording to settlement update.

---

## Actors

| Actor | Role |
|---|---|
| System (scheduled job) | Generates monthly rent cycles |
| Operator / Staff | Records payment received from tenant |
| Tenant | Makes payment (cash or online) |
| Owner | Views settlement impact |

---

## Trigger

- **Cycle generation**: monthly scheduled job (1st of month or property-configured due date)
- **Payment recording**: manual operator action via dashboard or mobile app

---

## Rent Cycle Generation Flow

```
1. Scheduled trigger fires for property
2. Fetch all ACTIVE tenants with their bed assignments
3. For each tenant:
   a. Check if cycle already exists for this month (idempotency check)
   b. If exists: skip
   c. If not: create RentCycle with status = PENDING
      - amount = bed's monthlyRent
      - dueDate = property's configured due date
4. Return count of cycles generated
```

**Idempotency**: `generateRentCycles` checks for an existing cycle with the same `tenantId` and billing month before creating. Safe to call multiple times.

---

## Payment Recording Flow

```
1. Operator records payment (amount, method, reference)
2. Validate: amount > 0 and ≤ remaining balance
3. Open Prisma transaction:
   a. Create Payment record (amount, method, reference, paidAt)
   b. Create Receipt (auto-generated receipt number, PDF-ready data)
   c. Update RentCycle:
      - Add amount to paidAmount
      - Recalculate remainingAmount
      - If fully paid: status = PAID
      - If partially paid: status = PARTIAL
   d. If deposit being used: update Tenant.depositBalance
4. Commit transaction
5. Dispatch notification to tenant
6. Return { payment, receipt, cycle }
```

---

## Overdue Marking Flow

```
1. Scheduled job runs (e.g., 5th of month)
2. Query all RentCycles where:
   - dueDate < today
   - status IN [PENDING, PARTIAL]
3. Batch update status = OVERDUE
4. Dispatch overdue notification to affected tenants
```

---

## Edge Cases

### Partial Payment

- Tenant pays ₹5,000 of ₹10,000 due
- System records payment, sets `paidAmount = 5000`, `remainingAmount = 5000`
- Cycle status → `PARTIAL`
- Receipt generated for ₹5,000 only
- Reminder continues for remaining ₹5,000
- See: [partial-payment-behavior.md](../product-behavior/partial-payment-behavior.md)

### Overpayment

- Tenant pays ₹12,000 when ₹10,000 is due
- Cycle marked `PAID` for ₹10,000
- Excess ₹2,000 recorded as credit against tenant account
- Next cycle's due amount reduced by ₹2,000
- **Not silently discarded**

### Deposit Adjustment

- Operator applies deposit to cover unpaid rent
- Decrements `tenant.depositBalance`
- Creates Payment with `method = DEPOSIT_ADJUSTMENT`
- Creates Receipt with note "Adjusted from security deposit"
- See: [deposit-adjustment.md](../product-behavior/deposit-adjustment.md)

### Failed Online Payment

- Online gateway failure does not create a Payment or update the cycle
- Cycle remains `PENDING`
- Operator manually records after confirmation

---

## Validation Rules

- `amount` must be positive
- `amount` must not exceed `remainingAmount` (no untracked overpayments)
- `paidAt` must not be a future date
- `tenantId` must be an ACTIVE tenant

---

## System Updates

| Record | Action |
|---|---|
| `RentCycle` | `paidAmount`, `remainingAmount`, `status` updated |
| `Payment` | Created |
| `Receipt` | Created with unique receipt number |
| `Tenant.depositBalance` | Decremented only for DEPOSIT_ADJUSTMENT |

---

## Notification Behavior

| Event | Recipient | Channel |
|---|---|---|
| Payment recorded | Tenant | Push + SMS |
| Cycle overdue | Tenant | Push + SMS |
| Cycle generated | Operator | Dashboard |

---

## Audit Requirements

- Every Payment record captures: `operatorId` (paidBy), `method`, `reference`, `paidAt`
- Receipts are immutable once created
- Status change history tracked via `updatedAt` timestamps
