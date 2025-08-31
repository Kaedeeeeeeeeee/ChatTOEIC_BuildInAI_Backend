/**
 * 认证邮件服务 - 处理注册、验证、密码重置等邮件
 */

import React from 'react';
import { emailService } from './emailService';
import { verificationService } from './verificationService';
import { passwordResetService } from './passwordResetService';
import { emailChangeService } from './emailChangeService';
import VerificationEmail from '../emails/templates/auth/VerificationEmail';
import PasswordResetEmail from '../emails/templates/auth/PasswordResetEmail';
import PasswordResetSuccessEmail from '../emails/templates/auth/PasswordResetSuccessEmail';
import EmailChangeConfirmationEmail from '../emails/templates/auth/EmailChangeConfirmationEmail';
import EmailChangeNotificationEmail from '../emails/templates/auth/EmailChangeNotificationEmail';
import EmailChangeSuccessEmail from '../emails/templates/auth/EmailChangeSuccessEmail';

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

  /**
   * 发送密码重置邮件
   */
  async sendPasswordResetEmail(
    email: string,
    userName: string,
    userId?: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<AuthEmailResult> {
    try {
      // 验证邮箱格式
      if (!emailService.validateEmail(email)) {
        return {
          success: false,
          error: 'invalid_email_format'
        };
      }

      // 检查是否已有活跃的重置请求
      const activeRequest = passwordResetService.hasActiveResetRequest(email);
      if (activeRequest.hasActive && activeRequest.count >= 3) {
        return {
          success: false,
          error: 'too_many_reset_requests'
        };
      }

      // 生成安全的重置令牌
      const resetToken = await passwordResetService.createResetToken(
        email, 
        userId, 
        userAgent, 
        ipAddress
      );

      // 创建重置URL
      const resetUrl = `${process.env.FRONTEND_URL || 'https://www.chattoeic.com'}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

      // 渲染邮件模板
      const emailTemplate = React.createElement(PasswordResetEmail, {
        userName,
        resetToken,
        resetUrl,
        expiresInHours: 1
      });

      // 发送邮件
      const result = await emailService.sendEmail({
        to: email,
        subject: '重置您的ChatTOEIC密码',
        template: emailTemplate
      });

      if (result.success) {
        console.log('🔐 Password reset email sent:', {
          email,
          userName,
          resetToken: resetToken.substring(0, 8) + '...', // 只记录前8位
          emailId: result.id,
          userAgent
        });

        return {
          success: true,
          emailId: result.id
        };
      } else {
        // 如果邮件发送失败，清理已创建的令牌
        await passwordResetService.cleanupTokensForEmail(email);
        
        return {
          success: false,
          error: result.error || 'email_send_failed'
        };
      }

    } catch (error: any) {
      console.error('❌ Failed to send password reset email:', error);
      
      if (error.message === 'too_many_reset_requests') {
        return {
          success: false,
          error: 'too_many_reset_requests'
        };
      }

      return {
        success: false,
        error: error.message || 'unknown_error'
      };
    }
  }

  /**
   * 验证密码重置令牌
   */
  async verifyPasswordResetToken(
    token: string
  ): Promise<{ success: boolean; email?: string; userId?: string; error?: string }> {
    try {
      const result = await passwordResetService.verifyResetToken(token);
      
      if (result.success) {
        console.log('✅ Password reset token verified for:', result.email);
      }

      return result;

    } catch (error: any) {
      console.error('❌ Password reset token verification error:', error);
      return {
        success: false,
        error: 'verification_error'
      };
    }
  }

  /**
   * 完成密码重置后发送确认邮件
   */
  async sendPasswordResetSuccessEmail(
    token: string,
    email: string,
    userName: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<AuthEmailResult> {
    try {
      const resetTime = new Date().toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Shanghai'
      });

      // 标记令牌为已使用
      await passwordResetService.markTokenAsUsed(token);

      // 渲染邮件模板
      const emailTemplate = React.createElement(PasswordResetSuccessEmail, {
        userName,
        resetTime,
        userAgent,
        ipAddress
      });

      // 发送邮件
      const result = await emailService.sendEmail({
        to: email,
        subject: '密码重置成功 - ChatTOEIC',
        template: emailTemplate
      });

      if (result.success) {
        console.log('✅ Password reset success email sent:', {
          email,
          userName,
          resetTime,
          emailId: result.id
        });
      }

      return {
        success: result.success,
        emailId: result.id,
        error: result.error
      };

    } catch (error: any) {
      console.error('❌ Failed to send password reset success email:', error);
      return {
        success: false,
        error: error.message || 'unknown_error'
      };
    }
  }

  /**
   * 检查密码重置请求是否存在
   */
  checkPasswordResetRequest(email: string): {
    hasActive: boolean;
    count: number;
    earliestExpiry?: Date;
  } {
    return passwordResetService.hasActiveResetRequest(email);
  }

  /**
   * 获取重置令牌统计信息
   */
  getResetTokenStats() {
    return passwordResetService.getTokenStats();
  }

  /**
   * 发送邮箱变更确认邮件（发送到新邮箱）
   */
  async sendEmailChangeConfirmationEmail(
    userId: string,
    oldEmail: string,
    newEmail: string,
    userName: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<AuthEmailResult & { verificationCode?: string }> {
    try {
      // 验证新邮箱格式
      if (!emailService.validateEmail(newEmail)) {
        return {
          success: false,
          error: 'invalid_email_format'
        };
      }

      // 创建邮箱变更请求
      const changeResult = await emailChangeService.createEmailChangeRequest(
        userId,
        oldEmail,
        newEmail,
        userAgent,
        ipAddress
      );

      if (!changeResult.success) {
        return {
          success: false,
          error: changeResult.error
        };
      }

      // 渲染确认邮件模板
      const confirmationTemplate = React.createElement(EmailChangeConfirmationEmail, {
        userName,
        oldEmail,
        newEmail,
        verificationCode: changeResult.verificationCode!,
        expiresInMinutes: 15
      });

      // 发送确认邮件到新邮箱
      const result = await emailService.sendEmail({
        to: newEmail,
        subject: '确认您的新邮箱地址 - ChatTOEIC',
        template: confirmationTemplate
      });

      if (result.success) {
        console.log('📧 Email change confirmation sent:', {
          userId,
          oldEmail,
          newEmail,
          emailId: result.id
        });

        return {
          success: true,
          verificationCode: changeResult.verificationCode,
          emailId: result.id
        };
      } else {
        // 如果邮件发送失败，取消变更请求
        await emailChangeService.cancelEmailChangeRequest(userId, newEmail);
        
        return {
          success: false,
          error: result.error || 'email_send_failed'
        };
      }

    } catch (error: any) {
      console.error('❌ Failed to send email change confirmation:', error);
      return {
        success: false,
        error: error.message || 'unknown_error'
      };
    }
  }

  /**
   * 发送邮箱变更通知邮件（发送到旧邮箱）
   */
  async sendEmailChangeNotificationEmail(
    oldEmail: string,
    newEmail: string,
    userName: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<AuthEmailResult> {
    try {
      const changeTime = new Date().toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Shanghai'
      });

      // 渲染通知邮件模板
      const notificationTemplate = React.createElement(EmailChangeNotificationEmail, {
        userName,
        oldEmail,
        newEmail,
        changeTime,
        userAgent,
        ipAddress
      });

      // 发送通知邮件到旧邮箱
      const result = await emailService.sendEmail({
        to: oldEmail,
        subject: '邮箱变更通知 - ChatTOEIC',
        template: notificationTemplate
      });

      if (result.success) {
        console.log('📧 Email change notification sent:', {
          oldEmail,
          newEmail,
          emailId: result.id
        });
      }

      return {
        success: result.success,
        emailId: result.id,
        error: result.error
      };

    } catch (error: any) {
      console.error('❌ Failed to send email change notification:', error);
      return {
        success: false,
        error: error.message || 'unknown_error'
      };
    }
  }

  /**
   * 验证邮箱变更验证码
   */
  async verifyEmailChangeCode(
    userId: string,
    newEmail: string,
    code: string
  ): Promise<{ 
    success: boolean; 
    oldEmail?: string; 
    newEmail?: string; 
    error?: string 
  }> {
    try {
      const result = await emailChangeService.verifyEmailChangeCode(userId, newEmail, code);
      
      if (result.success) {
        console.log('✅ Email change verified:', {
          userId,
          oldEmail: result.request!.oldEmail,
          newEmail: result.request!.newEmail
        });

        return {
          success: true,
          oldEmail: result.request!.oldEmail,
          newEmail: result.request!.newEmail
        };
      }

      return {
        success: false,
        error: result.error
      };

    } catch (error: any) {
      console.error('❌ Email change verification error:', error);
      return {
        success: false,
        error: 'verification_error'
      };
    }
  }

  /**
   * 发送邮箱变更成功邮件（发送到新邮箱）
   */
  async sendEmailChangeSuccessEmail(
    oldEmail: string,
    newEmail: string,
    userName: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<AuthEmailResult> {
    try {
      const changeTime = new Date().toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Shanghai'
      });

      // 渲染成功邮件模板
      const successTemplate = React.createElement(EmailChangeSuccessEmail, {
        userName,
        oldEmail,
        newEmail,
        changeTime,
        userAgent,
        ipAddress
      });

      // 发送成功邮件到新邮箱
      const result = await emailService.sendEmail({
        to: newEmail,
        subject: '邮箱变更成功 - ChatTOEIC',
        template: successTemplate
      });

      if (result.success) {
        console.log('📧 Email change success notification sent:', {
          oldEmail,
          newEmail,
          emailId: result.id
        });
      }

      return {
        success: result.success,
        emailId: result.id,
        error: result.error
      };

    } catch (error: any) {
      console.error('❌ Failed to send email change success notification:', error);
      return {
        success: false,
        error: error.message || 'unknown_error'
      };
    }
  }

  /**
   * 取消邮箱变更请求
   */
  async cancelEmailChangeRequest(
    userId: string,
    newEmail?: string
  ): Promise<{ success: boolean; cancelledCount: number }> {
    try {
      return await emailChangeService.cancelEmailChangeRequest(userId, newEmail);
    } catch (error: any) {
      console.error('❌ Failed to cancel email change request:', error);
      return {
        success: false,
        cancelledCount: 0
      };
    }
  }

  /**
   * 获取用户的邮箱变更请求状态
   */
  getUserEmailChangeStatus(userId: string) {
    return emailChangeService.getUserEmailChangeRequests(userId);
  }

  /**
   * 检查邮箱是否已被其他用户请求使用
   */
  isEmailBeingUsed(newEmail: string, excludeUserId?: string): boolean {
    return emailChangeService.isEmailBeingUsed(newEmail, excludeUserId);
  }

  /**
   * 获取邮箱变更请求统计信息
   */
  getEmailChangeStats() {
    return emailChangeService.getRequestStats();
  }
}

// 创建单例实例
export const authEmailService = new AuthEmailService();