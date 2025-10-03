import { Router } from 'express';
import { prisma } from '../utils/database.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import { requirePracticeAccess, incrementUsage } from '../middleware/subscriptionAuth.js';
import { validateRequest, schemas } from '../middleware/validation.js';
import { aiRateLimit } from '../middleware/rateLimiting.js';
import { geminiService } from '../services/geminiService.js';
import { fixCategory } from '../utils/categoryMapping.js';
import { v4 as uuidv4 } from 'uuid';
const router = Router();
// 生成练习题目 (需要AI速率限制和权限检查)
router.post('/generate', aiRateLimit, authenticateToken, requirePracticeAccess, validateRequest({ body: schemas.questionGeneration }), async (req, res) => {
    try {
        const questions = await geminiService.generateQuestions(req.body);
        // 生成成功后增加使用计数
        const userId = req.user.userId;
        await incrementUsage(userId, 'daily_practice', 1);
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
// 提交练习结果 (需要权限检查)
router.post('/submit', authenticateToken, requirePracticeAccess, validateRequest({ body: schemas.practiceSubmission }), async (req, res) => {
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
router.post('/sessions', authenticateToken, requirePracticeAccess, async (req, res) => {
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
        console.log('Getting practice sessions for user:', userId, { completed, page, limit });
        // 尝试从数据库获取记录，如果失败则返回空数组
        let records = [];
        let total = 0;
        try {
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
            [records, total] = await Promise.all([
                prisma.practiceRecord.findMany({
                    where: whereClause,
                    orderBy: { completedAt: 'desc' },
                    skip,
                    take: limitNum,
                    select: {
                        id: true,
                        userId: true,
                        sessionId: true,
                        questionType: true,
                        difficulty: true,
                        questionsCount: true,
                        correctAnswers: true,
                        totalTime: true,
                        score: true,
                        questions: true,
                        completedAt: true
                    }
                }),
                prisma.practiceRecord.count({ where: whereClause })
            ]);
            console.log(`Found ${records.length} practice records in database`);
        }
        catch (dbError) {
            console.warn('Database query failed, returning empty results:', dbError);
            // 如果数据库查询失败，返回空结果（优雅降级）
            records = [];
            total = 0;
        }
        // 转换为前端期望的格式
        const sessions = records.map(record => {
            // 计算百分比得分
            const percentageScore = Math.round((record.correctAnswers / record.questionsCount) * 100);
            return {
                id: record.sessionId,
                sessionType: 'part_practice',
                questionType: record.questionType.toLowerCase().includes('reading') ? 'reading' : 'listening',
                difficulty: [3], // 简化处理
                categories: [],
                totalQuestions: record.questionsCount,
                correctAnswers: record.correctAnswers,
                score: percentageScore, // 百分比得分 (0-100)
                estimatedScore: record.score, // TOEIC估分 (200-990)
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
                    category: fixCategory(q.category || '未分类', record.questionType),
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
                userAnswers: Array.isArray(record.questions) ? record.questions.map((q, index) => ({
                    id: `${record.sessionId}_answer_${index}`,
                    sessionId: record.sessionId,
                    questionId: q.id || `${record.sessionId}_q_${index}`,
                    answer: q.userAnswer !== undefined ? q.userAnswer : null,
                    isCorrect: q.userAnswer !== null && q.userAnswer === q.correctAnswer,
                    timeSpent: q.timeSpent || 0,
                    createdAt: record.completedAt.toISOString()
                })) : [],
                wrongQuestions: []
            };
        });
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
        // 即使出错也返回空结果结构，避免前端崩溃
        res.status(200).json({
            success: true,
            data: {
                sessions: [],
                pagination: {
                    page: parseInt(req.query.page) || 1,
                    limit: parseInt(req.query.limit) || 20,
                    total: 0,
                    totalPages: 0
                }
            },
            message: '暂无练习记录'
        });
    }
});
// 提交单题答案 (兼容前端API)
router.post('/sessions/:sessionId/answers', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { questionId, answer, timeSpent } = req.body;
        console.log(`Answer submission: session=${sessionId}, questionId=${questionId}, answer=${answer}, timeSpent=${timeSpent}`);
        // 这里可以添加临时存储逻辑，但由于我们在完成时会重新处理所有答案
        // 目前只需要确认答案接收成功
        res.json({
            success: true,
            data: {
                answerId: `${sessionId}_answer_${questionId}`,
                isCorrect: null, // 在session完成时计算
                correctAnswer: null, // 在session完成时返回
                received: { questionId, answer, timeSpent }
            },
            message: '答案提交成功'
        });
    }
    catch (error) {
        console.error('Submit answer error:', error);
        res.status(500).json({
            success: false,
            error: '提交答案失败'
        });
    }
});
// 完成练习会话 (支持访客用户)
router.post('/sessions/:sessionId/complete', optionalAuth, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { questions, userAnswers, timeSpent } = req.body;
        console.log(`Completing session ${sessionId}, questions: ${questions?.length}, answers: ${userAnswers?.length}`);
        console.log('First question:', questions?.[0]);
        console.log('First user answer:', userAnswers?.[0]);
        console.log('All user answers:', userAnswers);
        if (!questions || !userAnswers) {
            return res.status(400).json({
                success: false,
                error: '缺少必需字段：questions, userAnswers'
            });
        }
        // 计算正确答案数量
        let correctAnswers = 0;
        // 确保题目有正确的ID
        questions.forEach((q, index) => {
            if (!q.id) {
                q.id = `${sessionId}_q_${index}`;
            }
        });
        // 创建题目ID到索引的映射
        const questionIdToIndex = new Map();
        questions.forEach((q, index) => {
            questionIdToIndex.set(q.id, index);
        });
        console.log('Question ID mapping:', Object.fromEntries(questionIdToIndex));
        // 处理用户答案，使用ID匹配而非索引
        const processedUserAnswers = userAnswers.map((userAnswer, answerIndex) => {
            let questionIndex = answerIndex; // 默认使用索引
            let questionId = questions[answerIndex]?.id || `${sessionId}_q_${answerIndex}`;
            // 如果用户答案包含questionId，尝试匹配
            if (userAnswer.questionId && questionIdToIndex.has(userAnswer.questionId)) {
                questionIndex = questionIdToIndex.get(userAnswer.questionId);
                questionId = userAnswer.questionId;
            }
            else if (userAnswer.questionId) {
                // 如果questionId不匹配，尝试根据模式匹配（如TOEIC_PART5_1 -> 索引0）
                const match = userAnswer.questionId.match(/(\d+)$/);
                if (match) {
                    const idNumber = parseInt(match[1]);
                    if (idNumber >= 1 && idNumber <= questions.length) {
                        questionIndex = idNumber - 1; // 转换为0-based索引
                        questionId = questions[questionIndex]?.id || `${sessionId}_q_${questionIndex}`;
                    }
                }
            }
            const question = questions[questionIndex];
            const isCorrect = userAnswer.answer !== null && userAnswer.answer === question?.correctAnswer;
            console.log(`Answer ${answerIndex}: userAnswer.questionId=${userAnswer.questionId}, mapped to questionIndex=${questionIndex}, question.correctAnswer=${question?.correctAnswer}, userAnswer.answer=${userAnswer.answer}, isCorrect=${isCorrect}`);
            if (isCorrect) {
                correctAnswers++;
            }
            return {
                id: `${sessionId}_answer_${answerIndex}`,
                sessionId,
                questionId,
                answer: userAnswer.answer,
                isCorrect,
                timeSpent: userAnswer.timeSpent || 0,
                createdAt: new Date().toISOString()
            };
        });
        // 计算分数
        const score = Math.round((correctAnswers / questions.length) * 100);
        const estimatedScore = Math.round(200 + ((correctAnswers / questions.length) * 800));
        // 处理题目数据，包含用户答案
        const processedQuestions = questions.map((q, index) => {
            // 找到对应的用户答案
            const userAnswerData = processedUserAnswers.find(ua => ua.questionId === (q.id || `${sessionId}_q_${index}`));
            return {
                id: q.id || `${sessionId}_q_${index}`,
                sessionId,
                type: q.type || 'reading',
                category: fixCategory(q.category || '未分类', q.type || 'reading'),
                question: q.question || '',
                options: q.options || [],
                correctAnswer: q.correctAnswer || 0,
                explanation: q.explanation || '',
                difficulty: q.difficulty || 3,
                audioUrl: q.audioUrl,
                imageUrl: q.imageUrl,
                tags: q.tags || [],
                questionOrder: index,
                createdAt: new Date().toISOString(),
                // 添加用户答案信息
                userAnswer: userAnswerData?.answer ?? null,
                isCorrect: userAnswerData?.isCorrect ?? false,
                timeSpent: userAnswerData?.timeSpent ?? 0
            };
        });
        // 尝试保存到数据库（如果有用户认证）
        let savedToDatabase = false;
        if (req.user?.userId) {
            try {
                // 只使用数据库中确实存在的字段
                await prisma.practiceRecord.create({
                    data: {
                        userId: req.user.userId,
                        sessionId,
                        questionType: questions[0]?.type === 'reading' ? 'READING_PART5' : 'LISTENING_PART1',
                        difficulty: 'INTERMEDIATE',
                        questionsCount: questions.length,
                        correctAnswers,
                        totalTime: timeSpent || 0,
                        score: estimatedScore,
                        questions: processedQuestions
                        // 暂时不包含可能不存在的字段，等数据库同步后再添加
                    }
                });
                savedToDatabase = true;
                console.log(`✅ Session saved to database for user ${req.user.userId}`);
            }
            catch (dbError) {
                console.warn('⚠️ Failed to save to database, but continuing:', dbError);
            }
        }
        else {
            console.log('ℹ️ Guest user - session not saved to database');
        }
        // 返回完整的会话数据结构
        const completedSession = {
            id: sessionId,
            sessionType: 'quick_practice',
            questionType: questions[0]?.type || 'reading',
            difficulty: [3],
            categories: [],
            totalQuestions: questions.length,
            correctAnswers,
            score, // 百分比得分 (0-100)
            estimatedScore, // TOEIC估分 (200-990)
            partScores: null,
            timeSpent: timeSpent || 0,
            timeLimit: null,
            completed: true,
            completedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            questions: processedQuestions,
            userAnswers: processedUserAnswers,
            wrongQuestions: [],
            savedToDatabase
        };
        console.log(`✅ Practice session completed: ${sessionId}, score: ${score}/${questions.length}, TOEIC估分: ${estimatedScore}`);
        res.json({
            success: true,
            data: completedSession,
            message: `练习会话完成，得分: ${score}分 (TOEIC估分: ${estimatedScore})`
        });
    }
    catch (error) {
        console.error('❌ Complete session error:', error);
        res.status(500).json({
            success: false,
            error: '完成练习会话失败'
        });
    }
});
// 原始完整实现（备用）
router.post('/sessions/:sessionId/complete-full', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { questions, userAnswers, timeSpent } = req.body;
        console.log(`Completing session ${sessionId}, questions: ${questions?.length}, answers: ${userAnswers?.length}`);
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
        // 简化返回数据（跳过数据库操作以避免错误）
        const completedSession = {
            id: sessionId,
            sessionType: 'quick_practice',
            questionType: questions[0]?.type || 'reading',
            difficulty: [3],
            categories: [],
            totalQuestions: questions.length,
            correctAnswers,
            score,
            estimatedScore: score,
            partScores: null,
            timeSpent: timeSpent || 0,
            timeLimit: null,
            completed: true,
            completedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            questions: questions.map((q, index) => ({
                ...q,
                id: q.id || `${sessionId}_q_${index}`,
                sessionId,
                questionOrder: index,
                createdAt: new Date().toISOString()
            })),
            userAnswers: userAnswers.map((ua, index) => ({
                id: `${sessionId}_answer_${index}`,
                sessionId,
                questionId: questions[index]?.id,
                answer: ua.answer,
                isCorrect: ua.answer !== null && questions[index]?.correctAnswer === ua.answer,
                timeSpent: ua.timeSpent || 0,
                createdAt: new Date().toISOString()
            })),
            wrongQuestions: []
        };
        console.log(`✅ Practice session completed: ${sessionId}, score: ${score}/${questions.length}`);
        res.json({
            success: true,
            data: completedSession,
            message: `练习会话完成，得分: ${score}分`
        });
    }
    catch (error) {
        console.error('❌ Complete session error:', error);
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
