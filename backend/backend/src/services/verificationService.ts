/**
 * 验证码管理服务
 */

import crypto from 'crypto';

// 验证码配置
interface VerificationConfig {
  type: 'email' | 'phone' | 'password_reset';
  email?: string;
  phone?: string;
  userId?: string;
  expiresInMinutes?: number;
}

// 验证码信息
interface VerificationCode {
  code: string;
  type: string;
  email?: string;
  phone?: string;
  userId?: string;
  expiresAt: Date;
  createdAt: Date;
  attempts: number;
  maxAttempts: number;
}

export class VerificationService {
  private codes: Map<string, VerificationCode> = new Map();
  private readonly DEFAULT_EXPIRY_MINUTES = 10;
  private readonly MAX_ATTEMPTS = 5;

  /**
   * 生成6位数字验证码
   */
  private generateCode(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * 生成验证码key
   */
  private generateKey(config: VerificationConfig): string {
    const identifier = config.email || config.phone || config.userId || 'unknown';
    return `${config.type}:${identifier}`;
  }

  /**
   * 创建验证码
   */
  createVerificationCode(config: VerificationConfig): string {
    const code = this.generateCode();
    const key = this.generateKey(config);
    const expiryMinutes = config.expiresInMinutes || this.DEFAULT_EXPIRY_MINUTES;

    // 删除旧的验证码（如果存在）
    this.codes.delete(key);

    const verificationCode: VerificationCode = {
      code,
      type: config.type,
      email: config.email,
      phone: config.phone,
      userId: config.userId,
      expiresAt: new Date(Date.now() + expiryMinutes * 60 * 1000),
      createdAt: new Date(),
      attempts: 0,
      maxAttempts: this.MAX_ATTEMPTS
    };

    this.codes.set(key, verificationCode);

    console.log('🔐 Verification code created:', {
      key,
      code,
      expiresAt: verificationCode.expiresAt,
      type: config.type
    });

    return code;
  }

  /**
   * 验证验证码
   */
  verifyCode(config: VerificationConfig, inputCode: string): {
    success: boolean;
    error?: string;
    remainingAttempts?: number;
  } {
    const key = this.generateKey(config);
    const storedCode = this.codes.get(key);

    if (!storedCode) {
      return {
        success: false,
        error: 'verification_code_not_found'
      };
    }

    // 检查是否过期
    if (new Date() > storedCode.expiresAt) {
      this.codes.delete(key);
      return {
        success: false,
        error: 'verification_code_expired'
      };
    }

    // 检查尝试次数
    if (storedCode.attempts >= storedCode.maxAttempts) {
      this.codes.delete(key);
      return {
        success: false,
        error: 'too_many_attempts'
      };
    }

    // 增加尝试次数
    storedCode.attempts++;

    // 验证码码
    if (inputCode !== storedCode.code) {
      return {
        success: false,
        error: 'invalid_verification_code',
        remainingAttempts: storedCode.maxAttempts - storedCode.attempts
      };
    }

    // 验证成功，删除验证码
    this.codes.delete(key);

    console.log('✅ Verification code verified successfully:', {
      key,
      type: config.type
    });

    return {
      success: true
    };
  }

  /**
   * 检查验证码是否存在且未过期
   */
  checkCodeExists(config: VerificationConfig): boolean {
    const key = this.generateKey(config);
    const storedCode = this.codes.get(key);

    if (!storedCode) {
      return false;
    }

    if (new Date() > storedCode.expiresAt) {
      this.codes.delete(key);
      return false;
    }

    return true;
  }

  /**
   * 删除验证码
   */
  removeCode(config: VerificationConfig): boolean {
    const key = this.generateKey(config);
    return this.codes.delete(key);
  }

  /**
   * 清理过期的验证码
   */
  cleanupExpiredCodes(): number {
    const now = new Date();
    let cleanedCount = 0;

    for (const [key, code] of this.codes.entries()) {
      if (now > code.expiresAt) {
        this.codes.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} expired verification codes`);
    }

    return cleanedCount;
  }

  /**
   * 获取当前验证码数量
   */
  getCodeCount(): number {
    return this.codes.size;
  }

  /**
   * 获取用户的验证码信息（不包含实际验证码）
   */
  getCodeInfo(config: VerificationConfig): {
    exists: boolean;
    expiresAt?: Date;
    remainingAttempts?: number;
  } {
    const key = this.generateKey(config);
    const storedCode = this.codes.get(key);

    if (!storedCode) {
      return { exists: false };
    }

    if (new Date() > storedCode.expiresAt) {
      this.codes.delete(key);
      return { exists: false };
    }

    return {
      exists: true,
      expiresAt: storedCode.expiresAt,
      remainingAttempts: storedCode.maxAttempts - storedCode.attempts
    };
  }
}

// 创建单例实例
export const verificationService = new VerificationService();

// 设置定时清理过期验证码（每5分钟清理一次）
setInterval(() => {
  verificationService.cleanupExpiredCodes();
}, 5 * 60 * 1000);