import { prisma } from '../utils/database.js';
import logger from '../utils/logger.js';

interface VerificationCode {
  id: string;
  email: string;
  code: string;
  type: 'register' | 'reset';
  expiresAt: Date;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
}

class VerificationCodeService {
  // 生成6位数字验证码
  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // 创建或更新验证码
  async createVerificationCode(email: string, type: 'register' | 'reset' = 'register'): Promise<string> {
    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5分钟过期
    const maxAttempts = 5; // 最大尝试次数

    try {
      // 删除该邮箱之前的验证码
      await prisma.verificationCode.deleteMany({
        where: {
          email,
          type
        }
      });

      // 创建新的验证码
      await prisma.verificationCode.create({
        data: {
          email,
          code,
          type,
          expiresAt,
          attempts: 0,
          maxAttempts
        }
      });

      logger.info('Verification code created', {
        email,
        type,
        expiresAt: expiresAt.toISOString()
      });

      return code;
    } catch (error) {
      logger.error('Failed to create verification code', {
        error: error.message,
        email,
        type
      });
      throw new Error('验证码创建失败');
    }
  }

  // 验证验证码
  async verifyCode(email: string, code: string, type: 'register' | 'reset' = 'register'): Promise<boolean> {
    try {
      // 查找验证码
      const verificationRecord = await prisma.verificationCode.findFirst({
        where: {
          email,
          type
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      if (!verificationRecord) {
        logger.warn('Verification code not found', { email, type });
        return false;
      }

      // 检查是否过期
      if (new Date() > verificationRecord.expiresAt) {
        logger.warn('Verification code expired', {
          email,
          type,
          expiresAt: verificationRecord.expiresAt
        });
        // 删除过期的验证码
        await this.cleanupExpiredCodes();
        return false;
      }

      // 检查尝试次数
      if (verificationRecord.attempts >= verificationRecord.maxAttempts) {
        logger.warn('Max verification attempts exceeded', {
          email,
          type,
          attempts: verificationRecord.attempts,
          maxAttempts: verificationRecord.maxAttempts
        });
        return false;
      }

      // 增加尝试次数
      await prisma.verificationCode.update({
        where: {
          id: verificationRecord.id
        },
        data: {
          attempts: {
            increment: 1
          }
        }
      });

      // 验证验证码
      const isValid = verificationRecord.code === code;

      if (isValid) {
        // 验证成功，删除验证码
        await prisma.verificationCode.delete({
          where: {
            id: verificationRecord.id
          }
        });

        logger.info('Verification code verified successfully', {
          email,
          type
        });
      } else {
        logger.warn('Invalid verification code', {
          email,
          type,
          attempts: verificationRecord.attempts + 1
        });
      }

      return isValid;
    } catch (error) {
      logger.error('Failed to verify code', {
        error: error.message,
        email,
        type
      });
      throw new Error('验证码验证失败');
    }
  }

  // 检查验证码发送频率限制（60秒内最多发送1次）
  async canSendCode(email: string, type: 'register' | 'reset' = 'register'): Promise<{ canSend: boolean; remainingTime?: number }> {
    try {
      const latestCode = await prisma.verificationCode.findFirst({
        where: {
          email,
          type
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      if (!latestCode) {
        return { canSend: true };
      }

      const now = new Date();
      const timeSinceLastSend = now.getTime() - latestCode.createdAt.getTime();
      const cooldownPeriod = 60 * 1000; // 60秒

      if (timeSinceLastSend < cooldownPeriod) {
        const remainingTime = Math.ceil((cooldownPeriod - timeSinceLastSend) / 1000);
        return {
          canSend: false,
          remainingTime
        };
      }

      return { canSend: true };
    } catch (error) {
      logger.error('Failed to check send rate limit', {
        error: error.message,
        email,
        type
      });
      // 如果出错，允许发送
      return { canSend: true };
    }
  }

  // 清理过期的验证码
  async cleanupExpiredCodes(): Promise<void> {
    try {
      const result = await prisma.verificationCode.deleteMany({
        where: {
          expiresAt: {
            lt: new Date()
          }
        }
      });

      logger.info('Expired verification codes cleaned up', {
        count: result.count
      });
    } catch (error) {
      logger.error('Failed to cleanup expired codes', {
        error: error.message
      });
    }
  }

  // 获取验证码统计信息（用于监控）
  async getCodeStats(): Promise<{
    total: number;
    expired: number;
    active: number;
  }> {
    try {
      const now = new Date();
      
      const [total, expired] = await Promise.all([
        prisma.verificationCode.count(),
        prisma.verificationCode.count({
          where: {
            expiresAt: {
              lt: now
            }
          }
        })
      ]);

      return {
        total,
        expired,
        active: total - expired
      };
    } catch (error) {
      logger.error('Failed to get code stats', {
        error: error.message
      });
      return {
        total: 0,
        expired: 0,
        active: 0
      };
    }
  }
}

export const verificationCodeService = new VerificationCodeService();