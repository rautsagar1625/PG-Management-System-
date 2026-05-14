# Financial Models

The system supports three financial models for PG operations. Each property has exactly one active model at a time.

---

## Model Types

### 1. FIXED_PAYOUT

**Description**: Owner receives a fixed monthly amount regardless of total rent collected. The operator keeps everything else.

**Use case**: Owner leases the property to an operator under a fixed rent agreement.

**Flow**:
```
Total Rent Collected
  └─ Fixed Owner Payout (configured amount)
       └─ Operator Earnings = Total - Fixed Payout
```

**Example**:
```
Total collected:    ₹3,00,000
Owner fixed payout: ₹2,00,000
Operator earnings:  ₹1,00,000
```

**Required fields**: `fixedOwnerPayout`

---

### 2. REVENUE_SHARE

**Description**: Revenue or profit is split between owner and operator by configured percentages.

**Use case**: Joint ventures, partnership PGs, or sub-lease models with shared profit.

**Flow**:
```
Total Rent Collected
  └─ Owner Share = Total × ownerSharePercent / 100
  └─ Operator Share = Total × operatorSharePercent / 100
```

**Example**:
```
Total collected:    ₹2,00,000
Owner share (60%):  ₹1,20,000
Operator share (40%): ₹80,000
```

**Required fields**: `ownerSharePercent`, `operatorSharePercent`

**Validation**: `ownerSharePercent + operatorSharePercent` must equal exactly 100.

---

### 3. OWNER_OPERATED

**Description**: Owner operates the PG directly. No split calculation required.

**Use case**: Single-owner PGs with no external operator.

**Flow**:
```
Total Rent Collected → Owner keeps all
```

**Required fields**: none (beyond `type`)

---

## Model Lifecycle

- A property can have only **one active model** at a time (`isActive: true`)
- Setting a new model **deactivates the previous one** with `effectiveTo = new effectiveFrom`
- Historical models are **immutable** — they are never deleted or updated retroactively
- Settlement calculations always use the model **active at the time of settlement**

---

## Database Schema

```prisma
model FinancialModel {
  id                  String            @id @default(uuid())
  propertyId          String
  type                FinancialModelType
  fixedOwnerPayout    Decimal?          @db.Decimal(10, 2)
  ownerSharePercent   Decimal?          @db.Decimal(5, 2)
  operatorSharePercent Decimal?         @db.Decimal(5, 2)
  effectiveFrom       DateTime
  effectiveTo         DateTime?
  isActive            Boolean           @default(true)
  createdAt           DateTime          @default(now())
}
```

---

## Important Rules

- Total share percentages must sum to 100 for REVENUE_SHARE — enforced at the service layer
- `fixedOwnerPayout` is required for FIXED_PAYOUT — validated before creation
- Share percentages must be stored as `Decimal`, not `Float`
- A property with no active financial model cannot generate settlements
- Changing financial model mid-cycle affects only future settlements — past settlements are immutable
