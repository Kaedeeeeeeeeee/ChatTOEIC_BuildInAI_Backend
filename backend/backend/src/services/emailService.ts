/**
 * 邮件发送服务 - 使用Gmail SMTP
 */

import { render } from '@react-email/render';
import nodemailer from 'nodemailer';
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
  private transporter: nodemailer.Transporter;
  private defaultFrom: string;
  private stats: EmailStats;

  constructor() {
    // 初始化 Gmail SMTP 配置
    this.initializeGmailSMTP();
    this.defaultFrom = process.env.EMAIL_FROM || 'ChatTOEIC <noreply@chattoeic.com>';
    this.stats = {
      sent: 0,
      failed: 0,
      pending: 0
    };
  }

  private initializeGmailSMTP() {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = parseInt(process.env.SMTP_PORT || '587');
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpHost || !smtpUser || !smtpPass) {
      console.warn('⚠️  Gmail SMTP configuration incomplete. Email service will run in mock mode.');
      console.warn('   Required environment variables: SMTP_HOST, SMTP_USER, SMTP_PASS');

      // Create a mock transporter that doesn't actually send emails
      this.transporter = {
        sendMail: async (options: any) => {
          console.log('📧 Mock email would be sent:', {
            to: options.to,
            subject: options.subject,
            from: options.from
          });
          return { messageId: 'mock-' + Date.now() };
        }
      } as any;
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465, // true for 465, false for other ports
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });

    console.log('📧 Email service initialized with Gmail SMTP');
  }


  /**
   * 发送邮件
   */
  async sendEmail(config: EmailConfig): Promise<EmailResult> {
    try {
      this.stats.pending++;

      // 渲染React邮件模板为HTML
      const html = await render(config.template);

      // 使用 Gmail SMTP 发送邮件
      return await this.sendEmailViaGmail(config, html);

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

  private async sendEmailViaGmail(config: EmailConfig, html: string): Promise<EmailResult> {
    const info = await this.transporter!.sendMail({
      from: config.from || this.defaultFrom,
      to: Array.isArray(config.to) ? config.to.join(', ') : config.to,
      subject: config.subject,
      html,
      replyTo: config.replyTo
    });

    this.stats.pending--;
    this.stats.sent++;

    console.log('📧 Email sent successfully via Gmail SMTP:', {
      messageId: info.messageId,
      to: config.to,
      subject: config.subject
    });

    return {
      id: info.messageId || 'gmail-smtp',
      success: true
    };
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