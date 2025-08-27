/**
 * 邮件发送服务 - 基于Resend + React Email
 */

import { Resend } from 'resend';
import { render } from '@react-email/render';
import React from 'react';

// 邮件配置接口
interface EmailConfig {
  to: string | string[];
  subject: string;
  template: React.ReactElement;
  from?: string;
  replyTo?: string;
}

// 邮件发送结果接口
interface EmailResult {
  id: string;
  success: boolean;
  error?: string;
}

// 邮件统计接口
interface EmailStats {
  sent: number;
  failed: number;
  pending: number;
}

export class EmailService {
  private resend: Resend;
  private defaultFrom: string;
  private stats: EmailStats;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is required');
    }

    this.resend = new Resend(apiKey);
    this.defaultFrom = process.env.EMAIL_FROM || 'ChatTOEIC <noreply@chattoeic.com>';
    this.stats = {
      sent: 0,
      failed: 0,
      pending: 0
    };
  }

  /**
   * 发送邮件
   */
  async sendEmail(config: EmailConfig): Promise<EmailResult> {
    try {
      this.stats.pending++;

      // 渲染React邮件模板为HTML
      const html = await render(config.template);
      
      // 发送邮件
      const response = await this.resend.emails.send({
        from: config.from || this.defaultFrom,
        to: Array.isArray(config.to) ? config.to : [config.to],
        subject: config.subject,
        html,
        replyTo: config.replyTo
      });

      this.stats.pending--;
      this.stats.sent++;

      console.log('📧 Email sent successfully:', {
        id: response.data?.id,
        to: config.to,
        subject: config.subject
      });

      return {
        id: response.data?.id || 'unknown',
        success: true
      };

    } catch (error: any) {
      this.stats.pending--;
      this.stats.failed++;

      console.error('❌ Email sending failed:', {
        to: config.to,
        subject: config.subject,
        error: error.message
      });

      return {
        id: '',
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 批量发送邮件
   */
  async sendBulkEmails(configs: EmailConfig[]): Promise<EmailResult[]> {
    const results = await Promise.allSettled(
      configs.map(config => this.sendEmail(config))
    );

    return results.map(result => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        this.stats.failed++;
        return {
          id: '',
          success: false,
          error: result.reason?.message || 'Unknown error'
        };
      }
    });
  }

  /**
   * 获取发送统计
   */
  getStats(): EmailStats {
    return { ...this.stats };
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      sent: 0,
      failed: 0,
      pending: 0
    };
  }

  /**
   * 验证邮箱格式
   */
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * 批量验证邮箱格式
   */
  static validateEmails(emails: string[]): { valid: string[]; invalid: string[] } {
    const valid: string[] = [];
    const invalid: string[] = [];

    emails.forEach(email => {
      if (this.validateEmail(email)) {
        valid.push(email);
      } else {
        invalid.push(email);
      }
    });

    return { valid, invalid };
  }
}

// 创建单例实例
export const emailService = new EmailService();