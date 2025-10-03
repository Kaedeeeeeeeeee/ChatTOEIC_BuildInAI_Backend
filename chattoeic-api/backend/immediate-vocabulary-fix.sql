-- 🚨 IMMEDIATE VOCABULARY FIX
-- Run this in the Railway database console right now

-- First, check what columns actually exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'vocabulary_items'
ORDER BY ordinal_position;

-- Fix the data type issue with commonality field
UPDATE vocabulary_items
SET commonality = NULL
WHERE commonality::text = 'common';

-- Ensure all required columns exist
ALTER TABLE vocabulary_items ADD COLUMN IF NOT EXISTS sourceType TEXT;
ALTER TABLE vocabulary_items ADD COLUMN IF NOT EXISTS sourceId TEXT;

-- Final verification
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'vocabulary_items'
AND column_name IN ('sourceType', 'sourceId', 'commonality')
ORDER BY column_name;