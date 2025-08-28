/**
 * 密码重置令牌管理服务
 * 提供安全的令牌生成、验证和存储功能
 */

import crypto from 'crypto';
import bcrypt from 'bcryptjs';

// 重置令牌信息
interface ResetToken {
  token: string;
  hashedToken: string;
  email: string;
  userId?: string;
  expiresAt: Date;
  createdAt: Date;
  used: boolean;
  userAgent?: string;
  ipAddress?: string;
}

export class PasswordResetService {
  private tokens: Map<string, ResetToken> = new Map();
  private readonly TOKEN_EXPIRY_HOURS = 1;
  private readonly MAX_TOKENS_PER_EMAIL = 3;

  /**
   * 生成安全的重置令牌
   */
  generateResetToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * 创建密码重置令牌
   */
  async createResetToken(
    email: string,
    userId?: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<string> {
    // 清理该邮箱的旧令牌
    await this.cleanupTokensForEmail(email);

    // 检查该邮箱的令牌数量限制
    const existingTokens = Array.from(this.tokens.values())
      .filter(token => token.email === email && !token.used && new Date() < token.expiresAt);

    if (existingTokens.length >= this.MAX_TOKENS_PER_EMAIL) {
      throw new Error('too_many_reset_requests');
    }

    const token = this.generateResetToken();
    const hashedToken = await bcrypt.hash(token, 12);

    const resetToken: ResetToken = {
      token,
      hashedToken,
      email,
      userId,
      expiresAt: new Date(Date.now() + this.TOKEN_EXPIRY_HOURS * 60 * 60 * 1000),
      createdAt: new Date(),
      used: false,
      userAgent,
      ipAddress
    };

    // 使用token的前16位作为键，便于快速查找
    const tokenKey = token.substring(0, 16);
    this.tokens.set(tokenKey, resetToken);

    console.log('🔐 Password reset token created:', {
      tokenKey,
      email,
      userId,
      expiresAt: resetToken.expiresAt
    });

    return token;
  }

  /**
   * 验证重置令牌
   */
  async verifyResetToken(token: string): Promise<{
    success: boolean;
    email?: string;
    userId?: string;
    error?: string;
  }> {
    try {
      if (!token || token.length !== 64) {
        return {
          success: false,
          error: 'invalid_token_format'
        };
      }

      const tokenKey = token.substring(0, 16);
      const storedToken = this.tokens.get(tokenKey);

      if (!storedToken) {
        return {
          success: false,
          error: 'token_not_found'
        };
      }

      // 检查是否过期
      if (new Date() > storedToken.expiresAt) {
        this.tokens.delete(tokenKey);
        return {
          success: false,
          error: 'token_expired'
        };
      }

      // 检查是否已使用
      if (storedToken.used) {
        return {
          success: false,
          error: 'token_already_used'
        };
      }

      // 验证令牌哈希
      const isValid = await bcrypt.compare(token, storedToken.hashedToken);
      if (!isValid) {
        return {
          success: false,
          error: 'invalid_token'
        };
      }

      console.log('✅ Password reset token verified:', {
        tokenKey,
        email: storedToken.email,
        userId: storedToken.userId
      });

      return {
        success: true,
        email: storedToken.email,
        userId: storedToken.userId
      };

    } catch (error: any) {
      console.error('❌ Password reset token verification error:', error);
      return {
        success: false,
        error: 'verification_error'
      };
    }
  }

  /**
   * 标记令牌为已使用
   */
  async markTokenAsUsed(token: string): Promise<boolean> {
    try {
      const tokenKey = token.substring(0, 16);
      const storedToken = this.tokens.get(tokenKey);

      if (!storedToken) {
        return false;
      }

      storedToken.used = true;

      console.log('🔒 Password reset token marked as used:', {
        tokenKey,
        email: storedToken.email
      });

      return true;
    } catch (error) {
      console.error('❌ Error marking token as used:', error);
      return false;
    }
  }

  /**
   * 清理指定邮箱的所有令牌
   */
  async cleanupTokensForEmail(email: string): Promise<number> {
    let cleanedCount = 0;

    for (const [key, token] of this.tokens.entries()) {
      if (token.email === email) {
        this.tokens.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} reset tokens for email: ${email}`);
    }

    return cleanedCount;
  }

  /**
   * 清理过期的重置令牌
   */
  async cleanupExpiredTokens(): Promise<number> {
    const now = new Date();
    let cleanedCount = 0;

    for (const [key, token] of this.tokens.entries()) {
      if (now > token.expiresAt || token.used) {
        this.tokens.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} expired/used reset tokens`);
    }

    return cleanedCount;
  }

  /**
   * 获取令牌统计信息
   */
  getTokenStats(): {
    total: number;
    active: number;
    expired: number;
    used: number;
  } {
    const now = new Date();
    let active = 0;
    let expired = 0;
    let used = 0;

    for (const token of this.tokens.values()) {
      if (token.used) {
        used++;
      } else if (now > token.expiresAt) {
        expired++;
      } else {
        active++;
      }
    }

    return {
      total: this.tokens.size,
      active,
      expired,
      used
    };
  }

  /**
   * 检查邮箱是否有活跃的重置请求
   */
  hasActiveResetRequest(email: string): {
    hasActive: boolean;
    count: number;
    earliestExpiry?: Date;
  } {
    const now = new Date();
    const activeTokens = Array.from(this.tokens.values())
      .filter(token => 
        token.email === email && 
        !token.used && 
        now < token.expiresAt
      );

    const earliestExpiry = activeTokens.length > 0 
      ? new Date(Math.min(...activeTokens.map(t => t.expiresAt.getTime())))
      : undefined;

    return {
      hasActive: activeTokens.length > 0,
      count: activeTokens.length,
      earliestExpiry
    };
  }
}

// 创建单例实例
export const passwordResetService = new PasswordResetService();

// 设置定时清理过期令牌（每10分钟清理一次）
setInterval(() => {
  passwordResetService.cleanupExpiredTokens();
}, 10 * 60 * 1000);