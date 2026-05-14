# Room Transfer Workflow

## Overview

A room transfer moves an ACTIVE tenant from one bed to another within the same property
(or potentially across properties in future).

## Preconditions

- Tenant must be ACTIVE
- New bed must be AVAILABLE
- Transfer date must be provided

## Transfer Flow

```
Operator selects tenant → Select new bed → Confirm transfer date & new rent
    ↓
Old TenantBedAssignment.isActive = false, endDate = transferDate
    ↓
Old Bed.status = AVAILABLE
Old Room status recalculated
    ↓
New TenantBedAssignment created (isActive: true, startDate = transferDate)
New Bed.status = OCCUPIED
New Room status recalculated
    ↓
Transfer complete
```

## Rent Change on Transfer

If the new bed/room has a different rent:
- `newMonthlyRent` param specifies the new rent
- The new TenantBedAssignment locks in the new rent
- Next rent cycle uses the new amount

If moving mid-month:
- Current month's rent is NOT automatically adjusted
- Operator can manually adjust or create a credit/note

## Within Same Property

Most common case. Room transfer within the same property.

## Across Properties (Future)

Moving a tenant from Property A to Property B:
- Move-out from Property A (with deposit settlement)
- New tenant onboarding at Property B (as ACTIVE, skipping lead flow)
- Not currently supported as an atomic operation

## Why Transfer Happens

Common scenarios:
- Tenant requests upgrade/downgrade
- Tenant's roommate moved out, they want private room
- Maintenance on current room
- Better room became available
