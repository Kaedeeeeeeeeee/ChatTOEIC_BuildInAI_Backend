/**
 * 用户管理API路由
 * 提供管理员用户管理功能
 */
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { prisma } from '../utils/database.js';
import { log } from '../utils/logger.js';
import { TokenBlacklistService } from '../services/tokenBlacklistService.js';
const router = Router();
// 管理员权限检查中间件
const requireAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'ADMIN') {
        return res.status(403).json({
            success: false,
            error: '需要管理员权限'
        });
    }
    next();
};
// 获取用户列表（分页、搜索、筛选）
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const role = req.query.role;
        const sortBy = req.query.sortBy || 'createdAt';
        const sortOrder = req.query.sortOrder || 'desc';
        const skip = (page - 1) * limit;
        // 构建查询条件
        const whereClause = {};
        if (search) {
            whereClause.OR = [
                { email: { contains: search, mode: 'insensitive' } },
                { name: { contains: search, mode: 'insensitive' } }
            ];
        }
        if (role && role !== 'ALL') {
            whereClause.role = role;
        }
        // 获取用户列表和总数
        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where: whereClause,
                select: {
                    id: true,
                    email: true,
                    name: true,
                    avatar: true,
                    role: true,
                    emailVerified: true,
                    isActive: true, // 新增字段
                    preferredLanguage: true,
                    createdAt: true,
                    lastLoginAt: true,
                    _count: {
                        select: {
                            practiceRecords: true,
                            vocabularyItems: true,
                            chatSessions: true
                        }
                    }
                },
                orderBy: { [sortBy]: sortOrder },
                skip,
                take: limit
            }),
            prisma.user.count({ where: whereClause })
        ]);
        // 计算用户统计数据
        const usersWithStats = users.map(user => ({
            ...user,
            stats: {
                practiceCount: user._count.practiceRecords,
                vocabularyCount: user._count.vocabularyItems,
                chatSessionCount: user._count.chatSessions,
                isActive: user.lastLoginAt ?
                    (new Date().getTime() - new Date(user.lastLoginAt).getTime()) < (7 * 24 * 60 * 60 * 1000) : false
            }
        }));
        res.json({
            success: true,
            data: {
                users: usersWithStats,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            }
        });
    }
    catch (error) {
        log.error('Failed to get users list', { error });
        res.status(500).json({
            success: false,
            error: '获取用户列表失败'
        });
    }
});
// 获取单个用户详细信息
router.get('/:userId', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                practiceRecords: {
                    select: {
                        id: true,
                        questionType: true,
                        difficulty: true,
                        questionsCount: true,
                        correctAnswers: true,
                        score: true,
                        completedAt: true
                    },
                    orderBy: { completedAt: 'desc' },
                    take: 10
                },
                vocabularyItems: {
                    select: {
                        id: true,
                        word: true,
                        mastered: true,
                        addedAt: true,
                        reviewCount: true
                    },
                    orderBy: { addedAt: 'desc' },
                    take: 10
                },
                chatSessions: {
                    select: {
                        id: true,
                        title: true,
                        createdAt: true,
                        _count: {
                            select: { messages: true }
                        }
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 5
                }
            }
        });
        if (!user) {
            return res.status(404).json({
                success: false,
                error: '用户不存在'
            });
        }
        // 计算用户学习统计
        const [totalPracticeTime, averageScore, masteredWords, totalApiUsage] = await Promise.all([
            prisma.practiceRecord.aggregate({
                where: { userId },
                _sum: { totalTime: true }
            }),
            prisma.practiceRecord.aggregate({
                where: { userId },
                _avg: { score: true }
            }),
            prisma.vocabularyItem.count({
                where: { userId, mastered: true }
            }),
            prisma.aPIUsage.count({
                where: { userId }
            })
        ]);
        // 移除密码字段
        const { password, ...userInfo } = user;
        res.json({
            success: true,
            data: {
                ...userInfo,
                stats: {
                    totalPracticeTime: totalPracticeTime._sum.totalTime || 0,
                    averageScore: Math.round(averageScore._avg.score || 0),
                    masteredWords,
                    totalApiUsage,
                    isActive: user.lastLoginAt ?
                        (new Date().getTime() - new Date(user.lastLoginAt).getTime()) < (7 * 24 * 60 * 60 * 1000) : false
                }
            }
        });
    }
    catch (error) {
        log.error('Failed to get user details', { error, userId: req.params.userId });
        res.status(500).json({
            success: false,
            error: '获取用户详情失败'
        });
    }
});
// 更新用户状态（启用/禁用账户）
router.patch('/:userId/status', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { enabled } = req.body;
        // 不允许禁用自己的账户
        if (userId === req.user.userId) {
            return res.status(400).json({
                success: false,
                error: '不能禁用自己的账户'
            });
        }
        // 更新用户状态（通过emailVerified字段模拟启用/禁用状态）
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { emailVerified: enabled },
            select: {
                id: true,
                email: true,
                name: true,
                emailVerified: true
            }
        });
        // 记录管理操作日志
        log.info('Admin user status update', {
            adminId: req.user.userId,
            adminEmail: req.user.email,
            targetUserId: userId,
            targetUserEmail: updatedUser.email,
            action: enabled ? 'enable' : 'disable',
            timestamp: new Date().toISOString()
        });
        res.json({
            success: true,
            data: updatedUser,
            message: `用户账户已${enabled ? '启用' : '禁用'}`
        });
    }
    catch (error) {
        log.error('Failed to update user status', { error, userId: req.params.userId });
        res.status(500).json({
            success: false,
            error: '更新用户状态失败'
        });
    }
});
// 更新用户活跃状态（新的封禁/解封功能）
router.patch('/:userId/active-status', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { isActive } = req.body;
        // 不允许禁用自己的账户
        if (userId === req.user.userId) {
            return res.status(400).json({
                success: false,
                error: '不能禁用自己的账户'
            });
        }
        // 更新用户活跃状态
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { isActive },
            select: {
                id: true,
                email: true,
                name: true,
                isActive: true
            }
        });
        // 处理令牌黑名单
        if (isActive) {
            // 解封：从黑名单中移除用户令牌
            await TokenBlacklistService.removeUserFromBlacklist(userId);
        }
        else {
            // 封禁：将用户所有令牌加入黑名单
            await TokenBlacklistService.blacklistUserTokens(userId, 'ADMIN_BAN');
        }
        // 记录管理操作日志
        log.info('Admin user active status update', {
            adminId: req.user.userId,
            adminEmail: req.user.email,
            targetUserId: userId,
            targetUserEmail: updatedUser.email,
            action: isActive ? 'activate' : 'ban',
            timestamp: new Date().toISOString()
        });
        res.json({
            success: true,
            data: updatedUser,
            message: `用户账户已${isActive ? '激活' : '封禁'}`
        });
    }
    catch (error) {
        log.error('Failed to update user active status', { error, userId: req.params.userId });
        res.status(500).json({
            success: false,
            error: '更新用户状态失败'
        });
    }
});
// 更新用户角色
router.patch('/:userId/role', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { role } = req.body;
        // 不允许修改自己的角色
        if (userId === req.user.userId) {
            return res.status(400).json({
                success: false,
                error: '不能修改自己的角色'
            });
        }
        // 验证角色值
        if (!['USER', 'ADMIN'].includes(role)) {
            return res.status(400).json({
                success: false,
                error: '无效的角色类型'
            });
        }
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { role },
            select: {
                id: true,
                email: true,
                name: true,
                role: true
            }
        });
        // 记录管理操作日志
        log.info('Admin user role update', {
            adminId: req.user.userId,
            adminEmail: req.user.email,
            targetUserId: userId,
            targetUserEmail: updatedUser.email,
            newRole: role,
            timestamp: new Date().toISOString()
        });
        res.json({
            success: true,
            data: updatedUser,
            message: `用户角色已更新为${role === 'ADMIN' ? '管理员' : '普通用户'}`
        });
    }
    catch (error) {
        log.error('Failed to update user role', { error, userId: req.params.userId });
        res.status(500).json({
            success: false,
            error: '更新用户角色失败'
        });
    }
});
// 删除用户（软删除 - 实际上是禁用账户）
router.delete('/:userId', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        // 不允许删除自己的账户
        if (userId === req.user.userId) {
            return res.status(400).json({
                success: false,
                error: '不能删除自己的账户'
            });
        }
        // 软删除：禁用账户而不是真正删除
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                emailVerified: false,
                // 可以添加deletedAt字段来标记删除时间
            },
            select: {
                id: true,
                email: true,
                name: true
            }
        });
        // 记录管理操作日志
        log.info('Admin user deletion (soft)', {
            adminId: req.user.userId,
            adminEmail: req.user.email,
            targetUserId: userId,
            targetUserEmail: updatedUser.email,
            timestamp: new Date().toISOString()
        });
        res.json({
            success: true,
            message: '用户账户已禁用'
        });
    }
    catch (error) {
        log.error('Failed to delete user', { error, userId: req.params.userId });
        res.status(500).json({
            success: false,
            error: '删除用户失败'
        });
    }
});
// 获取用户概览统计
router.get('/stats/overview', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [totalUsers, activeUsers, adminUsers, verifiedUsers, recentUsers] = await Promise.all([
            prisma.user.count(),
            prisma.user.count({
                where: {
                    lastLoginAt: {
                        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7天内活跃
                    }
                }
            }),
            prisma.user.count({ where: { role: 'ADMIN' } }),
            prisma.user.count({ where: { emailVerified: true } }),
            prisma.user.count({
                where: {
                    createdAt: {
                        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7天内注册
                    }
                }
            })
        ]);
        res.json({
            success: true,
            data: {
                totalUsers,
                activeUsers,
                adminUsers,
                verifiedUsers,
                recentUsers,
                inactiveUsers: totalUsers - activeUsers,
                unverifiedUsers: totalUsers - verifiedUsers
            }
        });
    }
    catch (error) {
        log.error('Failed to get user stats overview', { error });
        res.status(500).json({
            success: false,
            error: '获取用户统计概览失败'
        });
    }
});
export default router;
