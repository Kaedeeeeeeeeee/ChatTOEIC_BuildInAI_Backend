import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';

// 通用速率限制
export const generalRateLimit = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS!) || 15 * 60 * 1000, // 15分钟
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS!) || 100, // 限制每个IP每个windowMs最多请求数
  message: {
    success: false,
    error: '请求过于频繁，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// AI相关API的严格限制
export const aiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 30, // AI请求限制更严格
  message: {
    success: false,
    error: 'AI请求过于频繁，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// 认证相关的适度限制
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 20, // 增加到20次，支持Google OAuth流程
  message: {
    success: false,
    error: '认证请求过于频繁，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // 成功的请求不计入限制
});

// OAuth专用的宽松限制
export const oauthRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5分钟
  max: 50, // OAuth流程需要多次请求
  message: {
    success: false,
    error: 'OAuth认证请求过于频繁，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

// 慢速限制中间件
export const generalSlowDown = slowDown({
  windowMs: parseInt(process.env.SLOW_DOWN_WINDOW_MS!) || 15 * 60 * 1000, // 15分钟
  delayAfter: parseInt(process.env.SLOW_DOWN_DELAY_AFTER!) || 50, // 超过50个请求后开始延迟
  delayMs: () => 500, // 修复express-slow-down v2警告，使用函数形式
  maxDelayMs: 5000, // 最大延迟5秒
  validate: { delayMs: false }, // 禁用警告消息
});

// 文件上传的速率限制
export const uploadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1小时
  max: 10, // 每小时最多10次上传
  message: {
    success: false,
    error: '文件上传过于频繁，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false,
});