#!/usr/bin/env node

/**
 * 生产环境数据库紧急修复脚本
 * 添加缺失的realQuestions, aiPoolQuestions, realtimeQuestions字段
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixProductionDatabase() {
  console.log('🔧 开始修复生产环境数据库schema...');

  try {
    // 检查当前表结构
    console.log('🔍 检查practice_records表结构...');

    // 尝试添加缺失字段（使用原生SQL）
    const alterQueries = [
      'ALTER TABLE "practice_records" ADD COLUMN IF NOT EXISTS "realQuestions" INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE "practice_records" ADD COLUMN IF NOT EXISTS "aiPoolQuestions" INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE "practice_records" ADD COLUMN IF NOT EXISTS "realtimeQuestions" INTEGER NOT NULL DEFAULT 0'
    ];

    for (const query of alterQueries) {
      try {
        console.log(`📝 执行: ${query}`);
        await prisma.$executeRawUnsafe(query);
        console.log('✅ 字段添加成功');
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log('ℹ️  字段已存在，跳过');
        } else {
          console.error('❌ 字段添加失败:', error.message);
        }
      }
    }

    // 验证修复结果
    console.log('🔍 验证表结构修复结果...');
    const testRecord = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'practice_records'
      AND column_name IN ('realQuestions', 'aiPoolQuestions', 'realtimeQuestions')
      ORDER BY column_name;
    `;

    console.log('📋 修复后的字段信息:');
    console.table(testRecord);

    if (testRecord.length === 3) {
      console.log('🎉 数据库schema修复完成！');
      console.log('✅ 所有必需字段已成功添加');
    } else {
      console.log('⚠️ 部分字段可能未成功添加，请检查');
    }

  } catch (error) {
    console.error('💥 数据库修复失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
    console.log('🔌 数据库连接已关闭');
  }
}

// 执行修复
if (require.main === module) {
  fixProductionDatabase()
    .then(() => {
      console.log('🏁 修复脚本执行完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('🚨 修复脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = { fixProductionDatabase };