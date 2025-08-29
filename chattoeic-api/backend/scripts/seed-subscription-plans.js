/**
 * 种子脚本：创建订阅套餐数据
 * 解决前端套餐ID与后端数据库不匹配的问题
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const subscriptionPlans = [
  {
    id: 'free',
    name: 'Free Plan',
    nameJp: '無料プラン',
    description: '基础功能，适合初学者',
    descriptionJp: '基本機能、初心者向け',
    priceCents: 0,
    currency: 'jpy',
    interval: 'month',
    stripePriceId: null, // 免费套餐不需要Stripe价格ID
    features: {
      aiPractice: false,
      aiChat: false,
      vocabulary: false,
      exportData: false,
      viewMistakes: false
    },
    limits: {
      dailyPractice: 5,
      dailyAiChat: 3,
      vocabularyWords: 50
    },
    isActive: true,
    sortOrder: 1
  },
  {
    id: 'premium_monthly',
    name: 'Premium Monthly',
    nameJp: 'プレミアム月額',
    description: '完整功能，月度订阅',
    descriptionJp: '全機能、月次サブスクリプション',
    priceCents: 300000, // 3000日元
    currency: 'jpy',
    interval: 'month',
    stripePriceId: 'price_placeholder_monthly', // 需要从Stripe获取真实的price ID
    features: {
      aiPractice: true,
      aiChat: true,
      vocabulary: true,
      exportData: true,
      viewMistakes: true
    },
    limits: {
      dailyPractice: null, // unlimited
      dailyAiChat: null, // unlimited
      vocabularyWords: null // unlimited
    },
    isActive: true,
    isPopular: true,
    sortOrder: 2
  },
  {
    id: 'premium_yearly',
    name: 'Premium Yearly',
    nameJp: 'プレミアム年額',
    description: '完整功能，年度订阅（节省2个月费用）',
    descriptionJp: '全機能、年次サブスクリプション（2ヶ月分お得）',
    priceCents: 3000000, // 30000日元
    currency: 'jpy',
    interval: 'year',
    stripePriceId: 'price_placeholder_yearly', // 需要从Stripe获取真实的price ID
    features: {
      aiPractice: true,
      aiChat: true,
      vocabulary: true,
      exportData: true,
      viewMistakes: true
    },
    limits: {
      dailyPractice: null, // unlimited
      dailyAiChat: null, // unlimited
      vocabularyWords: null // unlimited
    },
    isActive: true,
    sortOrder: 3
  }
];

async function main() {
  console.log('开始种子订阅套餐数据...');

  for (const plan of subscriptionPlans) {
    try {
      const result = await prisma.subscriptionPlan.upsert({
        where: { id: plan.id },
        update: {
          name: plan.name,
          nameJp: plan.nameJp,
          description: plan.description,
          descriptionJp: plan.descriptionJp,
          priceCents: plan.priceCents,
          currency: plan.currency,
          interval: plan.interval,
          stripePriceId: plan.stripePriceId,
          features: plan.features,
          limits: plan.limits,
          isActive: plan.isActive,
          isPopular: plan.isPopular || false,
          sortOrder: plan.sortOrder
        },
        create: plan
      });
      
      console.log(`✅ 套餐 ${plan.id} (${plan.name}) 创建/更新成功`);
    } catch (error) {
      console.error(`❌ 套餐 ${plan.id} 创建失败:`, error.message);
    }
  }

  console.log('✅ 订阅套餐种子数据完成');
}

main()
  .catch((e) => {
    console.error('❌ 种子脚本错误:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });