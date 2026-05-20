-- Rename Room.monthlyRent → Room.baseRent (data-safe, no DROP)
ALTER TABLE "Room" RENAME COLUMN "monthlyRent" TO "baseRent";

-- Add TransferReason enum
CREATE TYPE "TransferReason" AS ENUM (
  'TENANT_REQUEST',
  'UPGRADE',
  'DOWNGRADE',
  'MAINTENANCE',
  'ROOMMATE_CONFLICT',
  'OPERATOR_DECISION',
  'OTHER'
);

-- Add transferReason to TenantAllocation (nullable — only set for TRANSFER allocations)
ALTER TABLE "TenantAllocation" ADD COLUMN "transferReason" "TransferReason";
