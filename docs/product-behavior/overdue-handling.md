# Overdue Handling

## Grace Period

Default: 5 days after the due date (RENT_GRACE_PERIOD_DAYS = 5).

Timeline:
```
Month start (1st)   → Rent cycle created (PENDING)
Due date (1st)      → Status → DUE
Grace ends (6th)    → Status → OVERDUE (if not paid/partial)
```

Partial payments made before grace ends → PARTIAL (not OVERDUE yet)
Partial payments made after grace ends → OVERDUE until fully paid

## Automated Job

`markOverdueCycles()` runs daily (via cron/scheduler):
- Finds all DUE and PARTIAL cycles where dueDate < (today - gracePeriodDays)
- Sets status → OVERDUE

This job is idempotent — running it multiple times is safe.

## Late Fees

Currently DEFAULT_LATE_FEE_PERCENT = 0 (no automatic late fee).

Future: configurable per-property late fee percentage.
When configured:
```
lateFee = monthlyRent × lateFeePercent / 100
balanceDue += lateFee (added once on first overdue transition)
```

## Overdue Dashboard Display

Operator sees:
- Number of overdue tenants
- Total overdue amount
- Days overdue per tenant
- Color coding: yellow (1-7 days), orange (8-15 days), red (>15 days)

## Overdue Escalation (Future)

- D+1 after overdue: reminder notification
- D+7: warning notification + operator alert
- D+15: escalation alert to owner
- D+30: flag for review (possible move-out initiation)

## Waiving Overdue Rent

Operator can waive:
- Full amount (status → WAIVED, balanceDue → 0)
- Partial amount (operator manually records a discounted payment)

Waivers require:
- Who waived it (waivedBy = userId)
- When (waivedAt)
- Why (waivedNote — required)

## Historical Overdue

After a tenant moves out with overdue rent:
- Rent cycles remain OVERDUE in the system
- Not automatically written off
- Operator must explicitly waive or record payment

This ensures accurate financial history even after move-out.
