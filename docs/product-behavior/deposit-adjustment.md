# Deposit Handling & Adjustment

## Deposit Lifecycle

```
PENDING         → Deposit amount set, not yet paid
PARTIALLY_PAID  → Some deposit collected
PAID            → Full deposit amount collected
REFUNDED        → Fully refunded on move-out
PARTIALLY_REFUNDED → Partially refunded (some forfeited)
FORFEITED       → Fully retained by operator/owner
```

## Collecting Deposit

Deposit can be paid:
- At the DEPOSIT_PENDING stage (as part of onboarding)
- At move-in as a combined payment
- In parts (multiple payments)

Each deposit payment:
- PaymentType = DEPOSIT
- Updates Tenant.depositPaid
- Updates Tenant.depositStatus
- Generates a receipt

## Deposit Adjustment (After Move-In)

If the deposit amount needs to change after move-in:
- Operator edits the tenant record directly (future: deposit adjustment form)
- Increase: new target amount, collect additional payment
- Decrease: record as partial refund

## Deposit Refund at Move-Out

On move-out, operator specifies:
- `depositRefundAmount`: amount to return to tenant
- `depositForfeitAmount`: amount to retain (damage, unpaid dues, etc.)

Rules:
- depositRefundAmount + depositForfeitAmount should = depositPaid (ideally)
- System does not enforce this strictly — operator has discretion
- Notes field captures reason for any forfeiture

## Refund Payment Recording

The refund itself is a separate payment:
- PaymentType = DEPOSIT_REFUND
- Records when physically returned
- Generates receipt

The depositStatus on Tenant is set at move-out time based on operator input,
not when the refund is physically made. The refund payment is recorded separately.

## Security Deposit vs Advance Rent

Some PGs collect "2 months advance + 1 month security deposit."
In this system:
- Advance rent is recorded as RENT payments against future rent cycles
- Security deposit is the depositAmount tracked separately

Do not mix these. They have different refund rules.

## Deposit in Financial Settlement

Deposit is NOT included in the monthly revenue settlement.
It is a liability (owed back to the tenant), not income.

Only RENT type payments are included in settlement calculations.
