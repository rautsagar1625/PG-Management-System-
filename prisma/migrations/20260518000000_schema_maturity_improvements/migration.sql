-- ============================================================
-- Schema maturity improvements
-- Adds: new enum values, room physical attributes,
--       tenant compliance flags, complaint REOPENED,
--       OperationalNote model
-- ============================================================

-- ── Enum: PropertyStatus — add UNDER_MAINTENANCE, CLOSED ────
ALTER TYPE "PropertyStatus" ADD VALUE IF NOT EXISTS 'UNDER_MAINTENANCE';
ALTER TYPE "PropertyStatus" ADD VALUE IF NOT EXISTS 'CLOSED';

-- ── Enum: BedStatus — add BLOCKED ───────────────────────────
ALTER TYPE "BedStatus" ADD VALUE IF NOT EXISTS 'BLOCKED';

-- ── Enum: TenantStatus — add PENDING_COMPLIANCE, ARCHIVED ───
ALTER TYPE "TenantStatus" ADD VALUE IF NOT EXISTS 'PENDING_COMPLIANCE';
ALTER TYPE "TenantStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';

-- ── Enum: ComplaintStatus — add REOPENED ────────────────────
ALTER TYPE "ComplaintStatus" ADD VALUE IF NOT EXISTS 'REOPENED';

-- ── Enum: PaymentType — add RENT_REFUND, ADJUSTMENT, WAIVER ─
ALTER TYPE "PaymentType" ADD VALUE IF NOT EXISTS 'RENT_REFUND';
ALTER TYPE "PaymentType" ADD VALUE IF NOT EXISTS 'ADJUSTMENT';
ALTER TYPE "PaymentType" ADD VALUE IF NOT EXISTS 'WAIVER';

-- ── Room: physical attributes & operational fields ───────────
ALTER TABLE "Room"
  ADD COLUMN IF NOT EXISTS "floorLabel"       TEXT,
  ADD COLUMN IF NOT EXISTS "attachedWashroom" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "acAvailable"      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "balcony"          BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "genderType"       "PropertyType",
  ADD COLUMN IF NOT EXISTS "maintenanceNote"  TEXT;

-- Add floor index (was missing from init)
CREATE INDEX IF NOT EXISTS "Room_propertyId_floor_idx" ON "Room"("propertyId", "floor");

-- ── Tenant: compliance flags + archivedAt ────────────────────
ALTER TABLE "Tenant"
  ADD COLUMN IF NOT EXISTS "depositCompleted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "kycCompleted"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "agreementSigned"  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "archivedAt"       TIMESTAMP(3);

-- ── Complaint: reopenedAt timestamp ─────────────────────────
ALTER TABLE "Complaint"
  ADD COLUMN IF NOT EXISTS "reopenedAt" TIMESTAMP(3);

-- ── NoteEntityType enum ──────────────────────────────────────
CREATE TYPE "NoteEntityType" AS ENUM (
  'TENANT',
  'ROOM',
  'COMPLAINT',
  'PROPERTY',
  'GENERAL'
);

-- ── OperationalNote table ────────────────────────────────────
CREATE TABLE IF NOT EXISTS "OperationalNote" (
    "id"         TEXT        NOT NULL,
    "propertyId" TEXT        NOT NULL,
    "entityType" "NoteEntityType" NOT NULL,
    "entityId"   TEXT,
    "content"    TEXT        NOT NULL,
    "isPinned"   BOOLEAN     NOT NULL DEFAULT false,
    "createdBy"  TEXT        NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationalNote_pkey" PRIMARY KEY ("id")
);

-- Foreign keys for OperationalNote
ALTER TABLE "OperationalNote"
  ADD CONSTRAINT "OperationalNote_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OperationalNote"
  ADD CONSTRAINT "OperationalNote_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Indexes for OperationalNote
CREATE INDEX IF NOT EXISTS "OperationalNote_propertyId_entityType_entityId_idx"
  ON "OperationalNote"("propertyId", "entityType", "entityId");

CREATE INDEX IF NOT EXISTS "OperationalNote_propertyId_isPinned_createdAt_idx"
  ON "OperationalNote"("propertyId", "isPinned", "createdAt");

CREATE INDEX IF NOT EXISTS "OperationalNote_entityType_entityId_idx"
  ON "OperationalNote"("entityType", "entityId");
