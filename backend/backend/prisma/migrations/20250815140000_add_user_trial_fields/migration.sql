-- Add trial-related fields to users table for independent trial system
-- This replaces the complex subscription-based trial system

ALTER TABLE "users" ADD COLUMN "trialStartedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "trialExpiresAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "hasUsedTrial" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "trialEmail" TEXT;
ALTER TABLE "users" ADD COLUMN "trialIpAddress" TEXT;

-- Add indexes for better query performance
CREATE INDEX "users_trialExpiresAt_idx" ON "users"("trialExpiresAt");
CREATE INDEX "users_hasUsedTrial_idx" ON "users"("hasUsedTrial");
CREATE INDEX "users_trialEmail_idx" ON "users"("trialEmail");
CREATE INDEX "users_trialIpAddress_idx" ON "users"("trialIpAddress");