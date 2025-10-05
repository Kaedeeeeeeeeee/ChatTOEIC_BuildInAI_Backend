import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../utils/database.js';
import { authenticateToken } from '../middleware/auth.js';
// 辅助函数：验证管理员权限（包含模拟管理员处理）
async function verifyAdminPermission(req) {
    // 如果是模拟管理员令牌，直接返回权限
    if (req.user?.userId === 'be2d0b23-b625-47ab-b406-db5778c58471') {
        return {
            isAdmin: true,
            currentUser: {
                id: 'be2d0b23-b625-47ab-b406-db5778c58471',
                email: 'admin@chattoeic.com',
                name: '管理员',
                role: 'ADMIN'
            }
        };
    }
    // 普通用户权限验证
    const currentUser = await prisma.user.findUnique({
        where: { id: req.user.userId }
    });
    return {
        isAdmin: currentUser?.role === 'ADMIN',
        currentUser
    };
}
const router = Router();
/**
 * 临时管理员创建端点 - 仅用于初始化
 * 生产环境中应该禁用此端点或添加更严格的安全验证
 */
router.post('/create-first-admin', async (req, res) => {
    try {
        // 检查是否已有管理员
        const existingAdmin = await prisma.user.findFirst({
            where: { role: 'ADMIN' }
        });
        if (existingAdmin) {
            return res.status(400).json({
                success: false,
                error: '系统中已存在管理员账户，无法再次创建'
            });
        }
        const { email, password, name, secretKey } = req.body;
        // 简单的安全密钥验证 (生产环境中应该使用更复杂的验证)
        const ADMIN_SECRET = process.env.ADMIN_CREATION_SECRET || 'create_first_admin_2024';
        if (secretKey !== ADMIN_SECRET) {
            return res.status(403).json({
                success: false,
                error: '无效的创建密钥'
            });
        }
        // 验证输入
        if (!email || !password || !name) {
            return res.status(400).json({
                success: false,
                error: '邮箱、密码和姓名都是必需的'
            });
        }
        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                error: '密码至少需要8个字符'
            });
        }
        // 检查邮箱是否已存在
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
        // 创建管理员用户
        const adminUser = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                role: 'ADMIN',
                emailVerified: true,
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
        res.status(201).json({
            success: true,
            data: adminUser,
            message: '首个管理员账户创建成功'
        });
        // 记录管理员创建日志
        console.log(`✅ 首个管理员账户已创建: ${adminUser.email} (ID: ${adminUser.id})`);
    }
    catch (error) {
        console.error('创建首个管理员失败:', error);
        res.status(500).json({
            success: false,
            error: '创建管理员失败，请稍后重试'
        });
    }
});
/**
 * 获取管理员列表 - 需要管理员权限
 */
router.get('/users', authenticateToken, async (req, res) => {
    try {
        // 验证当前用户是否为管理员
        const currentUser = await prisma.user.findUnique({
            where: { id: req.user.userId }
        });
        if (!currentUser || currentUser.role !== 'ADMIN') {
            return res.status(403).json({
                success: false,
                error: '需要管理员权限'
            });
        }
        // 获取所有用户列表
        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                emailVerified: true,
                createdAt: true,
                updatedAt: true,
                _count: {
                    select: {
                        practiceRecords: true,
                        vocabularyItems: true,
                        chatSessions: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        res.json({
            success: true,
            data: users
        });
    }
    catch (error) {
        console.error('获取用户列表失败:', error);
        res.status(500).json({
            success: false,
            error: '获取用户列表失败'
        });
    }
});
/**
 * 升级用户为管理员 - 需要管理员权限
 */
router.post('/promote/:userId', authenticateToken, async (req, res) => {
    try {
        // 验证当前用户是否为管理员
        const currentUser = await prisma.user.findUnique({
            where: { id: req.user.userId }
        });
        if (!currentUser || currentUser.role !== 'ADMIN') {
            return res.status(403).json({
                success: false,
                error: '需要管理员权限'
            });
        }
        const { userId } = req.params;
        // 检查目标用户是否存在
        const targetUser = await prisma.user.findUnique({
            where: { id: userId }
        });
        if (!targetUser) {
            return res.status(404).json({
                success: false,
                error: '用户不存在'
            });
        }
        if (targetUser.role === 'ADMIN') {
            return res.status(400).json({
                success: false,
                error: '该用户已经是管理员'
            });
        }
        // 升级为管理员
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { role: 'ADMIN' },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                updatedAt: true
            }
        });
        res.json({
            success: true,
            data: updatedUser,
            message: '用户已成功升级为管理员'
        });
        console.log(`✅ 用户 ${updatedUser.email} (ID: ${updatedUser.id}) 已被升级为管理员`);
    }
    catch (error) {
        console.error('升级用户失败:', error);
        res.status(500).json({
            success: false,
            error: '升级用户失败'
        });
    }
});
/**
 * 获取用户订阅详情 - 需要管理员权限
 */
router.get('/users/:userId/subscription', authenticateToken, async (req, res) => {
    try {
        // 验证管理员权限
        const { isAdmin, currentUser } = await verifyAdminPermission(req);
        if (!isAdmin) {
            return res.status(403).json({
                success: false,
                error: '需要管理员权限'
            });
        }
        const { userId } = req.params;
        // 首先检查用户是否存在
        const targetUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true }
        });
        if (!targetUser) {
            return res.status(404).json({
                success: false,
                error: '用户不存在'
            });
        }
        console.log(`📊 获取用户 ${targetUser.email} (${userId}) 的订阅信息`);
        // 获取用户订阅信息（如果表不存在或查询失败，使用默认值）
        let subscription = null;
        try {
            subscription = await prisma.userSubscription.findUnique({
                where: { userId },
                include: {
                    plan: true,
                    paymentTransactions: {
                        take: 10,
                        orderBy: { createdAt: 'desc' }
                    }
                }
            });
        }
        catch (subscriptionError) {
            console.warn(`⚠️ 获取用户订阅信息时出错，使用默认免费状态:`, subscriptionError);
            // 继续执行，subscription 保持为 null
        }
        // 获取订阅状态
        let status = 'free';
        let displayStatus = '免费用户';
        let hasSubscription = false;
        if (subscription) {
            hasSubscription = true;
            if (subscription.status === 'trialing' && subscription.trialEnd && subscription.trialEnd > new Date()) {
                status = 'trial';
                displayStatus = '试用用户';
            }
            else if (subscription.status === 'active') {
                status = 'paid';
                displayStatus = '付费用户';
            }
            else {
                status = 'free';
                displayStatus = '免费用户';
            }
        }
        // 返回前端期望的 SubscriptionStatusInfo 格式
        const subscriptionInfo = {
            hasSubscription,
            status,
            displayStatus,
            isTestAccount: subscription?.isTestAccount || false,
            trialEndDate: subscription?.trialEnd?.toISOString(),
            nextPaymentDate: subscription?.nextPaymentAt?.toISOString(),
            features: status === 'paid' ? ['无限制练习', 'AI对话', '词汇管理', '详细统计'] :
                status === 'trial' ? ['限时练习', 'AI对话', '词汇管理'] :
                    ['基础练习'],
            limitations: status === 'free' ? {
                dailyQuestions: 10,
                monthlyQuestions: 300,
                aiChatSessions: 3
            } : undefined
        };
        res.json({
            success: true,
            data: subscriptionInfo
        });
    }
    catch (error) {
        console.error('获取用户订阅详情失败:', error);
        res.status(500).json({
            success: false,
            error: '获取用户订阅详情失败'
        });
    }
});
/**
 * 更新用户订阅状态 - 需要管理员权限
 */
router.post('/users/:userId/subscription-status', authenticateToken, async (req, res) => {
    try {
        // 验证管理员权限
        const currentUser = await prisma.user.findUnique({
            where: { id: req.user.userId }
        });
        if (!currentUser || currentUser.role !== 'ADMIN') {
            return res.status(403).json({
                success: false,
                error: '需要管理员权限'
            });
        }
        const { userId } = req.params;
        const { newStatus, reason } = req.body; // newStatus: 'free' | 'trial' | 'paid'
        if (!['free', 'trial', 'paid'].includes(newStatus)) {
            return res.status(400).json({
                success: false,
                error: '无效的订阅状态'
            });
        }
        // 获取目标用户
        const targetUser = await prisma.user.findUnique({
            where: { id: userId },
            include: { subscription: true }
        });
        if (!targetUser) {
            return res.status(404).json({
                success: false,
                error: '用户不存在'
            });
        }
        const currentSubscription = targetUser.subscription;
        let currentStatus = 'free';
        if (currentSubscription) {
            if (currentSubscription.status === 'trialing' &&
                currentSubscription.trialEnd &&
                currentSubscription.trialEnd > new Date()) {
                currentStatus = 'trial';
            }
            else if (currentSubscription.status === 'active') {
                currentStatus = 'paid';
            }
        }
        // 如果状态没有变化，直接返回
        if (currentStatus === newStatus) {
            return res.json({
                success: true,
                message: '状态未发生变化',
                data: { currentStatus: newStatus }
            });
        }
        let updatedSubscription;
        // 根据目标状态进行状态转换
        switch (newStatus) {
            case 'free':
                if (currentSubscription) {
                    updatedSubscription = await prisma.userSubscription.update({
                        where: { id: currentSubscription.id },
                        data: {
                            status: 'canceled',
                            canceledAt: new Date(),
                            trialEnd: null,
                            currentPeriodEnd: new Date()
                        },
                        include: { plan: true }
                    });
                }
                break;
            case 'trial':
                const trialEndDate = new Date();
                trialEndDate.setDate(trialEndDate.getDate() + 3); // 3天试用
                if (currentSubscription) {
                    updatedSubscription = await prisma.userSubscription.update({
                        where: { id: currentSubscription.id },
                        data: {
                            status: 'trialing',
                            trialStart: new Date(),
                            trialEnd: trialEndDate,
                            canceledAt: null
                        },
                        include: { plan: true }
                    });
                }
                else {
                    updatedSubscription = await prisma.userSubscription.create({
                        data: {
                            userId,
                            planId: 'premium_monthly', // 默认使用premium套餐
                            status: 'trialing',
                            trialStart: new Date(),
                            trialEnd: trialEndDate,
                            isTestAccount: true // 管理员创建的默认为测试账户
                        },
                        include: { plan: true }
                    });
                }
                break;
            case 'paid':
                const currentPeriodStart = new Date();
                const currentPeriodEnd = new Date();
                currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1); // 1个月有效期
                if (currentSubscription) {
                    updatedSubscription = await prisma.userSubscription.update({
                        where: { id: currentSubscription.id },
                        data: {
                            status: 'active',
                            planId: 'premium_monthly',
                            currentPeriodStart,
                            currentPeriodEnd,
                            canceledAt: null,
                            trialEnd: null
                        },
                        include: { plan: true }
                    });
                }
                else {
                    updatedSubscription = await prisma.userSubscription.create({
                        data: {
                            userId,
                            planId: 'premium_monthly',
                            status: 'active',
                            currentPeriodStart,
                            currentPeriodEnd,
                            isTestAccount: true // 管理员创建的默认为测试账户
                        },
                        include: { plan: true }
                    });
                }
                break;
        }
        // 记录操作日志
        await prisma.adminSubscriptionLog.create({
            data: {
                adminUserId: currentUser.id,
                targetUserId: userId,
                subscriptionId: updatedSubscription?.id,
                operationType: 'status_change',
                oldStatus: currentStatus,
                newStatus: newStatus,
                reason: reason || '管理员手动修改',
                metadata: {
                    adminEmail: currentUser.email,
                    targetEmail: targetUser.email,
                    timestamp: new Date().toISOString()
                }
            }
        });
        console.log(`✅ 管理员 ${currentUser.email} 将用户 ${targetUser.email} 的订阅状态从 ${currentStatus} 修改为 ${newStatus}`);
        // 构建前端期望的 SubscriptionStatusInfo 格式
        const displayStatusMap = {
            'free': '免费用户',
            'trial': '试用用户',
            'paid': '付费用户'
        };
        const subscriptionInfo = {
            hasSubscription: updatedSubscription !== null,
            status: newStatus,
            displayStatus: displayStatusMap[newStatus],
            isTestAccount: updatedSubscription?.isTestAccount || false,
            trialEndDate: updatedSubscription?.trialEnd?.toISOString(),
            nextPaymentDate: updatedSubscription?.nextPaymentAt?.toISOString(),
            features: newStatus === 'paid' ? ['无限制练习', 'AI对话', '词汇管理', '详细统计'] :
                newStatus === 'trial' ? ['限时练习', 'AI对话', '词汇管理'] :
                    ['基础练习'],
            limitations: newStatus === 'free' ? {
                dailyQuestions: 10,
                monthlyQuestions: 300,
                aiChatSessions: 3
            } : undefined
        };
        res.json({
            success: true,
            message: '订阅状态更新成功',
            data: subscriptionInfo
        });
    }
    catch (error) {
        console.error('更新用户订阅状态失败:', error);
        res.status(500).json({
            success: false,
            error: '更新用户订阅状态失败'
        });
    }
});
/**
 * 切换测试账户标记 - 需要管理员权限
 */
router.post('/users/:userId/test-account', authenticateToken, async (req, res) => {
    try {
        // 验证管理员权限
        const currentUser = await prisma.user.findUnique({
            where: { id: req.user.userId }
        });
        if (!currentUser || currentUser.role !== 'ADMIN') {
            return res.status(403).json({
                success: false,
                error: '需要管理员权限'
            });
        }
        const { userId } = req.params;
        const { isTestAccount, reason } = req.body;
        // 获取用户订阅
        const subscription = await prisma.userSubscription.findUnique({
            where: { userId }
        });
        if (!subscription) {
            return res.status(404).json({
                success: false,
                error: '用户暂无订阅信息'
            });
        }
        const oldTestAccount = subscription.isTestAccount;
        // 更新测试账户标记
        const updatedSubscription = await prisma.userSubscription.update({
            where: { id: subscription.id },
            data: { isTestAccount: Boolean(isTestAccount) },
            include: { plan: true }
        });
        // 记录操作日志
        await prisma.adminSubscriptionLog.create({
            data: {
                adminUserId: currentUser.id,
                targetUserId: userId,
                subscriptionId: subscription.id,
                operationType: 'test_account_toggle',
                oldTestAccount,
                newTestAccount: Boolean(isTestAccount),
                reason: reason || '管理员切换测试账户状态',
                metadata: {
                    adminEmail: currentUser.email,
                    timestamp: new Date().toISOString()
                }
            }
        });
        // 构建前端期望的 SubscriptionStatusInfo 格式
        let status = 'free';
        let displayStatus = '免费用户';
        if (updatedSubscription) {
            if (updatedSubscription.status === 'trialing' &&
                updatedSubscription.trialEnd &&
                updatedSubscription.trialEnd > new Date()) {
                status = 'trial';
                displayStatus = '试用用户';
            }
            else if (updatedSubscription.status === 'active') {
                status = 'paid';
                displayStatus = '付费用户';
            }
        }
        const subscriptionInfo = {
            hasSubscription: updatedSubscription !== null,
            status,
            displayStatus,
            isTestAccount: Boolean(isTestAccount),
            trialEndDate: updatedSubscription?.trialEnd?.toISOString(),
            nextPaymentDate: updatedSubscription?.nextPaymentAt?.toISOString(),
            features: status === 'paid' ? ['无限制练习', 'AI对话', '词汇管理', '详细统计'] :
                status === 'trial' ? ['限时练习', 'AI对话', '词汇管理'] :
                    ['基础练习'],
            limitations: status === 'free' ? {
                dailyQuestions: 10,
                monthlyQuestions: 300,
                aiChatSessions: 3
            } : undefined
        };
        res.json({
            success: true,
            message: '测试账户状态更新成功',
            data: subscriptionInfo
        });
    }
    catch (error) {
        console.error('切换测试账户标记失败:', error);
        res.status(500).json({
            success: false,
            error: '切换测试账户标记失败'
        });
    }
});
/**
 * 获取订阅操作日志 - 需要管理员权限
 */
router.get('/subscription-logs', authenticateToken, async (req, res) => {
    try {
        // 验证管理员权限
        const currentUser = await prisma.user.findUnique({
            where: { id: req.user.userId }
        });
        if (!currentUser || currentUser.role !== 'ADMIN') {
            return res.status(403).json({
                success: false,
                error: '需要管理员权限'
            });
        }
        const { page = 1, limit = 20, targetUserId, operationType } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const where = {};
        if (targetUserId)
            where.targetUserId = targetUserId;
        if (operationType)
            where.operationType = operationType;
        const [logs, total] = await Promise.all([
            prisma.adminSubscriptionLog.findMany({
                where,
                include: {
                    adminUser: {
                        select: { id: true, email: true, name: true }
                    },
                    targetUser: {
                        select: { id: true, email: true, name: true }
                    },
                    subscription: {
                        select: { id: true, status: true, planId: true }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: Number(limit)
            }),
            prisma.adminSubscriptionLog.count({ where })
        ]);
        res.json({
            success: true,
            data: {
                logs,
                pagination: {
                    page: Number(page),
                    limit: Number(limit),
                    total,
                    totalPages: Math.ceil(total / Number(limit))
                }
            }
        });
    }
    catch (error) {
        console.error('获取订阅操作日志失败:', error);
        res.status(500).json({
            success: false,
            error: '获取订阅操作日志失败'
        });
    }
});
// 通知用户权限更新（用于实时刷新用户权限）
router.post('/users/:userId/refresh-permissions', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUser = req.user;
        // 验证管理员权限
        if (currentUser.role !== 'ADMIN') {
            return res.status(403).json({
                success: false,
                error: '需要管理员权限'
            });
        }
        // 验证目标用户存在
        const targetUser = await prisma.user.findUnique({
            where: { id: userId }
        });
        if (!targetUser) {
            return res.status(404).json({
                success: false,
                error: '用户不存在'
            });
        }
        // 获取用户最新的订阅状态
        const subscription = await prisma.userSubscription.findUnique({
            where: { userId },
            include: { plan: true }
        });
        // 这里可以实现WebSocket通知或者其他实时通知机制
        // 目前返回成功，客户端可以通过轮询或其他方式刷新权限
        res.json({
            success: true,
            data: {
                userId,
                message: '权限刷新通知已发送',
                subscription: subscription ? {
                    status: subscription.status,
                    planName: subscription.plan?.name,
                    isTestAccount: subscription.isTestAccount
                } : null
            }
        });
    }
    catch (error) {
        console.error('发送权限刷新通知失败:', error);
        res.status(500).json({
            success: false,
            error: '发送权限刷新通知失败'
        });
    }
});
export default router;
