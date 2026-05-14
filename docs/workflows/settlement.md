# Owner-Operator Settlement Workflow

## Overview

Settlement is the monthly financial reconciliation between the property owner and the operator.
It answers: "How much does the operator owe the owner this month?"

## When It Happens

- Monthly, after rent collection is complete (or at a configured date)
- Can be triggered manually by the owner or operator
- Can be recalculated if more payments come in (status must be PENDING or CALCULATED)

## Settlement Models

### Model 1: FIXED_PAYOUT

Owner receives a fixed amount regardless of how much rent is collected.

```
totalCollected = sum of all RENT payments for the month
ownerPayout = fixedOwnerPayout (configured)
operatorProfit = totalCollected - fixedOwnerPayout

Example:
  Monthly fixed: ₹30,000
  Collected: ₹75,000
  Owner gets: ₹30,000
  Operator keeps: ₹45,000
```

**Important:** If collected < fixedOwnerPayout, operator is in deficit.
The system records this deficit. Operator must cover from other sources.

### Model 2: REVENUE_SHARE

Revenue split by configured percentage.

```
ownerPayout = totalCollected × ownerSharePercent / 100
operatorProfit = totalCollected × operatorSharePercent / 100

Example:
  Split: 40% owner / 60% operator
  Collected: ₹80,000
  Owner gets: ₹32,000
  Operator keeps: ₹48,000
```

Percentages must sum to 100%.

### Model 3: OWNER_OPERATED

Owner operates the PG themselves. No split.

```
ownerPayout = totalCollected
operatorProfit = 0
```

## Settlement Status Flow

```
PENDING
  ↓ (calculate called)
CALCULATED  ← amount visible, not yet paid
  ↓ (owner confirms payment received)
PAID        ← locked, immutable
  ↓ (or if disputed)
DISPUTED
```

## Recalculation Rules

- PENDING or CALCULATED → can be recalculated
- PAID → immutable (cannot recalculate)
- DISPUTED → requires admin resolution

## Partnership Settlement (Multiple Operators)

When a property has OPERATOR + CO_OPERATOR:
- Total operator profit is first calculated (same as above)
- Then split between partners based on their respective sharePercent in PropertyRole

```
operatorA_share = operatorProfit × operatorA.sharePercent / 100
operatorB_share = operatorProfit × operatorB.sharePercent / 100
```

This split is tracked in the settlement breakdown JSON.

## Audit Trail

Every settlement stores a `breakdown` JSON with:
- Financial model type used
- Calculation formula
- Input values (totalCollected, percentages, fixed amounts)
- Rent cycle summary (paid/partial/overdue counts)
- Timestamp

This ensures full auditability even if the financial model is changed later.

## Financial Model Change Mid-Period

If the financial model is changed mid-month:
- Settlement uses the model that was active at the start of the settlement period
- Previous model's `effectiveTo` is set to the new model's `effectiveFrom`
- Historical settlements retain their original calculation
