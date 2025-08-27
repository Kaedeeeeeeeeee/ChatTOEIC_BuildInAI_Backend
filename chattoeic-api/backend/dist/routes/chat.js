import { Router } from 'express';
import { prisma } from '../utils/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateRequest, schemas } from '../middleware/validation.js';
import { aiRateLimit } from '../middleware/rateLimiting.js';
import { geminiService } from '../services/geminiService.js';
import { v4 as uuidv4 } from 'uuid';
const router = Router();
// 发送聊天消息
router.post('/message', aiRateLimit, authenticateToken, validateRequest({ body: schemas.chatRequest }), async (req, res) => {
    try {
        const { message, sessionId, context } = req.body;
        const userId = req.user.userId;
        // 如果没有sessionId，创建新的聊天会话
        let chatSession;
        if (sessionId) {
            chatSession = await prisma.chatSession.findFirst({
                where: { id: sessionId, userId }
            });
        }
        if (!chatSession) {
            chatSession = await prisma.chatSession.create({
                data: {
                    id: sessionId || uuidv4(),
                    userId,
                    title: message.substring(0, 50) + (message.length > 50 ? '...' : '')
                }
            });
        }
        // 保存用户消息
        await prisma.chatMessage.create({
            data: {
                sessionId: chatSession.id,
                role: 'user',
                content: message,
                metadata: context
            }
        });
        // 获取AI回复
        const aiResponse = await geminiService.chatResponse(message, context);
        // 保存AI回复
        const aiMessage = await prisma.chatMessage.create({
            data: {
                sessionId: chatSession.id,
                role: 'assistant',
                content: aiResponse
            }
        });
        res.json({
            success: true,
            data: {
                sessionId: chatSession.id,
                message: {
                    id: aiMessage.id,
                    role: 'assistant',
                    content: aiResponse,
                    createdAt: aiMessage.createdAt
                }
            }
        });
    }
    catch (error) {
        console.error('Chat message error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : '聊天服务暂时不可用'
        });
    }
});
// 获取聊天会话列表
router.get('/sessions', authenticateToken, validateRequest({ query: schemas.pagination }), async (req, res) => {
    try {
        const userId = req.user.userId;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const [sessions, total] = await Promise.all([
            prisma.chatSession.findMany({
                where: { userId },
                orderBy: { updatedAt: 'desc' },
                skip,
                take: limit,
                select: {
                    id: true,
                    title: true,
                    createdAt: true,
                    updatedAt: true,
                    _count: {
                        select: { messages: true }
                    }
                }
            }),
            prisma.chatSession.count({ where: { userId } })
        ]);
        res.json({
            success: true,
            data: sessions,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    }
    catch (error) {
        console.error('Get chat sessions error:', error);
        res.status(500).json({
            success: false,
            error: '获取聊天会话失败'
        });
    }
});
// 获取聊天会话详情
router.get('/sessions/:sessionId', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { sessionId } = req.params;
        const session = await prisma.chatSession.findFirst({
            where: { id: sessionId, userId },
            include: {
                messages: {
                    orderBy: { createdAt: 'asc' },
                    select: {
                        id: true,
                        role: true,
                        content: true,
                        metadata: true,
                        createdAt: true
                    }
                }
            }
        });
        if (!session) {
            return res.status(404).json({
                success: false,
                error: '聊天会话不存在'
            });
        }
        res.json({
            success: true,
            data: session
        });
    }
    catch (error) {
        console.error('Get chat session error:', error);
        res.status(500).json({
            success: false,
            error: '获取聊天会话详情失败'
        });
    }
});
// 删除聊天会话
router.delete('/sessions/:sessionId', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { sessionId } = req.params;
        const session = await prisma.chatSession.findFirst({
            where: { id: sessionId, userId }
        });
        if (!session) {
            return res.status(404).json({
                success: false,
                error: '聊天会话不存在'
            });
        }
        await prisma.chatSession.delete({
            where: { id: sessionId }
        });
        res.json({
            success: true,
            message: '聊天会话删除成功'
        });
    }
    catch (error) {
        console.error('Delete chat session error:', error);
        res.status(500).json({
            success: false,
            error: '删除聊天会话失败'
        });
    }
});
// 更新会话标题
router.put('/sessions/:sessionId/title', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { sessionId } = req.params;
        const { title } = req.body;
        if (!title || title.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: '标题不能为空'
            });
        }
        const session = await prisma.chatSession.findFirst({
            where: { id: sessionId, userId }
        });
        if (!session) {
            return res.status(404).json({
                success: false,
                error: '聊天会话不存在'
            });
        }
        const updatedSession = await prisma.chatSession.update({
            where: { id: sessionId },
            data: { title: title.trim() }
        });
        res.json({
            success: true,
            data: updatedSession,
            message: '会话标题更新成功'
        });
    }
    catch (error) {
        console.error('Update chat session title error:', error);
        res.status(500).json({
            success: false,
            error: '更新会话标题失败'
        });
    }
});
// 解释题目答案
router.post('/explain', aiRateLimit, authenticateToken, async (req, res) => {
    try {
        const { question, userAnswer, correctAnswer } = req.body;
        if (!question || !correctAnswer) {
            return res.status(400).json({
                success: false,
                error: '题目和正确答案是必需的'
            });
        }
        const explanation = await geminiService.explainAnswer(question, userAnswer, correctAnswer);
        res.json({
            success: true,
            data: { explanation }
        });
    }
    catch (error) {
        console.error('Explain answer error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : '答案解释失败'
        });
    }
});
export default router;
