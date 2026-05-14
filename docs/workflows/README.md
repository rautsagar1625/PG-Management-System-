# Workflow Documentation

Operational workflows for the PG Management System.

Workflows define exact system behavior at every step of real-world PG operations. Each workflow is the authoritative source of truth for how a business process runs — covering actors, state transitions, edge cases, and system effects.

---

## Workflow Principles

- Reflect real business operations, not idealized flows
- Define step-by-step state transitions
- Cover every edge case explicitly
- Prevent workflow ambiguity before it reaches code
- Each workflow maps to specific API endpoints and DB updates

---

## Tenant Lifecycle Workflows

| File | Description |
|---|---|
| [tenant-onboarding.md](tenant-onboarding.md) | Lead → Active tenant move-in flow |
| [rent-collection.md](rent-collection.md) | Rent cycle generation and payment recording |
| [move-out.md](move-out.md) | Notice period, final settlement, bed release |
| [room-transfer.md](room-transfer.md) | Moving tenant between rooms/beds |

## Financial Workflows

| File | Description |
|---|---|
| [settlement.md](settlement.md) | Monthly owner settlement calculation |

## Operational Workflows

| File | Description |
|---|---|
| [complaints.md](complaints.md) | Complaint creation, assignment, resolution |

---

## Tenant State Machine

```
LEAD
  └─→ VISIT_SCHEDULED     (scheduleVisit)
        └─→ VISITED              (markVisited)
              └─→ ROOM_FINALIZED       (finalizeRoom)
                    ├─→ DEPOSIT_PENDING     (moveIn — deposit not paid)
                    ├─→ KYC_PENDING         (moveIn — KYC not submitted)
                    └─→ ACTIVE              (moveIn — all conditions met)
                          └─→ NOTICE_PERIOD     (initiateNotice)
                                └─→ MOVED_OUT         (moveOut)
```

Valid transitions only — invalid transitions throw a `BadRequestException`.

---

## Workflow Document Structure

Every workflow file must contain:

1. **Purpose** — what business problem this solves
2. **Actors** — who triggers and who is affected
3. **Trigger** — what initiates the workflow
4. **Step-by-step flow** — exact sequence of operations
5. **Edge cases** — non-happy paths explicitly handled
6. **Validation rules** — what is checked before execution
7. **System updates** — DB writes, status changes
8. **Notification behavior** — who gets notified and when
9. **Failure scenarios** — what happens if a step fails
10. **Audit logs** — what is recorded for compliance
