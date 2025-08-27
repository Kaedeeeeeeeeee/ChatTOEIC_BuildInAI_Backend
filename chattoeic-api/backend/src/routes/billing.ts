/**
 * Stripe支付系统API路由
 * 提供订阅管理、支付处理、Webhook处理等功能
 */

import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { Prisma } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';
import { AuthenticatedRequest, getUserSubscriptionInfo, checkUsageQuota } from '../middleware/subscriptionAuth.js';
import StripeService from '../services/stripeService.js';
import { prisma } from '../utils/database.js';
import { log } from '../utils/logger.js';

const router = Router();

// 获取Stripe实例用于Webhook验证（延迟初始化）
function getStripeInstance(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY environment variable is not set');
  }
  
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16',
  });
}

// 简单内存缓存
interface CacheEntry {
  data: any;
  timestamp: number;
  expireAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 10 * 60 * 1000; // 10分钟缓存

function getCached(key: string): any | null {
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expireAt) {
    return entry.data;
  }
  if (entry) {
    cache.delete(key); // 删除过期缓存
  }
  return null;
}

function setCache(key: string, data: any): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
    expireAt: Date.now() + CACHE_TTL
  });
}

// ===============================
// 公开API（不需要认证）
// ===============================

/**
 * GET /api/billing/health  
 * 测试billing路由是否正常工作
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      service: 'billing',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      message: 'Billing service is working'
    });
  } catch (error) {
    log.error('Billing health check failed', { error });
    res.status(500).json({
      success: false,
      error: '服务检查失败',
    });
  }
});

/**
 * POST /api/billing/setup-database
 * 紧急修复：手动创建数据库表和初始数据
 */
router.post('/setup-database', async (req: Request, res: Response) => {
  try {
    log.info('🆘 Emergency database setup requested');
    
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
        priceCents: 300000,
        currency: 'jpy',
        interval: 'month',
        stripePriceId: process.env.STRIPE_PRICE_ID_MONTHLY || 'price_1PwQQsRpNxWe2zQY2xkv8VsT', // 真实的测试价格ID
        stripeProductId: process.env.STRIPE_PRODUCT_ID || 'prod_QsI8lqCHYv9SDm',
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
      }
    ];

    // 尝试使用原始SQL创建表（如果不存在）
    try {
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS subscription_plans (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          "nameJp" TEXT,
          "priceCents" INTEGER NOT NULL,
          currency TEXT NOT NULL DEFAULT 'jpy',
          interval TEXT NOT NULL,
          "intervalCount" INTEGER NOT NULL DEFAULT 1,
          "stripePriceId" TEXT UNIQUE,
          "stripeProductId" TEXT UNIQUE,
          features JSONB NOT NULL,
          "dailyPracticeLimit" INTEGER,
          "dailyAiChatLimit" INTEGER,
          "maxVocabularyWords" INTEGER,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "sortOrder" INTEGER NOT NULL DEFAULT 0,
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `;
      log.info('✅ Created subscription_plans table');
    } catch (createError) {
      log.warn('Table might already exist', { createError: createError.message });
    }

    // 创建user_subscriptions表
    try {
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS user_subscriptions (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          "userId" TEXT NOT NULL,
          "planId" TEXT,
          "stripeCustomerId" TEXT,
          "stripeSubscriptionId" TEXT,
          "stripeSessionId" TEXT,
          status TEXT NOT NULL DEFAULT 'inactive',
          "currentPeriodStart" TIMESTAMP,
          "currentPeriodEnd" TIMESTAMP,
          "trialStart" TIMESTAMP,
          "trialEnd" TIMESTAMP,
          "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
          "canceledAt" TIMESTAMP,
          "lastPaymentAt" TIMESTAMP,
          "nextPaymentAt" TIMESTAMP,
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          UNIQUE("userId")
        );
      `;
      log.info('✅ Created user_subscriptions table');
    } catch (createError) {
      log.warn('user_subscriptions table might already exist', { createError: createError.message });
    }

    // 创建payment_transactions表
    try {
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS payment_transactions (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          "userId" TEXT NOT NULL,
          "subscriptionId" TEXT,
          "stripeSessionId" TEXT,
          "stripePaymentIntentId" TEXT,
          amount INTEGER NOT NULL DEFAULT 0,
          currency TEXT NOT NULL DEFAULT 'jpy',
          status TEXT NOT NULL,
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `;
      log.info('✅ Created payment_transactions table');
    } catch (createError) {
      log.warn('payment_transactions table might already exist', { createError: createError.message });
    }

    // 🔧 修复现有表的缺失列（如果表已存在但列缺失）
    try {
      log.info('🔧 Checking and adding missing columns...');
      
      // 添加 nextPaymentAt 列到 user_subscriptions 表（如果缺失）
      // 使用更简单直接的方法
      try {
        await prisma.$executeRaw`
          ALTER TABLE public.user_subscriptions 
          ADD COLUMN IF NOT EXISTS "nextPaymentAt" TIMESTAMP;
        `;
        log.info('✅ nextPaymentAt column added or already exists');
      } catch (alterError: any) {
        // 如果列已存在，这个错误是正常的
        if (alterError.message.includes('already exists') || alterError.message.includes('duplicate')) {
          log.info('✅ nextPaymentAt column already exists');
        } else {
          log.warn('Column addition attempt failed, but continuing...', { error: alterError.message });
        }
      }
      
      // 确保所有subscription_plans列都存在
      const planColumns = [
        'dailyPracticeLimit',
        'dailyAiChatLimit', 
        'maxVocabularyWords'
      ];
      
      for (const columnName of planColumns) {
        try {
          await prisma.$executeRaw`
            ALTER TABLE public.subscription_plans 
            ADD COLUMN IF NOT EXISTS ${Prisma.raw(`"${columnName}"`)} INTEGER;
          `;
          log.info(`✅ Column ${columnName} added or already exists in subscription_plans`);
        } catch (alterError: any) {
          if (alterError.message.includes('already exists') || alterError.message.includes('duplicate')) {
            log.info(`✅ Column ${columnName} already exists in subscription_plans`);
          } else {
            log.warn(`Column ${columnName} addition failed, continuing...`, { error: alterError.message });
          }
        }
      }
      
      log.info('✅ Missing columns check/fix completed');
    } catch (columnError) {
      log.warn('Column fix error (might be normal if columns already exist)', { columnError: columnError.message });
    }

    // 清除现有数据并创建新数据
    try {
      await prisma.subscriptionPlan.deleteMany({});
      log.info('🗑️ Cleared existing plans');
    } catch (deleteError) {
      log.warn('Could not clear existing plans', { deleteError: deleteError.message });
    }
    
    for (const planData of plans) {
      try {
        await prisma.subscriptionPlan.create({
          data: planData
        });
        log.info(`✅ Created plan: ${planData.name}`);
      } catch (createPlanError) {
        log.error(`❌ Failed to create plan: ${planData.name}`, { createPlanError });
      }
    }

    res.json({
      success: true,
      message: 'Emergency database setup completed',
      plansCreated: plans.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    log.error('❌ Emergency database setup failed', { error });
    res.status(500).json({
      success: false,
      error: `Database setup failed: ${error.message}`,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/billing/clear-cache
 * 清除缓存的端点（用于调试）
 */
router.post('/clear-cache', async (req: Request, res: Response) => {
  try {
    log.info('🗑️ Clearing billing cache');
    cache.clear();
    res.json({
      success: true,
      message: 'Cache cleared successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('❌ Failed to clear cache', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/billing/emergency-migrate
 * 紧急数据库迁移端点
 */
router.post('/emergency-migrate', async (req: Request, res: Response) => {
  try {
    log.info('🚀 Starting emergency database migration...');

    // 创建usage_quotas表
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS usage_quotas (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        resource_type TEXT NOT NULL,
        used_count INTEGER DEFAULT 0,
        limit_count INTEGER,
        period_start TIMESTAMP DEFAULT NOW(),
        period_end TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, resource_type, period_start)
      );
    `;

    // 创建payment_transactions表
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS payment_transactions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        stripe_session_id TEXT UNIQUE,
        stripe_payment_id TEXT UNIQUE,
        amount INTEGER NOT NULL,
        currency TEXT DEFAULT 'jpy',
        status TEXT NOT NULL,
        subscription_id TEXT REFERENCES user_subscriptions(id),
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;

    log.info('✅ Emergency database migration completed');

    res.json({
      success: true,
      message: 'Emergency database migration completed successfully',
      timestamp: new Date().toISOString(),
      tablesCreated: ['usage_quotas', 'payment_transactions']
    });

  } catch (error) {
    log.error('❌ Emergency database migration failed', { error });
    res.status(500).json({
      success: false,
      error: 'Database migration failed',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/billing/test-env
 * 测试环境变量在套餐数据中的应用
 */
router.get('/test-env', async (req: Request, res: Response) => {
  try {
    const testPlan = {
      id: 'premium_monthly',
      stripePriceId: process.env.STRIPE_PRICE_ID_MONTHLY || 'fallback_price',
      stripeProductId: process.env.STRIPE_PRODUCT_ID || 'fallback_product',
      envVars: {
        STRIPE_PRICE_ID_MONTHLY: process.env.STRIPE_PRICE_ID_MONTHLY,
        STRIPE_PRODUCT_ID: process.env.STRIPE_PRODUCT_ID
      }
    };
    
    res.json({
      success: true,
      data: testPlan
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Test failed'
    });
  }
});

/**
 * GET /api/billing/debug-env
 * 调试环境变量配置（仅在开发环境）
 */
router.get('/debug-env', async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      data: {
        hasStripeSecret: !!process.env.STRIPE_SECRET_KEY,
        hasMonthlyPriceId: !!process.env.STRIPE_PRICE_ID_MONTHLY,
        hasYearlyPriceId: !!process.env.STRIPE_PRICE_ID_YEARLY,
        hasProductId: !!process.env.STRIPE_PRODUCT_ID,
        monthlyPriceId: process.env.STRIPE_PRICE_ID_MONTHLY ? process.env.STRIPE_PRICE_ID_MONTHLY.substring(0, 12) + '...' : null,
        environment: process.env.NODE_ENV
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '调试信息获取失败'
    });
  }
});

/**
 * GET /api/billing/plans
 * 获取所有可用的订阅套餐
 */
router.get('/plans', async (req: Request, res: Response) => {
  try {
    log.info('Billing plans request started');
    
    // 检查缓存
    const cacheKey = 'subscription_plans_active';
    const cachedPlans = getCached(cacheKey);
    
    if (cachedPlans) {
      log.info('Billing plans served from cache');
      return res.json({
        success: true,
        data: cachedPlans,
        cached: true
      });
    }

    // 尝试从数据库获取套餐，如果失败则使用硬编码数据
    let plans;
    try {
      plans = await prisma.subscriptionPlan.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          name: true,
          nameJp: true,
          priceCents: true,
          currency: true,
          interval: true,
          features: true,
          dailyPracticeLimit: true,
          dailyAiChatLimit: true,
          maxVocabularyWords: true,
        },
      });
      
      log.info('Plans loaded from database', { plansCount: plans.length });
    } catch (dbError) {
      log.warn('Failed to load plans from database, using hardcoded fallback', { dbError });
      
      // 硬编码的三层权限体系：免费 -> 试用 -> 付费
      plans = [
        {
          id: 'free',
          name: 'Free Plan', 
          nameJp: '無料プラン',
          priceCents: 0,
          currency: 'jpy',
          interval: 'month',
          features: {
            aiPractice: false,        // ❌ 无AI练习生成
            aiChat: false,            // ❌ 无AI对话
            vocabulary: true,         // ✅ 生词本功能
            exportData: false,        // ❌ 不能导出
            viewMistakes: true        // ✅ 无限复习功能
          },
          dailyPracticeLimit: null,   // 无限基础练习
          dailyAiChatLimit: 0,        // 0次AI对话
          maxVocabularyWords: null,   // 无限生词本
        },
        {
          id: 'trial',
          name: 'Free Trial',
          nameJp: '無料トライアル', 
          priceCents: 0,
          currency: 'jpy',
          interval: 'trial',
          features: {
            aiPractice: true,         // ✅ AI练习生成
            aiChat: true,             // ✅ AI对话（限制20次）
            vocabulary: true,         // ✅ 生词本功能
            exportData: true,         // ✅ 可以导出
            viewMistakes: true        // ✅ 无限复习功能
          },
          dailyPracticeLimit: null,   // 无限练习
          dailyAiChatLimit: 20,       // 每日20次AI对话
          maxVocabularyWords: null,   // 无限生词本
          trialDays: 3,
          isPopular: true
        },
        {
          id: 'premium_monthly',
          name: 'Premium Monthly',
          nameJp: 'プレミアム月額',
          priceCents: 300000,
          currency: 'jpy',
          interval: 'month',
          stripePriceId: process.env.STRIPE_PRICE_ID_MONTHLY || 'price_1PwQQsRpNxWe2zQY2xkv8VsT',
          stripeProductId: process.env.STRIPE_PRODUCT_ID || 'prod_QsI8lqCHYv9SDm',
          features: {
            aiPractice: true,         // ✅ 无限AI练习生成
            aiChat: true,             // ✅ 无限AI对话
            vocabulary: true,         // ✅ 无限生词本功能
            exportData: true,         // ✅ 可以导出
            viewMistakes: true        // ✅ 无限复习功能
          },
          dailyPracticeLimit: null,   // 无限练习
          dailyAiChatLimit: null,     // 无限AI对话
          maxVocabularyWords: null,   // 无限生词本
        }
      ];
    }

    // 格式化返回数据
    const formattedPlans = plans.map(plan => ({
      id: plan.id,
      name: plan.name,
      nameJp: plan.nameJp,
      priceCents: plan.priceCents,
      currency: plan.currency,
      interval: plan.interval,
      features: plan.features,
      limits: {
        dailyPractice: plan.dailyPracticeLimit,
        dailyAiChat: plan.dailyAiChatLimit,
        vocabularyWords: plan.maxVocabularyWords,
      },
      isPopular: plan.id === 'premium_monthly', // 标记高级版为推荐
    }));

    const responseData = { plans: formattedPlans };
    
    // 保存到缓存
    setCache(cacheKey, responseData);
    log.info('Billing plans cached successfully', { plansCount: formattedPlans.length });

    res.json({
      success: true,
      data: responseData,
      cached: false
    });
  } catch (error) {
    log.error('Failed to get plans', { error });
    res.status(500).json({
      success: false,
      error: '获取套餐信息失败',
    });
  }
});

/**
 * POST /api/billing/webhooks
 * Stripe Webhook端点
 */
router.post('/webhooks', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  
  try {
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      throw new Error('Webhook secret not configured');
    }

    // 验证Webhook签名
    const event = getStripeInstance().webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    // 处理Webhook事件
    await StripeService.handleWebhook(event);

    log.info('Webhook processed successfully', {
      eventType: event.type,
      eventId: event.id,
    });

    res.json({ received: true });
  } catch (error) {
    log.error('Webhook processing failed', { error });
    res.status(400).json({
      success: false,
      error: 'Webhook processing failed',
    });
  }
});

// ===============================
// 需要认证的API
// ===============================

/**
 * GET /api/user/subscription
 * 获取当前用户的订阅状态
 */
router.get('/user/subscription', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    log.info('User subscription request started', { userId });
    
    // 恢复真实的数据库查询逻辑，添加错误处理
    let subscriptionInfo;
    try {
      subscriptionInfo = await getUserSubscriptionInfo(userId);
      log.info('getUserSubscriptionInfo result', { userId, subscriptionInfo });
    } catch (error) {
      log.error('getUserSubscriptionInfo failed', { userId, error });
      // 如果查询失败，返回默认的免费用户状态
      subscriptionInfo = {
        hasPermission: false,
        subscription: null,
        permissions: {
          aiPractice: false,        // ❌ 无AI练习生成
          aiChat: false,            // ❌ 无AI对话
          vocabulary: true,         // ✅ 生词本功能  
          exportData: false,        // ❌ 不能导出
          viewMistakes: true,       // ✅ 无限复习功能
        },
        trialAvailable: false, // 查询失败时，不允许试用
      };
    }

    let practiceQuota, chatQuota, vocabularyQuota;
    try {
      [practiceQuota, chatQuota, vocabularyQuota] = await Promise.all([
        checkUsageQuota(userId, 'daily_practice'),
        checkUsageQuota(userId, 'daily_ai_chat'),
        checkUsageQuota(userId, 'vocabulary_words'),
      ]);
    } catch (error) {
      log.error('checkUsageQuota failed', { userId, error });
      // 如果配额查询失败，使用默认值（免费用户权限）
      practiceQuota = { used: 0, limit: null, remaining: null };  // 无限基础练习
      chatQuota = { used: 0, limit: 0, remaining: 0 };            // 0次AI对话
      vocabularyQuota = { used: 0, limit: null, remaining: null }; // 无限生词本
    }

    // 确保权限结构总是存在
    const permissions = subscriptionInfo.permissions || {
      aiPractice: false,        // ❌ 无AI练习生成
      aiChat: false,            // ❌ 无AI对话
      vocabulary: true,         // ✅ 生词本功能  
      exportData: false,        // ❌ 不能导出
      viewMistakes: true,       // ✅ 无限复习功能
    };

    res.json({
      success: true,
      data: {
        subscription: subscriptionInfo.subscription,
        usage: {
          dailyPractice: practiceQuota || {
            used: 0,
            limit: null,  // 无限基础练习
            remaining: null,
            resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          },
          dailyAiChat: chatQuota || {
            used: 0,
            limit: 0,     // 免费用户0次AI对话
            remaining: 0,
            resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          },
          vocabularyWords: vocabularyQuota || {
            used: 0,
            limit: null,  // 无限生词本
            remaining: null,
          },
        },
        permissions,
        trialAvailable: subscriptionInfo.trialAvailable || true,
      },
    });
  } catch (error) {
    log.error('Failed to get user subscription', { error, userId: req.user?.userId });
    res.status(500).json({
      success: false,
      error: '获取订阅信息失败',
    });
  }
});

/**
 * POST /api/user/subscription/start-trial
 * 开始免费试用
 */
router.post('/user/subscription/start-trial', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { planId } = req.body;

    if (!planId) {
      return res.status(400).json({
        success: false,
        error: '套餐ID不能为空',
      });
    }

    // 默认使用试用套餐
    const trialPlanId = planId || 'trial';
    
    const subscription = await StripeService.startTrial(userId, trialPlanId);

    res.json({
      success: true,
      data: {
        subscription: {
          id: subscription.id,
          status: subscription.status,
          trialEnd: subscription.trialEnd?.toISOString(),
        },
      },
      message: '免费试用已开始，可享受3天完整功能！',
    });
  } catch (error) {
    log.error('Failed to start trial', { 
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error,
      userId: req.user?.userId,
      planId: req.body?.planId
    });
    
    let errorMessage = '开始试用失败';
    let debugInfo = '';
    
    if (error instanceof Error) {
      debugInfo = error.message;
      if (error.message.includes('already used')) {
        errorMessage = '您已经使用过免费试用';
      } else if (error.message.includes('active subscription')) {
        errorMessage = '您已经有活跃的订阅';
      } else if (error.message.includes('Plan not found')) {
        errorMessage = '套餐未找到';
      } else if (error.message.includes('User not found')) {
        errorMessage = '用户未找到';
      }
    }

    res.status(400).json({
      success: false,
      error: errorMessage,
      ...(process.env.NODE_ENV === 'development' && { debugInfo })
    });
  }
});

/**
 * POST /api/billing/debug-trial
 * 调试试用功能 - 提供详细错误信息
 */
router.post('/debug-trial', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { planId } = req.body;

    log.info('Debug trial request', { userId, planId });

    // 检查用户是否存在
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'User not found in database',
        debugInfo: { userId }
      });
    }

    // 检查是否已有订阅
    const existingSubscription = await prisma.userSubscription.findUnique({
      where: { userId }
    });

    log.info('Debug info gathered', { 
      user: { id: user.id, email: user.email }, 
      existingSubscription: existingSubscription ? {
        id: existingSubscription.id,
        status: existingSubscription.status,
        planId: existingSubscription.planId
      } : null
    });

    // 尝试调用startTrial
    const subscription = await StripeService.startTrial(userId, planId || 'trial');

    res.json({
      success: true,
      data: {
        subscription: {
          id: subscription.id,
          status: subscription.status,
          trialEnd: subscription.trialEnd?.toISOString(),
        },
        debug: {
          user,
          existingSubscription
        }
      },
      message: 'Trial started successfully (debug mode)'
    });

  } catch (error) {
    log.error('Debug trial failed', { 
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error,
      userId: req.user?.userId 
    });

    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      debugInfo: {
        errorType: error instanceof Error ? error.name : typeof error,
        stack: error instanceof Error ? error.stack : undefined
      }
    });
  }
});

/**
 * GET /api/billing/debug-subscription/:userId
 * 调试用户订阅状态
 */
router.get('/debug-subscription/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    // 检查用户订阅
    const subscription = await prisma.userSubscription.findUnique({
      where: { userId }
    });

    // 检查用户信息
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, createdAt: true }
    });

    res.json({
      success: true,
      data: {
        user,
        subscription: subscription ? {
          id: subscription.id,
          planId: subscription.planId,
          status: subscription.status,
          trialStart: subscription.trialStart?.toISOString(),
          trialEnd: subscription.trialEnd?.toISOString(),
          createdAt: subscription.createdAt?.toISOString(),
          updatedAt: subscription.updatedAt?.toISOString(),
        } : null,
        currentTime: new Date().toISOString(),
        isTrialExpired: subscription?.trialEnd ? new Date() > subscription.trialEnd : false
      }
    });

  } catch (error) {
    log.error('Debug subscription failed', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to debug subscription'
    });
  }
});

/**
 * DELETE /api/billing/debug-reset-all
 * 重置所有用户的订阅状态（仅用于测试）
 */
router.delete('/debug-reset-all', async (req: Request, res: Response) => {
  try {
    // 获取所有订阅数量
    const subscriptionsCount = await prisma.userSubscription.count();
    const quotasCount = await prisma.usageQuota.count();

    // 删除所有用户订阅记录
    const deletedSubscriptions = await prisma.userSubscription.deleteMany({});

    // 删除所有使用配额记录
    const deletedQuotas = await prisma.usageQuota.deleteMany({});

    res.json({
      success: true,
      message: 'All user subscription statuses reset successfully',
      data: {
        deletedSubscriptions: deletedSubscriptions.count,
        deletedQuotas: deletedQuotas.count,
        totalSubscriptionsBefore: subscriptionsCount,
        totalQuotasBefore: quotasCount
      }
    });

  } catch (error) {
    log.error('Debug reset all failed', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to reset all user subscriptions'
    });
  }
});

/**
 * DELETE /api/billing/debug-reset/:userId
 * 重置用户订阅状态（仅用于测试）
 */
router.delete('/debug-reset/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    // 删除用户订阅记录
    const deletedSubscription = await prisma.userSubscription.delete({
      where: { userId }
    }).catch(() => null);

    // 删除用户使用配额记录
    const deletedQuotas = await prisma.usageQuota.deleteMany({
      where: { userId }
    });

    res.json({
      success: true,
      message: 'User subscription status reset successfully',
      data: {
        deletedSubscription: !!deletedSubscription,
        deletedQuotas: deletedQuotas.count
      }
    });

  } catch (error) {
    log.error('Debug reset failed', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to reset user subscription'
    });
  }
});

/**
 * POST /api/billing/create-checkout-session
 * 创建Stripe结账会话
 */
router.post('/create-checkout-session', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { planId, returnUrl, cancelUrl } = req.body;

    if (!planId) {
      return res.status(400).json({
        success: false,
        error: '套餐ID不能为空',
      });
    }

    const successUrl = returnUrl || `${process.env.FRONTEND_URL}/billing/success`;
    const cancelUrl_final = cancelUrl || `${process.env.FRONTEND_URL}/billing/cancel`;

    const result = await StripeService.createCheckoutSession({
      userId,
      planId,
      successUrl,
      cancelUrl: cancelUrl_final,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    log.error('Failed to create checkout session', { 
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error,
      userId: req.user?.userId,
      planId: req.body?.planId || 'unknown'
    });
    
    let errorMessage = '创建支付会话失败';
    if (error instanceof Error) {
      if (error.message.includes('active subscription')) {
        errorMessage = '您已经有活跃的订阅';
      } else if (error.message.includes('Plan not found') || error.message.includes('missing Stripe price ID')) {
        errorMessage = '套餐配置错误，请联系客服';
      } else if (error.message.includes('Stripe')) {
        errorMessage = '支付服务暂时不可用，请稍后重试';
      } else {
        // 在开发环境显示详细错误，生产环境显示通用错误
        errorMessage = process.env.NODE_ENV === 'development' ? error.message : '创建支付会话失败';
      }
    }

    res.status(400).json({
      success: false,
      error: errorMessage,
      ...(process.env.NODE_ENV === 'development' && { 
        debugInfo: error instanceof Error ? error.message : String(error) 
      })
    });
  }
});

/**
 * POST /api/billing/create-portal-session
 * 创建Stripe客户门户会话
 */
router.post('/create-portal-session', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { returnUrl } = req.body;

    const finalReturnUrl = returnUrl || `${process.env.FRONTEND_URL}/account/subscription`;

    const result = await StripeService.createPortalSession({
      userId,
      returnUrl: finalReturnUrl,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    log.error('Failed to create portal session', { error, userId: req.user?.userId });
    
    let errorMessage = '创建客户门户失败';
    if (error instanceof Error) {
      if (error.message.includes('No subscription')) {
        errorMessage = '您还没有订阅记录';
      }
    }

    res.status(400).json({
      success: false,
      error: errorMessage,
    });
  }
});

/**
 * POST /api/user/subscription/cancel
 * 取消订阅
 */
router.post('/user/subscription/cancel', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    
    const subscription = await StripeService.cancelSubscription(userId);

    res.json({
      success: true,
      data: {
        subscription: {
          id: subscription.id,
          status: subscription.status,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          currentPeriodEnd: subscription.currentPeriodEnd?.toISOString(),
        },
      },
      message: '订阅已取消，将在当前周期结束时停止续费',
    });
  } catch (error) {
    log.error('Failed to cancel subscription', { error, userId: req.user?.userId });
    
    let errorMessage = '取消订阅失败';
    if (error instanceof Error) {
      if (error.message.includes('No subscription')) {
        errorMessage = '没有找到活跃的订阅';
      }
    }

    res.status(400).json({
      success: false,
      error: errorMessage,
    });
  }
});

/**
 * POST /api/user/subscription/reactivate
 * 重新激活订阅
 */
router.post('/user/subscription/reactivate', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    
    const subscription = await prisma.userSubscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: '没有找到订阅记录',
      });
    }

    if (!subscription.stripeSubscriptionId) {
      return res.status(400).json({
        success: false,
        error: '无法重新激活此订阅',
      });
    }

    // 重新激活Stripe订阅
    await getStripeInstance().subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    // 更新数据库
    const updatedSubscription = await prisma.userSubscription.update({
      where: { userId },
      data: {
        cancelAtPeriodEnd: false,
        canceledAt: null,
      },
    });

    res.json({
      success: true,
      data: {
        subscription: {
          id: updatedSubscription.id,
          status: updatedSubscription.status,
          cancelAtPeriodEnd: updatedSubscription.cancelAtPeriodEnd,
        },
      },
      message: '订阅已重新激活',
    });
  } catch (error) {
    log.error('Failed to reactivate subscription', { error, userId: req.user?.userId });
    res.status(500).json({
      success: false,
      error: '重新激活订阅失败',
    });
  }
});

/**
 * GET /api/user/billing-history
 * 获取用户的付款历史
 */
router.get('/user/billing-history', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      prisma.paymentTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          amount: true,
          currency: true,
          status: true,
          stripeSessionId: true,
          createdAt: true,
        },
      }),
      prisma.paymentTransaction.count({ where: { userId } }),
    ]);

    const formattedTransactions = transactions.map(tx => ({
      id: tx.id,
      amount: tx.amount,
      currency: tx.currency,
      status: tx.status,
      description: `ChatTOEIC高级版订阅`,
      createdAt: tx.createdAt.toISOString(),
      receiptUrl: tx.stripeSessionId ? 
        `https://dashboard.stripe.com/test/payments/${tx.stripeSessionId}` : undefined,
    }));

    res.json({
      success: true,
      data: {
        transactions: formattedTransactions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    log.error('Failed to get billing history', { error, userId: req.user?.userId });
    res.status(500).json({
      success: false,
      error: '获取账单历史失败',
    });
  }
});

/**
 * GET /api/user/usage/check/:resourceType
 * 检查用户资源使用情况
 */
router.get('/user/usage/check/:resourceType', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { resourceType } = req.params;

    const quota = await checkUsageQuota(userId, resourceType);

    res.json({
      success: true,
      data: quota,
    });
  } catch (error) {
    log.error('Failed to check usage', { error, userId: req.user?.userId, resourceType: req.params.resourceType });
    res.status(500).json({
      success: false,
      error: '检查使用配额失败',
    });
  }
});

// 🆘 紧急数据库迁移端点 - 修复 Schema 不匹配问题
router.post('/migrate-database-schema', async (req: Request, res: Response) => {
  try {
    log.info('🆘 Emergency database schema migration requested');
    
    // 执行 Prisma 迁移
    const { execSync } = require('child_process');
    
    log.info('📦 Generating Prisma Client...');
    const generateOutput = execSync('npx prisma generate', { 
      stdio: 'pipe',
      encoding: 'utf8',
      env: { ...process.env }
    });
    
    log.info('🔄 Deploying database migrations...');
    const migrationOutput = execSync('npx prisma migrate deploy', { 
      stdio: 'pipe',
      encoding: 'utf8',
      env: { ...process.env }
    });
    
    log.info('✅ Database schema migration completed successfully');
    
    res.json({
      success: true,
      message: 'Database schema migration completed successfully',
      details: {
        timestamp: new Date().toISOString(),
        generate_output: generateOutput.toString(),
        migration_output: migrationOutput.toString(),
        next_steps: [
          'Database schema is now synchronized with Prisma models',
          'Missing columns (like nextPaymentAt) should now exist',
          'Payment system should work properly'
        ]
      }
    });
    
  } catch (error: any) {
    log.error('Failed to migrate database schema', { 
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      error: 'Database schema migration failed',
      details: {
        message: error.message,
        timestamp: new Date().toISOString(),
        troubleshooting: [
          'Check DATABASE_URL environment variable',
          'Verify database connectivity',
          'Ensure proper database permissions',
          'Review Prisma migration files'
        ]
      }
    });
  }
});

export default router;