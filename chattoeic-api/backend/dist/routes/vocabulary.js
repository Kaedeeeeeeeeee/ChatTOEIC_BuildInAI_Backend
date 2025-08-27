import { Router } from 'express';
import { prisma } from '../utils/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateRequest, schemas } from '../middleware/validation.js';
const router = Router();
// 添加单词到词汇本
router.post('/', authenticateToken, validateRequest({ body: schemas.vocabularyRequest }), async (req, res) => {
    try {
        const { word, context } = req.body;
        const userId = req.user.userId;
        // 检查单词是否已存在
        const existingWord = await prisma.vocabularyItem.findUnique({
            where: {
                userId_word: { userId, word: word.toLowerCase() }
            }
        });
        if (existingWord) {
            return res.status(400).json({
                success: false,
                error: '该单词已在您的词汇本中'
            });
        }
        // 这里可以集成词典API获取单词详细信息
        // 暂时使用简化版本
        const vocabularyItem = await prisma.vocabularyItem.create({
            data: {
                userId,
                word: word.toLowerCase(),
                definition: `${word} 的定义`, // 实际应该从词典API获取
                example: context || `${word} 的例句`,
                difficulty: 'INTERMEDIATE',
                nextReviewDate: new Date()
            }
        });
        res.status(201).json({
            success: true,
            data: vocabularyItem,
            message: '单词添加成功'
        });
    }
    catch (error) {
        console.error('Add vocabulary error:', error);
        res.status(500).json({
            success: false,
            error: '添加单词失败'
        });
    }
});
// 获取词汇本列表
router.get('/', authenticateToken, validateRequest({ query: schemas.pagination }), async (req, res) => {
    try {
        const userId = req.user.userId;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const [vocabulary, total] = await Promise.all([
            prisma.vocabularyItem.findMany({
                where: { userId },
                orderBy: { addedAt: 'desc' },
                skip,
                take: limit
            }),
            prisma.vocabularyItem.count({ where: { userId } })
        ]);
        res.json({
            success: true,
            data: vocabulary,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    }
    catch (error) {
        console.error('Get vocabulary error:', error);
        res.status(500).json({
            success: false,
            error: '获取词汇本失败'
        });
    }
});
// 获取需要复习的单词
router.get('/review', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const limit = parseInt(req.query.limit) || 20;
        const wordsToReview = await prisma.vocabularyItem.findMany({
            where: {
                userId,
                nextReviewDate: {
                    lte: new Date()
                }
            },
            orderBy: { nextReviewDate: 'asc' },
            take: limit
        });
        res.json({
            success: true,
            data: wordsToReview
        });
    }
    catch (error) {
        console.error('Get review words error:', error);
        res.status(500).json({
            success: false,
            error: '获取复习单词失败'
        });
    }
});
// 提交单词复习结果
router.post('/:wordId/review', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { wordId } = req.params;
        const { correct, difficulty } = req.body; // difficulty: 1-5 (1=很难, 5=很容易)
        const vocabularyItem = await prisma.vocabularyItem.findFirst({
            where: { id: wordId, userId }
        });
        if (!vocabularyItem) {
            return res.status(404).json({
                success: false,
                error: '单词不存在'
            });
        }
        // 间隔重复算法 (简化版)
        let newInterval = vocabularyItem.interval;
        let newEaseFactor = vocabularyItem.easeFactor;
        if (correct) {
            newEaseFactor = Math.max(1.3, newEaseFactor + (0.1 - (5 - difficulty) * (0.08 + (5 - difficulty) * 0.02)));
            if (vocabularyItem.reviewCount === 0) {
                newInterval = 1;
            }
            else if (vocabularyItem.reviewCount === 1) {
                newInterval = 6;
            }
            else {
                newInterval = Math.round(vocabularyItem.interval * newEaseFactor);
            }
        }
        else {
            newInterval = 1;
            newEaseFactor = Math.max(1.3, newEaseFactor - 0.2);
        }
        const nextReviewDate = new Date();
        nextReviewDate.setDate(nextReviewDate.getDate() + newInterval);
        const updatedItem = await prisma.vocabularyItem.update({
            where: { id: wordId },
            data: {
                reviewCount: { increment: 1 },
                correctCount: correct ? { increment: 1 } : undefined,
                incorrectCount: !correct ? { increment: 1 } : undefined,
                easeFactor: newEaseFactor,
                interval: newInterval,
                nextReviewDate,
                lastReviewedAt: new Date()
            }
        });
        res.json({
            success: true,
            data: updatedItem,
            message: '复习结果提交成功'
        });
    }
    catch (error) {
        console.error('Submit review error:', error);
        res.status(500).json({
            success: false,
            error: '提交复习结果失败'
        });
    }
});
// 删除单词
router.delete('/:wordId', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { wordId } = req.params;
        const vocabularyItem = await prisma.vocabularyItem.findFirst({
            where: { id: wordId, userId }
        });
        if (!vocabularyItem) {
            return res.status(404).json({
                success: false,
                error: '单词不存在'
            });
        }
        await prisma.vocabularyItem.delete({
            where: { id: wordId }
        });
        res.json({
            success: true,
            message: '单词删除成功'
        });
    }
    catch (error) {
        console.error('Delete vocabulary error:', error);
        res.status(500).json({
            success: false,
            error: '删除单词失败'
        });
    }
});
// 获取词汇统计
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const [totalWords, reviewToday, mastereedWords, difficultyStats] = await Promise.all([
            prisma.vocabularyItem.count({ where: { userId } }),
            prisma.vocabularyItem.count({
                where: {
                    userId,
                    nextReviewDate: {
                        lte: new Date()
                    }
                }
            }),
            prisma.vocabularyItem.count({
                where: {
                    userId,
                    reviewCount: { gte: 5 },
                    correctCount: { gte: 3 }
                }
            }),
            prisma.vocabularyItem.groupBy({
                by: ['difficulty'],
                where: { userId },
                _count: { id: true }
            })
        ]);
        res.json({
            success: true,
            data: {
                totalWords,
                reviewToday,
                mastereedWords,
                difficultyStats
            }
        });
    }
    catch (error) {
        console.error('Get vocabulary stats error:', error);
        res.status(500).json({
            success: false,
            error: '获取词汇统计失败'
        });
    }
});
export default router;
