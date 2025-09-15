import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';

const router = Router();
const prisma = new PrismaClient();
const execAsync = promisify(exec);

// 手动触发数据库设置
router.post('/database', async (req, res) => {
  try {
    console.log('🗄️ 开始数据库设置...');

    // 1. 运行数据库迁移
    console.log('⚡ 运行数据库迁移...');
    const migrateResult = await execAsync('npx prisma migrate deploy --schema=prisma/schema.prisma');
    console.log('迁移输出:', migrateResult.stdout);
    if (migrateResult.stderr) {
      console.warn('迁移警告:', migrateResult.stderr);
    }

    // 2. 创建订阅套餐
    console.log('🌱 创建订阅套餐...');

    // 清除现有数据
    await prisma.subscriptionPlan.deleteMany({});
    console.log('🗑️ 清除现有订阅套餐');

    const plans = [
      {
        id: 'free_plan',
        name: 'Free Plan',
        nameJp: '無料プラン',
        priceCents: 0,
        currency: 'jpy',
        interval: 'month',
        features: {
          aiPractice: false,
          aiChat: false,
          vocabulary: false,
          exportData: false,
          viewMistakes: false
        },
        dailyPracticeLimit: 5,
        dailyAiChatLimit: 3,
        maxVocabularyWords: 50,
        sortOrder: 1
      },
      {
        id: 'premium_monthly',
        name: 'Premium Monthly',
        nameJp: 'プレミアム月額',
        priceCents: 300000, // 3000日元
        currency: 'jpy',
        interval: 'month',
        features: {
          aiPractice: true,
          aiChat: true,
          vocabulary: true,
          exportData: true,
          viewMistakes: true
        },
        dailyPracticeLimit: null,
        dailyAiChatLimit: null,
        maxVocabularyWords: null,
        sortOrder: 2
      },
      {
        id: 'premium_yearly',
        name: 'Premium Yearly',
        nameJp: 'プレミアム年額',
        priceCents: 3000000, // 30000日元
        currency: 'jpy',
        interval: 'year',
        features: {
          aiPractice: true,
          aiChat: true,
          vocabulary: true,
          exportData: true,
          viewMistakes: true
        },
        dailyPracticeLimit: null,
        dailyAiChatLimit: null,
        maxVocabularyWords: null,
        sortOrder: 3
      }
    ];

    // 创建新的套餐数据
    const createdPlans = [];
    for (const plan of plans) {
      const created = await prisma.subscriptionPlan.create({
        data: plan
      });
      createdPlans.push(created);
      console.log(`✅ 创建套餐: ${created.name} (${created.id})`);
    }

    console.log('🎉 数据库设置完成！');

    res.json({
      success: true,
      message: '数据库设置成功',
      data: {
        plansCreated: createdPlans.length,
        plans: createdPlans
      }
    });

  } catch (error) {
    console.error('❌ 数据库设置失败:', error);
    res.status(500).json({
      success: false,
      message: '数据库设置失败',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// 检查数据库状态
router.get('/database/status', async (req, res) => {
  try {
    const planCount = await prisma.subscriptionPlan.count();
    const userCount = await prisma.user.count();

    const plans = await prisma.subscriptionPlan.findMany({
      select: { id: true, name: true, priceCents: true, isActive: true }
    });

    res.json({
      success: true,
      data: {
        planCount,
        userCount,
        plans,
        databaseConnected: true
      }
    });
  } catch (error) {
    console.error('❌ 数据库状态检查失败:', error);
    res.status(500).json({
      success: false,
      message: '数据库连接失败',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;