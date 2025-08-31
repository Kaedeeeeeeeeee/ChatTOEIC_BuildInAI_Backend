/**
 * 通知邮件路由 - 管理系统通知、公告推送等
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../utils/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { authRateLimit } from '../middleware/rateLimiting.js';
import { validateRequest, schemas } from '../middleware/validation.js';
import { notificationEmailService, SecurityAlertType, MaintenanceType, ActivityPeriodType, AnnouncementType } from '../services/notificationEmailService.js';
import { ActivityData } from '../emails/templates/notifications/AccountActivityEmail.js';
import { z } from 'zod';

const router = Router();

// 验证管理员权限的中间件
const requireAdmin = async (req: Request, res: Response, next: any) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { role: true }
    });

    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: '需要管理员权限'
      });
    }

    next();
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(500).json({
      success: false,
      error: '权限验证失败'
    });
  }
};

// 请求体验证模式
const securityAlertSchema = z.object({
  recipients: z.array(z.string().email()).optional(),
  userIds: z.array(z.string().uuid()).optional(),
  alertType: z.enum(['login', 'password_change', 'email_change', 'suspicious_activity']),
  options: z.object({
    location: z.string().optional(),
    ipAddress: z.string().optional(),
    userAgent: z.string().optional(),
    actionUrl: z.string().url().optional()
  }).optional()
}).refine(data => data.recipients || data.userIds, {
  message: '必须提供 recipients 或 userIds 之一'
});

const maintenanceSchema = z.object({
  recipients: z.array(z.string().email()).optional(),
  userIds: z.array(z.string().uuid()).optional(),
  maintenanceType: z.enum(['scheduled', 'emergency', 'completed']),
  options: z.object({
    startTime: z.string(),
    endTime: z.string().optional(),
    duration: z.string().optional(),
    reason: z.string().optional(),
    affectedServices: z.array(z.string()).optional(),
    statusPageUrl: z.string().url().optional()
  })
}).refine(data => data.recipients || data.userIds, {
  message: '必须提供 recipients 或 userIds 之一'
});

const activitySchema = z.object({
  recipients: z.array(z.string().email()).optional(),
  userIds: z.array(z.string().uuid()).optional(),
  periodType: z.enum(['weekly', 'monthly', 'yearly']),
  activityData: z.object({
    practiceCount: z.number().int().min(0),
    studyHours: z.number().min(0),
    questionsAnswered: z.number().int().min(0),
    correctRate: z.number().min(0).max(100),
    streakDays: z.number().int().min(0),
    newWords: z.number().int().min(0),
    achievementsUnlocked: z.number().int().min(0)
  }),
  options: z.object({
    periodStart: z.string(),
    periodEnd: z.string(),
    topAchievements: z.array(z.string()).optional(),
    recommendations: z.array(z.string()).optional(),
    dashboardUrl: z.string().url().optional()
  })
}).refine(data => data.recipients || data.userIds, {
  message: '必须提供 recipients 或 userIds 之一'
});

const announcementSchema = z.object({
  recipients: z.array(z.string().email()).optional(),
  userIds: z.array(z.string().uuid()).optional(),
  announcementType: z.enum(['new_feature', 'major_update', 'beta_release']),
  options: z.object({
    title: z.string().min(1),
    releaseDate: z.string(),
    features: z.array(z.object({
      name: z.string(),
      description: z.string(),
      icon: z.string().optional(),
      benefits: z.array(z.string())
    })),
    ctaText: z.string().optional(),
    ctaUrl: z.string().url().optional(),
    videoUrl: z.string().url().optional(),
    blogUrl: z.string().url().optional(),
    feedbackUrl: z.string().url().optional()
  })
}).refine(data => data.recipients || data.userIds, {
  message: '必须提供 recipients 或 userIds 之一'
});

// 辅助函数：根据用户ID或邮箱地址获取接收者列表
async function getRecipients(
  userIds?: string[],
  emails?: string[]
): Promise<Array<{ email: string; userName: string }>> {
  const recipients: Array<{ email: string; userName: string }> = [];

  // 如果提供了用户ID，从数据库获取用户信息
  if (userIds && userIds.length > 0) {
    const users = await prisma.user.findMany({
      where: {
        id: { in: userIds },
        emailVerified: true, // 只发送给已验证邮箱的用户
        isActive: true // 只发送给活跃用户
      },
      select: {
        email: true,
        name: true
      }
    });

    recipients.push(...users.map(user => ({
      email: user.email,
      userName: user.name || '用户'
    })));
  }

  // 如果提供了邮箱地址，直接使用
  if (emails && emails.length > 0) {
    recipients.push(...emails.map(email => ({
      email,
      userName: '用户' // 默认用户名
    })));
  }

  return recipients;
}

// =================== 安全警报邮件 ===================

// 发送安全警报邮件
router.post('/security-alert', authenticateToken, requireAdmin, authRateLimit, 
  validateRequest({ body: securityAlertSchema }), 
  async (req: Request, res: Response) => {
    try {
      const { recipients: emails, userIds, alertType, options } = req.body;

      // 获取接收者列表
      const recipients = await getRecipients(userIds, emails);

      if (recipients.length === 0) {
        return res.status(400).json({
          success: false,
          error: '没有找到有效的接收者'
        });
      }

      // 批量发送安全警报邮件
      const result = await notificationEmailService.sendBatchNotification(
        recipients,
        'security_alert',
        { alertType, options: options || {} }
      );

      res.json({
        success: result.success,
        message: `安全警报邮件发送完成`,
        data: {
          totalRecipients: recipients.length,
          successCount: result.successCount,
          failureCount: result.failureCount,
          results: result.results
        }
      });

    } catch (error) {
      console.error('Security alert email error:', error);
      res.status(500).json({
        success: false,
        error: '发送安全警报邮件失败'
      });
    }
  }
);

// =================== 系统维护邮件 ===================

// 发送系统维护通知邮件
router.post('/maintenance', authenticateToken, requireAdmin, authRateLimit,
  validateRequest({ body: maintenanceSchema }),
  async (req: Request, res: Response) => {
    try {
      const { recipients: emails, userIds, maintenanceType, options } = req.body;

      // 获取接收者列表
      const recipients = await getRecipients(userIds, emails);

      if (recipients.length === 0) {
        return res.status(400).json({
          success: false,
          error: '没有找到有效的接收者'
        });
      }

      // 批量发送维护通知邮件
      const result = await notificationEmailService.sendBatchNotification(
        recipients,
        'maintenance',
        { maintenanceType, options }
      );

      res.json({
        success: result.success,
        message: `系统维护通知邮件发送完成`,
        data: {
          totalRecipients: recipients.length,
          successCount: result.successCount,
          failureCount: result.failureCount,
          results: result.results
        }
      });

    } catch (error) {
      console.error('Maintenance notification email error:', error);
      res.status(500).json({
        success: false,
        error: '发送维护通知邮件失败'
      });
    }
  }
);

// =================== 活动报告邮件 ===================

// 发送账户活动报告邮件
router.post('/activity-report', authenticateToken, requireAdmin, authRateLimit,
  validateRequest({ body: activitySchema }),
  async (req: Request, res: Response) => {
    try {
      const { recipients: emails, userIds, periodType, activityData, options } = req.body;

      // 获取接收者列表
      const recipients = await getRecipients(userIds, emails);

      if (recipients.length === 0) {
        return res.status(400).json({
          success: false,
          error: '没有找到有效的接收者'
        });
      }

      // 批量发送活动报告邮件
      const result = await notificationEmailService.sendBatchNotification(
        recipients,
        'activity',
        { periodType, activityData, options }
      );

      res.json({
        success: result.success,
        message: `活动报告邮件发送完成`,
        data: {
          totalRecipients: recipients.length,
          successCount: result.successCount,
          failureCount: result.failureCount,
          results: result.results
        }
      });

    } catch (error) {
      console.error('Activity report email error:', error);
      res.status(500).json({
        success: false,
        error: '发送活动报告邮件失败'
      });
    }
  }
);

// =================== 功能公告邮件 ===================

// 发送功能发布公告邮件
router.post('/feature-announcement', authenticateToken, requireAdmin, authRateLimit,
  validateRequest({ body: announcementSchema }),
  async (req: Request, res: Response) => {
    try {
      const { recipients: emails, userIds, announcementType, options } = req.body;

      // 获取接收者列表
      const recipients = await getRecipients(userIds, emails);

      if (recipients.length === 0) {
        return res.status(400).json({
          success: false,
          error: '没有找到有效的接收者'
        });
      }

      // 批量发送功能公告邮件
      const result = await notificationEmailService.sendBatchNotification(
        recipients,
        'announcement',
        { announcementType, options }
      );

      res.json({
        success: result.success,
        message: `功能公告邮件发送完成`,
        data: {
          totalRecipients: recipients.length,
          successCount: result.successCount,
          failureCount: result.failureCount,
          results: result.results
        }
      });

    } catch (error) {
      console.error('Feature announcement email error:', error);
      res.status(500).json({
        success: false,
        error: '发送功能公告邮件失败'
      });
    }
  }
);

// =================== 便捷端点 ===================

// 发送邮件给所有活跃用户
router.post('/broadcast/:type', authenticateToken, requireAdmin, authRateLimit,
  async (req: Request, res: Response) => {
    try {
      const { type } = req.params;
      const emailData = req.body;

      if (!['security-alert', 'maintenance', 'activity-report', 'feature-announcement'].includes(type)) {
        return res.status(400).json({
          success: false,
          error: '不支持的邮件类型'
        });
      }

      // 获取所有活跃用户
      const activeUsers = await prisma.user.findMany({
        where: {
          emailVerified: true,
          isActive: true,
          // 可以添加更多筛选条件，比如最近登录时间等
        },
        select: {
          email: true,
          name: true
        },
        take: 1000 // 限制最大发送数量，避免一次性发送过多邮件
      });

      const recipients = activeUsers.map(user => ({
        email: user.email,
        userName: user.name || '用户'
      }));

      if (recipients.length === 0) {
        return res.json({
          success: true,
          message: '没有找到活跃用户',
          data: { totalRecipients: 0, successCount: 0, failureCount: 0 }
        });
      }

      // 根据类型发送相应的邮件
      const emailType = type.replace('-', '_') as any;
      const result = await notificationEmailService.sendBatchNotification(
        recipients,
        emailType,
        emailData
      );

      res.json({
        success: result.success,
        message: `广播邮件发送完成 (${type})`,
        data: {
          totalRecipients: recipients.length,
          successCount: result.successCount,
          failureCount: result.failureCount
        }
      });

    } catch (error) {
      console.error('Broadcast email error:', error);
      res.status(500).json({
        success: false,
        error: '广播邮件发送失败'
      });
    }
  }
);

// 获取通知邮件统计信息
router.get('/stats', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const stats = notificationEmailService.getNotificationStats();
    
    // 获取数据库中的用户统计
    const userStats = await prisma.user.groupBy({
      by: ['emailVerified'],
      _count: {
        id: true
      }
    });

    res.json({
      success: true,
      data: {
        notificationStats: stats,
        userStats: userStats.reduce((acc, stat) => {
          acc[stat.emailVerified ? 'verified' : 'unverified'] = stat._count.id;
          return acc;
        }, {} as Record<string, number>)
      }
    });

  } catch (error) {
    console.error('Notification stats error:', error);
    res.status(500).json({
      success: false,
      error: '获取统计信息失败'
    });
  }
});

export default router;