import { Router, Request, Response } from 'express';
import { prisma } from '../utils/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireAiChatAccess, incrementUsage, AuthenticatedRequest } from '../middleware/subscriptionAuth.js';
import { validateRequest, schemas } from '../middleware/validation.js';
import { aiRateLimit } from '../middleware/rateLimiting.js';
import { geminiService } from '../services/geminiService.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// 发送聊天消息 (需要AI对话权限)
router.post('/message',
  aiRateLimit,
  authenticateToken,
  requireAiChatAccess,
  validateRequest({ body: schemas.chatRequest }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { message, sessionId, context, questionContext } = req.body;
      const userId = req.user!.userId;
      
      // 合并 context 和 questionContext，优先使用 questionContext
      const mergedContext = questionContext || context;

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
          metadata: mergedContext
        }
      });

      // 获取AI回复
      const aiResponse = await geminiService.chatResponse(message, mergedContext);

      // AI回复成功后增加使用计数
      await incrementUsage(userId, 'daily_ai_chat', 1);

      // 保存AI回复
      const aiMessage = await prisma.chatMessage.create({
        data: {
          sessionId: chatSession.id,
          role: 'assistant',
          content: aiResponse
        }
      });

      // 获取刚才保存的用户消息
      const userMessage = await prisma.chatMessage.findFirst({
        where: {
          sessionId: chatSession.id,
          role: 'user',
          content: message
        },
        orderBy: { createdAt: 'desc' }
      });

      res.json({
        success: true,
        data: {
          sessionId: chatSession.id,
          userMessage: {
            id: userMessage?.id || '',
            role: 'user',
            content: message,
            createdAt: userMessage?.createdAt || new Date()
          },
          assistantMessage: {
            id: aiMessage.id,
            role: 'assistant',
            content: aiResponse,
            createdAt: aiMessage.createdAt
          }
        }
      });
    } catch (error) {
      console.error('Chat message error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : '聊天服务暂时不可用'
      });
    }
  }
);

// 获取或创建基于题目的聊天会话
router.post('/sessions/question-based',
  authenticateToken,
  requireAiChatAccess,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { questionId, questionData, title } = req.body;
      const userId = req.user!.userId;

      if (!questionId) {
        return res.status(400).json({
          success: false,
          error: '缺少questionId参数'
        });
      }

      console.log('Looking for existing question-based chat session:', { userId, questionId });

      // 首先查找是否已存在基于此题目的聊天会话
      let existingSession = await prisma.chatSession.findFirst({
        where: {
          userId,
          questionId: questionId
        },
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

      if (existingSession) {
        console.log('Found existing session:', existingSession.id);
        
        // 计算消息数量和最后消息时间
        const messageCount = existingSession.messages.length;
        const lastMessageAt = existingSession.messages.length > 0 
          ? existingSession.messages[existingSession.messages.length - 1].createdAt
          : existingSession.createdAt;

        res.json({
          success: true,
          data: {
            ...existingSession,
            messageCount,
            lastMessageAt,
            isActive: true
          },
          message: '找到已存在的聊天会话'
        });
      } else {
        console.log('Creating new question-based chat session:', { userId, questionId, title });

        // 创建新的聊天会话
        const newSession = await prisma.chatSession.create({
          data: {
            userId,
            questionId: questionId,
            title: title || '题目讨论 - 未分类',
            questionData: questionData ? JSON.stringify(questionData) : null
          }
        });

        console.log('New question-based session created:', newSession.id);

        res.status(201).json({
          success: true,
          data: {
            ...newSession,
            messages: [],
            messageCount: 0,
            lastMessageAt: newSession.createdAt,
            isActive: true
          },
          message: '创建新的题目讨论会话'
        });
      }
    } catch (error) {
      console.error('Get or create question-based session error:', error);
      res.status(500).json({
        success: false,
        error: '获取或创建题目讨论会话失败'
      });
    }
  }
);

// 创建聊天会话
router.post('/sessions',
  authenticateToken,
  requireAiChatAccess,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { title } = req.body;
      const userId = req.user!.userId;

      console.log('Creating chat session:', { userId, title });

      const chatSession = await prisma.chatSession.create({
        data: {
          userId,
          title: title || '新的对话'
        }
      });

      console.log('Chat session created:', chatSession);

      res.status(201).json({
        success: true,
        data: chatSession,
        message: '聊天会话创建成功'
      });
    } catch (error) {
      console.error('Create chat session error:', error);
      res.status(500).json({
        success: false,
        error: '创建聊天会话失败'
      });
    }
  }
);

// 获取聊天会话列表
router.get('/sessions',
  authenticateToken,
  validateRequest({ query: schemas.pagination }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
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
    } catch (error) {
      console.error('Get chat sessions error:', error);
      res.status(500).json({
        success: false,
        error: '获取聊天会话失败'
      });
    }
  }
);

// 获取聊天会话详情
router.get('/sessions/:sessionId',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
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
    } catch (error) {
      console.error('Get chat session error:', error);
      res.status(500).json({
        success: false,
        error: '获取聊天会话详情失败'
      });
    }
  }
);

// 删除聊天会话
router.delete('/sessions/:sessionId',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
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
    } catch (error) {
      console.error('Delete chat session error:', error);
      res.status(500).json({
        success: false,
        error: '删除聊天会话失败'
      });
    }
  }
);

// 更新会话标题
router.put('/sessions/:sessionId/title',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
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
    } catch (error) {
      console.error('Update chat session title error:', error);
      res.status(500).json({
        success: false,
        error: '更新会话标题失败'
      });
    }
  }
);

// 解释题目答案 (需要AI对话权限)
router.post('/explain',
  aiRateLimit,
  authenticateToken,
  requireAiChatAccess,
  async (req: AuthenticatedRequest, res: Response) => {
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
    } catch (error) {
      console.error('Explain answer error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : '答案解释失败'
      });
    }
  }
);

export default router;