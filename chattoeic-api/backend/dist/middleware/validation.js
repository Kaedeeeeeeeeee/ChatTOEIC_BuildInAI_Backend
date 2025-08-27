import Joi from 'joi';
export const validateRequest = (schema) => {
    return (req, res, next) => {
        const errors = [];
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
        limit: Joi.number().integer().min(1).max(100).default(20)
    }),
    // 用户注册
    userRegister: Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().min(6).required(),
        name: Joi.string().optional()
    }),
    // 用户登录
    userLogin: Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().required()
    }),
    // 题目生成请求
    questionGeneration: Joi.object({
        type: Joi.string().valid('LISTENING_PART1', 'LISTENING_PART2', 'LISTENING_PART3', 'LISTENING_PART4', 'READING_PART5', 'READING_PART6', 'READING_PART7').required(),
        difficulty: Joi.string().valid('BEGINNER', 'INTERMEDIATE', 'ADVANCED').required(),
        count: Joi.number().integer().min(1).max(20).required(),
        topic: Joi.string().optional(),
        customPrompt: Joi.string().max(500).optional()
    }),
    // 练习提交
    practiceSubmission: Joi.object({
        sessionId: Joi.string().required(),
        questions: Joi.array().items(Joi.object({
            questionId: Joi.string().required(),
            userAnswer: Joi.string().required(),
            timeSpent: Joi.number().integer().min(0).required()
        })).min(1).required()
    }),
    // 聊天请求
    chatRequest: Joi.object({
        message: Joi.string().min(1).max(2000).required(),
        sessionId: Joi.string().optional(),
        context: Joi.object({
            questionId: Joi.string().optional(),
            practiceSessionId: Joi.string().optional()
        }).optional()
    }),
    // 词汇请求
    vocabularyRequest: Joi.object({
        word: Joi.string().min(1).max(100).required(),
        context: Joi.string().max(500).optional()
    }),
    // ID参数验证
    idParam: Joi.object({
        id: Joi.string().required()
    })
};
