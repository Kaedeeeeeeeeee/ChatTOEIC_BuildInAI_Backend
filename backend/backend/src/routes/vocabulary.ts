import { Router, Request, Response } from 'express';
import { prisma } from '../utils/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateRequest, schemas } from '../middleware/validation.js';
import { geminiService } from '../services/geminiService.js';

const router = Router();

// 添加单词到词汇本 (兼容前端 /words 路径)
router.post(['/words', '/'],
  authenticateToken,
  validateRequest({ body: schemas.vocabularyRequest }),
  async (req: Request, res: Response) => {
    try {
      console.log('Add vocabulary request body:', req.body);
      console.log('User:', req.user?.userId);
      
      const { word, context, sourceType, sourceId, tags, language } = req.body;
      const userId = req.user!.userId;

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

      console.log(`Adding vocabulary - User: ${userId}, Word: ${word}, Context: ${context}, Source: ${sourceType}`);
      
      // 使用AI获取真实的词汇信息
      let wordDefinition;
      let aiMeanings = null;
      
      try {
        console.log(`🔍 Fetching AI definition for word: ${word}`);
        wordDefinition = await geminiService.getWordDefinition(word, context);
        aiMeanings = wordDefinition.meanings;
        console.log(`✅ AI definition fetched for ${word}`);
      } catch (error) {
        console.warn(`⚠️ AI definition failed for ${word}, using fallback:`, error);
        // AI失败时使用默认值
        aiMeanings = [
          {
            partOfSpeech: 'noun',
            partOfSpeechCN: '名词', 
            partOfSpeechLocal: '名词',
            definitions: [
              {
                definition: `${word} 的释义（请点击刷新按钮获取AI翻译）`,
                example: context || `${word} 的例句`
              }
            ]
          }
        ];
      }
      
      const vocabularyItem = await prisma.vocabularyItem.create({
        data: {
          userId,
          word: word.toLowerCase(),
          definition: wordDefinition?.phonetic ? `${word} ${wordDefinition.phonetic}` : `${word} 的基础定义`,
          phonetic: wordDefinition?.phonetic,
          context: context || `${word} 出现的语境`,
          sourceType: sourceType || 'practice',
          sourceId: sourceId || '',
          language: language || 'en',
          notes: '',
          tags: tags || [],
          mastered: false,
          meanings: aiMeanings,
          definitionLoading: false,
          definitionError: !wordDefinition, // 如果AI失败则标记为错误
          nextReviewDate: new Date()
        }
      });
      
      console.log(`✅ Vocabulary added successfully: ${vocabularyItem.id}`);

      res.status(201).json({
        success: true,
        data: vocabularyItem,
        message: '单词添加成功'
      });
    } catch (error) {
      console.error('Add vocabulary error:', error);
      res.status(500).json({
        success: false,
        error: '添加单词失败'
      });
    }
  }
);

// 获取词汇本列表 (兼容前端 /words 路径)
router.get(['/words', '/'],
  authenticateToken,
  validateRequest({ query: schemas.pagination }),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const sortBy = req.query.sortBy as string || 'createdAt';
      const sortOrder = req.query.sortOrder as string || 'desc';
      const skip = (page - 1) * limit;

      // 映射前端字段到数据库字段
      const sortFieldMap: Record<string, string> = {
        'createdAt': 'addedAt',
        'updatedAt': 'updatedAt', 
        'word': 'word',
        'reviewCount': 'reviewCount',
        'nextReviewDate': 'nextReviewDate'
      };
      
      const dbSortField = sortFieldMap[sortBy] || 'addedAt';
      const orderBy = { [dbSortField]: sortOrder };

      const [vocabulary, total] = await Promise.all([
        prisma.vocabularyItem.findMany({
          where: { userId },
          orderBy,
          skip,
          take: limit
        }),
        prisma.vocabularyItem.count({ where: { userId } })
      ]);

      console.log(`Vocabulary request - User: ${userId}, Found: ${vocabulary.length} words, Total: ${total}`);
      
      // 转换数据格式以匹配前端期望的结构
      const formattedVocabulary = vocabulary.map(item => ({
        id: item.id,
        word: item.word,
        definition: item.definition,
        phonetic: item.phonetic,
        audioUrl: item.audioUrl,
        context: item.context,
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        meanings: item.meanings, // 前端期望的复杂结构
        language: item.language,
        reading: item.reading,
        jlpt: item.jlpt,
        commonality: item.commonality,
        notes: item.notes,
        mastered: item.mastered,
        definitionLoading: item.definitionLoading,
        definitionError: item.definitionError,
        // 复习数据
        reviewCount: item.reviewCount,
        easeIndex: item.easeFactor, // 前端使用 easeIndex
        intervalDays: item.interval, // 前端使用 intervalDays
        nextReviewDate: item.nextReviewDate,
        lastReviewDate: item.lastReviewedAt,
        createdAt: item.addedAt, // 前端使用 createdAt
        updatedAt: item.updatedAt
      }));
      
      res.json({
        success: true,
        data: formattedVocabulary,  // 直接返回词汇数组
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Get vocabulary error:', error);
      res.status(500).json({
        success: false,
        error: '获取词汇本失败'
      });
    }
  }
);

// 获取需要复习的单词
router.get('/review',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;
      const limit = parseInt(req.query.limit as string) || 20;

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
    } catch (error) {
      console.error('Get review words error:', error);
      res.status(500).json({
        success: false,
        error: '获取复习单词失败'
      });
    }
  }
);

// 提交单词复习结果
router.post('/:wordId/review',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;
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
        } else if (vocabularyItem.reviewCount === 1) {
          newInterval = 6;
        } else {
          newInterval = Math.round(vocabularyItem.interval * newEaseFactor);
        }
      } else {
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
    } catch (error) {
      console.error('Submit review error:', error);
      res.status(500).json({
        success: false,
        error: '提交复习结果失败'
      });
    }
  }
);

// 更新单词信息
router.put('/:wordId',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { wordId } = req.params;
      const { notes, mastered } = req.body;

      const vocabularyItem = await prisma.vocabularyItem.findFirst({
        where: { id: wordId, userId }
      });

      if (!vocabularyItem) {
        return res.status(404).json({
          success: false,
          error: '单词不存在'
        });
      }

      const updateData: any = {};
      if (notes !== undefined) updateData.notes = notes;
      if (mastered !== undefined) updateData.mastered = mastered;
      updateData.updatedAt = new Date();

      const updatedItem = await prisma.vocabularyItem.update({
        where: { id: wordId },
        data: updateData
      });

      const formattedWord = {
        id: updatedItem.id,
        word: updatedItem.word,
        definition: updatedItem.definition,
        phonetic: updatedItem.phonetic,
        audioUrl: updatedItem.audioUrl,
        context: updatedItem.context,
        sourceType: updatedItem.sourceType,
        sourceId: updatedItem.sourceId,
        meanings: updatedItem.meanings,
        language: updatedItem.language,
        reading: updatedItem.reading,
        jlpt: updatedItem.jlpt,
        commonality: updatedItem.commonality,
        notes: updatedItem.notes,
        mastered: updatedItem.mastered,
        definitionLoading: updatedItem.definitionLoading,
        definitionError: updatedItem.definitionError,
        reviewCount: updatedItem.reviewCount,
        easeIndex: updatedItem.easeFactor,
        intervalDays: updatedItem.interval,
        nextReviewDate: updatedItem.nextReviewDate,
        lastReviewDate: updatedItem.lastReviewedAt,
        createdAt: updatedItem.addedAt,
        updatedAt: updatedItem.updatedAt
      };

      res.json({
        success: true,
        data: formattedWord,
        message: '单词更新成功'
      });
    } catch (error) {
      console.error('Update vocabulary error:', error);
      res.status(500).json({
        success: false,
        error: '更新单词失败'
      });
    }
  }
);

// 刷新单词定义（重新获取AI翻译）
router.post('/:wordId/refresh-definition',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;
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

      console.log(`🔄 Refreshing definition for word: ${vocabularyItem.word}`);

      try {
        const wordDefinition = await geminiService.getWordDefinition(vocabularyItem.word, vocabularyItem.context);
        
        const updatedItem = await prisma.vocabularyItem.update({
          where: { id: wordId },
          data: {
            phonetic: wordDefinition.phonetic,
            meanings: wordDefinition.meanings,
            definition: wordDefinition.phonetic ? `${vocabularyItem.word} ${wordDefinition.phonetic}` : vocabularyItem.definition,
            definitionLoading: false,
            definitionError: false,
            updatedAt: new Date()
          }
        });

        console.log(`✅ Definition refreshed for ${vocabularyItem.word}`);

        res.json({
          success: true,
          data: {
            id: updatedItem.id,
            word: updatedItem.word,
            phonetic: updatedItem.phonetic,
            meanings: updatedItem.meanings,
            definition: updatedItem.definition,
            definitionError: updatedItem.definitionError
          },
          message: '释义刷新成功'
        });
      } catch (error) {
        console.error(`❌ Failed to refresh definition for ${vocabularyItem.word}:`, error);
        
        // 标记为定义错误状态
        await prisma.vocabularyItem.update({
          where: { id: wordId },
          data: {
            definitionLoading: false,
            definitionError: true
          }
        });

        res.status(500).json({
          success: false,
          error: 'AI释义获取失败，请稍后重试'
        });
      }
    } catch (error) {
      console.error('Refresh definition error:', error);
      res.status(500).json({
        success: false,
        error: '刷新定义失败'
      });
    }
  }
);

// 删除单词
router.delete('/:wordId',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;
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
    } catch (error) {
      console.error('Delete vocabulary error:', error);
      res.status(500).json({
        success: false,
        error: '删除单词失败'
      });
    }
  }
);

// 获取词汇统计
router.get('/stats',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;

      // 使用北京时间计算需要复习的单词（与前端保持一致）
      const beijingNow = getBeijingTime();
      
      const [
        totalWords,
        reviewToday,
        masteredWords,
        recentWords
      ] = await Promise.all([
        prisma.vocabularyItem.count({ where: { userId } }),
        prisma.vocabularyItem.count({
          where: {
            userId,
            nextReviewDate: {
              lte: beijingNow // 使用北京时间
            },
            mastered: false // 排除已掌握的单词
          }
        }),
        prisma.vocabularyItem.count({
          where: {
            userId,
            mastered: true
          }
        }),
        prisma.vocabularyItem.count({
          where: {
            userId,
            addedAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 最近7天
            }
          }
        })
      ]);

      // 使用北京时间计算复习相关统计
      const beijingTime = getBeijingTime();
      const todayStart = new Date(beijingTime);
      todayStart.setHours(0, 0, 0, 0);
      
      const reviewedToday = await prisma.vocabularyItem.count({
        where: {
          userId,
          lastReviewedAt: {
            gte: todayStart
          }
        }
      });

      res.json({
        success: true,
        data: {
          totalWords,
          masteredWords,
          recentWords,
          wordsNeedingReview: reviewToday,
          reviewedToday,
          reviewStreak: 0 // 可以后续实现复习连续天数计算
        }
      });
    } catch (error) {
      console.error('Get vocabulary stats error:', error);
      res.status(500).json({
        success: false,
        error: '获取词汇统计失败'
      });
    }
  }
);

// 获取词汇定义（用于翻译功能） - v2.0.1 部署修复
console.log('🔧 [路由注册] 注册 POST /vocabulary/definition 端点 - v2.0.1');
router.post('/definition',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      console.log(`🚀 [后端API] 收到词汇定义请求`);
      console.log(`🚀 [后端API] 请求体:`, req.body);
      console.log(`🚀 [后端API] 用户信息:`, req.user);
      
      const { word, language = 'zh' } = req.body;
      const userId = req.user!.userId;
      
      if (!word || typeof word !== 'string') {
        console.log(`❌ [后端API] 无效的单词参数: ${word}`);
        return res.status(400).json({
          success: false,
          error: '请提供有效的单词'
        });
      }

      console.log(`🔍 [后端API] 开始处理词汇定义: word="${word}", language="${language}", user="${userId}"`);

      // 1. 先查询数据库是否已有该单词的记录（优先查询当前用户的记录）
      console.log(`🗄️ [后端API] 查询用户词汇记录: userId="${userId}", word="${word.toLowerCase()}"`);
      let existingWord = await prisma.vocabularyItem.findFirst({
        where: {
          userId,
          word: word.toLowerCase()
        }
      });
      console.log(`🗄️ [后端API] 用户词汇查询结果:`, existingWord ? '找到记录' : '未找到记录');

      // 2. 如果当前用户没有，查询是否有其他用户的记录可以复用
      if (!existingWord) {
        console.log(`🗄️ [后端API] 查询其他用户词汇记录: word="${word.toLowerCase()}"`);
        existingWord = await prisma.vocabularyItem.findFirst({
          where: {
            word: word.toLowerCase(),
            meanings: {
              not: null // 确保有有效的meanings数据
            }
          },
          orderBy: {
            addedAt: 'desc' // 获取最新的记录
          }
        });
        console.log(`🗄️ [后端API] 其他用户词汇查询结果:`, existingWord ? '找到记录' : '未找到记录');
      }

      // 3. 如果数据库中有记录，直接返回
      if (existingWord && existingWord.meanings) {
        console.log(`✅ [后端API] 数据库中找到词汇定义: ${word}`, existingWord.meanings);
        
        const response = {
          success: true,
          data: {
            word,
            definition: existingWord.definition || '未找到释义',
            phonetic: existingWord.phonetic,
            partOfSpeech: existingWord.meanings[0]?.partOfSpeech || '',
            meanings: existingWord.meanings || []
          }
        };
        
        console.log(`📤 [后端API] 返回数据库结果:`, response);
        res.json(response);
        return;
      }

      // 4. 数据库中没有记录，调用AI API获取
      console.log(`🤖 [后端API] 数据库无记录，调用AI获取: word="${word}", language="${language}"`);
      
      try {
        console.log(`🤖 [后端API] 调用geminiService.getWordDefinition...`);
        const wordDefinition = await geminiService.getWordDefinition(word, '', language);
        
        console.log(`✅ [后端API] AI返回定义:`, wordDefinition);

        // 5. 返回AI获取的结果（格式与"添加生词"一致）
        const aiResponse = {
          success: true,
          data: {
            word,
            definition: wordDefinition.definition || '未找到释义',
            phonetic: wordDefinition.phonetic,
            partOfSpeech: wordDefinition.partOfSpeech,
            meanings: wordDefinition.meanings || []
          }
        };
        
        console.log(`📤 [后端API] 返回AI结果:`, aiResponse);
        res.json(aiResponse);
      } catch (error) {
        console.error(`❌ [后端API] AI调用失败:`, error);
        
        const errorResponse = {
          success: false,
          error: 'AI翻译服务暂时不可用，请稍后重试'
        };
        
        console.log(`📤 [后端API] 返回错误响应:`, errorResponse);
        res.status(500).json(errorResponse);
      }
    } catch (error) {
      console.error(`💥 [后端API] 外层异常捕获:`, error);
      
      const fatalErrorResponse = {
        success: false,
        error: '获取词汇定义失败'
      };
      
      console.log(`📤 [后端API] 返回致命错误响应:`, fatalErrorResponse);
      res.status(500).json(fatalErrorResponse);
    }
  }
);

// 北京时间处理工具函数
function getBeijingTime(): Date {
  const now = new Date();
  // 转换为北京时间 (UTC+8)
  return new Date(now.getTime() + (8 * 60 * 60 * 1000) - (now.getTimezoneOffset() * 60 * 1000));
}

function getBeijingDayStart(): Date {
  const beijingTime = getBeijingTime();
  const dayStart = new Date(beijingTime);
  dayStart.setHours(0, 0, 0, 0);
  return dayStart;
}

export default router;