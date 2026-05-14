# Product Behavior Documentation

Defines exact system behavior during edge cases and operational scenarios.

This documentation is the source of truth for product decisions — it prevents inconsistent logic across frontend and backend, and ensures predictable UX for all actors.

---

## Why This Exists

Edge cases in PG operations are common:
- Tenant pays partial rent
- Tenant wants to transfer rooms mid-cycle
- Operator changes after rent is already collected
- Owner changes financial model during an active cycle

Each of these requires a defined, consistent system response. These documents define that response.

---

## Tenant Behaviors

| File | Scenario |
|---|---|
| [partial-payment-behavior.md](partial-payment-behavior.md) | Tenant pays less than the due amount |
| [overdue-handling.md](overdue-handling.md) | What happens when rent is not paid by due date |

## Financial Behaviors

| File | Scenario |
|---|---|
| [deposit-adjustment.md](deposit-adjustment.md) | Using security deposit to cover unpaid rent |

## Operator Behaviors

| File | Scenario |
|---|---|
| [operator-change.md](operator-change.md) | Changing operator mid-cycle |

---

## Behavior Document Format

Each file must define:

1. **Scenario** — the exact situation being documented
2. **Trigger** — what action or event causes this behavior
3. **Expected system behavior** — step-by-step what the system does
4. **Financial implications** — how ledger, payments, and receipts are affected
5. **UI updates** — what changes in the dashboard
6. **Notification behavior** — who is notified and what they receive
7. **Audit logs** — what is recorded for compliance
8. **Validation checks** — what prevents invalid state
9. **Restrictions** — what is explicitly not allowed
