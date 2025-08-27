import { Router } from 'express';
import { prisma } from '../utils/database.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import { validateRequest, schemas } from '../middleware/validation.js';
import { aiRateLimit } from '../middleware/rateLimiting.js';
import { geminiService } from '../services/geminiService.js';
import { v4 as uuidv4 } from 'uuid';
const router = Router();
// 生成练习题目 (需要AI速率限制)
router.post('/generate', aiRateLimit, optionalAuth, validateRequest({ body: schemas.questionGeneration }), async (req, res) => {
    try {
        const questions = await geminiService.generateQuestions(req.body);
        res.json({
            success: true,
            data: {
                sessionId: uuidv4(),
                questions
            },
            message: '题目生成成功'
        });
    }
    catch (error) {
        console.error('Question generation error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : '题目生成失败'
        });
    }
});
// 提交练习结果
router.post('/submit', authenticateToken, validateRequest({ body: schemas.practiceSubmission }), async (req, res) => {
    try {
        const { sessionId, questions } = req.body;
        const userId = req.user.userId;
        // 计算分数
        const correctAnswers = questions.filter((q) => q.isCorrect).length;
        const totalQuestions = questions.length;
        const accuracy = correctAnswers / totalQuestions;
        const totalTime = questions.reduce((sum, q) => sum + q.timeSpent, 0);
        // 估算TOEIC分数 (简化算法)
        const estimatedScore = Math.round(200 + (accuracy * 800));
        // 保存练习记录
        const practiceRecord = await prisma.practiceRecord.create({
            data: {
                userId,
                sessionId,
                questionType: questions[0]?.type || 'READING_PART5',
                difficulty: questions[0]?.difficulty || 'INTERMEDIATE',
                questionsCount: totalQuestions,
                correctAnswers,
                totalTime,
                score: estimatedScore,
                questions: questions
            }
        });
        // 更新学习进度
        await updateStudyProgress(userId, practiceRecord);
        res.json({
            success: true,
            data: {
                practiceId: practiceRecord.id,
                score: estimatedScore,
                accuracy: Math.round(accuracy * 100),
                correctAnswers,
                totalQuestions,
                totalTime
            },
            message: '练习结果保存成功'
        });
    }
    catch (error) {
        console.error('Practice submission error:', error);
        res.status(500).json({
            success: false,
            error: '提交练习结果失败'
        });
    }
});
// 创建新的练习会话 (兼容前端API)
router.post('/sessions', authenticateToken, async (req, res) => {
    try {
        const { sessionType, questionType, difficulty, categories, totalQuestions, timeLimit } = req.body;
        const userId = req.user.userId;
        // 验证必需字段
        if (!sessionType || !questionType || !difficulty || !totalQuestions) {
            return res.status(400).json({
                success: false,
                error: '缺少必需字段：sessionType, questionType, difficulty, totalQuestions'
            });
        }
        // 生成会话ID
        const sessionId = uuidv4();
        console.log(`Creating new practice session: ${sessionId} for user: ${userId}`, {
            sessionType, questionType, difficulty, categories, totalQuestions
        });
        // 返回新创建的会话信息（不立即保存到数据库，等完成时再保存）
        const newSession = {
            id: sessionId,
            sessionType,
            questionType,
            difficulty: Array.isArray(difficulty) ? difficulty : [difficulty],
            categories: categories || [],
            totalQuestions,
            correctAnswers: 0,
            score: null,
            estimatedScore: null,
            partScores: null,
            timeSpent: 0,
            timeLimit: timeLimit || null,
            completed: false,
            completedAt: null,
            createdAt: new Date().toISOString(),
            questions: [],
            userAnswers: [],
            wrongQuestions: []
        };
        res.json({
            success: true,
            data: newSession,
            message: '练习会话创建成功'
        });
    }
    catch (error) {
        console.error('Create session error:', error);
        res.status(500).json({
            success: false,
            error: '创建练习会话失败'
        });
    }
});
// 获取练习会话列表 (兼容前端API)
router.get('/sessions', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { completed, page = '1', limit = '20' } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;
        // 构建查询条件
        const whereClause = { userId };
        // 根据completed参数添加过滤条件
        if (completed === 'true') {
            // 只返回已完成的会话（有score的记录视为已完成）
            whereClause.NOT = { score: null };
        }
        else if (completed === 'false') {
            // 只返回未完成的会话
            whereClause.score = null;
        }
        const [records, total] = await Promise.all([
            prisma.practiceRecord.findMany({
                where: whereClause,
                orderBy: { completedAt: 'desc' },
                skip,
                take: limitNum
            }),
            prisma.practiceRecord.count({ where: whereClause })
        ]);
        // 转换为前端期望的格式
        const sessions = records.map(record => ({
            id: record.sessionId,
            sessionType: 'part_practice',
            questionType: record.questionType.toLowerCase().includes('reading') ? 'reading' : 'listening',
            difficulty: [3], // 简化处理
            categories: [],
            totalQuestions: record.questionsCount,
            correctAnswers: record.correctAnswers,
            score: record.score,
            estimatedScore: record.score,
            partScores: null,
            timeSpent: record.totalTime,
            timeLimit: null,
            completed: true,
            completedAt: record.completedAt.toISOString(),
            createdAt: record.completedAt.toISOString(),
            questions: Array.isArray(record.questions) ? record.questions.map((q, index) => ({
                id: q.id || `${record.sessionId}_q_${index}`,
                sessionId: record.sessionId,
                type: record.questionType.toLowerCase().includes('reading') ? 'reading' : 'listening',
                category: q.category || 'Part 5 - 语法填空',
                question: q.question || '',
                options: q.options || [],
                correctAnswer: q.correctAnswer || 0,
                explanation: q.explanation || '',
                difficulty: q.difficulty || 3,
                audioUrl: q.audioUrl,
                imageUrl: q.imageUrl,
                tags: q.tags || [],
                questionOrder: index,
                createdAt: record.completedAt.toISOString()
            })) : [],
            userAnswers: [],
            wrongQuestions: []
        }));
        res.json({
            success: true,
            data: {
                sessions,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    totalPages: Math.ceil(total / limitNum)
                }
            }
        });
    }
    catch (error) {
        console.error('Get sessions error:', error);
        res.status(500).json({
            success: false,
            error: '获取练习会话失败'
        });
    }
});
// 完成练习会话
router.post('/sessions/:sessionId/complete', authenticateToken, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { questions, userAnswers, timeSpent } = req.body;
        const userId = req.user.userId;
        if (!questions || !userAnswers) {
            return res.status(400).json({
                success: false,
                error: '缺少必需字段：questions, userAnswers'
            });
        }
        // 计算正确答案数量
        let correctAnswers = 0;
        userAnswers.forEach((userAnswer, index) => {
            if (userAnswer.answer !== null && userAnswer.answer === questions[index]?.correctAnswer) {
                correctAnswers++;
            }
        });
        // 计算分数
        const score = Math.round((correctAnswers / questions.length) * 100);
        // 保存到数据库
        const practiceRecord = await prisma.practiceRecord.create({
            data: {
                userId,
                sessionId,
                questionType: questions[0]?.type === 'reading' ? 'READING_PART5' : 'LISTENING_PART1',
                difficulty: 'INTERMEDIATE', // 简化处理
                questionsCount: questions.length,
                correctAnswers,
                totalTime: timeSpent || 0,
                score,
                questions: questions
            }
        });
        // 返回完成的会话数据
        const completedSession = {
            id: practiceRecord.sessionId,
            sessionType: 'quick_practice',
            questionType: questions[0]?.type || 'reading',
            difficulty: [3],
            categories: [],
            totalQuestions: practiceRecord.questionsCount,
            correctAnswers: practiceRecord.correctAnswers,
            score: practiceRecord.score,
            estimatedScore: practiceRecord.score,
            partScores: null,
            timeSpent: practiceRecord.totalTime,
            timeLimit: null,
            completed: true,
            completedAt: practiceRecord.completedAt.toISOString(),
            createdAt: practiceRecord.completedAt.toISOString(),
            questions: questions.map((q, index) => ({
                ...q,
                id: q.id || `${practiceRecord.sessionId}_q_${index}`,
                sessionId: practiceRecord.sessionId,
                questionOrder: index,
                createdAt: practiceRecord.completedAt.toISOString()
            })),
            userAnswers: userAnswers.map((ua, index) => ({
                id: `${practiceRecord.sessionId}_answer_${index}`,
                sessionId: practiceRecord.sessionId,
                questionId: questions[index]?.id,
                answer: ua.answer,
                isCorrect: ua.answer !== null && questions[index]?.correctAnswer === ua.answer,
                timeSpent: ua.timeSpent || 0,
                createdAt: practiceRecord.completedAt.toISOString()
            })),
            wrongQuestions: []
        };
        console.log(`Practice session completed: ${sessionId}, score: ${score}/${questions.length}`);
        res.json({
            success: true,
            data: completedSession,
            message: `练习会话完成，得分: ${score}分`
        });
    }
    catch (error) {
        console.error('Complete session error:', error);
        res.status(500).json({
            success: false,
            error: '完成练习会话失败'
        });
    }
});
// 获取练习历史
router.get('/history', authenticateToken, validateRequest({ query: schemas.pagination }), async (req, res) => {
    try {
        const userId = req.user.userId;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const [records, total] = await Promise.all([
            prisma.practiceRecord.findMany({
                where: { userId },
                orderBy: { completedAt: 'desc' },
                skip,
                take: limit,
                select: {
                    id: true,
                    sessionId: true,
                    questionType: true,
                    difficulty: true,
                    questionsCount: true,
                    correctAnswers: true,
                    totalTime: true,
                    score: true,
                    completedAt: true
                }
            }),
            prisma.practiceRecord.count({ where: { userId } })
        ]);
        res.json({
            success: true,
            data: records,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    }
    catch (error) {
        console.error('Get practice history error:', error);
        res.status(500).json({
            success: false,
            error: '获取练习历史失败'
        });
    }
});
// 获取练习详情
router.get('/:id', authenticateToken, validateRequest({ params: schemas.idParam }), async (req, res) => {
    try {
        const userId = req.user.userId;
        const practiceId = req.params.id;
        const practice = await prisma.practiceRecord.findFirst({
            where: {
                id: practiceId,
                userId
            }
        });
        if (!practice) {
            return res.status(404).json({
                success: false,
                error: '练习记录不存在'
            });
        }
        res.json({
            success: true,
            data: practice
        });
    }
    catch (error) {
        console.error('Get practice detail error:', error);
        res.status(500).json({
            success: false,
            error: '获取练习详情失败'
        });
    }
});
// 获取学习统计
router.get('/stats/overview', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const [totalPractices, averageScore, recentPractices, progressByType] = await Promise.all([
            prisma.practiceRecord.count({ where: { userId } }),
            prisma.practiceRecord.aggregate({
                where: { userId },
                _avg: { score: true }
            }),
            prisma.practiceRecord.findMany({
                where: { userId },
                orderBy: { completedAt: 'desc' },
                take: 10,
                select: {
                    score: true,
                    completedAt: true,
                    questionType: true
                }
            }),
            prisma.studyProgress.findMany({
                where: { userId },
                orderBy: { updatedAt: 'desc' }
            })
        ]);
        res.json({
            success: true,
            data: {
                totalPractices,
                averageScore: Math.round(averageScore._avg.score || 0),
                recentPractices,
                progressByType
            }
        });
    }
    catch (error) {
        console.error('Get practice stats error:', error);
        res.status(500).json({
            success: false,
            error: '获取学习统计失败'
        });
    }
});
// 更新学习进度的辅助函数
async function updateStudyProgress(userId, practiceRecord) {
    const { questionType, difficulty, correctAnswers, questionsCount, totalTime } = practiceRecord;
    const existingProgress = await prisma.studyProgress.findUnique({
        where: {
            userId_questionType_difficulty: {
                userId,
                questionType,
                difficulty
            }
        }
    });
    const newAverageTime = existingProgress
        ? (existingProgress.averageTime * existingProgress.totalQuestions + totalTime) / (existingProgress.totalQuestions + questionsCount)
        : totalTime / questionsCount;
    await prisma.studyProgress.upsert({
        where: {
            userId_questionType_difficulty: {
                userId,
                questionType,
                difficulty
            }
        },
        update: {
            totalQuestions: {
                increment: questionsCount
            },
            correctAnswers: {
                increment: correctAnswers
            },
            averageTime: newAverageTime,
            bestScore: existingProgress?.bestScore
                ? Math.max(existingProgress.bestScore, practiceRecord.score || 0)
                : practiceRecord.score,
            lastPracticeAt: new Date()
        },
        create: {
            userId,
            questionType,
            difficulty,
            totalQuestions: questionsCount,
            correctAnswers,
            averageTime: newAverageTime,
            bestScore: practiceRecord.score,
            lastPracticeAt: new Date()
        }
    });
}
export default router;
