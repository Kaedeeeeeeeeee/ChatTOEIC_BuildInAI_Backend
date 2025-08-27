/**
 * Prisma数据库seed文件
 * 创建初始的订阅套餐数据
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // 创建订阅套餐
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
      dailyPracticeLimit: null, // unlimited
      dailyAiChatLimit: null, // unlimited  
      maxVocabularyWords: null, // unlimited
      sortOrder: 2
    },
    {
      id: 'premium_yearly',
      name: 'Premium Yearly',
      nameJp: 'プレミアム年額',
      priceCents: 3000000, // 30000日元 (相当于月付2500日元)
      currency: 'jpy',
      interval: 'year',
      features: {
        aiPractice: true,
        aiChat: true,
        vocabulary: true,
        exportData: true,
        viewMistakes: true
      },
      dailyPracticeLimit: null, // unlimited
      dailyAiChatLimit: null, // unlimited
      maxVocabularyWords: null, // unlimited
      sortOrder: 3
    }
  ];

  // 清除现有数据（如果存在）
  await prisma.subscriptionPlan.deleteMany({});
  console.log('🗑️ Cleared existing subscription plans');

  // 创建新的套餐数据
  for (const plan of plans) {
    const created = await prisma.subscriptionPlan.create({
      data: plan
    });
    console.log(`✅ Created plan: ${created.name} (${created.id})`);
  }

  console.log('🎉 Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });