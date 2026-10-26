-- Software subscription per shop (platform Stripe account, not the shop's own).
ALTER TABLE "Shop"
  ADD COLUMN "billingExempt" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "plan" TEXT,
  ADD COLUMN "subscriptionStatus" TEXT,
  ADD COLUMN "trialEndsAt" TIMESTAMP(3),
  ADD COLUMN "currentPeriodEnd" TIMESTAMP(3),
  ADD COLUMN "stripeCustomerId" TEXT,
  ADD COLUMN "stripeSubscriptionId" TEXT;

-- Shops that existed before billing (the platform owner's) are never charged.
UPDATE "Shop" SET "billingExempt" = true;

CREATE UNIQUE INDEX "Shop_stripeCustomerId_key" ON "Shop"("stripeCustomerId");
CREATE UNIQUE INDEX "Shop_stripeSubscriptionId_key" ON "Shop"("stripeSubscriptionId");
