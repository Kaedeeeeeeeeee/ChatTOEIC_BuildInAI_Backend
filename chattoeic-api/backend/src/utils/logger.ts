/**
 * 日志系统配置
 * 使用Winston进行结构化日志记录
 */

import winston from 'winston';
import path from 'path';

// 日志级别定义
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// 日志级别对应的颜色
const LOG_COLORS = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

// 添加颜色配置
winston.addColors(LOG_COLORS);

// 自定义日志格式
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// 控制台输出格式
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    
    // 如果有额外的元数据，添加到日志中
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta, null, 2)}`;
    }
    
    return log;
  })
);

// Winston logger配置 - 专为容器化环境优化，只使用控制台输出
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels: LOG_LEVELS,
  format: logFormat,
  defaultMeta: {
    service: 'chattoeic-api',
    environment: process.env.NODE_ENV || 'development',
    version: '3.1.0-PASSAGE-FIX-20251006' // 从 config/version.ts 导入会导致循环依赖
  },
  transports: [
    // 只使用控制台传输器，符合容器化最佳实践
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
          let log = `${timestamp} [${service}] ${level}: ${message}`;
          if (Object.keys(meta).length > 0) {
            log += ` ${JSON.stringify(meta, null, 2)}`;
          }
          return log;
        })
      )
    })
  ],
  
  // 异常和Promise rejection处理也使用控制台
  exceptionHandlers: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      )
    })
  ],
  
  rejectionHandlers: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      )
    })
  ]
});

// 控制台传输器已在主配置中包含，无需额外添加
// 日志级别通过 LOG_LEVEL 环境变量控制

// 导出日志函数
export const log = {
  error: (message: string, meta?: any) => logger.error(message, meta),
  warn: (message: string, meta?: any) => logger.warn(message, meta),
  info: (message: string, meta?: any) => logger.info(message, meta),
  http: (message: string, meta?: any) => logger.http(message, meta),
  debug: (message: string, meta?: any) => logger.debug(message, meta),
};

// 应用性能监控数据结构
export interface PerformanceMetrics {
  timestamp: Date;
  endpoint: string;
  method: string;
  responseTime: number;
  statusCode: number;
  userId?: string;
  userAgent?: string;
  ip?: string;
  errorMessage?: string;
  memoryUsage?: NodeJS.MemoryUsage;
  cpuUsage?: NodeJS.CpuUsage;
}

// 性能指标记录
export const logPerformance = (metrics: PerformanceMetrics) => {
  logger.http('API Performance', {
    type: 'performance',
    ...metrics,
    memoryUsage: process.memoryUsage(),
    uptime: process.uptime()
  });
};

// 业务事件日志
export interface BusinessEvent {
  event: string;
  userId?: string;
  sessionId?: string;
  data?: any;
  timestamp?: Date;
}

export const logBusinessEvent = (event: BusinessEvent) => {
  logger.info('Business Event', {
    type: 'business_event',
    timestamp: new Date(),
    ...event
  });
};

// 安全事件日志
export interface SecurityEvent {
  type: 'auth_failure' | 'rate_limit_exceeded' | 'suspicious_activity' | 'unauthorized_access';
  ip?: string;
  userAgent?: string;
  userId?: string;
  details?: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export const logSecurityEvent = (event: SecurityEvent) => {
  const level = event.severity === 'critical' || event.severity === 'high' ? 'error' : 'warn';
  
  logger[level]('Security Event', {
    type: 'security_event',
    timestamp: new Date(),
    ...event
  });
};

// 系统健康检查
export const logSystemHealth = () => {
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  
  logger.info('System Health Check', {
    type: 'system_health',
    timestamp: new Date(),
    uptime: process.uptime(),
    memory: {
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      external: `${Math.round(memUsage.external / 1024 / 1024)}MB`
    },
    cpu: {
      user: cpuUsage.user,
      system: cpuUsage.system
    }
  });
};

// 错误处理增强
export const logError = (error: Error, context?: any) => {
  logger.error('Application Error', {
    type: 'error',
    timestamp: new Date(),
    message: error.message,
    stack: error.stack,
    name: error.name,
    context
  });
};

export default logger;