import { PrismaClient } from '@prisma/client';
const globalForPrisma = globalThis;
export const prisma = globalForPrisma.prisma ??
    new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
        datasources: {
            db: {
                url: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/chattoeic',
            },
        },
    });
if (process.env.NODE_ENV !== 'production')
    globalForPrisma.prisma = prisma;
// 数据库连接测试
export async function testDatabaseConnection() {
    try {
        const start = Date.now();
        await prisma.$queryRaw `SELECT 1`;
        const responseTime = Date.now() - start;
        return {
            connected: true,
            responseTime
        };
    }
    catch (error) {
        console.warn('Database connection test failed:', error);
        return {
            connected: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}
// 优雅关闭数据库连接
export async function disconnectDatabase() {
    await prisma.$disconnect();
}
