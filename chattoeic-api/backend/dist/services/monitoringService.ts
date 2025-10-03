/**
 * 系统监控服务
 * 提供系统健康状况、性能指标和业务数据监控
 */

import { PrismaClient } from '@prisma/client';
import { log, logSystemHealth, logBusinessEvent } from '../utils/logger.js';

export interface SystemMetrics {
  timestamp: Date;
  uptime: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    heapUsedPercentage: number;
    external: number;
  };
  cpu: {
    user: number;
    system: number;
  };
  database: {
    connected: boolean;
    responseTime?: number;
    activeConnections?: number;
  };
  api: {
    totalRequests: number;
    errorRate: number;
    averageResponseTime: number;
  };
}

export interface BusinessMetrics {
  timestamp: Date;
  users: {
    total: number;
    active: number;
    newToday: number;
  };
  practice: {
    totalSessions: number;
    completedToday: number;
    averageScore: number;
  };
  ai: {
    questionsGenerated: number;
    chatMessages: number;
    apiUsage: number;
  };
}

class MonitoringService {
  private prisma: PrismaClient;
  private metricsCache: Map<string, any> = new Map();
  private readonly CACHE_TTL = 60 * 1000; // 1分钟缓存

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * 获取系统健康状况
   */
  async getSystemHealth(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    metrics: SystemMetrics;
    issues: string[];
  }> {
    const cacheKey = 'system_health';
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    const startTime = Date.now();
    const issues: string[] = [];
    
    try {
      // 系统基础指标
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      const uptime = process.uptime();

      // 内存使用百分比
      const heapUsedPercentage = (memUsage.heapUsed / memUsage.heapTotal) * 100;

      // 数据库连接测试
      const dbStartTime = Date.now();
      let dbConnected = false;
      let dbResponseTime = 0;
      
      try {
        await this.prisma.$queryRaw`SELECT 1`;
        dbConnected = true;
        dbResponseTime = Date.now() - dbStartTime;
      } catch (error) {
        issues.push('Database connection failed');
        log.error('Database health check failed', { error });
      }

      // API性能指标（模拟数据，实际应该从日志中统计）
      const apiMetrics = {
        totalRequests: 0,
        errorRate: 0,
        averageResponseTime: 0
      };

      const metrics: SystemMetrics = {
        timestamp: new Date(),
        uptime,
        memory: {
          rss: memUsage.rss,
          heapTotal: memUsage.heapTotal,
          heapUsed: memUsage.heapUsed,
          heapUsedPercentage,
          external: memUsage.external
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system
        },
        database: {
          connected: dbConnected,
          responseTime: dbResponseTime
        },
        api: apiMetrics
      };

      // 健康状况判断
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';

      if (heapUsedPercentage > 90) {
        issues.push('High memory usage');
        status = 'critical';
      } else if (heapUsedPercentage > 75) {
        issues.push('Elevated memory usage');
        status = status === 'healthy' ? 'warning' : status;
      }

      if (dbResponseTime > 1000) {
        issues.push('Slow database response');
        status = status === 'healthy' ? 'warning' : status;
      }

      if (!dbConnected) {
        status = 'critical';
      }

      const result = { status, metrics, issues };
      
      // 缓存结果
      this.setCachedData(cacheKey, result);
      
      // 记录系统健康日志
      logSystemHealth();
      
      return result;

    } catch (error) {
      log.error('System health check failed', { error });
      return {
        status: 'critical',
        metrics: {} as SystemMetrics,
        issues: ['System health check failed']
      };
    }
  }

  /**
   * 获取业务指标
   */
  async getBusinessMetrics(): Promise<BusinessMetrics> {
    const cacheKey = 'business_metrics';
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // 用户指标
      const [totalUsers, newUsersToday] = await Promise.all([
        this.prisma.user.count(),
        this.prisma.user.count({
          where: {
            createdAt: {
              gte: today,
              lt: tomorrow
            }
          }
        })
      ]);

      // 活跃用户（最近24小时有活动）
      const activeUsers = await this.prisma.user.count({
        where: {
          lastLoginAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      });

      // 练习指标
      const [totalSessions, todaySessions] = await Promise.all([
        this.prisma.practiceRecord.count(),
        this.prisma.practiceRecord.count({
          where: {
            completedAt: {
              gte: today,
              lt: tomorrow
            }
          }
        })
      ]);

      // 平均分数
      const avgScoreResult = await this.prisma.practiceRecord.aggregate({
        _avg: {
          score: true
        },
        where: {
          score: {
            not: null
          }
        }
      });

      // AI使用指标（估算）
      const chatMessagesCount = await this.prisma.chatSession.count({
        where: {
          createdAt: {
            gte: today,
            lt: tomorrow
          }
        }
      });

      const metrics: BusinessMetrics = {
        timestamp: new Date(),
        users: {
          total: totalUsers,
          active: activeUsers,
          newToday: newUsersToday
        },
        practice: {
          totalSessions,
          completedToday: todaySessions,
          averageScore: Math.round(avgScoreResult._avg.score || 0)
        },
        ai: {
          questionsGenerated: todaySessions * 5, // 估算：每次练习5道题
          chatMessages: chatMessagesCount,
          apiUsage: (todaySessions * 5) + chatMessagesCount
        }
      };

      // 缓存结果
      this.setCachedData(cacheKey, metrics);
      
      // 记录业务指标
      logBusinessEvent({
        event: 'metrics_collected',
        data: metrics
      });

      return metrics;

    } catch (error) {
      log.error('Business metrics collection failed', { error });
      throw error;
    }
  }

  /**
   * 获取实时统计数据
   */
  async getRealTimeStats() {
    try {
      const [systemHealth, businessMetrics] = await Promise.all([
        this.getSystemHealth(),
        this.getBusinessMetrics()
      ]);

      return {
        system: systemHealth,
        business: businessMetrics,
        timestamp: new Date()
      };
    } catch (error) {
      log.error('Real-time stats collection failed', { error });
      throw error;
    }
  }

  /**
   * 启动定期健康检查
   */
  startPeriodicHealthCheck(intervalMinutes: number = 5) {
    const interval = intervalMinutes * 60 * 1000;
    
    log.info('Starting periodic health check', { 
      intervalMinutes,
      nextCheck: new Date(Date.now() + interval)
    });

    setInterval(async () => {
      try {
        const health = await this.getSystemHealth();
        
        if (health.status === 'critical') {
          log.error('System health critical', {
            issues: health.issues,
            metrics: health.metrics
          });
        } else if (health.status === 'warning') {
          log.warn('System health warning', {
            issues: health.issues
          });
        } else {
          log.info('System health check passed');
        }
      } catch (error) {
        log.error('Periodic health check failed', { error });
      }
    }, interval);
  }

  /**
   * 缓存帮助方法
   */
  private getCachedData(key: string): any {
    const cached = this.metricsCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }
    return null;
  }

  private setCachedData(key: string, data: any): void {
    this.metricsCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * 清理缓存
   */
  clearCache(): void {
    this.metricsCache.clear();
    log.info('Monitoring cache cleared');
  }
}

export { MonitoringService };