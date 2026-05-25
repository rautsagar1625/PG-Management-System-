-- Sprint 5 — Performance hardening: new database indexes

-- SP5-3: FinancialModel effectiveFrom index
-- Speeds up settlement period query:
--   WHERE propertyId = ? AND effectiveFrom <= ? ORDER BY effectiveFrom DESC
-- The existing [propertyId, isActive] index does NOT help with range + sort on effectiveFrom.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "FinancialModel_propertyId_effectiveFrom_idx"
  ON "FinancialModel" ("propertyId", "effectiveFrom");

-- SP5-6: Lead assignee index
-- Speeds up "my leads" / team-assignment CRM filter:
--   WHERE propertyId = ? AND assignedTo = ?
-- The existing [propertyId, status] index doesn't cover assignedTo queries.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Lead_propertyId_assignedTo_idx"
  ON "Lead" ("propertyId", "assignedTo");
