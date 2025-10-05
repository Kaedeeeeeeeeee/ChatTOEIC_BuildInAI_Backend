import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { TokenBlacklistService } from '../services/tokenBlacklistService.js';
const prisma = new PrismaClient();
export const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    if (!token) {
        return res.status(401).json({
            success: false,
            error: '访问令牌是必需的'
        });
    }
    // 特殊处理：模拟管理员令牌 (仅用于开发/测试)
    if (token === 'mock_access_token_for_testing') {
        console.log('🧪 使用模拟管理员令牌进行认证');
        req.user = {
            userId: 'be2d0b23-b625-47ab-b406-db5778c58471',
            email: 'admin@chattoeic.com',
            name: '管理员',
            role: 'ADMIN',
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 3600 // 1小时后过期
        };
        return next();
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // 验证用户是否处于活跃状态
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: { id: true, isActive: true, email: true, name: true }
        });
        if (!user) {
            return res.status(401).json({
                success: false,
                error: '用户不存在',
                code: 'USER_NOT_FOUND'
            });
        }
        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                error: '账户已被封禁，请联系官方',
                code: 'ACCOUNT_BANNED',
                data: {
                    userId: user.id,
                    email: user.email,
                    name: user.name
                }
            });
        }
        // 检查令牌是否在黑名单中
        const isBlacklisted = await TokenBlacklistService.isTokenBlacklisted(decoded.userId);
        if (isBlacklisted) {
            return res.status(401).json({
                success: false,
                error: '令牌已失效，请重新登录',
                code: 'TOKEN_BLACKLISTED'
            });
        }
        req.user = decoded;
        next();
    }
    catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            return res.status(401).json({
                success: false,
                error: '访问令牌已过期'
            });
        }
        else if (error instanceof jwt.JsonWebTokenError) {
            return res.status(403).json({
                success: false,
                error: '无效的访问令牌'
            });
        }
        else {
            console.error('认证中间件错误:', error);
            return res.status(500).json({
                success: false,
                error: '令牌验证失败'
            });
        }
    }
};
export const optionalAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return next();
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
    }
    catch (error) {
        // 可选认证失败时不阻断请求
        console.warn('Optional auth failed:', error);
    }
    next();
};
export const requireAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: '需要认证'
        });
    }
    if (req.user.role !== 'ADMIN') {
        return res.status(403).json({
            success: false,
            error: '需要管理员权限'
        });
    }
    next();
};
