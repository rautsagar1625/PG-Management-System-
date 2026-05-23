-- Feature Expansion Migration
-- Adds: Lead CRM, Food Menu, Attendance, Autopay, Rental Agreements
-- Plus: Property public listing fields, User whatsapp field

-- User: add whatsappPhone
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "whatsappPhone" TEXT;

-- Property: public listing + attendance config fields
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "slug"             TEXT;
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "description"      TEXT;
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "heroImageUrl"     TEXT;
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "contactPhone"     TEXT;
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "isPublicListed"   BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "wifiSSIDs"        TEXT[]  NOT NULL DEFAULT '{}';
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "attendanceRadius" INTEGER NOT NULL DEFAULT 200;

CREATE UNIQUE INDEX IF NOT EXISTS "Property_slug_key" ON "Property"("slug");
CREATE INDEX IF NOT EXISTS "Property_slug_idx" ON "Property"("slug");

-- NotificationType enum additions
DO $$ DECLARE nt_oid OID;
BEGIN
  SELECT oid INTO nt_oid FROM pg_type WHERE typname = 'NotificationType';
  IF nt_oid IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'LEAD_ASSIGNED'       AND enumtypid = nt_oid) THEN
    ALTER TYPE "NotificationType" ADD VALUE 'LEAD_ASSIGNED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'AUTOPAY_ACTIVATED'   AND enumtypid = nt_oid) THEN
    ALTER TYPE "NotificationType" ADD VALUE 'AUTOPAY_ACTIVATED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'AUTOPAY_DEBIT'       AND enumtypid = nt_oid) THEN
    ALTER TYPE "NotificationType" ADD VALUE 'AUTOPAY_DEBIT';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'AGREEMENT_READY'     AND enumtypid = nt_oid) THEN
    ALTER TYPE "NotificationType" ADD VALUE 'AGREEMENT_READY';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'AGREEMENT_SIGNED'    AND enumtypid = nt_oid) THEN
    ALTER TYPE "NotificationType" ADD VALUE 'AGREEMENT_SIGNED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'ATTENDANCE_REMINDER' AND enumtypid = nt_oid) THEN
    ALTER TYPE "NotificationType" ADD VALUE 'ATTENDANCE_REMINDER';
  END IF;
END $$;

-- LeadSource enum
DO $$ BEGIN
  CREATE TYPE "LeadSource" AS ENUM ('DIRECT','WEBSITE','REFERRAL','SOCIAL_MEDIA','BROKER','WALK_IN','OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- LeadStatus enum
DO $$ BEGIN
  CREATE TYPE "LeadStatus" AS ENUM ('NEW','CONTACTED','VISIT_SCHEDULED','VISITED','NEGOTIATING','TOKEN_PAID','CONVERTED','LOST');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- MealType enum
DO $$ BEGIN
  CREATE TYPE "MealType" AS ENUM ('BREAKFAST','LUNCH','EVENING_SNACK','DINNER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AttendanceType enum
DO $$ BEGIN
  CREATE TYPE "AttendanceType" AS ENUM ('CHECK_IN','CHECK_OUT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- MandateStatus enum
DO $$ BEGIN
  CREATE TYPE "MandateStatus" AS ENUM ('CREATED','PENDING','ACTIVE','PAUSED','CANCELLED','EXPIRED','FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AgreementStatus enum
DO $$ BEGIN
  CREATE TYPE "AgreementStatus" AS ENUM ('DRAFT','SENT','SIGNED','EXPIRED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Lead table
CREATE TABLE IF NOT EXISTS "Lead" (
  "id"          TEXT NOT NULL,
  "propertyId"  TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "phone"       TEXT NOT NULL,
  "email"       TEXT,
  "source"      "LeadSource" NOT NULL DEFAULT 'DIRECT',
  "status"      "LeadStatus" NOT NULL DEFAULT 'NEW',
  "budget"      DECIMAL(10,2),
  "moveInDate"  TIMESTAMP(3),
  "roomType"    "RoomType",
  "notes"       TEXT,
  "assignedTo"  TEXT,
  "visitDate"   TIMESTAMP(3),
  "tokenAmount" DECIMAL(10,2),
  "convertedAt" TIMESTAMP(3),
  "tenantId"    TEXT UNIQUE,
  "createdBy"   TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Lead_propertyId_status_idx" ON "Lead"("propertyId","status");
CREATE INDEX IF NOT EXISTS "Lead_phone_idx"              ON "Lead"("phone");
CREATE INDEX IF NOT EXISTS "Lead_createdAt_idx"          ON "Lead"("createdAt");
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedTo_fkey" FOREIGN KEY ("assignedTo")  REFERENCES "User"("id") ON DELETE SET NULL;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_createdBy_fkey" FOREIGN KEY ("createdBy")   REFERENCES "User"("id");
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_tenantId_fkey"  FOREIGN KEY ("tenantId")    REFERENCES "Tenant"("id");

-- FoodMenu table
CREATE TABLE IF NOT EXISTS "FoodMenu" (
  "id"         TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "dayOfWeek"  INTEGER NOT NULL,
  "mealType"   "MealType" NOT NULL,
  "items"      TEXT[] NOT NULL DEFAULT '{}',
  "timing"     TEXT,
  "isActive"   BOOLEAN NOT NULL DEFAULT TRUE,
  "createdBy"  TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FoodMenu_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FoodMenu_property_day_meal_key" UNIQUE ("propertyId","dayOfWeek","mealType")
);
CREATE INDEX IF NOT EXISTS "FoodMenu_propertyId_isActive_idx" ON "FoodMenu"("propertyId","isActive");
ALTER TABLE "FoodMenu" ADD CONSTRAINT "FoodMenu_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE;

-- AttendanceRecord table
CREATE TABLE IF NOT EXISTS "AttendanceRecord" (
  "id"            TEXT NOT NULL,
  "userId"        TEXT NOT NULL,
  "propertyId"    TEXT NOT NULL,
  "type"          "AttendanceType" NOT NULL,
  "latitude"      DOUBLE PRECISION,
  "longitude"     DOUBLE PRECISION,
  "accuracy"      DOUBLE PRECISION,
  "wifiSSID"      TEXT,
  "isValid"       BOOLEAN NOT NULL DEFAULT TRUE,
  "invalidReason" TEXT,
  "deviceInfo"    TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AttendanceRecord_userId_createdAt_idx"     ON "AttendanceRecord"("userId","createdAt");
CREATE INDEX IF NOT EXISTS "AttendanceRecord_propertyId_createdAt_idx" ON "AttendanceRecord"("propertyId","createdAt");
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_userId_fkey"     FOREIGN KEY ("userId")     REFERENCES "User"("id")     ON DELETE CASCADE;
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE;

-- AutopayMandate table
CREATE TABLE IF NOT EXISTS "AutopayMandate" (
  "id"            TEXT NOT NULL,
  "tenantId"      TEXT NOT NULL,
  "propertyId"    TEXT NOT NULL,
  "externalId"    TEXT,
  "amount"        DECIMAL(10,2) NOT NULL,
  "bankAccount"   TEXT,
  "ifscCode"      TEXT,
  "accountName"   TEXT,
  "debitDay"      INTEGER NOT NULL DEFAULT 1,
  "status"        "MandateStatus" NOT NULL DEFAULT 'CREATED',
  "activatedAt"   TIMESTAMP(3),
  "cancelledAt"   TIMESTAMP(3),
  "failureReason" TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AutopayMandate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AutopayMandate_tenantId_idx"          ON "AutopayMandate"("tenantId");
CREATE INDEX IF NOT EXISTS "AutopayMandate_propertyId_status_idx" ON "AutopayMandate"("propertyId","status");
ALTER TABLE "AutopayMandate" ADD CONSTRAINT "AutopayMandate_tenantId_fkey"   FOREIGN KEY ("tenantId")   REFERENCES "Tenant"("id")   ON DELETE CASCADE;
ALTER TABLE "AutopayMandate" ADD CONSTRAINT "AutopayMandate_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id");

-- RentalAgreement table
CREATE TABLE IF NOT EXISTS "RentalAgreement" (
  "id"               TEXT NOT NULL,
  "tenantId"         TEXT NOT NULL,
  "propertyId"       TEXT NOT NULL,
  "allocationId"     TEXT,
  "terms"            TEXT NOT NULL,
  "rentAmount"       DECIMAL(10,2) NOT NULL,
  "depositAmount"    DECIMAL(10,2) NOT NULL,
  "startDate"        TIMESTAMP(3) NOT NULL,
  "endDate"          TIMESTAMP(3),
  "status"           "AgreementStatus" NOT NULL DEFAULT 'DRAFT',
  "signedByTenantAt" TIMESTAMP(3),
  "signedByOwnerAt"  TIMESTAMP(3),
  "fileUrl"          TEXT,
  "createdBy"        TEXT NOT NULL,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RentalAgreement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "RentalAgreement_tenantId_idx"          ON "RentalAgreement"("tenantId");
CREATE INDEX IF NOT EXISTS "RentalAgreement_propertyId_status_idx" ON "RentalAgreement"("propertyId","status");
ALTER TABLE "RentalAgreement" ADD CONSTRAINT "RentalAgreement_tenantId_fkey"   FOREIGN KEY ("tenantId")   REFERENCES "Tenant"("id")   ON DELETE CASCADE;
ALTER TABLE "RentalAgreement" ADD CONSTRAINT "RentalAgreement_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id");
