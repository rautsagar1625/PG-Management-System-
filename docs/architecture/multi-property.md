# Multi-Property Architecture

## Design Principle

This is NOT a multi-tenant SaaS where each customer gets their own schema.

**This is single-schema, single-database** where one platform hosts multiple PG businesses.
Each `Property` is a separate PG property. Users can operate across multiple properties.

## Data Isolation

Data isolation is enforced at the **query level**, not the schema level.

Every query is scoped by `propertyId`. The caller's property access is verified via
`PropertyRole` before any data is returned.

## Cross-Property Operations

Some users operate multiple properties:
- Operator dashboard aggregates across all their properties
- Financials are always calculated per-property
- No revenue cross-subsidization between properties

## Property Independence

Each property has its own:
- Room and bed inventory
- Tenant list
- Rent cycles
- Financial model
- Settlement history
- Complaints

Nothing is shared between properties except the user account itself.

## Searching Across Properties

Operators who manage multiple properties can search/filter tenants across all their properties
by omitting the `propertyId` filter. The query automatically scopes to their accessible properties.

## Database Indexes

Critical indexes for performance in a multi-property system:
- `PropertyRole(userId, isActive)` — find all properties a user can access
- `Tenant(propertyId, status)` — query tenants within a property
- `RentCycle(propertyId, month, year)` — monthly summaries
- `Payment(propertyId, paymentDate)` — date-range financial queries
- `Complaint(propertyId, status)` — open complaints per property

All of these are defined in the Prisma schema.
