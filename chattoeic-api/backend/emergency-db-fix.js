#!/usr/bin/env node

/**
 * 🚨 Emergency Database Fix - vocabulary_items.context column
 * Ensures the context column exists in vocabulary_items table
 * This runs on Railway startup to fix any missing schema
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function emergencyDatabaseFix() {
  console.log('🚨 [EMERGENCY] Starting database schema fix...');

  try {
    // Check if vocabulary_items table exists and add missing context column
    console.log('🔧 Checking vocabulary_items.context column...');

    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
          -- Add context column if it doesn't exist
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                        WHERE table_name='vocabulary_items'
                        AND column_name='context') THEN
              ALTER TABLE "vocabulary_items" ADD COLUMN "context" TEXT;
              RAISE NOTICE '✅ Added context column to vocabulary_items';
          ELSE
              RAISE NOTICE '✅ Context column already exists';
          END IF;

          -- Ensure other critical columns exist
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                        WHERE table_name='vocabulary_items'
                        AND column_name='meanings') THEN
              ALTER TABLE "vocabulary_items" ADD COLUMN "meanings" JSONB;
              RAISE NOTICE '✅ Added meanings column to vocabulary_items';
          END IF;

          IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                        WHERE table_name='vocabulary_items'
                        AND column_name='audioUrl') THEN
              ALTER TABLE "vocabulary_items" ADD COLUMN "audioUrl" TEXT;
              RAISE NOTICE '✅ Added audioUrl column to vocabulary_items';
          END IF;

      EXCEPTION
          WHEN others THEN
              RAISE NOTICE '⚠️ Error during schema fix: %', SQLERRM;
      END $$;
    `);

    // Verify the fix
    const result = await prisma.$queryRaw`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'vocabulary_items'
      AND column_name IN ('context', 'meanings', 'audioUrl')
      ORDER BY column_name
    `;

    console.log('📊 Verification result:');
    console.log(`Found columns: ${result.map(r => r.column_name).join(', ')}`);

    if (result.length >= 3) {
      console.log('🎉 [SUCCESS] vocabulary_items schema is now correct!');
    } else {
      console.log('⚠️ [WARNING] Some columns may still be missing');
    }

  } catch (error) {
    console.error('💥 [ERROR] Emergency database fix failed:', error.message);
    // Don't throw error to prevent server startup failure
    console.log('⚠️ Continuing with server startup...');
  } finally {
    await prisma.$disconnect();
    console.log('🔌 Database connection closed');
  }
}

// Run immediately if executed directly
if (require.main === module) {
  emergencyDatabaseFix()
    .then(() => {
      console.log('✨ Emergency database fix completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('🚨 Emergency fix failed:', error);
      // Exit with 0 to not block Railway deployment
      process.exit(0);
    });
} else {
  module.exports = { emergencyDatabaseFix };
}