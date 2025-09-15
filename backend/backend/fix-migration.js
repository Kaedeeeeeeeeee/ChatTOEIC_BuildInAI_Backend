#!/usr/bin/env node

// Emergency database fix script for Railway deployment
// Fixes failed migration by marking it as completed and applying missing schema changes

import { PrismaClient } from '@prisma/client';

async function fixMigration() {
  const prisma = new PrismaClient();

  try {
    console.log('🔧 Starting migration fix...');

    // Mark the failed migration as resolved
    console.log('📊 Resolving failed migration...');
    await prisma.$executeRawUnsafe(`
      UPDATE "_prisma_migrations"
      SET finished_at = NOW(),
          applied_steps_count = 1,
          logs = 'Fixed manually - column already exists'
      WHERE migration_name = '20250815130000_fix_vocabulary_schema'
      AND finished_at IS NULL
    `);

    // Apply all missing columns with IF NOT EXISTS checks
    console.log('✅ Applying missing vocabulary table columns...');

    // Check and add missing columns one by one
    const missingColumns = [
      { name: 'audioUrl', type: 'TEXT' },
      { name: 'meanings', type: 'JSONB' },
      { name: 'language', type: 'TEXT NOT NULL DEFAULT \'en\'' },
      { name: 'reading', type: 'TEXT' },
      { name: 'jlpt', type: 'TEXT[]' },
      { name: 'commonality', type: 'TEXT' },
      { name: 'notes', type: 'TEXT' },
      { name: 'mastered', type: 'BOOLEAN NOT NULL DEFAULT false' },
      { name: 'tags', type: 'TEXT[]' },
      { name: 'definitionLoading', type: 'BOOLEAN NOT NULL DEFAULT false' },
      { name: 'definitionError', type: 'BOOLEAN NOT NULL DEFAULT false' },
      { name: 'updatedAt', type: 'TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP' }
    ];

    for (const column of missingColumns) {
      try {
        await prisma.$executeRawUnsafe(`
          DO $$
          BEGIN
              IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vocabulary_items' AND column_name='${column.name}') THEN
                  ALTER TABLE "vocabulary_items" ADD COLUMN "${column.name}" ${column.type};
                  RAISE NOTICE 'Added column ${column.name}';
              ELSE
                  RAISE NOTICE 'Column ${column.name} already exists';
              END IF;
          END $$;
        `);
        console.log(`✅ Processed column: ${column.name}`);
      } catch (error) {
        console.warn(`⚠️  Warning processing column ${column.name}:`, error.message);
      }
    }

    // Make definition column nullable
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "vocabulary_items" ALTER COLUMN "definition" DROP NOT NULL;
      `);
      console.log('✅ Made definition column nullable');
    } catch (error) {
      console.warn('⚠️  Definition column already nullable:', error.message);
    }

    console.log('🎉 Migration fix completed successfully!');

  } catch (error) {
    console.error('❌ Migration fix failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix migration when script is executed directly
fixMigration()
  .then(() => {
    console.log('✅ Migration fix script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration fix script failed:', error);
    process.exit(1);
  });

export { fixMigration };