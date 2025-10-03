/**
 * 订阅权限中间件
 * 检查用户是否有权限使用特定功能
 */

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/database.js';
import { log } from '../utils/logger.js';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}

// 安全的用户订阅查询选择器，避免查询不存在的列
const safeUserSubscriptionSelect = {
  id: true,
  userId: true,
  planId: true,
  stripeCustomerId: true,
  stripeSubscriptionId: true,
  stripeSessionId: true,
  status: true,
  currentPeriodStart: true,
  currentPeriodEnd: true,
  trialStart: true,
  trialEnd: true,
  cancelAtPeriodEnd: true,
  canceledAt: true,
  lastPaymentAt: true,
  createdAt: true,
  updatedAt: true,
};

/**
 * 获取用户订阅状态和权限信息
 */
export async function getUserSubscriptionInfo(userId: string) {
  try {
    // 查询用户基本信息（仅查询存在的字段）
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true, // 使用name而不是username字段
        // 暂时不查询trialUsed和trialStartedAt字段，直到数据库同步
      },
    });

    if (!user) {
      return { hasPermission: false, reason: 'USER_NOT_FOUND' };
    }

    // 查询用户订阅信息（使用安全选择器）
    const subscription = await prisma.userSubscription.findUnique({
      where: { userId },
      select: safeUserSubscriptionSelect,
    });
    
    // 如果没有订阅，返回免费版权限（新的权限体系）
    if (!subscription) {
      return {
        hasPermission: true,  // ✅ 免费用户也有权限
        subscription: null,
        permissions: {
          aiPractice: true,         // ✅ 免费用户也可以使用AI练习生成
          aiChat: true,             // ✅ 免费用户也可以使用AI对话
          vocabulary: true,         // ✅ 生词本功能
          exportData: true,         // ✅ 免费用户也可以导出数据
          viewMistakes: true,       // ✅ 无限复习功能
        },
        trialAvailable: true, // 新用户可以试用
      };
    }

    // 查询订阅套餐信息
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: subscription.planId },
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

    // 如果套餐不在数据库中，使用硬编码的套餐数据
    let planData = plan;
    if (!plan) {
      log.warn('Subscription plan not found in database, using hardcoded data', { planId: subscription.planId, userId });
      
      // 提供硬编码的套餐数据，与StripeService中的一致
      if (subscription.planId === 'trial' || subscription.planId === 'trial_plan') {
        planData = {
          id: 'trial',
          name: 'Free Trial',
          nameJp: '無料トライアル',
          priceCents: 0,
          currency: 'jpy',
          interval: 'trial',
          features: {
            aiPractice: true,
            aiChat: true,
            vocabulary: true,
            exportData: true,
            viewMistakes: true
          },
          dailyPracticeLimit: null,
          dailyAiChatLimit: 20,
          maxVocabularyWords: null,
        };
      } else if (subscription.planId === 'free' || subscription.planId === 'free_plan') {
        planData = {
          id: 'free',
          name: 'Free Plan',
          nameJp: '無料プラン',
          priceCents: 0,
          currency: 'jpy',
          interval: 'month',
          features: {
            aiPractice: true,   // ✅ 免费套餐也支持AI练习
            aiChat: true,       // ✅ 免费套餐也支持AI对话
            vocabulary: true,
            exportData: true,   // ✅ 免费套餐也支持数据导出
            viewMistakes: true
          },
          dailyPracticeLimit: null,
          dailyAiChatLimit: 0,
          maxVocabularyWords: null,
        };
      } else {
        // 未知套餐，返回默认免费权限
        return {
          hasPermission: true,  // ✅ 未知套餐也有权限
          subscription: null,
          permissions: {
            aiPractice: true,     // ✅ 未知套餐也支持AI练习
            aiChat: true,         // ✅ 未知套餐也支持AI对话
            vocabulary: true,
            exportData: true,     // ✅ 未知套餐也支持数据导出
            viewMistakes: true,
          },
          trialAvailable: false, // 未知订阅状态，不允许试用
        };
      }
    }

    // 检查订阅状态
    const isActive = ['active', 'trialing'].includes(subscription.status);
    const isExpired = subscription.currentPeriodEnd && subscription.currentPeriodEnd < new Date();
    
    // 🔧 修复：对于试用用户，还需要检查 trialEnd
    const isTrialExpired = subscription.status === 'trialing' && 
                          subscription.trialEnd && 
                          subscription.trialEnd < new Date();
    
    const isReallyExpired = isExpired || isTrialExpired;

    if (!isActive || isReallyExpired) {
      return {
        hasPermission: true,  // ✅ 过期用户也有权限
        subscription: { ...subscription, plan: planData },
        reason: isReallyExpired ? 'SUBSCRIPTION_EXPIRED' : 'SUBSCRIPTION_INACTIVE',
        permissions: {
          aiPractice: true,         // ✅ 过期用户也可以使用AI练习生成
          aiChat: true,             // ✅ 过期用户也可以使用AI对话
          vocabulary: true,         // ✅ 生词本功能
          exportData: true,         // ✅ 过期用户也可以导出数据
          viewMistakes: true,       // ✅ 无限复习功能
        },
        trialAvailable: false,
      };
    }

    // 获取套餐权限
    const planFeatures = planData.features as any;
    
    // 🔧 特殊处理：如果是试用状态，需要检查试用是否过期
    if (subscription.status === 'trialing') {
      // 检查试用是否过期
      const now = new Date();
      const trialExpired = subscription.trialEnd && subscription.trialEnd < now;
      
      if (trialExpired) {
        log.info('🚫 Trial period expired for user', { 
          userId, 
          trialEnd: subscription.trialEnd,
          now: now.toISOString()
        });
        return {
          hasPermission: true,  // ✅ 试用过期用户也有权限
          subscription: { ...subscription, plan: planData },
          reason: 'TRIAL_EXPIRED',
          permissions: {
            aiPractice: true,         // ✅ 试用过期也可以使用AI练习
            aiChat: true,             // ✅ 试用过期也可以使用AI对话
            vocabulary: true,         // ✅ 生词本功能
            exportData: true,         // ✅ 试用过期也可以导出数据
            viewMistakes: true,       // ✅ 无限复习功能
          },
          trialAvailable: false,
        };
      }
      
      log.info('🎯 Granting trial permissions for active trialing user', { userId, status: subscription.status });
      return {
        hasPermission: true,
        subscription: { ...subscription, plan: planData },
        permissions: {
          aiPractice: true,    // ✅ 试用用户可以使用AI练习
          aiChat: true,        // ✅ 试用用户可以使用AI对话
          exportData: true,    // ✅ 试用用户可以导出数据
          viewMistakes: true,  // ✅ 试用用户可以查看错题
          vocabulary: true,    // ✅ 试用用户可以使用词汇功能
        },
        trialAvailable: false,
      };
    }
    
    // 其他状态按正常逻辑处理
    return {
      hasPermission: true,
      subscription: { ...subscription, plan: planData },
      permissions: {
        aiPractice: planFeatures.aiPractice || false,
        aiChat: planFeatures.aiChat || false,
        exportData: planFeatures.exportData || false,
        viewMistakes: planFeatures.viewMistakes !== false, // 默认为true
        vocabulary: planFeatures.vocabulary !== false, // 默认为true
      },
      trialAvailable: false,
    };
  } catch (error) {
    log.error('Failed to get user subscription info', { error, userId });
    return { hasPermission: false, reason: 'INTERNAL_ERROR' };
  }
}

/**
 * 检查用户使用配额
 */
export async function checkUsageQuota(userId: string, resourceType: string): Promise<{
  canUse: boolean;
  used: number;
  limit: number | null;
  remaining: number | null;
  resetAt?: Date;
}> {
  try {
    const now = new Date();
    
    // 对于每日配额，获取今天的配额记录
    if (resourceType.startsWith('daily_')) {
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);

      // 查找或创建今日配额记录
      let quota = null;
      try {
        quota = await prisma.usageQuota.findFirst({
          where: {
            userId,
            resourceType,
            periodStart: { gte: startOfDay },
            periodEnd: { lte: endOfDay },
          },
        });

        // 如果没有今日记录，获取用户的订阅套餐信息来创建
        if (!quota) {
          const subscriptionInfo = await getUserSubscriptionInfo(userId);
          if (subscriptionInfo.subscription?.plan) {
            const plan = subscriptionInfo.subscription.plan;
            let limitCount = null;

            if (resourceType === 'daily_practice') {
              limitCount = plan.dailyPracticeLimit;
            } else if (resourceType === 'daily_ai_chat') {
              limitCount = plan.dailyAiChatLimit;
            }

            if (limitCount !== null) {
              try {
                quota = await prisma.usageQuota.create({
                  data: {
                    userId,
                    resourceType,
                    usedCount: 0,
                    limitCount,
                    periodStart: startOfDay,
                    periodEnd: endOfDay,
                  },
                });
              } catch (createError) {
                log.warn('Failed to create usage quota record', {
                  userId,
                  resourceType,
                  error: createError instanceof Error ? createError.message : String(createError)
                });
              }
            }
          }
        }
      } catch (findError) {
        log.warn('Failed to query usage quota (table may not exist)', {
          userId,
          resourceType,
          error: findError instanceof Error ? findError.message : String(findError)
        });
      }

      if (!quota) {
        // 如果没有配额记录，说明是无限制或未订阅
        return {
          canUse: true,
          used: 0,
          limit: null,
          remaining: null,
        };
      }

      const remaining = quota.limitCount ? quota.limitCount - quota.usedCount : null;
      const canUse = quota.limitCount === null || quota.usedCount < quota.limitCount;

      return {
        canUse,
        used: quota.usedCount,
        limit: quota.limitCount,
        remaining,
        resetAt: endOfDay,
      };
    }

    // 对于非每日配额（如词汇本总数限制）
    const quota = await prisma.usageQuota.findFirst({
      where: {
        userId,
        resourceType,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!quota) {
      return {
        canUse: true,
        used: 0,
        limit: null,
        remaining: null,
      };
    }

    const remaining = quota.limitCount ? quota.limitCount - quota.usedCount : null;
    const canUse = quota.limitCount === null || quota.usedCount < quota.limitCount;

    return {
      canUse,
      used: quota.usedCount,
      limit: quota.limitCount,
      remaining,
    };
  } catch (error) {
    log.error('Failed to check usage quota', { error, userId, resourceType });
    return { canUse: false, used: 0, limit: 0, remaining: 0 };
  }
}

/**
 * 增加使用计数
 */
export async function incrementUsage(userId: string, resourceType: string, amount: number = 1) {
  try {
    if (resourceType.startsWith('daily_')) {
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);

      try {
        await prisma.usageQuota.updateMany({
          where: {
            userId,
            resourceType,
            periodStart: { gte: startOfDay },
            periodEnd: { lte: endOfDay },
          },
          data: {
            usedCount: { increment: amount },
          },
        });
      } catch (updateError) {
        log.warn('Failed to update daily usage quota (table may not exist)', {
          userId,
          resourceType,
          amount,
          error: updateError instanceof Error ? updateError.message : String(updateError)
        });
      }
    } else {
      try {
        await prisma.usageQuota.updateMany({
          where: {
            userId,
            resourceType,
          },
          data: {
            usedCount: { increment: amount },
          },
        });
      } catch (updateError) {
        log.warn('Failed to update usage quota (table may not exist)', {
          userId,
          resourceType,
          amount,
          error: updateError instanceof Error ? updateError.message : String(updateError)
        });
      }
    }

    log.info('Usage incremented', { userId, resourceType, amount });
  } catch (error) {
    log.error('Failed to increment usage', { error, userId, resourceType, amount });
  }
}

/**
 * 检查AI练习权限的中间件
 */
export const requirePracticeAccess = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        errorCode: 'UNAUTHORIZED',
      });
    }

    const subscriptionInfo = await getUserSubscriptionInfo(userId);
    
    if (!subscriptionInfo.permissions.aiPractice) {
      return res.status(403).json({
        success: false,
        error: 'AI练习功能需要高级版订阅',
        errorCode: 'SUBSCRIPTION_REQUIRED',
        data: {
          trialAvailable: subscriptionInfo.trialAvailable,
          upgradeUrl: '/pricing',
        },
      });
    }

    // 检查每日练习配额
    const quota = await checkUsageQuota(userId, 'daily_practice');
    if (!quota.canUse) {
      return res.status(403).json({
        success: false,
        error: '今日练习次数已用完',
        errorCode: 'USAGE_LIMIT_EXCEEDED',
        data: {
          used: quota.used,
          limit: quota.limit,
          resetAt: quota.resetAt,
          upgradeUrl: '/pricing',
        },
      });
    }

    // 将订阅信息和配额信息添加到请求对象
    (req as any).subscriptionInfo = subscriptionInfo;
    (req as any).usageQuota = quota;

    next();
  } catch (error) {
    log.error('Practice access check failed', { error, userId: req.user?.userId });
    res.status(500).json({
      success: false,
      error: '权限检查失败',
      errorCode: 'INTERNAL_ERROR',
    });
  }
};

/**
 * 检查AI对话权限的中间件
 */
export const requireAiChatAccess = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        errorCode: 'UNAUTHORIZED',
      });
    }

    const subscriptionInfo = await getUserSubscriptionInfo(userId);
    
    if (!subscriptionInfo.permissions.aiChat) {
      return res.status(403).json({
        success: false,
        error: 'AI对话功能需要高级版订阅',
        errorCode: 'SUBSCRIPTION_REQUIRED',
        data: {
          trialAvailable: subscriptionInfo.trialAvailable,
          upgradeUrl: '/pricing',
        },
      });
    }

    // 检查每日AI对话配额
    const quota = await checkUsageQuota(userId, 'daily_ai_chat');
    if (!quota.canUse) {
      return res.status(403).json({
        success: false,
        error: `今日AI对话次数已用完 (${quota.used}/${quota.limit})`,
        errorCode: 'USAGE_LIMIT_EXCEEDED',
        data: {
          used: quota.used,
          limit: quota.limit,
          resetAt: quota.resetAt,
          upgradeUrl: '/pricing',
        },
      });
    }

    // 将订阅信息和配额信息添加到请求对象
    (req as any).subscriptionInfo = subscriptionInfo;
    (req as any).usageQuota = quota;

    next();
  } catch (error) {
    log.error('AI chat access check failed', { error, userId: req.user?.userId });
    res.status(500).json({
      success: false,
      error: '权限检查失败',
      errorCode: 'INTERNAL_ERROR',
    });
  }
};

/**
 * 检查数据导出权限的中间件
 */
export const requireExportAccess = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        errorCode: 'UNAUTHORIZED',
      });
    }

    const subscriptionInfo = await getUserSubscriptionInfo(userId);
    
    if (!subscriptionInfo.permissions.exportData) {
      return res.status(403).json({
        success: false,
        error: '数据导出功能需要高级版订阅',
        errorCode: 'SUBSCRIPTION_REQUIRED',
        data: {
          trialAvailable: subscriptionInfo.trialAvailable,
          upgradeUrl: '/pricing',
        },
      });
    }

    next();
  } catch (error) {
    log.error('Export access check failed', { error, userId: req.user?.userId });
    res.status(500).json({
      success: false,
      error: '权限检查失败',
      errorCode: 'INTERNAL_ERROR',
    });
  }
};

/**
 * 获取用户订阅状态的中间件（不阻止请求，只添加信息）
 */
export const addSubscriptionInfo = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (userId) {
      const subscriptionInfo = await getUserSubscriptionInfo(userId);
      (req as any).subscriptionInfo = subscriptionInfo;
    }
    next();
  } catch (error) {
    log.error('Failed to add subscription info', { error, userId: req.user?.userId });
    // 不阻止请求，继续执行
    next();
  }
};

export { AuthenticatedRequest };