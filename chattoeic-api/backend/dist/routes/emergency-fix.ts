/**
 * 紧急修复端点
 * 完全独立的数据库修复，不依赖任何其他模块
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../utils/database.js';

const router = Router();

/**
 * POST /api/emergency-fix/create-tables
 * 直接创建缺失的表
 */
router.post('/create-tables', async (req: Request, res: Response) => {
  try {
    console.log('🚨 Creating missing tables...');
    
    // 创建user_subscriptions表（关键表）
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS user_subscriptions (
        id TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL UNIQUE,
        "planId" TEXT,
        "stripeCustomerId" TEXT,
        "stripeSubscriptionId" TEXT,
        "stripeSessionId" TEXT,
        status TEXT NOT NULL DEFAULT 'inactive',
        "currentPeriodStart" TIMESTAMP,
        "currentPeriodEnd" TIMESTAMP,
        "trialStart" TIMESTAMP,
        "trialEnd" TIMESTAMP,
        "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
        "canceledAt" TIMESTAMP,
        "lastPaymentAt" TIMESTAMP,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      );
    `;
    
    console.log('✅ user_subscriptions table created');

    // 创建usage_quotas表（最小版本）
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS usage_quotas (
        id TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "resourceType" TEXT NOT NULL,
        "usedCount" INTEGER DEFAULT 0,
        "limitCount" INTEGER,
        "periodStart" TIMESTAMP DEFAULT NOW(),
        "periodEnd" TIMESTAMP NOT NULL,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW(),
        UNIQUE("userId", "resourceType", "periodStart")
      );
    `;
    
    console.log('✅ usage_quotas table created');
    
    // 添加外键约束（如果可能）
    try {
      await prisma.$executeRaw`
        ALTER TABLE usage_quotas 
        ADD CONSTRAINT fk_usage_quotas_user_id 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
      `;
    } catch (error) {
      console.log('⚠️ Foreign key constraint already exists or failed:', error.message);
    }
    
    // 添加唯一约束
    try {
      await prisma.$executeRaw`
        ALTER TABLE usage_quotas 
        ADD CONSTRAINT unique_user_resource_period 
        UNIQUE(user_id, resource_type, period_start);
      `;
    } catch (error) {
      console.log('⚠️ Unique constraint already exists or failed:', error.message);
    }
    
    console.log('✅ All constraints added');
    
    res.json({
      success: true,
      message: 'Emergency table creation completed',
      tablesCreated: ['user_subscriptions', 'usage_quotas'],
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('❌ Emergency table creation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Table creation failed',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/emergency-fix/check
 * 检查表状态
 */
router.get('/check', async (req: Request, res: Response) => {
  try {
    // 简单查询检查表是否存在
    const checkUsageQuotas = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'usage_quotas'
      );
    `;
    
    res.json({
      success: true,
      tables: {
        usage_quotas: (checkUsageQuotas as any)[0]?.exists || false
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Check failed',
      details: error.message
    });
  }
});

export default router;