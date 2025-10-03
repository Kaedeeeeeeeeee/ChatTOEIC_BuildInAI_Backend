/**
 * 数据库管理API路由
 * 提供数据库迁移和管理功能
 */

import { Router, Request, Response } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { prisma } from '../utils/database.js';

const router = Router();

// 执行数据库迁移
router.post('/migrate', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { action, migration_name } = req.body;
    
    if (action === 'deploy_migrations' && migration_name === 'add_token_blacklist') {
      // 执行TokenBlacklist表创建
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "token_blacklist" (
          "id" TEXT NOT NULL,
          "userId" TEXT NOT NULL,
          "tokenId" TEXT NOT NULL,
          "reason" TEXT NOT NULL,
          "expiresAt" TIMESTAMP(3) NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "token_blacklist_pkey" PRIMARY KEY ("id")
        );
      `;
      
      // 创建唯一索引
      await prisma.$executeRaw`
        CREATE UNIQUE INDEX IF NOT EXISTS "token_blacklist_userId_tokenId_key" 
        ON "token_blacklist"("userId", "tokenId");
      `;
      
      console.log('✅ TokenBlacklist表创建成功');
      
      res.json({
        success: true,
        message: 'TokenBlacklist表迁移完成',
        migration: migration_name
      });
    } else if (action === 'fix_migration_record' && migration_name === '20250821151729_add_token_blacklist') {
      // 修复迁移记录 - 手动标记迁移为完成
      try {
        // 首先检查表是否存在
        await prisma.$queryRaw`SELECT 1 FROM "token_blacklist" LIMIT 1`;
        
        // 表存在，尝试修复迁移记录
        await prisma.$executeRaw`
          INSERT INTO "_prisma_migrations" 
          (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
          VALUES (
            gen_random_uuid(), 
            'b5c5f8c3d5e7c8b0e9d2a1f7c9b4d6e3f8c1a5d9e7b2c4f6a8d3e5f7c9b1d8e4',
            NOW(), 
            '20250821151729_add_token_blacklist',
            NULL,
            NULL,
            NOW(),
            1
          )
          ON CONFLICT (migration_name) DO NOTHING;
        `;
        
        console.log('✅ 迁移记录修复完成');
        
        res.json({
          success: true,
          message: '迁移记录已修复，TokenBlacklist表功能正常',
          migration: migration_name
        });
      } catch (error) {
        console.error('修复迁移记录失败:', error);
        res.json({
          success: false,
          error: '迁移记录修复失败: ' + error.message,
          note: '但TokenBlacklist表可能已经存在并可正常使用'
        });
      }
    } else {
      res.status(400).json({
        success: false,
        error: '不支持的迁移操作'
      });
    }
  } catch (error) {
    console.error('数据库迁移失败:', error);
    res.status(500).json({
      success: false,
      error: '数据库迁移失败: ' + error.message
    });
  }
});

// 检查数据库表状态
router.get('/status', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    // 检查关键表是否存在
    const tableChecks = await Promise.allSettled([
      prisma.$queryRaw`SELECT 1 FROM "User" LIMIT 1`,
      prisma.$queryRaw`SELECT 1 FROM "token_blacklist" LIMIT 1`
    ]);
    
    const tablesStatus = {
      users: tableChecks[0].status === 'fulfilled',
      tokenBlacklist: tableChecks[1].status === 'fulfilled'
    };
    
    // 获取表统计
    let stats: any = {};
    if (tablesStatus.users) {
      const userCount = await prisma.user.count();
      stats.users = { count: userCount };
    }

    if (tablesStatus.tokenBlacklist) {
      try {
        const blacklistCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM "token_blacklist"` as Array<{count: bigint}>;
        stats.tokenBlacklist = { count: Number(blacklistCount[0]?.count || 0) };
      } catch (error) {
        stats.tokenBlacklist = { error: 'Failed to query' };
      }
    }
    
    res.json({
      success: true,
      data: {
        tables: tablesStatus,
        stats
      }
    });
  } catch (error) {
    console.error('检查数据库状态失败:', error);
    res.status(500).json({
      success: false,
      error: '检查数据库状态失败'
    });
  }
});

export default router;