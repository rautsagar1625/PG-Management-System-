-- ── User: expo push token ────────────────────────────────────────────
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "expoPushToken" TEXT;

-- ── PasswordReset table ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "PasswordReset" (
  "id"        TEXT        NOT NULL,
  "userId"    TEXT        NOT NULL,
  "token"     TEXT        NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt"    TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PasswordReset_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PasswordReset"
  ADD CONSTRAINT "PasswordReset_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "PasswordReset_token_key" ON "PasswordReset"("token");
CREATE INDEX IF NOT EXISTS "PasswordReset_token_idx"  ON "PasswordReset"("token");
CREATE INDEX IF NOT EXISTS "PasswordReset_userId_idx" ON "PasswordReset"("userId");
