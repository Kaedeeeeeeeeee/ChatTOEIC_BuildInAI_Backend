-- CreateTable: UserLoginHistory for DAU/MAU tracking
CREATE TABLE "user_login_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "loginAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "logoutAt" TIMESTAMP(3),
    "sessionDuration" INTEGER,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "deviceType" TEXT,
    "browserType" TEXT,
    "osType" TEXT,
    "country" TEXT,
    "city" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_login_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_login_history_userId_loginAt_idx" ON "user_login_history"("userId", "loginAt");

-- CreateIndex
CREATE INDEX "user_login_history_loginAt_idx" ON "user_login_history"("loginAt");

-- AddForeignKey
ALTER TABLE "user_login_history" ADD CONSTRAINT "user_login_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Add session tracking fields to PracticeRecord
ALTER TABLE "practice_records" ADD COLUMN "startedAt" TIMESTAMP(3);
ALTER TABLE "practice_records" ADD COLUMN "pausedDuration" INTEGER;
ALTER TABLE "practice_records" ADD COLUMN "abandonedAt" TIMESTAMP(3);
ALTER TABLE "practice_records" ADD COLUMN "deviceType" TEXT;
ALTER TABLE "practice_records" ADD COLUMN "browserType" TEXT;
