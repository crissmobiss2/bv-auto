-- AlterTable (IF NOT EXISTS: applied to production ahead of deploy)
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "smsConsentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ServiceRequest" ADD COLUMN IF NOT EXISTS "smsConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "smsConsentAt" TIMESTAMP(3);
