-- Create missing enums
CREATE TYPE "QuestionSource" AS ENUM ('REAL', 'AI_POOL', 'AI_REALTIME');
CREATE TYPE "QuestionStatus" AS ENUM ('ACTIVE', 'REVIEW', 'INACTIVE', 'REJECTED');
CREATE TYPE "EmailType" AS ENUM ('REGISTRATION_VERIFICATION', 'PASSWORD_RESET', 'EMAIL_CHANGE_CONFIRMATION', 'WELCOME', 'SECURITY_ALERT', 'SYSTEM_NOTIFICATION', 'FEATURE_ANNOUNCEMENT', 'WEEKLY_REPORT', 'UNSUBSCRIBE_CONFIRMATION');
CREATE TYPE "EmailStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED', 'COMPLAINED');

-- Create Questions table
CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "difficulty" "DifficultyLevel" NOT NULL,
    "source" "QuestionSource" NOT NULL,
    "status" "QuestionStatus" NOT NULL DEFAULT 'ACTIVE',
    "content" JSONB NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "explanation" TEXT,
    "audioUrl" TEXT,
    "audioScript" TEXT,
    "qualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "difficultyScore" DOUBLE PRECISION,
    "averageTime" INTEGER,
    "successRate" DOUBLE PRECISION,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "aiGeneratedData" JSONB,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- Create PracticeAnswer table
CREATE TABLE "practice_answers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "userAnswer" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "timeSpent" INTEGER NOT NULL,
    "practiceRecordId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "practice_answers_pkey" PRIMARY KEY ("id")
);

-- Create QuestionRating table
CREATE TABLE "question_ratings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "clarity" INTEGER,
    "difficulty" INTEGER,
    "quality" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_ratings_pkey" PRIMARY KEY ("id")
);

-- Create AdminSubscriptionLog table
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

-- Create Email system tables
CREATE TABLE "email_logs" (
    "id" TEXT NOT NULL,
    "type" "EmailType" NOT NULL,
    "status" "EmailStatus" NOT NULL DEFAULT 'PENDING',
    "recipientEmail" TEXT NOT NULL,
    "recipientName" TEXT,
    "userId" TEXT,
    "subject" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "templateData" JSONB,
    "htmlContent" TEXT,
    "emailProvider" TEXT NOT NULL DEFAULT 'resend',
    "providerEmailId" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "errorCode" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "metadata" JSONB,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "email_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "type" "EmailType" NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "variables" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_email_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "receiveSecurityAlerts" BOOLEAN NOT NULL DEFAULT true,
    "receiveSystemNotify" BOOLEAN NOT NULL DEFAULT true,
    "receiveWeeklyReport" BOOLEAN NOT NULL DEFAULT true,
    "receiveFeatureNews" BOOLEAN NOT NULL DEFAULT true,
    "receivePromotional" BOOLEAN NOT NULL DEFAULT false,
    "weeklyReportDay" INTEGER NOT NULL DEFAULT 1,
    "promotionalFrequency" TEXT NOT NULL DEFAULT 'weekly',
    "globalUnsubscribe" BOOLEAN NOT NULL DEFAULT false,
    "unsubscribeToken" TEXT,
    "unsubscribedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_email_preferences_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "email_stats" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "totalSent" INTEGER NOT NULL DEFAULT 0,
    "totalDelivered" INTEGER NOT NULL DEFAULT 0,
    "totalFailed" INTEGER NOT NULL DEFAULT 0,
    "totalBounced" INTEGER NOT NULL DEFAULT 0,
    "totalOpened" INTEGER NOT NULL DEFAULT 0,
    "totalClicked" INTEGER NOT NULL DEFAULT 0,
    "totalUnsubscribed" INTEGER NOT NULL DEFAULT 0,
    "totalComplaints" INTEGER NOT NULL DEFAULT 0,
    "verificationEmails" INTEGER NOT NULL DEFAULT 0,
    "notificationEmails" INTEGER NOT NULL DEFAULT 0,
    "marketingEmails" INTEGER NOT NULL DEFAULT 0,
    "openRate" DOUBLE PRECISION,
    "clickRate" DOUBLE PRECISION,
    "deliveryRate" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_stats_pkey" PRIMARY KEY ("id")
);

-- Create Practice Session and Time tracking tables
CREATE TABLE "practice_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionType" TEXT NOT NULL DEFAULT 'quick_practice',
    "questions" JSONB NOT NULL DEFAULT '[]',
    "userAnswers" JSONB NOT NULL DEFAULT '[]',
    "score" INTEGER,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "questionTimes" JSONB,
    "totalTimeSpent" INTEGER,
    "averageTimePerQuestion" INTEGER,
    "overtimeQuestions" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "practice_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "question_time_records" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "questionIndex" INTEGER NOT NULL,
    "questionType" TEXT NOT NULL,
    "questionCategory" TEXT NOT NULL,
    "timeSpent" INTEGER NOT NULL,
    "timeLimit" INTEGER,
    "isOvertime" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_time_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audio_playback_records" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "questionIndex" INTEGER NOT NULL,
    "audioUrl" TEXT NOT NULL,
    "audioDuration" INTEGER,
    "playCount" INTEGER NOT NULL DEFAULT 0,
    "totalListenTime" INTEGER NOT NULL DEFAULT 0,
    "completedListening" BOOLEAN NOT NULL DEFAULT false,
    "firstPlayedAt" TIMESTAMP(3),
    "lastPlayedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audio_playback_records_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX "questions_type_difficulty_source_status_idx" ON "questions"("type", "difficulty", "source", "status");
CREATE INDEX "questions_qualityScore_usageCount_idx" ON "questions"("qualityScore", "usageCount");
CREATE INDEX "practice_answers_userId_questionId_practiceRecordId_idx" ON "practice_answers"("userId", "questionId", "practiceRecordId");
CREATE INDEX "question_ratings_userId_questionId_idx" ON "question_ratings"("userId", "questionId");
CREATE INDEX "admin_subscription_logs_adminUserId_idx" ON "admin_subscription_logs"("adminUserId");
CREATE INDEX "admin_subscription_logs_targetUserId_idx" ON "admin_subscription_logs"("targetUserId");
CREATE INDEX "admin_subscription_logs_subscriptionId_idx" ON "admin_subscription_logs"("subscriptionId");
CREATE INDEX "admin_subscription_logs_operationType_idx" ON "admin_subscription_logs"("operationType");
CREATE INDEX "admin_subscription_logs_createdAt_idx" ON "admin_subscription_logs"("createdAt" DESC);
CREATE INDEX "email_logs_recipientEmail_type_idx" ON "email_logs"("recipientEmail", "type");
CREATE INDEX "email_logs_userId_type_createdAt_idx" ON "email_logs"("userId", "type", "createdAt");
CREATE INDEX "email_logs_status_sentAt_idx" ON "email_logs"("status", "sentAt");
CREATE INDEX "question_time_records_sessionId_idx" ON "question_time_records"("sessionId");
CREATE INDEX "question_time_records_questionCategory_idx" ON "question_time_records"("questionCategory");
CREATE INDEX "question_time_records_questionType_idx" ON "question_time_records"("questionType");
CREATE INDEX "audio_playback_records_sessionId_idx" ON "audio_playback_records"("sessionId");
CREATE INDEX "audio_playback_records_questionId_idx" ON "audio_playback_records"("questionId");

-- Create unique constraints
CREATE UNIQUE INDEX "practice_answers_userId_questionId_practiceRecordId_key" ON "practice_answers"("userId", "questionId", "practiceRecordId");
CREATE UNIQUE INDEX "question_ratings_userId_questionId_key" ON "question_ratings"("userId", "questionId");
CREATE UNIQUE INDEX "email_templates_name_key" ON "email_templates"("name");
CREATE UNIQUE INDEX "user_email_preferences_userId_key" ON "user_email_preferences"("userId");
CREATE UNIQUE INDEX "user_email_preferences_unsubscribeToken_key" ON "user_email_preferences"("unsubscribeToken");
CREATE UNIQUE INDEX "email_stats_date_key" ON "email_stats"("date");

-- Add foreign key constraints
ALTER TABLE "questions" ADD CONSTRAINT "questions_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "practice_answers" ADD CONSTRAINT "practice_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "practice_answers" ADD CONSTRAINT "practice_answers_practiceRecordId_fkey" FOREIGN KEY ("practiceRecordId") REFERENCES "practice_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "question_ratings" ADD CONSTRAINT "question_ratings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "question_ratings" ADD CONSTRAINT "question_ratings_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admin_subscription_logs" ADD CONSTRAINT "admin_subscription_logs_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "admin_subscription_logs" ADD CONSTRAINT "admin_subscription_logs_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "admin_subscription_logs" ADD CONSTRAINT "admin_subscription_logs_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "user_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "practice_sessions" ADD CONSTRAINT "practice_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "question_time_records" ADD CONSTRAINT "question_time_records_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "practice_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audio_playback_records" ADD CONSTRAINT "audio_playback_records_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "practice_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;