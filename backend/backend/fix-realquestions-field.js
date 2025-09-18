#!/usr/bin/env node

/**
 * 生产环境紧急修复：添加realQuestions, aiPoolQuestions, realtimeQuestions字段
 * 解决历史记录保存失败问题
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixRealQuestionsField() {
  console.log('🚨 [紧急修复] 开始添加practice_records表缺失字段...');

  try {
    // 添加缺失字段
    const alterQueries = [
      'ALTER TABLE "practice_records" ADD COLUMN IF NOT EXISTS "realQuestions" INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE "practice_records" ADD COLUMN IF NOT EXISTS "aiPoolQuestions" INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE "practice_records" ADD COLUMN IF NOT EXISTS "realtimeQuestions" INTEGER NOT NULL DEFAULT 0'
    ];

    for (const query of alterQueries) {
      try {
        console.log(`🔧 执行: ${query.substring(0, 80)}...`);
        await prisma.$executeRawUnsafe(query);
        console.log('✅ 字段添加成功');
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log('ℹ️ 字段已存在，跳过');
        } else {
          console.warn('⚠️ 字段添加警告:', error.message);
        }
      }
    }

    // 验证修复结果
    const result = await prisma.$queryRaw`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'practice_records'
      AND column_name IN ('realQuestions', 'aiPoolQuestions', 'realtimeQuestions')
    `;

    console.log('📊 修复结果验证:');
    console.log(`找到字段数量: ${result.length}/3`);

    if (result.length === 3) {
      console.log('🎉 [成功] realQuestions字段修复完成！历史记录功能已恢复');
    } else {
      console.log('⚠️ [警告] 部分字段可能未成功添加');
    }

  } catch (error) {
    console.error('💥 [错误] realQuestions字段修复失败:', error.message);
    // 不抛出错误，避免阻止服务器启动
  } finally {
    await prisma.$disconnect();
    console.log('🔌 数据库连接已关闭');
  }
}

// 如果直接执行此脚本
if (require.main === module) {
  fixRealQuestionsField()
    .then(() => {
      console.log('✨ realQuestions字段修复脚本执行完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('🚨 修复脚本执行失败:', error);
      process.exit(1);
    });
} else {
  // 作为模块导出
  module.exports = { fixRealQuestionsField };
}