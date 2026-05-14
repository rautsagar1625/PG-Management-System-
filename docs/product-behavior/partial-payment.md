# Partial Payment Behavior

## Core Rule

**Partial payments are first-class citizens, not edge cases.**

The system always accepts whatever amount is offered, records it,
generates a receipt, and accurately tracks the balance.

## How Partial Payments Work

1. Tenant pays ₹4,000 of ₹8,000 rent due.
2. Payment created: amount=4000, type=RENT, rentCycleId=X
3. Receipt generated: RCP-202412-XXXXX
4. RentCycle updated:
   - paidAmount: 0 → 4000
   - balanceDue: 8000 → 4000
   - status: DUE → PARTIAL

5. Later, tenant pays remaining ₹4,000.
6. Second payment created with receipt.
7. RentCycle updated:
   - paidAmount: 4000 → 8000
   - balanceDue: 4000 → 0
   - status: PARTIAL → PAID

## Multiple Partial Payments

There is no limit on how many partial payments can be made.
Each payment gets its own receipt.

## Overpayment

If a tenant pays MORE than the balance due:
- The excess is not automatically applied anywhere
- Operator must manually handle — create a credit note or apply to next month
- System records the exact amount paid

In practice: most operators accept only exact amounts. This is not a limitation.

## Partial Payment + Overdue

If a partial payment is made after the grace period:
- The cycle remains OVERDUE (not downgraded to PARTIAL for display purposes)
- paidAmount and balanceDue still updated correctly
- Status becomes PAID only when balanceDue = 0

## Which Cycle Gets the Payment?

When operator records a rent payment without specifying a cycle:
- System applies to the oldest unpaid cycle automatically
- If tenant has cycles for Jan, Feb, Mar all unpaid: Jan gets paid first

Operator can override by explicitly passing `rentCycleId`.

## Receipts

Every single payment — no matter the amount or type — generates a receipt.
Receipt contains:
- Receipt number (RCP-YYYYMM-XXXXX)
- Tenant name and code
- Property name
- Amount paid
- Payment method
- Date
- Balance remaining (if partial)
