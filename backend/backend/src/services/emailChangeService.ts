/**
 * 邮箱变更管理服务
 * 处理邮箱变更的验证码生成、验证和状态管理
 */

// 邮箱变更请求信息
interface EmailChangeRequest {
  userId: string;
  oldEmail: string;
  newEmail: string;
  verificationCode: string;
  expiresAt: Date;
  createdAt: Date;
  userAgent?: string;
  ipAddress?: string;
  verified: boolean;
  cancelled: boolean;
}

export class EmailChangeService {
  private requests: Map<string, EmailChangeRequest> = new Map();
  private readonly EXPIRY_MINUTES = 15;
  private readonly MAX_REQUESTS_PER_USER = 3;

  /**
   * 生成6位数字验证码
   */
  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * 生成请求键
   */
  private generateRequestKey(userId: string, newEmail: string): string {
    return `${userId}:${newEmail}`;
  }

  /**
   * 创建邮箱变更请求
   */
  async createEmailChangeRequest(
    userId: string,
    oldEmail: string,
    newEmail: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<{ success: boolean; verificationCode?: string; error?: string }> {
    try {
      // 检查新邮箱格式
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newEmail)) {
        return {
          success: false,
          error: 'invalid_email_format'
        };
      }

      // 检查是否与当前邮箱相同
      if (oldEmail.toLowerCase() === newEmail.toLowerCase()) {
        return {
          success: false,
          error: 'same_email'
        };
      }

      // 清理该用户的过期请求
      this.cleanupRequestsForUser(userId);

      // 检查该用户的活跃请求数量
      const activeRequests = Array.from(this.requests.values())
        .filter(req => 
          req.userId === userId && 
          !req.verified && 
          !req.cancelled && 
          new Date() < req.expiresAt
        );

      if (activeRequests.length >= this.MAX_REQUESTS_PER_USER) {
        return {
          success: false,
          error: 'too_many_requests'
        };
      }

      // 检查是否已有相同的变更请求
      const requestKey = this.generateRequestKey(userId, newEmail);
      const existingRequest = this.requests.get(requestKey);

      if (existingRequest && !existingRequest.verified && !existingRequest.cancelled && new Date() < existingRequest.expiresAt) {
        // 如果5分钟内，不允许重复创建
        if (existingRequest.createdAt.getTime() > Date.now() - 5 * 60 * 1000) {
          return {
            success: false,
            error: 'request_too_frequent'
          };
        }
      }

      const verificationCode = this.generateVerificationCode();

      const changeRequest: EmailChangeRequest = {
        userId,
        oldEmail,
        newEmail,
        verificationCode,
        expiresAt: new Date(Date.now() + this.EXPIRY_MINUTES * 60 * 1000),
        createdAt: new Date(),
        userAgent,
        ipAddress,
        verified: false,
        cancelled: false
      };

      this.requests.set(requestKey, changeRequest);

      console.log('📧 Email change request created:', {
        userId,
        oldEmail,
        newEmail,
        verificationCode: verificationCode.substring(0, 3) + '***',
        expiresAt: changeRequest.expiresAt
      });

      return {
        success: true,
        verificationCode
      };

    } catch (error: any) {
      console.error('❌ Failed to create email change request:', error);
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
  ): Promise<{ success: boolean; request?: EmailChangeRequest; error?: string }> {
    try {
      const requestKey = this.generateRequestKey(userId, newEmail);
      const request = this.requests.get(requestKey);

      if (!request) {
        return {
          success: false,
          error: 'request_not_found'
        };
      }

      // 检查是否过期
      if (new Date() > request.expiresAt) {
        this.requests.delete(requestKey);
        return {
          success: false,
          error: 'request_expired'
        };
      }

      // 检查是否已验证或取消
      if (request.verified) {
        return {
          success: false,
          error: 'already_verified'
        };
      }

      if (request.cancelled) {
        return {
          success: false,
          error: 'request_cancelled'
        };
      }

      // 验证验证码
      if (request.verificationCode !== code) {
        return {
          success: false,
          error: 'invalid_verification_code'
        };
      }

      // 标记为已验证
      request.verified = true;

      console.log('✅ Email change request verified:', {
        userId,
        oldEmail: request.oldEmail,
        newEmail: request.newEmail
      });

      return {
        success: true,
        request
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
   * 取消邮箱变更请求
   */
  async cancelEmailChangeRequest(
    userId: string,
    newEmail?: string
  ): Promise<{ success: boolean; cancelledCount: number }> {
    try {
      let cancelledCount = 0;

      if (newEmail) {
        // 取消特定的请求
        const requestKey = this.generateRequestKey(userId, newEmail);
        const request = this.requests.get(requestKey);

        if (request && !request.verified && !request.cancelled) {
          request.cancelled = true;
          cancelledCount = 1;
        }
      } else {
        // 取消用户的所有活跃请求
        for (const request of this.requests.values()) {
          if (request.userId === userId && !request.verified && !request.cancelled) {
            request.cancelled = true;
            cancelledCount++;
          }
        }
      }

      if (cancelledCount > 0) {
        console.log(`🚫 Email change request(s) cancelled:`, {
          userId,
          newEmail,
          cancelledCount
        });
      }

      return {
        success: true,
        cancelledCount
      };

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
  getUserEmailChangeRequests(userId: string): {
    active: EmailChangeRequest[];
    total: number;
  } {
    const now = new Date();
    const userRequests = Array.from(this.requests.values())
      .filter(req => req.userId === userId);

    const active = userRequests.filter(req => 
      !req.verified && 
      !req.cancelled && 
      now < req.expiresAt
    );

    return {
      active,
      total: userRequests.length
    };
  }

  /**
   * 检查邮箱是否已被其他用户请求使用
   */
  isEmailBeingUsed(newEmail: string, excludeUserId?: string): boolean {
    const now = new Date();
    
    for (const request of this.requests.values()) {
      if (request.newEmail.toLowerCase() === newEmail.toLowerCase() &&
          request.userId !== excludeUserId &&
          !request.cancelled &&
          !request.verified &&
          now < request.expiresAt) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * 清理指定用户的过期请求
   */
  private cleanupRequestsForUser(userId: string): number {
    const now = new Date();
    let cleanedCount = 0;

    for (const [key, request] of this.requests.entries()) {
      if (request.userId === userId && 
          (now > request.expiresAt || request.verified || request.cancelled)) {
        this.requests.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} email change requests for user: ${userId}`);
    }

    return cleanedCount;
  }

  /**
   * 清理所有过期的请求
   */
  async cleanupExpiredRequests(): Promise<number> {
    const now = new Date();
    let cleanedCount = 0;

    for (const [key, request] of this.requests.entries()) {
      if (now > request.expiresAt || request.verified || request.cancelled) {
        this.requests.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} expired email change requests`);
    }

    return cleanedCount;
  }

  /**
   * 获取邮箱变更请求统计信息
   */
  getRequestStats(): {
    total: number;
    active: number;
    expired: number;
    verified: number;
    cancelled: number;
  } {
    const now = new Date();
    let active = 0;
    let expired = 0;
    let verified = 0;
    let cancelled = 0;

    for (const request of this.requests.values()) {
      if (request.verified) {
        verified++;
      } else if (request.cancelled) {
        cancelled++;
      } else if (now > request.expiresAt) {
        expired++;
      } else {
        active++;
      }
    }

    return {
      total: this.requests.size,
      active,
      expired,
      verified,
      cancelled
    };
  }
}

// 创建单例实例
export const emailChangeService = new EmailChangeService();

// 设置定时清理过期请求（每10分钟清理一次）
setInterval(() => {
  emailChangeService.cleanupExpiredRequests();
}, 10 * 60 * 1000);