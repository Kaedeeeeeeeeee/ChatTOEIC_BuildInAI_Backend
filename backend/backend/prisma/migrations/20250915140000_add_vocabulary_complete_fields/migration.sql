-- Add missing fields to vocabulary_items table to match Prisma schema
-- Based on error: The column `vocabulary_items.audioUrl` does not exist in current database

-- Add audioUrl column for storing pronunciation audio URLs
ALTER TABLE "vocabulary_items" ADD COLUMN "audioUrl" TEXT;

-- Add meanings column for storing AI-generated comprehensive word information (JSON format)
ALTER TABLE "vocabulary_items" ADD COLUMN "meanings" JSONB;

-- Add language column with default value
ALTER TABLE "vocabulary_items" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'en';

-- Add reading column for additional pronunciation info
ALTER TABLE "vocabulary_items" ADD COLUMN "reading" TEXT;

-- Add jlpt array column for Japanese language proficiency levels
ALTER TABLE "vocabulary_items" ADD COLUMN "jlpt" TEXT[];

-- Add commonality column for word frequency indication
ALTER TABLE "vocabulary_items" ADD COLUMN "commonality" TEXT;

-- Add notes column for user personal notes
ALTER TABLE "vocabulary_items" ADD COLUMN "notes" TEXT;

-- Add mastered boolean flag with default false
ALTER TABLE "vocabulary_items" ADD COLUMN "mastered" BOOLEAN NOT NULL DEFAULT false;

-- Add tags array for categorization
ALTER TABLE "vocabulary_items" ADD COLUMN "tags" TEXT[];

-- Add loading and error state columns for definition fetching
ALTER TABLE "vocabulary_items" ADD COLUMN "definitionLoading" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "vocabulary_items" ADD COLUMN "definitionError" BOOLEAN NOT NULL DEFAULT false;

-- Add updatedAt timestamp column
ALTER TABLE "vocabulary_items" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Update existing definition column to be nullable (to match schema)
ALTER TABLE "vocabulary_items" ALTER COLUMN "definition" DROP NOT NULL;