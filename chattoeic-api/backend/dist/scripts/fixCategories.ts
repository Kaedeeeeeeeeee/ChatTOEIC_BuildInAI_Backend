/**
 * 数据库修复脚本：修复历史练习记录中的题目分类
 * 将"未分类"题目根据其类型设置正确的TOEIC Part分类
 */

import { PrismaClient } from '@prisma/client';
import { fixQuestionCategories } from '../utils/categoryMapping.js';

const prisma = new PrismaClient();

async function fixCategoriesInDatabase() {
  console.log('🔧 开始修复数据库中的题目分类...');

  try {
    // 1. 获取所有需要修复的练习记录
    const practiceRecords = await prisma.practiceRecord.findMany({
      select: {
        id: true,
        sessionId: true,
        questionType: true,
        questions: true,
      }
    });

    console.log(`📊 找到 ${practiceRecords.length} 条练习记录，开始检查和修复...`);

    let fixedRecords = 0;
    let totalQuestionsFixed = 0;

    // 2. 逐条处理每个练习记录
    for (const record of practiceRecords) {
      let needsUpdate = false;
      const questions = Array.isArray(record.questions) ? record.questions : [];
      
      // 检查是否有需要修复的题目
      const questionsToFix = questions.filter((q: any) => 
        !q.category || 
        q.category === '未分类' || 
        q.category === 'undefined' || 
        q.category === 'General'
      );

      if (questionsToFix.length > 0) {
        console.log(`🔍 记录 ${record.sessionId} 需要修复 ${questionsToFix.length} 道题目`);
        
        // 使用修复工具处理所有题目
        const fixedQuestions = fixQuestionCategories(
          questions.map((q: any) => ({
            ...q,
            questionType: record.questionType
          }))
        );

        // 更新数据库记录
        await prisma.practiceRecord.update({
          where: { id: record.id },
          data: { questions: fixedQuestions }
        });

        fixedRecords++;
        totalQuestionsFixed += questionsToFix.length;
        needsUpdate = true;

        console.log(`✅ 已修复记录 ${record.sessionId}，${questionsToFix.length} 道题目分类已更新`);
      }
    }

    console.log('\n📈 修复完成统计：');
    console.log(`- 总记录数: ${practiceRecords.length}`);
    console.log(`- 修复的记录数: ${fixedRecords}`);
    console.log(`- 修复的题目数: ${totalQuestionsFixed}`);
    
    if (fixedRecords === 0) {
      console.log('🎉 所有记录的分类都已正确，无需修复！');
    } else {
      console.log(`🎉 成功修复了 ${fixedRecords} 条记录中的 ${totalQuestionsFixed} 道题目！`);
    }

  } catch (error) {
    console.error('❌ 修复过程中发生错误:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 验证修复结果
async function verifyFixes() {
  console.log('\n🔍 开始验证修复结果...');

  try {
    const allRecords = await prisma.practiceRecord.findMany({
      select: {
        id: true,
        sessionId: true,
        questions: true,
      }
    });

    let totalQuestions = 0;
    let uncategorizedQuestions = 0;

    for (const record of allRecords) {
      const questions = Array.isArray(record.questions) ? record.questions : [];
      totalQuestions += questions.length;

      for (const question of questions) {
        if (!question.category || 
            question.category === '未分类' || 
            question.category === 'undefined' || 
            question.category === 'General') {
          uncategorizedQuestions++;
          console.log(`⚠️ 记录 ${record.sessionId} 仍有未分类题目:`, {
            id: question.id,
            category: question.category,
            type: question.type
          });
        }
      }
    }

    console.log('\n📊 验证结果:');
    console.log(`- 总题目数: ${totalQuestions}`);
    console.log(`- 未分类题目数: ${uncategorizedQuestions}`);
    console.log(`- 修复成功率: ${((totalQuestions - uncategorizedQuestions) / totalQuestions * 100).toFixed(2)}%`);

    if (uncategorizedQuestions === 0) {
      console.log('🎉 验证通过！所有题目都已正确分类！');
    } else {
      console.log(`⚠️ 仍有 ${uncategorizedQuestions} 道题目未正确分类，可能需要手动处理`);
    }

  } catch (error) {
    console.error('❌ 验证过程中发生错误:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 主函数
async function main() {
  console.log('🚀 ChatTOEIC 题目分类修复脚本启动');
  console.log('=' .repeat(50));

  try {
    // 1. 修复分类
    await fixCategoriesInDatabase();
    
    // 2. 验证修复结果
    await verifyFixes();
    
    console.log('\n🎯 修复脚本执行完成！');
    
  } catch (error) {
    console.error('💥 脚本执行失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { fixCategoriesInDatabase, verifyFixes };