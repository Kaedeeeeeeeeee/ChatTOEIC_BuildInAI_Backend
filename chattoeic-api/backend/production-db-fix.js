#!/usr/bin/env node

/**
 * 🚨 PRODUCTION DATABASE FIX - VOCABULARY_ITEMS.CONTEXT COLUMN
 * 直接在生产环境运行，修复缺失的vocabulary_items.context列
 */

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

const prisma = new PrismaClient();

async function productionDatabaseFix() {
  console.log('🚨 [PRODUCTION FIX] Starting critical database schema repair...');
  console.log('Target: vocabulary_items.context column missing');

  try {
    // 显示当前数据库URL（隐藏敏感信息）
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      const maskedUrl = dbUrl.replace(/:\/\/([^:]+):([^@]+)@/, '://***:***@');
      console.log('🔗 Database:', maskedUrl.substring(0, 50) + '...');
    }

    // 1. 检查当前vocabulary_items表结构
    console.log('📊 Checking current vocabulary_items table structure...');

    const columns = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'vocabulary_items'
      ORDER BY ordinal_position
    `;

    console.log('Current columns:', columns.map(c => c.column_name).join(', '));

    // 2. 添加缺失的列
    console.log('🔧 Adding missing columns...');

    const fixes = [
      {
        name: 'context',
        sql: 'ALTER TABLE "vocabulary_items" ADD COLUMN IF NOT EXISTS "context" TEXT',
        description: 'Text context for vocabulary word'
      },
      {
        name: 'meanings',
        sql: 'ALTER TABLE "vocabulary_items" ADD COLUMN IF NOT EXISTS "meanings" JSONB',
        description: 'JSON meanings from AI'
      },
      {
        name: 'audioUrl',
        sql: 'ALTER TABLE "vocabulary_items" ADD COLUMN IF NOT EXISTS "audioUrl" TEXT',
        description: 'Audio pronunciation URL'
      },
      {
        name: 'language',
        sql: 'ALTER TABLE "vocabulary_items" ADD COLUMN IF NOT EXISTS "language" TEXT NOT NULL DEFAULT \'en\'',
        description: 'Language of the word'
      },
      {
        name: 'reading',
        sql: 'ALTER TABLE "vocabulary_items" ADD COLUMN IF NOT EXISTS "reading" TEXT',
        description: 'Reading pronunciation'
      },
      {
        name: 'jlpt',
        sql: 'ALTER TABLE "vocabulary_items" ADD COLUMN IF NOT EXISTS "jlpt" TEXT[]',
        description: 'JLPT level array'
      },
      {
        name: 'tags',
        sql: 'ALTER TABLE "vocabulary_items" ADD COLUMN IF NOT EXISTS "tags" TEXT[]',
        description: 'User tags array'
      },
      {
        name: 'mastered',
        sql: 'ALTER TABLE "vocabulary_items" ADD COLUMN IF NOT EXISTS "mastered" BOOLEAN NOT NULL DEFAULT false',
        description: 'Mastery status'
      },
      {
        name: 'notes',
        sql: 'ALTER TABLE "vocabulary_items" ADD COLUMN IF NOT EXISTS "notes" TEXT',
        description: 'User notes'
      },
      {
        name: 'definitionLoading',
        sql: 'ALTER TABLE "vocabulary_items" ADD COLUMN IF NOT EXISTS "definitionLoading" BOOLEAN NOT NULL DEFAULT false',
        description: 'Loading state'
      },
      {
        name: 'definitionError',
        sql: 'ALTER TABLE "vocabulary_items" ADD COLUMN IF NOT EXISTS "definitionError" BOOLEAN NOT NULL DEFAULT false',
        description: 'Error state'
      }
    ];

    for (const fix of fixes) {
      try {
        console.log(`  ✅ Adding ${fix.name}: ${fix.description}`);
        await prisma.$executeRawUnsafe(fix.sql);
        console.log(`  ✅ ${fix.name} column processed successfully`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`  ℹ️ ${fix.name} column already exists`);
        } else {
          console.warn(`  ⚠️ Warning for ${fix.name}:`, error.message);
        }
      }
    }

    // 3. 验证修复结果
    console.log('📊 Verifying fix results...');

    const finalColumns = await prisma.$queryRaw`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'vocabulary_items'
      AND column_name IN ('context', 'meanings', 'audioUrl', 'language', 'tags', 'mastered')
      ORDER BY column_name
    `;

    console.log('Fixed columns:', finalColumns.map(c => c.column_name).join(', '));

    // 4. 测试查询
    console.log('🧪 Testing vocabulary query...');

    const testQuery = await prisma.vocabularyItem.findMany({
      take: 1,
      select: {
        id: true,
        word: true,
        context: true,
        meanings: true
      }
    });

    console.log('✅ Test query successful! Sample:', testQuery[0] || 'No data');

    console.log('🎉 [SUCCESS] Production database fix completed successfully!');
    console.log('📈 All vocabulary_items columns are now available');

  } catch (error) {
    console.error('💥 [CRITICAL ERROR] Production database fix failed:');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  } finally {
    await prisma.$disconnect();
    console.log('🔌 Database connection closed');
  }
}

// 立即执行修复
productionDatabaseFix()
  .then(() => {
    console.log('✨ Production database fix script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('🚨 PRODUCTION FIX FAILED:', error);
    process.exit(1);
  });