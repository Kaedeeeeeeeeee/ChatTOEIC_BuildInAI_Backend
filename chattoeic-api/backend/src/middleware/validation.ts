import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

export const validateRequest = (schema: {
  body?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
}) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: string[] = [];

    // 验证请求体
    if (schema.body) {
      const { error } = schema.body.validate(req.body);
      if (error) {
        errors.push(`请求体: ${error.details.map(d => d.message).join(', ')}`);
      }
    }

    // 验证查询参数
    if (schema.query) {
      const { error } = schema.query.validate(req.query);
      if (error) {
        errors.push(`查询参数: ${error.details.map(d => d.message).join(', ')}`);
      }
    }

    // 验证路径参数
    if (schema.params) {
      const { error } = schema.params.validate(req.params);
      if (error) {
        errors.push(`路径参数: ${error.details.map(d => d.message).join(', ')}`);
      }
    }

    if (errors.length > 0) {
      console.log('Validation failed:', {
        path: req.path,
        method: req.method,
        body: req.body,
        errors
      });
      return res.status(400).json({
        success: false,
        error: '验证失败',
        details: errors
      });
    }

    next();
  };
};

// 通用验证模式
export const schemas = {
  // 分页参数
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string().valid('createdAt', 'updatedAt', 'name', 'word', 'reviewCount', 'nextReviewDate').optional(),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc').optional()
  }),

  // 用户注册
  userRegister: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    name: Joi.string().min(1).required(),
    verificationCode: Joi.string().length(6).optional() // 6位验证码，可选
  }),

  // 用户登录
  userLogin: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),

  // 题目生成请求
  questionGeneration: Joi.object({
    type: Joi.string().valid(
      'LISTENING_PART1', 'LISTENING_PART2', 'LISTENING_PART3', 'LISTENING_PART4',
      'READING_PART5', 'READING_PART6', 'READING_PART7'
    ).required(),
    difficulty: Joi.string().valid(
      'UNDER_500', 'LEVEL_500_600', 'LEVEL_600_700', 'LEVEL_700_800', 'OVER_800',
      // 向后兼容旧的难度级别
      'BEGINNER', 'INTERMEDIATE', 'ADVANCED'
    ).required(),
    count: Joi.number().integer().min(1).max(20).required(),
    topic: Joi.string().optional(),
    customPrompt: Joi.string().max(500).optional(),
    language: Joi.string().valid('en', 'zh', 'ja').optional(),
    timeLimit: Joi.number().integer().min(0).optional() // 允许timeLimit字段
  }),

  // 练习提交
  practiceSubmission: Joi.object({
    sessionId: Joi.string().required(),
    questions: Joi.array().items(
      Joi.object({
        questionId: Joi.string().required(),
        userAnswer: Joi.string().required(),
        timeSpent: Joi.number().integer().min(0).required()
      })
    ).min(1).required()
  }),

  // 聊天请求
  chatRequest: Joi.object({
    message: Joi.string().min(1).max(2000).required(),
    sessionId: Joi.string().optional(),
    context: Joi.object({
      questionId: Joi.string().optional(),
      practiceSessionId: Joi.string().optional()
    }).optional(),
    // 支持前端发送的 questionContext 格式
    questionContext: Joi.object({
      id: Joi.string().optional(),
      question: Joi.string().optional(),
      options: Joi.array().items(Joi.string()).optional(),
      correctAnswer: Joi.number().optional(),
      category: Joi.string().optional(),
      difficulty: Joi.alternatives().try(
        Joi.string().valid('BEGINNER', 'INTERMEDIATE', 'ADVANCED'),
        Joi.number()
      ).optional(),
      userAnswer: Joi.number().optional(),
      explanation: Joi.string().optional()
    }).optional(),
    // 支持语言指令字段
    languageInstruction: Joi.string().optional()
  }),

  // 词汇请求
  vocabularyRequest: Joi.object({
    word: Joi.string().min(1).max(100).required(),
    context: Joi.string().max(500).optional(),
    sourceType: Joi.string().valid('practice', 'review', 'manual').optional(),
    sourceId: Joi.string().optional(),
    tags: Joi.array().items(Joi.string()).optional(),
    language: Joi.string().valid('zh', 'en', 'auto').optional()
  }),

  // ID参数验证
  idParam: Joi.object({
    id: Joi.string().required()
  })
};