# Partial Payment Behavior

## Scenario

A tenant pays only part of the monthly rent due. For example: ₹5,000 paid against a ₹10,000 due cycle.

---

## Trigger

Operator records a payment where `amount < rentCycle.remainingAmount`.

---

## Expected System Behavior

### Step 1: Payment Validation

- `amount` must be greater than 0
- `amount` must not exceed `remainingAmount` (prevents silent overpayment)
- Tenant must be in `ACTIVE` status

### Step 2: Transaction Execution

All writes happen inside a single Prisma transaction:

1. Create `Payment` record:
   - `amount = partial amount paid`
   - `method = cash | upi | bank_transfer | deposit_adjustment`
   - `reference = operator-provided reference`
   - `paidAt = now()`

2. Create `Receipt`:
   - Generated for the partial amount only
   - Unique receipt number
   - Shows: amount paid, balance remaining, payment method

3. Update `RentCycle`:
   - `paidAmount += amount`
   - `remainingAmount -= amount`
   - `status = PARTIAL` (not PAID)

### Step 3: Post-Transaction

- Reminder notifications continue for the remaining balance
- Dashboard shows `PARTIAL` badge on this cycle
- Tenant can see remaining balance in self-service view

---

## Financial Implications

| Before Payment | After Payment |
|---|---|
| `paidAmount = 0` | `paidAmount = 5,000` |
| `remainingAmount = 10,000` | `remainingAmount = 5,000` |
| `status = PENDING` | `status = PARTIAL` |

- Receipt is issued **only for the amount actually paid** — not for the full cycle amount
- The cycle is not considered closed until `remainingAmount = 0`

---

## UI Updates

- Rent cycle card shows `PARTIAL` status badge in orange
- Shows `Paid: ₹5,000 | Due: ₹5,000`
- Receipt for the partial payment is downloadable immediately
- Reminder banner remains active on tenant dashboard

---

## Notification Behavior

| Event | Recipient | Message |
|---|---|---|
| Partial payment recorded | Tenant | "Payment of ₹5,000 received. Balance due: ₹5,000." |
| Upcoming due reminder | Tenant | "You have ₹5,000 due for [Month]. Please pay by [due date]." |

---

## Audit Requirements

Every Payment record captures:
- `amount` — exact amount paid in this transaction
- `paidBy` — operator user ID who recorded it
- `method` — payment method used
- `reference` — operator-entered reference (cheque number, UPI ID, etc.)
- `paidAt` — timestamp of payment recording

---

## Validation Checks

- `amount <= remainingAmount` — enforced at service layer before transaction opens
- `amount > 0` — enforced by DTO validation (`@IsPositive()`)
- Duplicate `reference` within the same cycle is warned but not blocked (operator may re-enter)

---

## Restrictions

- Negative balances are **not allowed** — `remainingAmount` never goes below 0
- Overpayment beyond cycle amount is **not allowed** via the partial payment flow; excess must be handled as a credit separately
- A receipt cannot be voided or modified after creation
- The `PARTIAL` status cycle must remain open until fully paid — it cannot be manually closed as `PAID` with outstanding balance
