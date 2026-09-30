-- CreateEnum
CREATE TYPE "WarrantyType" AS ENUM ('PARTS', 'LABOR', 'PARTS_AND_LABOR');

-- CreateEnum
CREATE TYPE "WarrantyStatus" AS ENUM ('ACTIVE', 'CLAIMED', 'EXPIRED', 'VOIDED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserRole" ADD VALUE 'SERVICE_ADVISOR';
ALTER TYPE "UserRole" ADD VALUE 'CUSTOMER';

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "portalToken" TEXT;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "qbInvoiceId" TEXT,
ADD COLUMN     "qbSyncedAt" TIMESTAMP(3),
ADD COLUMN     "stripePaymentUrl" TEXT,
ADD COLUMN     "stripeSessionId" TEXT,
ADD COLUMN     "xeroInvoiceId" TEXT,
ADD COLUMN     "xeroSyncedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "fleetAccountId" TEXT,
ADD COLUMN     "fleetPoNumber" TEXT,
ADD COLUMN     "shopId" TEXT,
ADD COLUMN     "vehicleHealthScore" INTEGER;

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "approvalToken" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "customerId" TEXT,
ADD COLUMN     "resetToken" TEXT,
ADD COLUMN     "resetTokenExpiry" TIMESTAMP(3),
ADD COLUMN     "shopId" TEXT,
ADD COLUMN     "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "totpSecret" TEXT;

-- CreateTable
CREATE TABLE "ServiceRequest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "vehicleYear" INTEGER,
    "vehicleMake" TEXT,
    "vehicleModel" TEXT,
    "serviceType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "photoUrl" TEXT,
    "preferredDate" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "customerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceInterval" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "intervalMiles" INTEGER,
    "intervalDays" INTEGER,
    "lastServiceMiles" INTEGER,
    "lastServiceDate" TIMESTAMP(3),
    "nextDueMiles" INTEGER,
    "nextDueDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceInterval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsMessage" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "fromNumber" TEXT NOT NULL,
    "toNumber" TEXT NOT NULL,
    "twilioSid" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeLog" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "clockedIn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clockedOut" TIMESTAMP(3),
    "notes" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "partNumber" TEXT,
    "description" TEXT,
    "category" TEXT,
    "quantityOnHand" INTEGER NOT NULL DEFAULT 0,
    "reorderPoint" INTEGER NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "location" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewRequest" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "reviewToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentPlanInstallment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "paidAmount" DECIMAL(10,2),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentPlanInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FleetAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "billingTerms" TEXT NOT NULL DEFAULT 'NET_30',
    "customLaborRate" DECIMAL(10,2),
    "poRequired" BOOLEAN NOT NULL DEFAULT false,
    "creditLimit" DECIMAL(10,2),
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FleetAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "triggerValue" TEXT,
    "messageTemplate" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaborTimeCache" (
    "id" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "year" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "repair" TEXT NOT NULL,
    "laborHours" DECIMAL(6,2) NOT NULL,
    "skillLevel" TEXT NOT NULL DEFAULT 'Intermediate',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LaborTimeCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CannedService" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "laborHours" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "laborPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "parts" JSONB,
    "totalPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CannedService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "taxRate" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "laborRate" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "logoUrl" TEXT,
    "googleReviewUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeclinedService" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reason" TEXT,
    "estimatedPrice" DECIMAL(10,2),
    "followUpAt" TIMESTAMP(3),
    "followedUp" BOOLEAN NOT NULL DEFAULT false,
    "followUpNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeclinedService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warranty" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "type" "WarrantyType" NOT NULL DEFAULT 'PARTS',
    "description" TEXT NOT NULL,
    "partNumber" TEXT,
    "laborCode" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiryDate" TIMESTAMP(3),
    "mileageAtService" INTEGER,
    "mileageLimit" INTEGER,
    "durationDays" INTEGER,
    "status" "WarrantyStatus" NOT NULL DEFAULT 'ACTIVE',
    "claimedAt" TIMESTAMP(3),
    "claimNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warranty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommSequence" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "triggerEvent" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommSequenceStep" (
    "id" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "delayHours" INTEGER NOT NULL DEFAULT 0,
    "messageTemplate" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'SMS',

    CONSTRAINT "CommSequenceStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommEnrollment" (
    "id" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "jobId" TEXT,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "nextStepAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsuranceClaim" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "claimNumber" TEXT,
    "insuranceCompany" TEXT NOT NULL,
    "adjusterName" TEXT,
    "adjusterPhone" TEXT,
    "adjusterEmail" TEXT,
    "deductible" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "approvedAmount" DECIMAL(10,2),
    "paidAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsuranceClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sublet" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "vendorInvoice" TEXT,
    "ourCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "ourCharge" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "markup" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sublet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rateType" TEXT NOT NULL DEFAULT 'HOURLY',
    "hourlyRate" DECIMAL(10,2),
    "flatRateMul" DECIMAL(5,2) NOT NULL DEFAULT 1.0,
    "commissionPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleSpec" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "trim" TEXT,
    "engine" TEXT,
    "engineDisplacement" TEXT,
    "engineCylinders" INTEGER,
    "compressionRatio" TEXT,
    "firingOrder" TEXT,
    "timingType" TEXT,
    "timingBeltMiles" INTEGER,
    "oilType" TEXT,
    "oilCapacityQts" DOUBLE PRECISION,
    "oilFilterPN" TEXT,
    "coolantType" TEXT,
    "coolantCapacityQts" DOUBLE PRECISION,
    "transType" TEXT,
    "transFluidType" TEXT,
    "transFluidQts" DOUBLE PRECISION,
    "brakeFluidType" TEXT,
    "powerSteeringFluid" TEXT,
    "diffFluidFrontType" TEXT,
    "diffFluidFrontQts" DOUBLE PRECISION,
    "diffFluidRearType" TEXT,
    "diffFluidRearQts" DOUBLE PRECISION,
    "transferCaseFluid" TEXT,
    "transferCaseQts" DOUBLE PRECISION,
    "batteryGroup" TEXT,
    "batteryCCA" INTEGER,
    "batteryRC" INTEGER,
    "tireSizeFront" TEXT,
    "tireSizeRear" TEXT,
    "tirePressureFront" INTEGER,
    "tirePressureRear" INTEGER,
    "spareTireSize" TEXT,
    "frontRotorDia" DOUBLE PRECISION,
    "rearRotorDia" DOUBLE PRECISION,
    "frontRotorMinMM" DOUBLE PRECISION,
    "rearRotorMinMM" DOUBLE PRECISION,
    "frontPadMinMM" DOUBLE PRECISION,
    "rearPadMinMM" DOUBLE PRECISION,
    "wheelNutTorque" INTEGER,
    "frontCaliperTorque" INTEGER,
    "rearCaliperTorque" INTEGER,
    "sparkPlugPN" TEXT,
    "sparkPlugGapIn" DOUBLE PRECISION,
    "sparkPlugMiles" INTEGER,
    "refrigerantType" TEXT,
    "refrigerantOz" DOUBLE PRECISION,
    "acOilType" TEXT,
    "adasFeatures" TEXT[],
    "adasCalRequired" TEXT[],
    "obd2Protocol" TEXT,
    "evapSystemType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleSpec_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatternFailure" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "engine" TEXT,
    "dtcCodes" TEXT[],
    "symptoms" TEXT[],
    "confirmedFix" TEXT NOT NULL,
    "partNumbers" TEXT[],
    "laborHours" DOUBLE PRECISION,
    "successCount" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "techId" TEXT,
    "shopId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatternFailure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechnicianLocation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "heading" DOUBLE PRECISION,
    "speed" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TechnicianLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'web',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceRequest_status_idx" ON "ServiceRequest"("status");

-- CreateIndex
CREATE INDEX "ServiceRequest_customerId_idx" ON "ServiceRequest"("customerId");

-- CreateIndex
CREATE INDEX "MaintenanceInterval_vehicleId_idx" ON "MaintenanceInterval"("vehicleId");

-- CreateIndex
CREATE INDEX "SmsMessage_customerId_idx" ON "SmsMessage"("customerId");

-- CreateIndex
CREATE INDEX "TimeLog_jobId_idx" ON "TimeLog"("jobId");

-- CreateIndex
CREATE INDEX "TimeLog_technicianId_idx" ON "TimeLog"("technicianId");

-- CreateIndex
CREATE INDEX "InventoryItem_category_idx" ON "InventoryItem"("category");

-- CreateIndex
CREATE INDEX "InventoryItem_location_idx" ON "InventoryItem"("location");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewRequest_jobId_key" ON "ReviewRequest"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewRequest_reviewToken_key" ON "ReviewRequest"("reviewToken");

-- CreateIndex
CREATE INDEX "ReviewRequest_customerId_idx" ON "ReviewRequest"("customerId");

-- CreateIndex
CREATE INDEX "PaymentPlanInstallment_invoiceId_idx" ON "PaymentPlanInstallment"("invoiceId");

-- CreateIndex
CREATE INDEX "FleetAccount_name_idx" ON "FleetAccount"("name");

-- CreateIndex
CREATE INDEX "FleetAccount_isActive_idx" ON "FleetAccount"("isActive");

-- CreateIndex
CREATE INDEX "MarketingCampaign_type_idx" ON "MarketingCampaign"("type");

-- CreateIndex
CREATE INDEX "MarketingCampaign_isActive_idx" ON "MarketingCampaign"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "LaborTimeCache_cacheKey_key" ON "LaborTimeCache"("cacheKey");

-- CreateIndex
CREATE INDEX "LaborTimeCache_cacheKey_idx" ON "LaborTimeCache"("cacheKey");

-- CreateIndex
CREATE INDEX "LaborTimeCache_make_model_idx" ON "LaborTimeCache"("make", "model");

-- CreateIndex
CREATE INDEX "CannedService_category_idx" ON "CannedService"("category");

-- CreateIndex
CREATE INDEX "CannedService_isActive_idx" ON "CannedService"("isActive");

-- CreateIndex
CREATE INDEX "Shop_isActive_idx" ON "Shop"("isActive");

-- CreateIndex
CREATE INDEX "DeclinedService_customerId_idx" ON "DeclinedService"("customerId");

-- CreateIndex
CREATE INDEX "DeclinedService_vehicleId_idx" ON "DeclinedService"("vehicleId");

-- CreateIndex
CREATE INDEX "DeclinedService_followedUp_idx" ON "DeclinedService"("followedUp");

-- CreateIndex
CREATE INDEX "DeclinedService_followUpAt_idx" ON "DeclinedService"("followUpAt");

-- CreateIndex
CREATE INDEX "Warranty_customerId_idx" ON "Warranty"("customerId");

-- CreateIndex
CREATE INDEX "Warranty_vehicleId_idx" ON "Warranty"("vehicleId");

-- CreateIndex
CREATE INDEX "Warranty_jobId_idx" ON "Warranty"("jobId");

-- CreateIndex
CREATE INDEX "Warranty_status_idx" ON "Warranty"("status");

-- CreateIndex
CREATE INDEX "Warranty_expiryDate_idx" ON "Warranty"("expiryDate");

-- CreateIndex
CREATE INDEX "CommSequence_triggerEvent_idx" ON "CommSequence"("triggerEvent");

-- CreateIndex
CREATE INDEX "CommSequence_isActive_idx" ON "CommSequence"("isActive");

-- CreateIndex
CREATE INDEX "CommSequenceStep_sequenceId_idx" ON "CommSequenceStep"("sequenceId");

-- CreateIndex
CREATE INDEX "CommEnrollment_customerId_idx" ON "CommEnrollment"("customerId");

-- CreateIndex
CREATE INDEX "CommEnrollment_sequenceId_idx" ON "CommEnrollment"("sequenceId");

-- CreateIndex
CREATE INDEX "CommEnrollment_nextStepAt_idx" ON "CommEnrollment"("nextStepAt");

-- CreateIndex
CREATE INDEX "CommEnrollment_status_idx" ON "CommEnrollment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "InsuranceClaim_jobId_key" ON "InsuranceClaim"("jobId");

-- CreateIndex
CREATE INDEX "InsuranceClaim_status_idx" ON "InsuranceClaim"("status");

-- CreateIndex
CREATE INDEX "InsuranceClaim_claimNumber_idx" ON "InsuranceClaim"("claimNumber");

-- CreateIndex
CREATE INDEX "Sublet_jobId_idx" ON "Sublet"("jobId");

-- CreateIndex
CREATE INDEX "Sublet_status_idx" ON "Sublet"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRate_userId_key" ON "PayrollRate"("userId");

-- CreateIndex
CREATE INDEX "VehicleSpec_make_model_idx" ON "VehicleSpec"("make", "model");

-- CreateIndex
CREATE INDEX "VehicleSpec_year_make_model_idx" ON "VehicleSpec"("year", "make", "model");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleSpec_year_make_model_trim_engine_key" ON "VehicleSpec"("year", "make", "model", "trim", "engine");

-- CreateIndex
CREATE INDEX "PatternFailure_make_model_idx" ON "PatternFailure"("make", "model");

-- CreateIndex
CREATE INDEX "PatternFailure_dtcCodes_idx" ON "PatternFailure"("dtcCodes");

-- CreateIndex
CREATE INDEX "PatternFailure_year_make_model_idx" ON "PatternFailure"("year", "make", "model");

-- CreateIndex
CREATE INDEX "TechnicianLocation_userId_idx" ON "TechnicianLocation"("userId");

-- CreateIndex
CREATE INDEX "TechnicianLocation_jobId_idx" ON "TechnicianLocation"("jobId");

-- CreateIndex
CREATE INDEX "TechnicianLocation_createdAt_idx" ON "TechnicianLocation"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PushToken_token_key" ON "PushToken"("token");

-- CreateIndex
CREATE INDEX "PushToken_userId_idx" ON "PushToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_portalToken_key" ON "Customer"("portalToken");

-- CreateIndex
CREATE INDEX "Job_fleetAccountId_idx" ON "Job"("fleetAccountId");

-- CreateIndex
CREATE INDEX "Job_shopId_idx" ON "Job"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_approvalToken_key" ON "Quote"("approvalToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_resetToken_key" ON "User"("resetToken");

-- CreateIndex
CREATE INDEX "User_resetToken_idx" ON "User"("resetToken");

-- CreateIndex
CREATE INDEX "User_shopId_idx" ON "User"("shopId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_fleetAccountId_fkey" FOREIGN KEY ("fleetAccountId") REFERENCES "FleetAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceInterval" ADD CONSTRAINT "MaintenanceInterval_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsMessage" ADD CONSTRAINT "SmsMessage_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeLog" ADD CONSTRAINT "TimeLog_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeLog" ADD CONSTRAINT "TimeLog_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewRequest" ADD CONSTRAINT "ReviewRequest_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewRequest" ADD CONSTRAINT "ReviewRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentPlanInstallment" ADD CONSTRAINT "PaymentPlanInstallment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeclinedService" ADD CONSTRAINT "DeclinedService_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeclinedService" ADD CONSTRAINT "DeclinedService_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeclinedService" ADD CONSTRAINT "DeclinedService_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warranty" ADD CONSTRAINT "Warranty_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warranty" ADD CONSTRAINT "Warranty_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warranty" ADD CONSTRAINT "Warranty_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommSequenceStep" ADD CONSTRAINT "CommSequenceStep_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "CommSequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommEnrollment" ADD CONSTRAINT "CommEnrollment_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "CommSequence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommEnrollment" ADD CONSTRAINT "CommEnrollment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceClaim" ADD CONSTRAINT "InsuranceClaim_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sublet" ADD CONSTRAINT "Sublet_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRate" ADD CONSTRAINT "PayrollRate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicianLocation" ADD CONSTRAINT "TechnicianLocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicianLocation" ADD CONSTRAINT "TechnicianLocation_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushToken" ADD CONSTRAINT "PushToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

