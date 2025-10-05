-- Add test account field to user_subscriptions table
ALTER TABLE "user_subscriptions" ADD COLUMN "isTestAccount" BOOLEAN NOT NULL DEFAULT FALSE;

-- Create admin subscription logs table
CREATE TABLE "admin_subscription_logs" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "operationType" TEXT NOT NULL,
    "oldStatus" TEXT,
    "newStatus" TEXT,
    "oldTestAccount" BOOLEAN,
    "newTestAccount" BOOLEAN,
    "metadata" JSONB,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_subscription_logs_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraints
ALTER TABLE "admin_subscription_logs" ADD CONSTRAINT "admin_subscription_logs_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "admin_subscription_logs" ADD CONSTRAINT "admin_subscription_logs_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "admin_subscription_logs" ADD CONSTRAINT "admin_subscription_logs_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "user_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create indexes for better query performance
CREATE INDEX "admin_subscription_logs_adminUserId_idx" ON "admin_subscription_logs"("adminUserId");
CREATE INDEX "admin_subscription_logs_targetUserId_idx" ON "admin_subscription_logs"("targetUserId");
CREATE INDEX "admin_subscription_logs_subscriptionId_idx" ON "admin_subscription_logs"("subscriptionId");
CREATE INDEX "admin_subscription_logs_operationType_idx" ON "admin_subscription_logs"("operationType");
CREATE INDEX "admin_subscription_logs_createdAt_idx" ON "admin_subscription_logs"("createdAt" DESC);