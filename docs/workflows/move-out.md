# Move-Out Workflow

## Overview

Move-out is a terminal event in the tenant lifecycle.
It involves releasing the bed, settling the deposit, and finalizing rent.

## Preconditions

Tenant must be in status: `ACTIVE` or `NOTICE_PERIOD`

## Move-Out Flow

```
Operator initiates notice
    ↓
NOTICE_PERIOD (notice period begins, noticedAt timestamp recorded)
    ↓
On move-out date:
    ↓
Bed freed → AVAILABLE
Room status recalculated
Deposit settlement recorded
Any pending rent cycles flagged for collection
Tenant status → MOVED_OUT
```

## Data Required at Move-Out

- moveOutDate
- depositRefundAmount (₹ to be returned)
- depositForfeitAmount (₹ to be retained)
- notes (reason, condition, etc.)

## Deposit Handling

Deposit settlement is recorded on the Tenant record:

| Scenario | depositStatus |
|----------|--------------|
| Full deposit refunded | REFUNDED |
| Partial refund | PARTIALLY_REFUNDED |
| Full deposit retained | FORFEITED |

The actual refund payment is recorded as a separate Payment record
(PaymentType = DEPOSIT_REFUND) when physically returned.

## Bed Release

On move-out:
1. TenantBedAssignment.isActive = false, endDate = moveOutDate
2. Bed.status = AVAILABLE
3. Room status recalculated based on remaining occupied beds

## Pending Rent at Move-Out

- Pending rent cycles are NOT automatically cancelled
- Operator must manually waive or collect before closing
- Dashboard flags tenants in MOVED_OUT with unpaid cycles

## Notice Period

- Initiated by operator: status → NOTICE_PERIOD
- noticedAt timestamp recorded
- Tenant remains ACTIVE in system — rent cycles continue
- Move-out date can be any date after noticedAt

## Early Move-Out (Without Notice)

- Operator can skip notice period and move out directly
- System records this — no automatic penalty, but notes field used

## After Move-Out

- Tenant record preserved (immutable financial history)
- User account remains (can be reactivated as a new tenant in another PG)
- All payment history and receipts remain accessible
