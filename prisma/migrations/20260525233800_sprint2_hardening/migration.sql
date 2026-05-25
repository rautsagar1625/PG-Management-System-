-- Sprint 2 Hardening Migration
-- Audit date: 2026-05-25
-- Issues addressed: AE-002, MA-001, PF-003

-- ─────────────────────────────────────────────────────────────────────────────
-- AE-002: Partial unique index — one ACTIVE allocation per tenant
-- ─────────────────────────────────────────────────────────────────────────────
-- Service-layer enforcement only is insufficient; a race condition between two
-- concurrent move-in requests can both pass the check before either commits,
-- resulting in duplicate active allocations for the same tenant.
--
-- A PostgreSQL partial unique index enforces this at the DB engine level.
-- Prisma schema DSL cannot express partial indexes (WHERE clause), so this
-- must be a raw migration.
--
-- Effect: INSERT/UPDATE that would create a second "isActive = true" row for
-- the same tenantId will raise a unique violation (P2002), which the service
-- layer already catches and re-throws as ConflictException.

CREATE UNIQUE INDEX IF NOT EXISTS "unique_active_allocation_per_tenant"
  ON "TenantAllocation" ("tenantId")
  WHERE "isActive" = TRUE;

-- ─────────────────────────────────────────────────────────────────────────────
-- AE-002 (bed side): one ACTIVE allocation per bed
-- ─────────────────────────────────────────────────────────────────────────────
-- Prevents two tenants from being assigned the same bed simultaneously.

CREATE UNIQUE INDEX IF NOT EXISTS "unique_active_allocation_per_bed"
  ON "TenantAllocation" ("bedId")
  WHERE "isActive" = TRUE;

-- ─────────────────────────────────────────────────────────────────────────────
-- MA-001: DeviceToken table for FCM / APNs push notifications
-- ─────────────────────────────────────────────────────────────────────────────
-- Created via Prisma schema generate (DeviceToken model + DevicePlatform enum).
-- Prisma will handle this table creation through the schema sync.
-- This comment documents the intent for the migration audit trail.

-- ─────────────────────────────────────────────────────────────────────────────
-- PF-003: Additional composite index on Payment(tenantId, paidAt)
-- ─────────────────────────────────────────────────────────────────────────────
-- Rent history queries filter by tenantId and sort by paidAt.
-- Without this index, queries become full table scans as Payment grows.
-- Prisma schema already has this via @@index([tenantId, paidAt]) added in Sprint 1.
-- This is a no-op comment confirming the index was added via schema.
