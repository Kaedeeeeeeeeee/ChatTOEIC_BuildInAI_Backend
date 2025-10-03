-- 🚨 RAILWAY DATABASE QUICK FIX - 复制下面的SQL到数据库控制台
-- Step 1: Add missing columns to vocabulary_items table

ALTER TABLE "vocabulary_items" ADD COLUMN IF NOT EXISTS "context" TEXT;
ALTER TABLE "vocabulary_items" ADD COLUMN IF NOT EXISTS "meanings" JSONB;
ALTER TABLE "vocabulary_items" ADD COLUMN IF NOT EXISTS "audioUrl" TEXT;
ALTER TABLE "vocabulary_items" ADD COLUMN IF NOT EXISTS "language" TEXT NOT NULL DEFAULT 'en';
ALTER TABLE "vocabulary_items" ADD COLUMN IF NOT EXISTS "reading" TEXT;
ALTER TABLE "vocabulary_items" ADD COLUMN IF NOT EXISTS "jlpt" TEXT[];
ALTER TABLE "vocabulary_items" ADD COLUMN IF NOT EXISTS "commonality" BOOLEAN;
ALTER TABLE "vocabulary_items" ADD COLUMN IF NOT EXISTS "sourceType" TEXT;
ALTER TABLE "vocabulary_items" ADD COLUMN IF NOT EXISTS "sourceId" TEXT;
ALTER TABLE "vocabulary_items" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "vocabulary_items" ADD COLUMN IF NOT EXISTS "mastered" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "vocabulary_items" ADD COLUMN IF NOT EXISTS "tags" TEXT[];
ALTER TABLE "vocabulary_items" ADD COLUMN IF NOT EXISTS "definitionLoading" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "vocabulary_items" ADD COLUMN IF NOT EXISTS "definitionError" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "vocabulary_items" ADD COLUMN IF NOT EXISTS "nextReviewDate" TIMESTAMP(3);
ALTER TABLE "vocabulary_items" ADD COLUMN IF NOT EXISTS "reviewCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "vocabulary_items" ADD COLUMN IF NOT EXISTS "correctCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "vocabulary_items" ADD COLUMN IF NOT EXISTS "incorrectCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "vocabulary_items" ADD COLUMN IF NOT EXISTS "easeFactor" DOUBLE PRECISION NOT NULL DEFAULT 2.5;
ALTER TABLE "vocabulary_items" ADD COLUMN IF NOT EXISTS "interval" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "vocabulary_items" ADD COLUMN IF NOT EXISTS "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "vocabulary_items" ADD COLUMN IF NOT EXISTS "lastReviewedAt" TIMESTAMP(3);
ALTER TABLE "vocabulary_items" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Step 2: Make definition column nullable
ALTER TABLE "vocabulary_items" ALTER COLUMN "definition" DROP NOT NULL;

-- Step 3: Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_vocabulary_user_word" ON "vocabulary_items"("userId", "word");
CREATE INDEX IF NOT EXISTS "idx_vocabulary_user_created" ON "vocabulary_items"("userId", "addedAt");
CREATE INDEX IF NOT EXISTS "idx_vocabulary_review" ON "vocabulary_items"("userId", "nextReviewDate") WHERE "nextReviewDate" IS NOT NULL;

-- Step 4: Verify the fix worked
SELECT 'SUCCESS: vocabulary_items table fixed!' as result;
SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'vocabulary_items' ORDER BY ordinal_position;