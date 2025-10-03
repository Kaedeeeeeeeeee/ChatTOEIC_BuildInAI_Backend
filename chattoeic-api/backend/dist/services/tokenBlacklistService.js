/**
 * JWT令牌黑名单服务
 * 用于在用户被封禁时立即使其会话失效
 */
import { prisma } from '../utils/database.js';
export class TokenBlacklistService {
    /**
     * 将用户的所有令牌加入黑名单（封禁时调用）
     */
    static async blacklistUserTokens(userId, reason = 'USER_BANNED') {
        try {
            // 为简单起见，我们记录被封禁用户的ID和时间
            // 实际实现中可以存储具体的JWT ID
            await prisma.$executeRaw `
        INSERT INTO "token_blacklist" (id, "userId", "tokenId", reason, "expiresAt", "createdAt")
        VALUES (
          gen_random_uuid(),
          ${userId},
          'ALL_TOKENS',
          ${reason},
          NOW() + INTERVAL '7 days',
          NOW()
        )
        ON CONFLICT DO NOTHING
      `;
            console.log(`✅ 用户 ${userId} 的所有令牌已加入黑名单`);
        }
        catch (error) {
            console.error('❌ 加入令牌黑名单失败:', error);
        }
    }
    /**
     * 从黑名单中移除用户令牌（解封时调用）
     */
    static async removeUserFromBlacklist(userId) {
        try {
            await prisma.$executeRaw `
        DELETE FROM "token_blacklist" 
        WHERE "userId" = ${userId}
      `;
            console.log(`✅ 用户 ${userId} 已从令牌黑名单中移除`);
        }
        catch (error) {
            console.error('❌ 移除令牌黑名单失败:', error);
        }
    }
    /**
     * 检查用户令牌是否在黑名单中
     */
    static async isTokenBlacklisted(userId) {
        try {
            const result = await prisma.$queryRaw `
        SELECT COUNT(*) as count
        FROM "token_blacklist" 
        WHERE "userId" = ${userId}
        AND "expiresAt" > NOW()
      `;
            const count = Number(result[0]?.count || 0);
            return count > 0;
        }
        catch (error) {
            console.error('❌ 检查令牌黑名单失败:', error);
            return false; // 出错时默认不阻止（保证服务可用性）
        }
    }
    /**
     * 清理过期的黑名单记录
     */
    static async cleanupExpiredTokens() {
        try {
            const result = await prisma.$executeRaw `
        DELETE FROM "token_blacklist" 
        WHERE "expiresAt" < NOW()
      `;
            console.log(`✅ 清理了过期的黑名单令牌记录`);
        }
        catch (error) {
            console.error('❌ 清理过期令牌黑名单失败:', error);
        }
    }
}
// 定期清理过期令牌（每小时执行一次）
setInterval(() => {
    TokenBlacklistService.cleanupExpiredTokens();
}, 60 * 60 * 1000); // 1小时
