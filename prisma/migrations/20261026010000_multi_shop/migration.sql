-- Multi-shop isolation: shopId on every tenant root table, backfilled to the existing shop.

ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "shopId" TEXT;
CREATE INDEX IF NOT EXISTS "Customer_shopId_idx" ON "Customer"("shopId");
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "shopId" TEXT;
CREATE INDEX IF NOT EXISTS "Vehicle_shopId_idx" ON "Vehicle"("shopId");
ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "shopId" TEXT;
CREATE INDEX IF NOT EXISTS "Quote_shopId_idx" ON "Quote"("shopId");
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "shopId" TEXT;
CREATE INDEX IF NOT EXISTS "Invoice_shopId_idx" ON "Invoice"("shopId");
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "shopId" TEXT;
CREATE INDEX IF NOT EXISTS "Payment_shopId_idx" ON "Payment"("shopId");
ALTER TABLE "PartsVendor" ADD COLUMN IF NOT EXISTS "shopId" TEXT;
CREATE INDEX IF NOT EXISTS "PartsVendor_shopId_idx" ON "PartsVendor"("shopId");
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "shopId" TEXT;
CREATE INDEX IF NOT EXISTS "PurchaseOrder_shopId_idx" ON "PurchaseOrder"("shopId");
ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "shopId" TEXT;
CREATE INDEX IF NOT EXISTS "InventoryItem_shopId_idx" ON "InventoryItem"("shopId");
ALTER TABLE "CannedService" ADD COLUMN IF NOT EXISTS "shopId" TEXT;
CREATE INDEX IF NOT EXISTS "CannedService_shopId_idx" ON "CannedService"("shopId");
ALTER TABLE "ServiceRequest" ADD COLUMN IF NOT EXISTS "shopId" TEXT;
CREATE INDEX IF NOT EXISTS "ServiceRequest_shopId_idx" ON "ServiceRequest"("shopId");
ALTER TABLE "MarketingCampaign" ADD COLUMN IF NOT EXISTS "shopId" TEXT;
CREATE INDEX IF NOT EXISTS "MarketingCampaign_shopId_idx" ON "MarketingCampaign"("shopId");
ALTER TABLE "FleetAccount" ADD COLUMN IF NOT EXISTS "shopId" TEXT;
CREATE INDEX IF NOT EXISTS "FleetAccount_shopId_idx" ON "FleetAccount"("shopId");
ALTER TABLE "CommSequence" ADD COLUMN IF NOT EXISTS "shopId" TEXT;
CREATE INDEX IF NOT EXISTS "CommSequence_shopId_idx" ON "CommSequence"("shopId");
ALTER TABLE "SmsMessage" ADD COLUMN IF NOT EXISTS "shopId" TEXT;
CREATE INDEX IF NOT EXISTS "SmsMessage_shopId_idx" ON "SmsMessage"("shopId");
ALTER TABLE "Communication" ADD COLUMN IF NOT EXISTS "shopId" TEXT;
CREATE INDEX IF NOT EXISTS "Communication_shopId_idx" ON "Communication"("shopId");
ALTER TABLE "ReviewRequest" ADD COLUMN IF NOT EXISTS "shopId" TEXT;
CREATE INDEX IF NOT EXISTS "ReviewRequest_shopId_idx" ON "ReviewRequest"("shopId");
ALTER TABLE "PayrollRun" ADD COLUMN IF NOT EXISTS "shopId" TEXT;
CREATE INDEX IF NOT EXISTS "PayrollRun_shopId_idx" ON "PayrollRun"("shopId");
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "shopId" TEXT;
CREATE INDEX IF NOT EXISTS "AuditLog_shopId_idx" ON "AuditLog"("shopId");
ALTER TABLE "Warranty" ADD COLUMN IF NOT EXISTS "shopId" TEXT;
CREATE INDEX IF NOT EXISTS "Warranty_shopId_idx" ON "Warranty"("shopId");
ALTER TABLE "InsuranceClaim" ADD COLUMN IF NOT EXISTS "shopId" TEXT;
CREATE INDEX IF NOT EXISTS "InsuranceClaim_shopId_idx" ON "InsuranceClaim"("shopId");
ALTER TABLE "DeclinedService" ADD COLUMN IF NOT EXISTS "shopId" TEXT;
CREATE INDEX IF NOT EXISTS "DeclinedService_shopId_idx" ON "DeclinedService"("shopId");
ALTER TABLE "FollowUp" ADD COLUMN IF NOT EXISTS "shopId" TEXT;
CREATE INDEX IF NOT EXISTS "FollowUp_shopId_idx" ON "FollowUp"("shopId");

-- Installs that never ran onboarding get a shop to own their existing data.
INSERT INTO "Shop" ("id", "name", "isActive", "isDefault", "createdAt", "updatedAt")
SELECT 'shop_default', 'My Shop', true, true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM "Shop");

CREATE TEMP TABLE "_owner_shop" AS
SELECT "id" FROM "Shop" ORDER BY "isActive" DESC, "isDefault" DESC, "createdAt" ASC LIMIT 1;

UPDATE "Customer" SET "shopId" = (SELECT "id" FROM "_owner_shop") WHERE "shopId" IS NULL;
UPDATE "Vehicle" SET "shopId" = (SELECT "id" FROM "_owner_shop") WHERE "shopId" IS NULL;
UPDATE "Quote" SET "shopId" = (SELECT "id" FROM "_owner_shop") WHERE "shopId" IS NULL;
UPDATE "Invoice" SET "shopId" = (SELECT "id" FROM "_owner_shop") WHERE "shopId" IS NULL;
UPDATE "Payment" SET "shopId" = (SELECT "id" FROM "_owner_shop") WHERE "shopId" IS NULL;
UPDATE "PartsVendor" SET "shopId" = (SELECT "id" FROM "_owner_shop") WHERE "shopId" IS NULL;
UPDATE "PurchaseOrder" SET "shopId" = (SELECT "id" FROM "_owner_shop") WHERE "shopId" IS NULL;
UPDATE "InventoryItem" SET "shopId" = (SELECT "id" FROM "_owner_shop") WHERE "shopId" IS NULL;
UPDATE "CannedService" SET "shopId" = (SELECT "id" FROM "_owner_shop") WHERE "shopId" IS NULL;
UPDATE "ServiceRequest" SET "shopId" = (SELECT "id" FROM "_owner_shop") WHERE "shopId" IS NULL;
UPDATE "MarketingCampaign" SET "shopId" = (SELECT "id" FROM "_owner_shop") WHERE "shopId" IS NULL;
UPDATE "FleetAccount" SET "shopId" = (SELECT "id" FROM "_owner_shop") WHERE "shopId" IS NULL;
UPDATE "CommSequence" SET "shopId" = (SELECT "id" FROM "_owner_shop") WHERE "shopId" IS NULL;
UPDATE "SmsMessage" SET "shopId" = (SELECT "id" FROM "_owner_shop") WHERE "shopId" IS NULL;
UPDATE "Communication" SET "shopId" = (SELECT "id" FROM "_owner_shop") WHERE "shopId" IS NULL;
UPDATE "ReviewRequest" SET "shopId" = (SELECT "id" FROM "_owner_shop") WHERE "shopId" IS NULL;
UPDATE "PayrollRun" SET "shopId" = (SELECT "id" FROM "_owner_shop") WHERE "shopId" IS NULL;
UPDATE "AuditLog" SET "shopId" = (SELECT "id" FROM "_owner_shop") WHERE "shopId" IS NULL;
UPDATE "Warranty" SET "shopId" = (SELECT "id" FROM "_owner_shop") WHERE "shopId" IS NULL;
UPDATE "InsuranceClaim" SET "shopId" = (SELECT "id" FROM "_owner_shop") WHERE "shopId" IS NULL;
UPDATE "DeclinedService" SET "shopId" = (SELECT "id" FROM "_owner_shop") WHERE "shopId" IS NULL;
UPDATE "FollowUp" SET "shopId" = (SELECT "id" FROM "_owner_shop") WHERE "shopId" IS NULL;
UPDATE "User" SET "shopId" = (SELECT "id" FROM "_owner_shop") WHERE "shopId" IS NULL;
UPDATE "Job" SET "shopId" = (SELECT "id" FROM "_owner_shop") WHERE "shopId" IS NULL;

UPDATE "Settings" SET "key" = (SELECT "id" FROM "_owner_shop") || ':' || "key"
WHERE "key" IN ('quickbooks_connection', 'xero_connection');

DROP INDEX IF EXISTS "PayrollRun_periodStart_periodEnd_key";
CREATE UNIQUE INDEX IF NOT EXISTS "PayrollRun_shopId_periodStart_periodEnd_key" ON "PayrollRun"("shopId", "periodStart", "periodEnd");

DROP TABLE "_owner_shop";
