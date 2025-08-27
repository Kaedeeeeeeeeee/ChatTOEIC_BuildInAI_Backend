import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/database.js';
import { validateRequest, schemas } from '../middleware/validation.js';
import { authRateLimit } from '../middleware/rateLimiting.js';
import { authenticateToken } from '../middleware/auth.js';
const router = Router();
// 应用认证速率限制
router.use(authRateLimit);
// 用户注册
router.post('/register', validateRequest({ body: schemas.userRegister }), async (req, res) => {
    try {
        const { email, password, name } = req.body;
        // 检查用户是否已存在
        const existingUser = await prisma.user.findUnique({
            where: { email }
        });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: '该邮箱已被注册'
            });
        }
        // 加密密码
        const hashedPassword = await bcrypt.hash(password, 12);
        // 创建用户
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                settings: {
                    preferredLanguage: 'zh',
                    theme: 'light',
                    notifications: true
                }
            },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                createdAt: true
            }
        });
        // 生成令牌
        const tokens = generateTokens({
            userId: user.id,
            email: user.email,
            role: user.role
        });
        res.status(201).json({
            success: true,
            data: {
                user,
                ...tokens
            },
            message: '注册成功'
        });
    }
    catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            error: '注册失败，请稍后重试'
        });
    }
});
// 用户登录
router.post('/login', validateRequest({ body: schemas.userLogin }), async (req, res) => {
    try {
        const { email, password } = req.body;
        // 查找用户
        const user = await prisma.user.findUnique({
            where: { email }
        });
        if (!user || !user.password) {
            return res.status(401).json({
                success: false,
                error: '邮箱或密码错误'
            });
        }
        // 验证密码
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({
                success: false,
                error: '邮箱或密码错误'
            });
        }
        // 生成令牌
        const tokens = generateTokens({
            userId: user.id,
            email: user.email,
            role: user.role
        });
        // 返回用户信息（不包括密码）
        const { password: _, ...userInfo } = user;
        res.json({
            success: true,
            data: {
                user: userInfo,
                ...tokens
            },
            message: '登录成功'
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: '登录失败，请稍后重试'
        });
    }
});
// 刷新令牌
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(401).json({
                success: false,
                error: '刷新令牌是必需的'
            });
        }
        // 验证刷新令牌
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        // 查找用户确保仍然存在
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId }
        });
        if (!user) {
            return res.status(401).json({
                success: false,
                error: '用户不存在'
            });
        }
        // 生成新的令牌
        const tokens = generateTokens({
            userId: user.id,
            email: user.email,
            role: user.role
        });
        res.json({
            success: true,
            data: tokens,
            message: '令牌刷新成功'
        });
    }
    catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            return res.status(401).json({
                success: false,
                error: '刷新令牌已过期，请重新登录'
            });
        }
        console.error('Token refresh error:', error);
        res.status(401).json({
            success: false,
            error: '令牌刷新失败'
        });
    }
});
// 获取当前用户信息
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.userId },
            select: {
                id: true,
                email: true,
                name: true,
                avatar: true,
                role: true,
                settings: true,
                createdAt: true,
                updatedAt: true
            }
        });
        if (!user) {
            return res.status(404).json({
                success: false,
                error: '用户不存在'
            });
        }
        res.json({
            success: true,
            data: user
        });
    }
    catch (error) {
        console.error('Get user info error:', error);
        res.status(500).json({
            success: false,
            error: '获取用户信息失败'
        });
    }
});
// 更新用户信息
router.put('/me', authenticateToken, async (req, res) => {
    try {
        const { name, avatar, settings } = req.body;
        const updatedUser = await prisma.user.update({
            where: { id: req.user.userId },
            data: {
                ...(name && { name }),
                ...(avatar && { avatar }),
                ...(settings && { settings })
            },
            select: {
                id: true,
                email: true,
                name: true,
                avatar: true,
                role: true,
                settings: true,
                updatedAt: true
            }
        });
        res.json({
            success: true,
            data: updatedUser,
            message: '用户信息更新成功'
        });
    }
    catch (error) {
        console.error('Update user info error:', error);
        res.status(500).json({
            success: false,
            error: '更新用户信息失败'
        });
    }
});
// 退出登录
router.post('/logout', authenticateToken, async (req, res) => {
    // 在实际应用中，这里可以将令牌加入黑名单
    // 目前只是返回成功响应
    res.json({
        success: true,
        message: '退出登录成功'
    });
});
// 生成JWT令牌的辅助函数
function generateTokens(payload) {
    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
    return { accessToken, refreshToken };
}
export default router;
