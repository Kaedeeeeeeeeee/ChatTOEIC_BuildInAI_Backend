/**
 * Dashboard 实时数据流
 * 使用 Server-Sent Events (SSE) 实现简单稳定的实时数据同步
 */
import { Router } from 'express';
import { prisma } from '../utils/database.js';
import { log } from '../utils/logger.js';
const router = Router();
// 存储活跃的 SSE 连接
const activeConnections = new Set();
// 获取核心用户数据
async function getCoreUserData() {
    try {
        // 计算今天的时间范围（北京时间）
        const now = new Date();
        const beijingTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
        const todayStart = new Date(beijingTime);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(beijingTime);
        todayEnd.setHours(23, 59, 59, 999);
        // 转换为UTC时间查询数据库
        const todayStartUTC = new Date(todayStart.getTime() - (8 * 60 * 60 * 1000));
        const todayEndUTC = new Date(todayEnd.getTime() - (8 * 60 * 60 * 1000));
        // 并行查询所有数据
        const [totalUsers, dailyActiveUsers, recentUsers] = await Promise.all([
            // 总用户数
            prisma.user.count(),
            // 今日活跃用户数
            prisma.user.count({
                where: {
                    lastLoginAt: {
                        gte: todayStartUTC,
                        lte: todayEndUTC
                    }
                }
            }),
            // 最近的用户（最多10个）
            prisma.user.findMany({
                select: {
                    id: true,
                    email: true,
                    lastLoginAt: true,
                    isActive: true,
                    emailVerified: true,
                    createdAt: true
                },
                orderBy: {
                    createdAt: 'desc'
                },
                take: 10
            })
        ]);
        // 处理用户状态
        const processedUsers = recentUsers.map(user => {
            let status = 'inactive';
            if (!user.isActive) {
                status = 'banned';
            }
            else if (user.lastLoginAt) {
                const daysSinceLogin = (now.getTime() - user.lastLoginAt.getTime()) / (1000 * 60 * 60 * 24);
                if (daysSinceLogin < 7) {
                    status = 'active';
                }
            }
            return {
                id: user.id,
                email: user.email,
                lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
                isActive: user.isActive,
                status
            };
        });
        return {
            totalUsers,
            dailyActiveUsers,
            onlineUsers: dailyActiveUsers, // 简化：在线用户 ≈ 今日活跃用户
            recentUsers: processedUsers,
            lastUpdate: new Date().toISOString()
        };
    }
    catch (error) {
        log.error('获取核心用户数据失败', { error });
        throw error;
    }
}
// SSE 数据推送端点
router.get('/stream', async (req, res) => {
    // 设置 SSE 头部
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
    });
    // 添加到活跃连接
    activeConnections.add(res);
    console.log(`📡 新的Dashboard连接建立，当前连接数: ${activeConnections.size}`);
    // 立即发送当前数据
    try {
        const data = await getCoreUserData();
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
    catch (error) {
        console.error('❌ 初始数据发送失败:', error);
        res.write(`data: ${JSON.stringify({ error: '数据获取失败' })}\n\n`);
    }
    // 定期发送心跳
    const heartbeat = setInterval(() => {
        res.write(`: heartbeat ${Date.now()}\n\n`);
    }, 30000);
    // 处理连接关闭
    req.on('close', () => {
        activeConnections.delete(res);
        clearInterval(heartbeat);
        console.log(`📡 Dashboard连接关闭，剩余连接数: ${activeConnections.size}`);
    });
    req.on('error', (error) => {
        console.error('📡 SSE连接错误:', error);
        activeConnections.delete(res);
        clearInterval(heartbeat);
    });
});
// 手动触发数据更新
router.post('/refresh', async (req, res) => {
    try {
        const data = await getCoreUserData();
        // 向所有连接的Dashboard推送更新
        activeConnections.forEach(connection => {
            try {
                connection.write(`data: ${JSON.stringify(data)}\n\n`);
            }
            catch (error) {
                console.error('推送数据失败:', error);
                activeConnections.delete(connection);
            }
        });
        res.json({
            success: true,
            message: '数据已更新',
            activeConnections: activeConnections.size,
            data
        });
    }
    catch (error) {
        console.error('❌ 手动刷新数据失败:', error);
        res.status(500).json({
            success: false,
            error: '数据刷新失败'
        });
    }
});
// 触发实时更新的函数（供其他模块调用）
export async function notifyDashboardUpdate(event, data) {
    try {
        console.log(`📡 触发Dashboard更新: ${event}`, data);
        const coreData = await getCoreUserData();
        const updateMessage = {
            event,
            timestamp: new Date().toISOString(),
            data: coreData,
            trigger: data
        };
        // 推送给所有连接的Dashboard
        activeConnections.forEach(connection => {
            try {
                connection.write(`data: ${JSON.stringify(updateMessage)}\n\n`);
            }
            catch (error) {
                console.error('推送更新失败:', error);
                activeConnections.delete(connection);
            }
        });
        console.log(`✅ Dashboard更新已推送给 ${activeConnections.size} 个连接`);
    }
    catch (error) {
        console.error('❌ Dashboard更新通知失败:', error);
    }
}
// 定期自动刷新数据（每分钟）
setInterval(async () => {
    if (activeConnections.size > 0) {
        try {
            await notifyDashboardUpdate('auto_refresh');
        }
        catch (error) {
            console.error('❌ 定期刷新失败:', error);
        }
    }
}, 60000);
export default router;
