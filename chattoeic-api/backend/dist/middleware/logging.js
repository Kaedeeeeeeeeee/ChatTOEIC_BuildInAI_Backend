/**
 * HTTP请求日志中间件
 * 记录所有API请求的详细信息，用于监控和分析
 */
import responseTime from 'response-time';
import { log, logPerformance, logBusinessEvent } from '../utils/logger.js';
// 生成请求ID
const generateRequestId = () => {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};
// 请求开始时间中间件
export const requestTimer = (req, res, next) => {
    req.startTime = new Date();
    req.requestId = generateRequestId();
    // 在响应头中添加请求ID
    res.setHeader('X-Request-ID', req.requestId);
    next();
};
// HTTP请求日志中间件
export const httpLogger = (req, res, next) => {
    const startTime = Date.now();
    // 记录请求开始
    log.http('HTTP Request Started', {
        requestId: req.requestId,
        method: req.method,
        url: req.originalUrl,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        contentLength: req.get('Content-Length'),
        contentType: req.get('Content-Type'),
        timestamp: new Date().toISOString()
    });
    // 监听响应结束事件
    res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        // 构建性能指标
        const metrics = {
            timestamp: new Date(),
            endpoint: req.route?.path || req.path,
            method: req.method,
            responseTime,
            statusCode: res.statusCode,
            userId: req.user?.userId,
            userAgent: req.get('User-Agent'),
            ip: req.ip || req.connection.remoteAddress,
        };
        // 如果是错误响应，添加错误信息
        if (res.statusCode >= 400) {
            metrics.errorMessage = `HTTP ${res.statusCode}`;
        }
        // 记录性能指标
        logPerformance(metrics);
        // 记录响应完成
        log.http('HTTP Request Completed', {
            requestId: req.requestId,
            method: req.method,
            url: req.originalUrl,
            statusCode: res.statusCode,
            responseTime: `${responseTime}ms`,
            contentLength: res.get('Content-Length'),
            timestamp: new Date().toISOString()
        });
        // 记录慢请求
        if (responseTime > 5000) { // 5秒以上的请求
            log.warn('Slow Request Detected', {
                requestId: req.requestId,
                method: req.method,
                url: req.originalUrl,
                responseTime: `${responseTime}ms`,
                statusCode: res.statusCode
            });
        }
        // 记录错误请求
        if (res.statusCode >= 500) {
            log.error('Server Error Response', {
                requestId: req.requestId,
                method: req.method,
                url: req.originalUrl,
                statusCode: res.statusCode,
                responseTime: `${responseTime}ms`
            });
        }
    });
    next();
};
// 业务事件记录中间件（用于特定路由）
export const logBusinessActivity = (eventType) => {
    return (req, res, next) => {
        // 记录业务活动
        logBusinessEvent({
            event: eventType,
            userId: req.user?.userId,
            sessionId: req.headers['x-session-id'],
            data: {
                method: req.method,
                path: req.path,
                query: req.query,
                ip: req.ip
            }
        });
        next();
    };
};
// 响应时间中间件配置
export const responseTimeMiddleware = responseTime((req, res, time) => {
    // 将响应时间添加到响应头
    res.setHeader('X-Response-Time', `${time}ms`);
    // 记录响应时间统计
    log.debug('Response Time', {
        requestId: req.requestId,
        method: req.method,
        url: req.originalUrl,
        responseTime: `${time}ms`,
        statusCode: res.statusCode
    });
});
// 错误日志中间件
export const errorLogger = (err, req, res, next) => {
    // 记录详细错误信息
    log.error('Request Error', {
        requestId: req.requestId,
        error: {
            message: err.message,
            stack: err.stack,
            name: err.name,
            code: err.code,
            status: err.status || err.statusCode
        },
        request: {
            method: req.method,
            url: req.originalUrl,
            headers: req.headers,
            query: req.query,
            body: req.body,
            params: req.params,
            ip: req.ip,
            userAgent: req.get('User-Agent')
        },
        user: {
            userId: req.user?.userId,
            email: req.user?.email
        },
        timestamp: new Date().toISOString()
    });
    next(err);
};
// 健康检查中间件
export const healthCheckLogger = (req, res, next) => {
    // 健康检查请求不记录到主日志，使用单独的日志级别
    if (req.path === '/health' || req.path === '/ping') {
        log.debug('Health Check', {
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: process.memoryUsage()
        });
    }
    next();
};
// API使用统计中间件
export const apiUsageTracker = (req, res, next) => {
    const endpoint = req.route?.path || req.path;
    // 跳过健康检查和静态资源
    if (endpoint.includes('health') || endpoint.includes('static')) {
        return next();
    }
    // 记录API使用情况
    logBusinessEvent({
        event: 'api_usage',
        userId: req.user?.userId,
        data: {
            endpoint,
            method: req.method,
            userAgent: req.get('User-Agent'),
            ip: req.ip,
            timestamp: new Date()
        }
    });
    next();
};
