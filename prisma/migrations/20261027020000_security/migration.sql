-- Sign-ins before this time are revoked (set when a password changes).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMP(3);

-- Reset tokens are now stored hashed; outstanding plain-text tokens can no longer be used.
UPDATE "User" SET "resetToken" = NULL, "resetTokenExpiry" = NULL WHERE "resetToken" IS NOT NULL;
