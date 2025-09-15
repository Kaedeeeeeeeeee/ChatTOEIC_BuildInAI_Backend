-- Fix vocabulary_items table schema issues
-- Add missing phonetic column that was referenced in schema but missing in database

ALTER TABLE "vocabulary_items" ADD COLUMN "phonetic" TEXT;