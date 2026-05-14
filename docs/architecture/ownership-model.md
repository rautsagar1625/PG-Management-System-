# Ownership & Operator Model

## Core Concept

In the real world, the person who OWNS property and the person who RUNS the PG business
are often different people. The system models this explicitly.

## PropertyRole Table

Every user-property relationship is stored in `PropertyRole`:

| Field | Description |
|-------|-------------|
| propertyId | The property |
| userId | The user |
| role | OWNER, OPERATOR, CO_OPERATOR, STAFF |
| sharePercent | For CO_OPERATOR revenue split |
| isActive | Soft deactivation |
| startDate / endDate | Timeline of role |

## Role Types

### OWNER

- Owns the physical property (the building/land)
- Receives payout from operators
- Can view all financial data
- Sets the financial model (fixed payout or revenue share)
- Cannot be overridden by operators

**OWNER ≠ OPERATOR.** An owner might not manage the PG at all.

### OPERATOR

- Runs the day-to-day PG business
- Manages tenants, rooms, rent collection
- Responsible for paying the owner (in fixed payout model)
- Profit = totalCollected - ownerPayout

### CO_OPERATOR

- Equal business partner with OPERATOR
- Same operational permissions as OPERATOR
- Has a defined `sharePercent` of operator profit
- Example: two friends running one PG together — one is OPERATOR (60%), one is CO_OPERATOR (40%)

### STAFF

- Limited role: can record payments, manage complaints
- Cannot modify financial models or property settings
- Cannot view owner payout details

## Real-World Scenarios Modeled

### Scenario 1: Owner Operates Themselves
```
User A: OWNER + OPERATOR on Property 1
Financial model: OWNER_OPERATED
```

### Scenario 2: Owner + Operator
```
User A: OWNER on Property 1
User B: OPERATOR on Property 1
Financial model: FIXED_PAYOUT (₹30,000/month to A)
```

### Scenario 3: Partnership Operation
```
User A: OWNER on Property 1
User B: OPERATOR on Property 1 (sharePercent: 60%)
User C: CO_OPERATOR on Property 1 (sharePercent: 40%)
Financial model: REVENUE_SHARE (40% owner, 60% operators)
```
B and C split the 60% operator share: B gets 60%×60% = 36%, C gets 40%×60% = 24%

### Scenario 4: Multi-Property Operator
```
User B: OPERATOR on Property 1
User B: OPERATOR on Property 2
User B: CO_OPERATOR on Property 3
```
User B has different financial terms on each property.

### Scenario 5: One Owner, Two Operators
```
User A: OWNER on Property 1
User B: OPERATOR on Property 1
User C: CO_OPERATOR on Property 1
Financial model: FIXED_PAYOUT (A gets ₹30,000, B and C split the rest)
```

## Key Rules

1. A property MUST have exactly one active OWNER
2. A property MUST have at least one active OPERATOR
3. CO_OPERATOR percentages must sum to 100% within the operator group
4. Roles are time-bounded (startDate/endDate) — history is preserved
5. Removing a role sets isActive=false and endDate=now, never deletes
