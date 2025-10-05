import { Router } from 'express';
import { prisma } from '../utils/database.js';
import { authenticateToken } from '../middleware/auth.js';
const router = Router();
/**
 * 初始化订阅数据库 - 修复所有订阅相关问题
 * 只允许管理员执行此操作
 */
router.post('/initialize-subscriptions', authenticateToken, async (req, res) => {
    try {
        console.log('🚀 API: 开始初始化订阅数据库...');
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
        const results = {
            plansCreated: 0,
            subscriptionsCreated: 0,
            errors: [],
            summary: {}
        };
        // ==================== 第一步：创建基础订阅计划 ====================
        console.log('📋 1. 创建基础订阅计划...');
        try {
            // 检查是否已存在订阅计划
            const existingPlans = await prisma.subscriptionPlan.findMany();
            console.log(`   现有订阅计划数量: ${existingPlans.length}`);
            if (existingPlans.length === 0) {
                console.log('   创建基础订阅计划...');
                // 创建基础订阅计划
                const planData = [
                    {
                        id: 'free',
                        name: '免费版',
                        nameJp: 'フリープラン',
                        priceCents: 0,
                        currency: 'jpy',
                        interval: 'month',
                        intervalCount: 1,
                        features: {
                            dailyQuestions: 10,
                            aiChatSessions: 3,
                            vocabularyWords: 100,
                            practiceHistory: true,
                            basicStats: true
                        },
                        dailyPracticeLimit: 10,
                        dailyAiChatLimit: 3,
                        maxVocabularyWords: 100,
                        isActive: true,
                        sortOrder: 1
                    },
                    {
                        id: 'trial',
                        name: '试用版',
                        nameJp: 'トライアル',
                        priceCents: 0,
                        currency: 'jpy',
                        interval: 'month',
                        intervalCount: 1,
                        features: {
                            dailyQuestions: 50,
                            aiChatSessions: 10,
                            vocabularyWords: 500,
                            practiceHistory: true,
                            detailedStats: true,
                            aiExplanations: true
                        },
                        dailyPracticeLimit: 50,
                        dailyAiChatLimit: 20,
                        maxVocabularyWords: 500,
                        isActive: true,
                        sortOrder: 2
                    },
                    {
                        id: 'premium_monthly',
                        name: 'Premium月费版',
                        nameJp: 'プレミアム月額',
                        priceCents: 99800, // 998日元
                        currency: 'jpy',
                        interval: 'month',
                        intervalCount: 1,
                        stripePriceId: 'price_1Rymu42IgNyaWiWliQimHPBs',
                        stripeProductId: 'prod_Suc82nR87bh9hA',
                        features: {
                            unlimitedQuestions: true,
                            unlimitedAiChat: true,
                            unlimitedVocabulary: true,
                            practiceHistory: true,
                            detailedStats: true,
                            aiExplanations: true,
                            exportData: true,
                            prioritySupport: true
                        },
                        dailyPracticeLimit: null,
                        dailyAiChatLimit: null,
                        maxVocabularyWords: null,
                        isActive: true,
                        sortOrder: 3
                    }
                ];
                // 逐个创建计划（避免并发问题）
                for (const plan of planData) {
                    try {
                        await prisma.subscriptionPlan.create({ data: plan });
                        results.plansCreated++;
                        console.log(`   ✅ 创建订阅计划: ${plan.name}`);
                    }
                    catch (planError) {
                        if (planError.code === 'P2002') {
                            console.log(`   ⏭️  订阅计划 ${plan.name} 已存在，跳过`);
                        }
                        else {
                            const error = `创建订阅计划 ${plan.name} 失败: ${planError.message}`;
                            console.error(`   ❌ ${error}`);
                            results.errors.push(error);
                        }
                    }
                }
                console.log(`   ✅ 订阅计划创建完成，共创建 ${results.plansCreated} 个`);
            }
            else {
                console.log('   ⏭️  订阅计划已存在，跳过创建');
            }
        }
        catch (error) {
            const errorMsg = `创建订阅计划时发生错误: ${error.message}`;
            console.error('❌', errorMsg);
            results.errors.push(errorMsg);
        }
        // ==================== 第二步：为现有用户创建默认订阅记录 ====================
        console.log('👥 2. 为现有用户创建默认订阅记录...');
        try {
            // 获取所有没有订阅记录的用户
            const usersWithoutSubscription = await prisma.user.findMany({
                where: {
                    subscription: null
                },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    createdAt: true
                }
            });
            console.log(`   找到 ${usersWithoutSubscription.length} 个没有订阅记录的用户`);
            if (usersWithoutSubscription.length > 0) {
                // 为每个用户创建免费订阅记录
                for (const user of usersWithoutSubscription) {
                    try {
                        await prisma.userSubscription.create({
                            data: {
                                userId: user.id,
                                planId: 'free', // 默认为免费用户
                                status: 'active', // 免费用户状态为active
                                isTestAccount: false,
                                currentPeriodStart: user.createdAt,
                                currentPeriodEnd: new Date('2099-12-31'), // 免费用户永不过期
                                createdAt: user.createdAt,
                                updatedAt: new Date()
                            }
                        });
                        results.subscriptionsCreated++;
                        console.log(`   ✅ 用户 ${user.email} 创建免费订阅记录成功`);
                    }
                    catch (error) {
                        const errorMsg = `用户 ${user.email} 创建订阅记录失败: ${error.message}`;
                        console.error(`   ❌ ${errorMsg}`);
                        results.errors.push(errorMsg);
                    }
                }
            }
            else {
                console.log('   ⏭️  所有用户都已有订阅记录');
            }
        }
        catch (error) {
            const errorMsg = `创建用户订阅记录时发生错误: ${error.message}`;
            console.error('❌', errorMsg);
            results.errors.push(errorMsg);
        }
        // ==================== 第三步：验证数据完整性 ====================
        console.log('🔍 3. 验证数据完整性...');
        try {
            // 检查订阅计划
            const totalPlans = await prisma.subscriptionPlan.count();
            console.log(`   订阅计划总数: ${totalPlans}`);
            // 检查用户订阅
            const totalSubscriptions = await prisma.userSubscription.count();
            const totalUsers = await prisma.user.count();
            console.log(`   用户订阅记录数: ${totalSubscriptions}`);
            console.log(`   用户总数: ${totalUsers}`);
            results.summary = {
                totalPlans,
                totalSubscriptions,
                totalUsers,
                allUsersHaveSubscriptions: totalSubscriptions >= totalUsers
            };
            if (totalSubscriptions >= totalUsers) {
                console.log('   ✅ 所有用户都有订阅记录');
            }
            else {
                console.log(`   ⚠️  还有 ${totalUsers - totalSubscriptions} 个用户没有订阅记录`);
            }
        }
        catch (error) {
            const errorMsg = `验证数据完整性时发生错误: ${error.message}`;
            console.error('❌', errorMsg);
            results.errors.push(errorMsg);
        }
        // ==================== 第四步：测试订阅查询 ====================
        console.log('🧪 4. 测试订阅查询功能...');
        try {
            // 随机选择一个用户测试订阅查询
            const testUser = await prisma.user.findFirst({
                where: { subscription: { isNot: null } },
                include: {
                    subscription: {
                        include: {
                            plan: true
                        }
                    }
                }
            });
            if (testUser && testUser.subscription) {
                console.log(`   ✅ 测试用户 ${testUser.email} 订阅查询成功:`);
                console.log(`      - 订阅状态: ${testUser.subscription.status}`);
                console.log(`      - 订阅计划: ${testUser.subscription.plan?.name}`);
                console.log(`      - 测试账户: ${testUser.subscription.isTestAccount}`);
                results.testQuery = {
                    success: true,
                    user: testUser.email,
                    status: testUser.subscription.status,
                    plan: testUser.subscription.plan?.name
                };
            }
            else {
                console.log('   ❌ 订阅查询测试失败');
                results.testQuery = { success: false };
            }
        }
        catch (error) {
            const errorMsg = `测试订阅查询时发生错误: ${error.message}`;
            console.error('❌', errorMsg);
            results.errors.push(errorMsg);
        }
        console.log('\n🎉 订阅数据库初始化完成！');
        // 返回结果
        res.json({
            success: true,
            message: '订阅数据库初始化完成',
            data: results
        });
        console.log('✅ API响应发送成功');
    }
    catch (error) {
        console.error('❌ 订阅数据库初始化失败:', error);
        let errorMessage = '订阅数据库初始化失败';
        let suggestions = [];
        if (error.code === 'P2021') {
            errorMessage = '数据库表不存在';
            suggestions = [
                '确保数据库表已通过 Prisma 迁移创建',
                '运行: npx prisma migrate deploy',
                '检查数据库连接配置'
            ];
        }
        else if (error.code === 'P2002') {
            errorMessage = '数据已存在（重复键冲突）';
            suggestions = ['某些数据可能已经存在，这通常不是问题'];
        }
        res.status(500).json({
            success: false,
            error: errorMessage,
            details: error.message,
            code: error.code,
            suggestions
        });
    }
});
/**
 * 快速检查订阅数据库状态
 */
router.get('/check-subscriptions', authenticateToken, async (req, res) => {
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
        // 检查数据库状态
        const [totalPlans, totalUsers, totalSubscriptions, usersWithoutSubscriptions] = await Promise.all([
            prisma.subscriptionPlan.count(),
            prisma.user.count(),
            prisma.userSubscription.count(),
            prisma.user.count({ where: { subscription: null } })
        ]);
        const status = {
            database: 'connected',
            subscriptionPlans: {
                total: totalPlans,
                hasBasicPlans: totalPlans >= 3
            },
            users: {
                total: totalUsers,
                withSubscriptions: totalSubscriptions,
                withoutSubscriptions: usersWithoutSubscriptions
            },
            dataIntegrity: {
                allUsersHaveSubscriptions: usersWithoutSubscriptions === 0,
                subscriptionCoverage: totalUsers > 0 ? (totalSubscriptions / totalUsers * 100).toFixed(1) + '%' : '0%'
            }
        };
        res.json({
            success: true,
            data: status
        });
    }
    catch (error) {
        console.error('检查订阅数据库状态失败:', error);
        res.status(500).json({
            success: false,
            error: '检查订阅数据库状态失败',
            details: error.message
        });
    }
});
/**
 * 修复数据库schema问题（例如缺失的列）
 */
router.post('/fix-schema', authenticateToken, async (req, res) => {
    try {
        console.log('🔧 API: 开始修复数据库schema问题...');
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
        const results = {
            columnsFixed: 0,
            errors: [],
            testResults: {}
        };
        // ==================== 修复payment_transactions表的stripePaymentId列 ====================
        console.log('📊 1. 修复payment_transactions表schema...');
        try {
            // 检查表是否存在stripePaymentId列
            const columns = await prisma.$queryRaw `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'payment_transactions' 
        AND table_schema = 'public'
      `;
            console.log('   现有列:', columns.map((col) => col.column_name));
            const hasStripePaymentId = columns.some((col) => col.column_name === 'stripePaymentId');
            if (!hasStripePaymentId) {
                console.log('   缺少stripePaymentId列，正在添加...');
                await prisma.$executeRaw `
          ALTER TABLE payment_transactions 
          ADD COLUMN IF NOT EXISTS "stripePaymentId" VARCHAR(255)
        `;
                await prisma.$executeRaw `
          ALTER TABLE payment_transactions 
          ADD CONSTRAINT payment_transactions_stripePaymentId_key 
          UNIQUE ("stripePaymentId")
        `;
                results.columnsFixed++;
                console.log('   ✅ stripePaymentId列添加成功');
            }
            else {
                console.log('   ✅ stripePaymentId列已存在');
            }
        }
        catch (error) {
            const errorMsg = `修复payment_transactions表失败: ${error.message}`;
            console.error('   ❌', errorMsg);
            results.errors.push(errorMsg);
        }
        // ==================== 测试修复后的查询 ====================
        console.log('🧪 2. 测试修复后的订阅查询...');
        try {
            // 尝试执行之前失败的查询
            const testUser = await prisma.user.findFirst({
                where: { subscription: { isNot: null } }
            });
            if (testUser) {
                const subscription = await prisma.userSubscription.findUnique({
                    where: { userId: testUser.id },
                    include: {
                        plan: true,
                        paymentTransactions: {
                            take: 5,
                            orderBy: { createdAt: 'desc' }
                        }
                    }
                });
                console.log('   ✅ 订阅查询测试成功');
                console.log(`   测试用户: ${testUser.email}`);
                console.log(`   订阅状态: ${subscription?.status || '无订阅'}`);
                console.log(`   关联交易记录: ${subscription?.paymentTransactions?.length || 0}条`);
                results.testResults = {
                    success: true,
                    user: testUser.email,
                    status: subscription?.status,
                    plan: subscription?.plan?.name,
                    transactionCount: subscription?.paymentTransactions?.length || 0
                };
            }
            else {
                console.log('   ⚠️ 没有找到有订阅的用户进行测试');
                results.testResults = { success: false, reason: 'no_subscribed_users' };
            }
        }
        catch (error) {
            const errorMsg = `订阅查询测试失败: ${error.message}`;
            console.error('   ❌', errorMsg);
            results.errors.push(errorMsg);
            results.testResults = { success: false, error: errorMsg };
        }
        console.log('\\n🎉 数据库schema修复完成！');
        // 返回结果
        res.json({
            success: true,
            message: '数据库schema修复完成',
            data: results
        });
        console.log('✅ Schema修复API响应发送成功');
    }
    catch (error) {
        console.error('❌ 数据库schema修复失败:', error);
        res.status(500).json({
            success: false,
            error: '数据库schema修复失败',
            details: error.message,
            code: error.code
        });
    }
});
export default router;
