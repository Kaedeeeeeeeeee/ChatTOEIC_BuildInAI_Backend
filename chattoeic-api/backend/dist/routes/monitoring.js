/**
 * 监控和健康检查API路由
 * 提供系统状态、性能指标和业务数据的API端点
 */
import { Router } from 'express';
import { prisma } from '../utils/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { MonitoringService } from '../services/monitoringService.js';
import { log, logSecurityEvent } from '../utils/logger.js';
const router = Router();
const monitoringService = new MonitoringService(prisma);
// 简单健康检查 (公开访问)
router.get('/health', async (req, res) => {
    try {
        const startTime = Date.now();
        // 基础健康检查
        const dbCheck = await prisma.$queryRaw `SELECT 1 as status`;
        const responseTime = Date.now() - startTime;
        res.status(200).json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: Math.floor(process.uptime()),
            database: {
                connected: !!dbCheck,
                responseTime: `${responseTime}ms`
            },
            memory: {
                used: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
                total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`
            }
        });
    }
    catch (error) {
        log.error('Health check failed', { error });
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: 'Health check failed'
        });
    }
});
// 详细系统健康检查 (需要认证)
router.get('/health/detailed', authenticateToken, async (req, res) => {
    try {
        // 记录管理员访问监控数据
        logSecurityEvent({
            type: 'unauthorized_access',
            severity: 'low',
            userId: req.user?.userId,
            ip: req.ip,
            details: { endpoint: '/monitoring/health/detailed' }
        });
        const health = await monitoringService.getSystemHealth();
        res.json({
            success: true,
            data: health,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        log.error('Detailed health check failed', {
            error,
            userId: req.user?.userId
        });
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve system health'
        });
    }
});
// 业务指标 (需要认证)
router.get('/metrics/business', authenticateToken, async (req, res) => {
    try {
        const metrics = await monitoringService.getBusinessMetrics();
        res.json({
            success: true,
            data: metrics,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        log.error('Business metrics retrieval failed', {
            error,
            userId: req.user?.userId
        });
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve business metrics'
        });
    }
});
// 实时统计数据 (需要认证)
router.get('/stats/realtime', authenticateToken, async (req, res) => {
    try {
        const stats = await monitoringService.getRealTimeStats();
        res.json({
            success: true,
            data: stats,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        log.error('Real-time stats retrieval failed', {
            error,
            userId: req.user?.userId
        });
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve real-time stats'
        });
    }
});
// 系统信息 (需要认证)
router.get('/system/info', authenticateToken, async (req, res) => {
    try {
        const systemInfo = {
            node: {
                version: process.version,
                platform: process.platform,
                arch: process.arch,
                uptime: Math.floor(process.uptime()),
                pid: process.pid
            },
            memory: process.memoryUsage(),
            environment: {
                nodeEnv: process.env.NODE_ENV || 'development',
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
            },
            application: {
                name: 'ChatTOEIC API',
                version: process.env.APP_VERSION || '2.0.0',
                startTime: new Date(Date.now() - (process.uptime() * 1000)).toISOString()
            }
        };
        res.json({
            success: true,
            data: systemInfo,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        log.error('System info retrieval failed', {
            error,
            userId: req.user?.userId
        });
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve system information'
        });
    }
});
// 清理监控缓存 (需要认证)
router.post('/cache/clear', authenticateToken, async (req, res) => {
    try {
        monitoringService.clearCache();
        log.info('Monitoring cache cleared by user', {
            userId: req.user?.userId,
            ip: req.ip
        });
        res.json({
            success: true,
            message: 'Monitoring cache cleared successfully',
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        log.error('Cache clear failed', {
            error,
            userId: req.user?.userId
        });
        res.status(500).json({
            success: false,
            error: 'Failed to clear cache'
        });
    }
});
// 获取最近的日志条目 (需要认证 - 仅供调试使用)
router.get('/logs/recent', authenticateToken, async (req, res) => {
    try {
        const { level = 'info', limit = 50 } = req.query;
        // 记录日志访问
        logSecurityEvent({
            type: 'unauthorized_access',
            severity: 'medium',
            userId: req.user?.userId,
            ip: req.ip,
            details: {
                endpoint: '/monitoring/logs/recent',
                level,
                limit
            }
        });
        // 注意：这里只是示例，实际实现需要从日志文件或日志服务中读取
        res.json({
            success: true,
            message: 'Log access requires file system integration',
            data: {
                note: 'This endpoint would typically read from log files',
                params: { level, limit }
            },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        log.error('Recent logs retrieval failed', {
            error,
            userId: req.user?.userId
        });
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve recent logs'
        });
    }
});
// Ping端点 (用于外部监控服务)
router.get('/ping', (req, res) => {
    res.status(200).json({
        status: 'pong',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime())
    });
});
export default router;
