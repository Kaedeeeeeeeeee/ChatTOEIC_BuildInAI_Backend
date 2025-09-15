/**
 * 订阅权限中间件
 * 检查用户是否有权限使用特定功能
 * 支持独立的试用系统和付费订阅系统
 */

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/database.js';
import { log } from '../utils/logger.js';
import { TrialService } from '../services/trialService.js';

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
 * 获取用户订阅状态和权限信息（使用新的独立试用系统）
 */
export async function getUserSubscriptionInfo(userId: string) {
  try {
    // 查询用户基本信息，包括新的试用字段
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        // 新的试用系统字段
        trialStartedAt: true,
        trialExpiresAt: true,
        hasUsedTrial: true,
        trialEmail: true,
        trialIpAddress: true,
      },
    });

    if (!user) {
      return { hasPermission: false, reason: 'USER_NOT_FOUND' };
    }

    // 首先检查是否在试用期内（新的独立试用系统）
    const isInTrial = TrialService.isInTrial(user);

    if (isInTrial) {
      log.info('User is in trial period', { userId, trialExpiresAt: user.trialExpiresAt });

      // 返回试用权限
      const trialPermissions = TrialService.getTrialPermissions();
      return {
        hasPermission: true,
        subscription: null,
        trial: {
          isActive: true,
          startedAt: user.trialStartedAt,
          expiresAt: user.trialExpiresAt,
          daysRemaining: user.trialExpiresAt
            ? Math.ceil((user.trialExpiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
            : 0
        },
        permissions: {
          aiPractice: trialPermissions.aiPractice,
          aiChat: trialPermissions.aiChat,
          vocabulary: trialPermissions.vocabulary,
          exportData: trialPermissions.exportData,
          viewMistakes: trialPermissions.viewMistakes,
        },
        trialAvailable: false, // 已经在使用试用
      };
    }

    // 检查是否可以开始试用
    const canStartTrial = !user.hasUsedTrial;

    // 查询用户订阅信息
    const subscription = await prisma.userSubscription.findUnique({
      where: { userId },
      select: safeUserSubscriptionSelect,
    });

    // 如果没有订阅且不在试用期，返回免费版权限
    if (!subscription) {
      return {
        hasPermission: false,
        subscription: null,
        trial: {
          isActive: false,
          hasUsed: user.hasUsedTrial,
          canStart: canStartTrial
        },
        permissions: {
          aiPractice: false,        // ❌ 无AI练习生成
          aiChat: false,            // ❌ 无AI对话
          vocabulary: true,         // ✅ 生词本功能
          exportData: false,        // ❌ 不能导出
          viewMistakes: true,       // ✅ 无限复习功能
        },
        trialAvailable: canStartTrial,
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

      if (subscription.planId === 'free' || subscription.planId === 'free_plan') {
        planData = {
          id: 'free',
          name: 'Free Plan',
          nameJp: '無料プラン',
          priceCents: 0,
          currency: 'jpy',
          interval: 'month',
          features: {
            aiPractice: false,
            aiChat: false,
            vocabulary: true,
            exportData: false,
            viewMistakes: true
          },
          dailyPracticeLimit: null,
          dailyAiChatLimit: 0,
          maxVocabularyWords: null,
        };
      } else {
        // 未知套餐，返回默认免费权限
        return {
          hasPermission: false,
          subscription: null,
          trial: {
            isActive: false,
            hasUsed: user.hasUsedTrial,
            canStart: canStartTrial
          },
          permissions: {
            aiPractice: false,
            aiChat: false,
            vocabulary: true,
            exportData: false,
            viewMistakes: true,
          },
          trialAvailable: canStartTrial,
        };
      }
    }

    // 检查订阅状态
    const isActive = ['active'].includes(subscription.status); // 移除 'trialing'，因为现在使用独立试用系统
    const isExpired = subscription.currentPeriodEnd && subscription.currentPeriodEnd < new Date();

    if (!isActive || isExpired) {
      return {
        hasPermission: false,
        subscription: { ...subscription, plan: planData },
        trial: {
          isActive: false,
          hasUsed: user.hasUsedTrial,
          canStart: canStartTrial
        },
        reason: isExpired ? 'SUBSCRIPTION_EXPIRED' : 'SUBSCRIPTION_INACTIVE',
        permissions: {
          aiPractice: false,        // ❌ 无AI练习生成
          aiChat: false,            // ❌ 无AI对话
          vocabulary: true,         // ✅ 生词本功能
          exportData: false,        // ❌ 不能导出
          viewMistakes: true,       // ✅ 无限复习功能
        },
        trialAvailable: canStartTrial,
      };
    }

    // 获取套餐权限
    const planFeatures = planData.features as any;

    // 活跃付费订阅的权限
    return {
      hasPermission: true,
      subscription: { ...subscription, plan: planData },
      trial: {
        isActive: false,
        hasUsed: user.hasUsedTrial,
        canStart: false // 已有付费订阅，不需要试用
      },
      permissions: {
        aiPractice: planFeatures.aiPractice || false,
        aiChat: planFeatures.aiChat || false,
        exportData: planFeatures.exportData || false,
        viewMistakes: planFeatures.viewMistakes !== false, // 默认为true
        vocabulary: planFeatures.vocabulary !== false, // 默认为true
      },
      trialAvailable: false, // 已有付费订阅
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

        // 如果没有今日记录，获取用户的订阅/试用信息来创建
        if (!quota) {
          const subscriptionInfo = await getUserSubscriptionInfo(userId);
          let limitCount = null;

          // 优先检查试用状态
          if (subscriptionInfo.trial?.isActive) {
            // 试用用户的配额
            if (resourceType === 'daily_practice') {
              limitCount = null; // 试用用户练习无限制
            } else if (resourceType === 'daily_ai_chat') {
              limitCount = 20; // 试用用户每天20次AI对话
            }
          } else if (subscriptionInfo.subscription?.plan) {
            // 付费用户的配额
            const plan = subscriptionInfo.subscription.plan;
            if (resourceType === 'daily_practice') {
              limitCount = plan.dailyPracticeLimit;
            } else if (resourceType === 'daily_ai_chat') {
              limitCount = plan.dailyAiChatLimit;
            }
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
 * 增加使用计数（支持新试用系统）
 */
export async function incrementUsage(userId: string, resourceType: string, amount: number = 1) {
  try {
    // 对于AI对话，检查是否为试用用户
    if (resourceType === 'daily_ai_chat') {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          trialStartedAt: true,
          trialExpiresAt: true,
        },
      });

      if (user && TrialService.isInTrial(user)) {
        // 试用用户使用 TrialService
        await TrialService.incrementAiChatUsage(userId);
        log.info('Trial AI chat usage incremented', { userId, amount });
        return;
      }
    }

    // 非试用用户或非AI对话资源使用原有逻辑
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

    // 检查每日AI对话配额（支持新试用系统）
    let quota;
    if (subscriptionInfo.trial?.isActive) {
      // 试用用户使用 TrialService 检查
      quota = await TrialService.checkAiChatUsage(userId);
      if (!quota.canUse) {
        return res.status(403).json({
          success: false,
          error: `今日AI对话次数已用完 (${quota.remaining === 0 ? '20/20' : `${20 - quota.remaining}/20`})`,
          errorCode: 'USAGE_LIMIT_EXCEEDED',
          data: {
            used: 20 - quota.remaining,
            limit: 20,
            remaining: quota.remaining,
            upgradeUrl: '/pricing',
          },
        });
      }
    } else {
      // 非试用用户使用原有逻辑
      quota = await checkUsageQuota(userId, 'daily_ai_chat');
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