/**
 * 用户行为分析中间件
 * 自动收集和记录用户的学习行为数据
 */
import { AnalyticsLogger } from '../utils/analyticsLogger.js';
import { log } from '../utils/logger.js';
import { prisma } from '../utils/database.js';
// 创建全局分析日志实例
const analyticsLogger = new AnalyticsLogger(prisma);
// 设备类型检测
const detectDeviceType = (userAgent) => {
    if (!userAgent)
        return 'unknown';
    const ua = userAgent.toLowerCase();
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
        return 'mobile';
    }
    else if (ua.includes('tablet') || ua.includes('ipad')) {
        return 'tablet';
    }
    else {
        return 'desktop';
    }
};
// 浏览器类型检测
const detectBrowserType = (userAgent) => {
    if (!userAgent)
        return 'unknown';
    const ua = userAgent.toLowerCase();
    if (ua.includes('chrome'))
        return 'chrome';
    if (ua.includes('firefox'))
        return 'firefox';
    if (ua.includes('safari'))
        return 'safari';
    if (ua.includes('edge'))
        return 'edge';
    return 'other';
};
/**
 * 页面访问追踪中间件
 */
export const trackPageVisit = (req, res, next) => {
    try {
        // 跳过健康检查和静态资源
        if (req.path.includes('health') || req.path.includes('monitoring') || req.path.includes('static')) {
            return next();
        }
        analyticsLogger.logUserBehavior({
            userId: req.user?.userId,
            event: 'page_visited',
            timestamp: new Date(),
            data: {
                pagePath: req.originalUrl,
                method: req.method,
                referrer: req.get('Referer'),
                userAgent: req.get('User-Agent'),
                ip: req.ip,
                deviceType: detectDeviceType(req.get('User-Agent')),
                browserType: detectBrowserType(req.get('User-Agent'))
            },
            metadata: {
                platform: 'web',
                version: '2.0.0',
                environment: process.env.NODE_ENV || 'development'
            }
        });
    }
    catch (error) {
        log.error('Failed to track page visit', { error, path: req.originalUrl });
    }
    next();
};
/**
 * 创建特定功能使用追踪中间件
 */
export const trackFeatureUsage = (featureName) => {
    return (req, res, next) => {
        try {
            analyticsLogger.logUserBehavior({
                userId: req.user?.userId,
                event: 'feature_used',
                timestamp: new Date(),
                data: {
                    featureName,
                    pagePath: req.originalUrl,
                    method: req.method,
                    requestData: req.method === 'POST' ? req.body : req.query,
                    userAgent: req.get('User-Agent'),
                    ip: req.ip
                }
            });
        }
        catch (error) {
            log.error('Failed to track feature usage', { error, featureName });
        }
        next();
    };
};
/**
 * 练习活动追踪中间件
 */
export const trackPracticeActivity = (req, res, next) => {
    const originalSend = res.send;
    res.send = function (data) {
        try {
            // 检查是否是练习相关的成功响应
            if (res.statusCode >= 200 && res.statusCode < 300) {
                let event = null;
                let eventData = {};
                // 根据路径和方法确定事件类型
                if (req.path.includes('/sessions') && req.method === 'POST') {
                    event = 'practice_started';
                    eventData = {
                        practiceType: req.body.sessionType,
                        questionType: req.body.questionType,
                        difficulty: req.body.difficulty,
                        totalQuestions: req.body.totalQuestions
                    };
                }
                else if (req.path.includes('/complete') && req.method === 'POST') {
                    event = 'practice_completed';
                    // 尝试解析响应数据
                    let responseData;
                    try {
                        responseData = typeof data === 'string' ? JSON.parse(data) : data;
                    }
                    catch (e) {
                        responseData = {};
                    }
                    eventData = {
                        practiceType: 'quick_practice',
                        questionsCount: req.body.questions?.length || 0,
                        timeSpent: req.body.timeSpent || 0,
                        score: responseData.data?.score,
                        estimatedScore: responseData.data?.estimatedScore,
                        correctAnswers: responseData.data?.correctAnswers
                    };
                }
                else if (req.path.includes('/generate') && req.method === 'POST') {
                    event = 'feature_used';
                    eventData = {
                        featureName: 'question_generation',
                        questionType: req.body.type,
                        difficulty: req.body.difficulty,
                        count: req.body.count
                    };
                }
                // 记录事件
                if (event) {
                    analyticsLogger.logUserBehavior({
                        userId: req.user?.userId,
                        sessionId: req.headers['x-session-id'],
                        event,
                        timestamp: new Date(),
                        data: eventData
                    });
                }
            }
        }
        catch (error) {
            log.error('Failed to track practice activity', { error, path: req.path });
        }
        return originalSend.call(this, data);
    };
    next();
};
/**
 * AI交互追踪中间件
 */
export const trackAIInteraction = (req, res, next) => {
    const startTime = Date.now();
    const originalSend = res.send;
    res.send = function (data) {
        try {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                const responseTime = Date.now() - startTime;
                let event = 'ai_chat_message_sent';
                const eventData = {
                    messageLength: req.body.message?.length || 0,
                    aiResponseTime: responseTime,
                    chatContext: req.body.questionContext ? 'practice_question' : 'general',
                    hasQuestionContext: !!req.body.questionContext
                };
                // 如果是新的聊天会话
                if (!req.body.conversationHistory || req.body.conversationHistory.length === 0) {
                    event = 'ai_chat_initiated';
                }
                analyticsLogger.logUserBehavior({
                    userId: req.user?.userId,
                    sessionId: req.headers['x-session-id'],
                    event,
                    timestamp: new Date(),
                    data: eventData
                });
            }
        }
        catch (error) {
            log.error('Failed to track AI interaction', { error, path: req.path });
        }
        return originalSend.call(this, data);
    };
    next();
};
/**
 * 词汇学习追踪中间件
 */
export const trackVocabularyActivity = (req, res, next) => {
    const originalSend = res.send;
    res.send = function (data) {
        try {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                let event = null;
                let eventData = {};
                if (req.method === 'POST' && !req.path.includes('/review')) {
                    event = 'vocabulary_word_added';
                    eventData = {
                        wordCount: Array.isArray(req.body) ? req.body.length : 1,
                        source: req.body.source || 'manual'
                    };
                }
                else if (req.path.includes('/review') && req.method === 'POST') {
                    event = 'vocabulary_reviewed';
                    eventData = {
                        wordId: req.params.id,
                        reviewResult: req.body.result
                    };
                }
                if (event) {
                    analyticsLogger.logUserBehavior({
                        userId: req.user?.userId,
                        event,
                        timestamp: new Date(),
                        data: eventData
                    });
                }
            }
        }
        catch (error) {
            log.error('Failed to track vocabulary activity', { error, path: req.path });
        }
        return originalSend.call(this, data);
    };
    next();
};
/**
 * 用户认证追踪中间件
 */
export const trackAuthActivity = (req, res, next) => {
    const originalSend = res.send;
    res.send = function (data) {
        try {
            let event = null;
            let eventData = {
                method: req.path.includes('google') ? 'google_oauth' : 'email_password',
                userAgent: req.get('User-Agent'),
                ip: req.ip,
                deviceType: detectDeviceType(req.get('User-Agent')),
                browserType: detectBrowserType(req.get('User-Agent'))
            };
            if (req.path.includes('/register') && res.statusCode >= 200 && res.statusCode < 300) {
                event = 'user_registered';
                eventData.email = req.body.email;
            }
            else if (req.path.includes('/login') && res.statusCode >= 200 && res.statusCode < 300) {
                event = 'user_login';
                eventData.email = req.body.email;
            }
            else if (req.path.includes('/logout') && res.statusCode >= 200 && res.statusCode < 300) {
                event = 'user_logout';
            }
            if (event) {
                // 尝试获取用户ID
                let userId;
                try {
                    const responseData = typeof data === 'string' ? JSON.parse(data) : data;
                    userId = responseData.data?.user?.id || req.user?.userId;
                }
                catch (e) {
                    userId = req.user?.userId;
                }
                analyticsLogger.logUserBehavior({
                    userId,
                    event,
                    timestamp: new Date(),
                    data: eventData
                });
            }
        }
        catch (error) {
            log.error('Failed to track auth activity', { error, path: req.path });
        }
        return originalSend.call(this, data);
    };
    next();
};
/**
 * 错误追踪中间件
 */
export const trackErrorActivity = (err, req, res, next) => {
    try {
        analyticsLogger.logUserBehavior({
            userId: req.user?.userId,
            event: 'error_encountered',
            timestamp: new Date(),
            data: {
                errorType: err.name || 'Unknown',
                errorMessage: err.message,
                statusCode: err.status || 500,
                path: req.originalUrl,
                method: req.method,
                userAgent: req.get('User-Agent'),
                ip: req.ip
            }
        });
    }
    catch (error) {
        log.error('Failed to track error activity', { error, originalError: err });
    }
    next(err);
};
// 导出分析日志实例供其他地方使用
export { analyticsLogger };
