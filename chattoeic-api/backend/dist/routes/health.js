import { Router } from 'express';
import { testDatabaseConnection } from '../utils/database.js';
const router = Router();
// 基础健康检查
router.get('/', async (req, res) => {
    const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '2.0.0'
    };
    res.status(200).json(healthStatus);
});
// 详细健康检查
router.get('/detailed', async (req, res) => {
    try {
        // 测试数据库连接
        const dbStatus = await testDatabaseConnection();
        // 获取内存使用情况
        const memUsage = process.memoryUsage();
        const detailedStatus = {
            status: dbStatus.connected ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            version: process.env.npm_package_version || '2.0.0',
            database: dbStatus,
            memory: {
                used: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
                free: Math.round((memUsage.heapTotal - memUsage.heapUsed) / 1024 / 1024), // MB
                total: Math.round(memUsage.heapTotal / 1024 / 1024) // MB
            },
            services: {
                gemini: {
                    available: !!process.env.GEMINI_API_KEY,
                    rateLimit: {
                        remaining: 100, // 这里应该从实际的速率限制服务获取
                        resetTime: new Date(Date.now() + 60 * 60 * 1000).toISOString()
                    }
                }
            }
        };
        const statusCode = detailedStatus.status === 'healthy' ? 200 : 503;
        res.status(statusCode).json(detailedStatus);
    }
    catch (error) {
        console.error('Health check failed:', error);
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            version: process.env.npm_package_version || '2.0.0',
            error: 'Health check failed'
        });
    }
});
// 就绪检查 (Railway使用)
router.get('/ready', async (req, res) => {
    try {
        const dbStatus = await testDatabaseConnection();
        if (dbStatus.connected) {
            res.status(200).json({ ready: true });
        }
        else {
            res.status(503).json({ ready: false, reason: 'Database not connected' });
        }
    }
    catch (error) {
        res.status(503).json({ ready: false, reason: 'Health check failed' });
    }
});
// 存活检查
router.get('/live', (req, res) => {
    res.status(200).json({
        alive: true,
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});
// 度量指标
router.get('/metrics', async (req, res) => {
    try {
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        const metrics = {
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: {
                rss: memUsage.rss,
                heapTotal: memUsage.heapTotal,
                heapUsed: memUsage.heapUsed,
                external: memUsage.external
            },
            cpu: {
                user: cpuUsage.user,
                system: cpuUsage.system
            },
            process: {
                pid: process.pid,
                version: process.version,
                platform: process.platform,
                arch: process.arch
            }
        };
        res.status(200).json(metrics);
    }
    catch (error) {
        console.error('Metrics collection failed:', error);
        res.status(500).json({
            error: 'Failed to collect metrics'
        });
    }
});
export default router;
