-- Sprint 3 Medium Fixes Migration
-- Audit date: 2026-05-26
-- Issues addressed: BM-004, NS-004, RB-005

-- ─────────────────────────────────────────────────────────────────────────────
-- BM-004: GST compliance fields on Property
-- ─────────────────────────────────────────────────────────────────────────────
-- Indian enterprise PGs with rent > ₹7,500/month may be liable for GST.
-- Fields are zero/false-defaulted; opt-in per property.

ALTER TABLE "Property"
  ADD COLUMN IF NOT EXISTS "gstApplicable" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "gstNumber"     TEXT,
  ADD COLUMN IF NOT EXISTS "gstRate"       DECIMAL(5,2) NOT NULL DEFAULT 0;

-- ─────────────────────────────────────────────────────────────────────────────
-- BM-004: Deposit interest rate on FinancialModel
-- ─────────────────────────────────────────────────────────────────────────────
-- Some PGs credit tenants with interest on deposits held > 12 months.
-- Annual percentage; zero-default = no interest accrual.

ALTER TABLE "FinancialModel"
  ADD COLUMN IF NOT EXISTS "depositInterestRate" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- ─────────────────────────────────────────────────────────────────────────────
-- NS-004: Password reset email delivery tracking
-- ─────────────────────────────────────────────────────────────────────────────
-- If SMTP is down when forgotPassword is called, the reset token is created but
-- the user never receives the link. These columns let support staff detect
-- silent failures and resend / escalate to check SMTP health.

ALTER TABLE "PasswordReset"
  ADD COLUMN IF NOT EXISTS "emailSentAt"   TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "emailFailedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "emailError"    TEXT;

-- ─────────────────────────────────────────────────────────────────────────────
-- RB-005: JWT refresh token family tracking
-- ─────────────────────────────────────────────────────────────────────────────
-- All rotated tokens from the same login share a familyId.
-- If a stolen (already-revoked) token is replayed, the service revokes every
-- session in the family, forcing both the attacker and legitimate user to
-- re-authenticate.
--
-- Existing rows get a placeholder family — each old session is treated as its
-- own isolated family (no cross-session revocation for pre-migration rows).

ALTER TABLE "Session"
  ADD COLUMN IF NOT EXISTS "familyId" TEXT NOT NULL DEFAULT '';

-- Backfill: give every existing session its own unique family so old sessions
-- don't accidentally revoke each other on first rotation.
UPDATE "Session" SET "familyId" = id WHERE "familyId" = '';

-- Remove the temporary default now that backfill is complete.
ALTER TABLE "Session" ALTER COLUMN "familyId" DROP DEFAULT;

CREATE INDEX IF NOT EXISTS "Session_familyId_idx" ON "Session" ("familyId");
