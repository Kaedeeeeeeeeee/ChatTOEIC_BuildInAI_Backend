/**
 * 认证邮件服务 - 处理注册、验证、密码重置等邮件
 */

import React from 'react';
import { emailService } from './emailService';
import { verificationService } from './verificationService';
import VerificationEmail from '../emails/templates/auth/VerificationEmail';

// 邮件发送结果
interface AuthEmailResult {
  success: boolean;
  verificationCode?: string;
  emailId?: string;
  error?: string;
}

export class AuthEmailService {
  /**
   * 发送注册验证邮件
   */
  async sendRegistrationVerificationEmail(
    email: string, 
    userName: string
  ): Promise<AuthEmailResult> {
    try {
      // 验证邮箱格式
      if (!emailService.validateEmail(email)) {
        return {
          success: false,
          error: 'invalid_email_format'
        };
      }

      // 生成验证码
      const verificationCode = verificationService.createVerificationCode({
        type: 'email',
        email,
        expiresInMinutes: 10
      });

      // 创建验证URL
      const verificationUrl = `${process.env.FRONTEND_URL || 'https://www.chattoeic.com'}/verify?code=${verificationCode}&email=${encodeURIComponent(email)}`;

      // 渲染邮件模板
      const emailTemplate = React.createElement(VerificationEmail, {
        userName,
        verificationCode,
        verificationUrl
      });

      // 发送邮件
      const result = await emailService.sendEmail({
        to: email,
        subject: '验证您的ChatTOEIC账号',
        template: emailTemplate
      });

      if (result.success) {
        console.log('📧 Registration verification email sent:', {
          email,
          userName,
          verificationCode,
          emailId: result.id
        });

        return {
          success: true,
          verificationCode,
          emailId: result.id
        };
      } else {
        return {
          success: false,
          error: result.error || 'email_send_failed'
        };
      }

    } catch (error: any) {
      console.error('❌ Failed to send registration verification email:', error);
      return {
        success: false,
        error: error.message || 'unknown_error'
      };
    }
  }

  /**
   * 重新发送验证邮件
   */
  async resendVerificationEmail(
    email: string, 
    userName: string
  ): Promise<AuthEmailResult> {
    try {
      // 检查是否已有未过期的验证码
      const codeExists = verificationService.checkCodeExists({
        type: 'email',
        email
      });

      if (codeExists) {
        const codeInfo = verificationService.getCodeInfo({
          type: 'email',
          email
        });

        // 如果验证码还有5分钟以上才过期，拒绝重发
        if (codeInfo.expiresAt && (codeInfo.expiresAt.getTime() - Date.now()) > 5 * 60 * 1000) {
          return {
            success: false,
            error: 'verification_code_still_valid'
          };
        }
      }

      // 发送新的验证邮件
      return await this.sendRegistrationVerificationEmail(email, userName);

    } catch (error: any) {
      console.error('❌ Failed to resend verification email:', error);
      return {
        success: false,
        error: error.message || 'unknown_error'
      };
    }
  }

  /**
   * 验证邮箱验证码
   */
  async verifyEmailCode(
    email: string, 
    code: string
  ): Promise<{ success: boolean; error?: string; remainingAttempts?: number }> {
    try {
      const result = verificationService.verifyCode({
        type: 'email',
        email
      }, code);

      if (result.success) {
        console.log('✅ Email verification successful:', { email });
      } else {
        console.log('❌ Email verification failed:', { 
          email, 
          error: result.error,
          remainingAttempts: result.remainingAttempts
        });
      }

      return result;

    } catch (error: any) {
      console.error('❌ Email verification error:', error);
      return {
        success: false,
        error: 'verification_error'
      };
    }
  }

  /**
   * 发送欢迎邮件（验证完成后）
   */
  async sendWelcomeEmail(
    email: string,
    userName: string
  ): Promise<AuthEmailResult> {
    try {
      // TODO: 创建欢迎邮件模板
      // 暂时使用简单的HTML
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">🎉 欢迎来到ChatTOEIC！</h2>
          <p>亲爱的 ${userName}，</p>
          <p>恭喜您成功验证邮箱！现在您可以开始您的TOEIC学习之旅了。</p>
          <p>
            <a href="${process.env.FRONTEND_URL || 'https://www.chattoeic.com'}" 
               style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
              开始学习
            </a>
          </p>
          <p>如有任何问题，请随时联系我们：support@chattoeic.com</p>
          <p>祝学习愉快！<br>ChatTOEIC团队</p>
        </div>
      `;

      const result = await emailService.sendEmail({
        to: email,
        subject: '🎉 欢迎来到ChatTOEIC！',
        template: React.createElement('div', { 
          dangerouslySetInnerHTML: { __html: html }
        })
      });

      return {
        success: result.success,
        emailId: result.id,
        error: result.error
      };

    } catch (error: any) {
      console.error('❌ Failed to send welcome email:', error);
      return {
        success: false,
        error: error.message || 'unknown_error'
      };
    }
  }

  /**
   * 获取验证码信息（不返回实际验证码）
   */
  getVerificationCodeInfo(email: string) {
    return verificationService.getCodeInfo({
      type: 'email',
      email
    });
  }
}

// 创建单例实例
export const authEmailService = new AuthEmailService();