/**
 * 独立的试用系统服务
 * 不依赖订阅系统，简化试用逻辑
 */

import { prisma } from '../utils/database.js';
import { log } from '../utils/logger.js';

export interface TrialPermissions {
  aiPractice: boolean;
  aiChat: boolean;
  vocabulary: boolean;
  exportData: boolean;
  viewMistakes: boolean;
  dailyAiChatLimit: number | null;
  dailyPracticeLimit: number | null;
}

export class TrialService {

  /**
   * 检查用户是否可以开始试用
   */
  static async canStartTrial(userId: string, email: string, ipAddress: string): Promise<void> {
    // 1. 检查当前用户是否已试用
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { hasUsedTrial: true, email: true }
    });

    if (!user) {
      throw new Error('用户不存在');
    }

    if (user.hasUsedTrial) {
      throw new Error('您已经使用过免费试用');
    }

    // 2. 检查邮箱是否已被其他账户试用过
    const emailUsed = await prisma.user.findFirst({
      where: {
        trialEmail: email,
        hasUsedTrial: true
      }
    });

    if (emailUsed) {
      throw new Error('此邮箱已使用过免费试用');
    }

    // 3. 检查IP是否在短期内多次试用（防止恶意注册）
    const recentTrials = await prisma.user.count({
      where: {
        trialIpAddress: ipAddress,
        trialStartedAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7天内
        }
      }
    });

    if (recentTrials >= 3) {
      throw new Error('此网络环境试用次数过多，请联系客服');
    }
  }

  /**
   * 开始试用
   */
  static async startTrial(userId: string, email: string, ipAddress: string) {
    try {
      // 检查是否可以开始试用
      await this.canStartTrial(userId, email, ipAddress);

      const now = new Date();
      const expiresAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3天试用期

      // 更新用户试用信息
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          trialStartedAt: now,
          trialExpiresAt: expiresAt,
          hasUsedTrial: true,
          trialEmail: email,
          trialIpAddress: ipAddress
        }
      });

      // 初始化试用用户的使用配额
      await this.initializeTrialQuotas(userId);

      log.info('Trial started successfully', {
        userId,
        trialStartedAt: now,
        trialExpiresAt: expiresAt,
        email
      });

      return {
        userId: updatedUser.id,
        trialStartedAt: updatedUser.trialStartedAt,
        trialExpiresAt: updatedUser.trialExpiresAt,
        status: 'active'
      };

    } catch (error) {
      log.error('Failed to start trial', { error, userId, email, ipAddress });
      throw error;
    }
  }

  /**
   * 初始化试用用户的使用配额
   */
  private static async initializeTrialQuotas(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // AI对话配额 - 每天20次
    await prisma.usageQuota.upsert({
      where: {
        userId_resourceType_periodStart: {
          userId,
          resourceType: 'daily_ai_chat',
          periodStart: today
        }
      },
      create: {
        userId,
        resourceType: 'daily_ai_chat',
        usedCount: 0,
        limitCount: 20, // 试用用户每天20次AI对话
        periodStart: today,
        periodEnd: tomorrow
      },
      update: {
        limitCount: 20 // 确保限制正确
      }
    });

    // 练习配额 - 无限制
    await prisma.usageQuota.upsert({
      where: {
        userId_resourceType_periodStart: {
          userId,
          resourceType: 'daily_practice',
          periodStart: today
        }
      },
      create: {
        userId,
        resourceType: 'daily_practice',
        usedCount: 0,
        limitCount: null, // 试用用户练习无限制
        periodStart: today,
        periodEnd: tomorrow
      },
      update: {
        limitCount: null
      }
    });
  }

  /**
   * 检查用户是否在试用期内
   */
  static isInTrial(user: { trialExpiresAt?: Date | null }): boolean {
    if (!user.trialExpiresAt) return false;
    return user.trialExpiresAt > new Date();
  }

  /**
   * 获取试用用户的权限
   */
  static getTrialPermissions(): TrialPermissions {
    return {
      aiPractice: true,
      aiChat: true,
      vocabulary: true,
      exportData: true,
      viewMistakes: true,
      dailyAiChatLimit: 20,    // 每天20次AI对话
      dailyPracticeLimit: null  // 练习无限制
    };
  }

  /**
   * 获取用户的试用状态
   */
  static async getTrialStatus(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        trialStartedAt: true,
        trialExpiresAt: true,
        hasUsedTrial: true
      }
    });

    if (!user) {
      throw new Error('用户不存在');
    }

    const isInTrial = user.trialExpiresAt && user.trialExpiresAt > new Date();
    const isExpired = user.trialExpiresAt && user.trialExpiresAt <= new Date();

    return {
      hasUsedTrial: user.hasUsedTrial,
      isInTrial: !!isInTrial,
      isExpired: !!isExpired,
      trialStartedAt: user.trialStartedAt,
      trialExpiresAt: user.trialExpiresAt,
      daysRemaining: isInTrial
        ? Math.ceil((user.trialExpiresAt!.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
        : 0
    };
  }

  /**
   * 检查AI对话使用限制
   */
  static async checkAiChatUsage(userId: string): Promise<{ canUse: boolean; remaining: number }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const quota = await prisma.usageQuota.findFirst({
      where: {
        userId,
        resourceType: 'daily_ai_chat',
        periodStart: { gte: today }
      }
    });

    if (!quota || quota.limitCount === null) {
      return { canUse: true, remaining: -1 }; // 无限制
    }

    const remaining = quota.limitCount - quota.usedCount;
    return {
      canUse: remaining > 0,
      remaining: Math.max(0, remaining)
    };
  }

  /**
   * 增加AI对话使用计数
   */
  static async incrementAiChatUsage(userId: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    await prisma.usageQuota.upsert({
      where: {
        userId_resourceType_periodStart: {
          userId,
          resourceType: 'daily_ai_chat',
          periodStart: today
        }
      },
      create: {
        userId,
        resourceType: 'daily_ai_chat',
        usedCount: 1,
        limitCount: 20,
        periodStart: today,
        periodEnd: tomorrow
      },
      update: {
        usedCount: { increment: 1 }
      }
    });
  }
}

export default TrialService;