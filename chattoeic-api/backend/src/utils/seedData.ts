/**
 * 数据库初始化种子数据
 * 确保订阅套餐数据存在
 */

import { prisma } from './database.js';
import { log } from './logger.js';

export async function ensureSubscriptionPlansExist(forceRecreate: boolean = false): Promise<void> {
  try {
    // 检查是否已有套餐数据
    const existingPlans = await prisma.subscriptionPlan.findMany();
    
    if (existingPlans.length > 0 && !forceRecreate) {
      log.info('Subscription plans already exist', { count: existingPlans.length });
      return;
    }
    
    if (forceRecreate && existingPlans.length > 0) {
      log.info('Force recreating subscription plans...');
      await prisma.subscriptionPlan.deleteMany();
    }

    log.info('Creating initial subscription plans...');

    // 创建初始套餐数据
    const plans = [
      {
        id: 'free',
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

    // 创建套餐数据
    for (const planData of plans) {
      const created = await prisma.subscriptionPlan.create({
        data: planData
      });
      log.info('Created subscription plan', { 
        id: created.id, 
        name: created.name, 
        price: created.priceCents 
      });
    }

    log.info('Successfully created all subscription plans');
    
  } catch (error) {
    log.error('Failed to ensure subscription plans exist', { error });
    throw error;
  }
}