/**
 * 通知邮件服务 - 处理系统通知、公告、活动报告等邮件
 */

import React from 'react';
import { emailService } from './emailService';
import SecurityAlertEmail from '../emails/templates/notifications/SecurityAlertEmail';
import SystemMaintenanceEmail from '../emails/templates/notifications/SystemMaintenanceEmail';
import AccountActivityEmail, { ActivityData } from '../emails/templates/notifications/AccountActivityEmail';
import FeatureAnnouncementEmail from '../emails/templates/notifications/FeatureAnnouncementEmail';

// 安全警报类型
export type SecurityAlertType = 'login' | 'password_change' | 'email_change' | 'suspicious_activity';

// 维护类型
export type MaintenanceType = 'scheduled' | 'emergency' | 'completed';

// 活动报告周期
export type ActivityPeriodType = 'weekly' | 'monthly' | 'yearly';

// 公告类型
export type AnnouncementType = 'new_feature' | 'major_update' | 'beta_release';

// 邮件发送结果
interface NotificationEmailResult {
  success: boolean;
  emailId?: string;
  error?: string;
}

// 功能特性接口
interface Feature {
  name: string;
  description: string;
  icon?: string;
  benefits: string[];
}

export class NotificationEmailService {
  /**
   * 发送安全警报邮件
   */
  async sendSecurityAlert(
    email: string,
    userName: string,
    alertType: SecurityAlertType,
    options: {
      location?: string;
      ipAddress?: string;
      userAgent?: string;
      actionUrl?: string;
    } = {}
  ): Promise<NotificationEmailResult> {
    try {
      const alertTime = new Date().toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Shanghai'
      });

      const emailTemplate = React.createElement(SecurityAlertEmail, {
        userName,
        alertType,
        alertTime,
        location: options.location,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
        actionUrl: options.actionUrl
      });

      const subjectMap = {
        login: '新设备登录通知',
        password_change: '密码变更通知',
        email_change: '邮箱变更通知',
        suspicious_activity: '账户安全警报'
      };

      const result = await emailService.sendEmail({
        to: email,
        subject: `${subjectMap[alertType]} - ChatTOEIC`,
        template: emailTemplate
      });

      if (result.success) {
        console.log(`📧 Security alert email sent (${alertType}):`, {
          email,
          userName,
          alertType,
          emailId: result.id
        });
      }

      return {
        success: result.success,
        emailId: result.id,
        error: result.error
      };

    } catch (error: any) {
      console.error('❌ Failed to send security alert email:', error);
      return {
        success: false,
        error: error.message || 'unknown_error'
      };
    }
  }

  /**
   * 发送系统维护通知邮件
   */
  async sendSystemMaintenance(
    email: string,
    userName: string,
    maintenanceType: MaintenanceType,
    options: {
      startTime: string;
      endTime?: string;
      duration?: string;
      reason?: string;
      affectedServices?: string[];
      statusPageUrl?: string;
    }
  ): Promise<NotificationEmailResult> {
    try {
      const emailTemplate = React.createElement(SystemMaintenanceEmail, {
        userName,
        maintenanceType,
        startTime: options.startTime,
        endTime: options.endTime,
        duration: options.duration,
        reason: options.reason,
        affectedServices: options.affectedServices,
        statusPageUrl: options.statusPageUrl
      });

      const subjectMap = {
        scheduled: '系统维护通知',
        emergency: '紧急维护通知',
        completed: '维护完成通知'
      };

      const result = await emailService.sendEmail({
        to: email,
        subject: `${subjectMap[maintenanceType]} - ChatTOEIC`,
        template: emailTemplate
      });

      if (result.success) {
        console.log(`🔧 System maintenance email sent (${maintenanceType}):`, {
          email,
          userName,
          maintenanceType,
          emailId: result.id
        });
      }

      return {
        success: result.success,
        emailId: result.id,
        error: result.error
      };

    } catch (error: any) {
      console.error('❌ Failed to send system maintenance email:', error);
      return {
        success: false,
        error: error.message || 'unknown_error'
      };
    }
  }

  /**
   * 发送账户活动报告邮件
   */
  async sendAccountActivity(
    email: string,
    userName: string,
    periodType: ActivityPeriodType,
    activityData: ActivityData,
    options: {
      periodStart: string;
      periodEnd: string;
      topAchievements?: string[];
      recommendations?: string[];
      dashboardUrl?: string;
    }
  ): Promise<NotificationEmailResult> {
    try {
      const emailTemplate = React.createElement(AccountActivityEmail, {
        userName,
        periodType,
        periodStart: options.periodStart,
        periodEnd: options.periodEnd,
        activityData,
        topAchievements: options.topAchievements,
        recommendations: options.recommendations,
        dashboardUrl: options.dashboardUrl
      });

      const subjectMap = {
        weekly: '本周学习报告',
        monthly: '本月学习总结',
        yearly: '年度学习成就报告'
      };

      const result = await emailService.sendEmail({
        to: email,
        subject: `${subjectMap[periodType]} - ChatTOEIC`,
        template: emailTemplate
      });

      if (result.success) {
        console.log(`📊 Account activity email sent (${periodType}):`, {
          email,
          userName,
          periodType,
          emailId: result.id
        });
      }

      return {
        success: result.success,
        emailId: result.id,
        error: result.error
      };

    } catch (error: any) {
      console.error('❌ Failed to send account activity email:', error);
      return {
        success: false,
        error: error.message || 'unknown_error'
      };
    }
  }

  /**
   * 发送功能发布公告邮件
   */
  async sendFeatureAnnouncement(
    email: string,
    userName: string,
    announcementType: AnnouncementType,
    options: {
      title: string;
      releaseDate: string;
      features: Feature[];
      ctaText?: string;
      ctaUrl?: string;
      videoUrl?: string;
      blogUrl?: string;
      feedbackUrl?: string;
    }
  ): Promise<NotificationEmailResult> {
    try {
      const emailTemplate = React.createElement(FeatureAnnouncementEmail, {
        userName,
        announcementType,
        title: options.title,
        releaseDate: options.releaseDate,
        features: options.features,
        ctaText: options.ctaText,
        ctaUrl: options.ctaUrl,
        videoUrl: options.videoUrl,
        blogUrl: options.blogUrl,
        feedbackUrl: options.feedbackUrl
      });

      const subjectMap = {
        new_feature: '全新功能发布',
        major_update: '重大更新发布',
        beta_release: 'Beta测试邀请'
      };

      const result = await emailService.sendEmail({
        to: email,
        subject: `${subjectMap[announcementType]}: ${options.title} - ChatTOEIC`,
        template: emailTemplate
      });

      if (result.success) {
        console.log(`🚀 Feature announcement email sent (${announcementType}):`, {
          email,
          userName,
          announcementType,
          title: options.title,
          emailId: result.id
        });
      }

      return {
        success: result.success,
        emailId: result.id,
        error: result.error
      };

    } catch (error: any) {
      console.error('❌ Failed to send feature announcement email:', error);
      return {
        success: false,
        error: error.message || 'unknown_error'
      };
    }
  }

  /**
   * 批量发送通知邮件
   */
  async sendBatchNotification(
    recipients: Array<{ email: string; userName: string }>,
    emailType: 'security_alert' | 'maintenance' | 'activity' | 'announcement',
    emailData: any
  ): Promise<{
    success: boolean;
    successCount: number;
    failureCount: number;
    results: Array<{ email: string; success: boolean; error?: string }>;
  }> {
    try {
      console.log(`📬 Starting batch ${emailType} notification for ${recipients.length} recipients`);
      
      const results = await Promise.all(
        recipients.map(async (recipient) => {
          try {
            let result: NotificationEmailResult;
            
            switch (emailType) {
              case 'security_alert':
                result = await this.sendSecurityAlert(
                  recipient.email,
                  recipient.userName,
                  emailData.alertType,
                  emailData.options
                );
                break;
                
              case 'maintenance':
                result = await this.sendSystemMaintenance(
                  recipient.email,
                  recipient.userName,
                  emailData.maintenanceType,
                  emailData.options
                );
                break;
                
              case 'activity':
                result = await this.sendAccountActivity(
                  recipient.email,
                  recipient.userName,
                  emailData.periodType,
                  emailData.activityData,
                  emailData.options
                );
                break;
                
              case 'announcement':
                result = await this.sendFeatureAnnouncement(
                  recipient.email,
                  recipient.userName,
                  emailData.announcementType,
                  emailData.options
                );
                break;
                
              default:
                throw new Error(`Unknown email type: ${emailType}`);
            }
            
            return {
              email: recipient.email,
              success: result.success,
              error: result.error
            };
            
          } catch (error: any) {
            return {
              email: recipient.email,
              success: false,
              error: error.message
            };
          }
        })
      );
      
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.length - successCount;
      
      console.log(`📊 Batch notification completed:`, {
        emailType,
        total: recipients.length,
        success: successCount,
        failures: failureCount
      });
      
      return {
        success: failureCount === 0,
        successCount,
        failureCount,
        results
      };
      
    } catch (error: any) {
      console.error('❌ Batch notification failed:', error);
      return {
        success: false,
        successCount: 0,
        failureCount: recipients.length,
        results: recipients.map(r => ({
          email: r.email,
          success: false,
          error: error.message
        }))
      };
    }
  }

  /**
   * 获取通知邮件统计信息
   */
  getNotificationStats(): {
    totalSent: number;
    byType: Record<string, number>;
    lastSent?: Date;
  } {
    // TODO: 实现统计功能，可能需要数据库支持
    return {
      totalSent: 0,
      byType: {},
      lastSent: undefined
    };
  }
}

// 创建单例实例
export const notificationEmailService = new NotificationEmailService();