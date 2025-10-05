/**
 * 临时修复API - 修复trial plan数据
 */
import { Router } from 'express';
import { prisma } from '../utils/database.js';
import { log } from '../utils/logger.js';
const router = Router();
/**
 * 修复trial plan的features字段
 */
router.post('/fix-trial-plan', async (req, res) => {
    try {
        log.info('开始修复trial plan数据...');
        // 创建或更新trial plan
        const trialPlan = await prisma.subscriptionPlan.upsert({
            where: { id: 'trial' },
            create: {
                id: 'trial',
                name: '试用版',
                nameJp: 'トライアル',
                priceCents: 0,
                currency: 'jpy',
                interval: 'trial',
                features: {
                    aiPractice: true, // ✅ 关键修复：启用AI练习
                    aiChat: true, // ✅ 启用AI对话
                    vocabulary: true, // ✅ 启用词汇管理
                    exportData: true, // ✅ 启用数据导出
                    viewMistakes: true // ✅ 启用错题回顾
                },
                dailyPracticeLimit: null, // 无限制
                dailyAiChatLimit: 20, // 每日20次AI对话
                maxVocabularyWords: null, // 无限制词汇
                sortOrder: 0
            },
            update: {
                name: '试用版',
                nameJp: 'トライアル',
                features: {
                    aiPractice: true, // ✅ 关键修复：启用AI练习
                    aiChat: true, // ✅ 启用AI对话
                    vocabulary: true, // ✅ 启用词汇管理
                    exportData: true, // ✅ 启用数据导出
                    viewMistakes: true // ✅ 启用错题回顾
                },
                dailyPracticeLimit: null,
                dailyAiChatLimit: 20,
                maxVocabularyWords: null
            }
        });
        // 检查现有的trial用户
        const trialUsers = await prisma.userSubscription.findMany({
            where: { planId: 'trial', status: 'trialing' },
            select: { userId: true, planId: true, status: true }
        });
        log.info('Trial plan修复成功', {
            plan: trialPlan,
            trialUsersCount: trialUsers.length
        });
        res.json({
            success: true,
            message: 'Trial plan修复成功',
            data: {
                plan: trialPlan,
                trialUsersCount: trialUsers.length
            }
        });
    }
    catch (error) {
        log.error('修复trial plan失败', { error });
        res.status(500).json({
            success: false,
            error: '修复失败'
        });
    }
});
export default router;
