import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/chattoeic',
      },
    },
    // 添加连接池配置优化
    __internal: {
      engine: {
        connectTimeout: 10000, // 10秒连接超时
        poolTimeout: 10000, // 10秒池超时
      },
    },
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// 数据库连接测试
export async function testDatabaseConnection(): Promise<{ connected: boolean; responseTime?: number; error?: string }> {
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const responseTime = Date.now() - start;
    
    return {
      connected: true,
      responseTime
    };
  } catch (error) {
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