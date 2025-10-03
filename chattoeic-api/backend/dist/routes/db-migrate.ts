/**
 * 紧急数据库迁移端点
 * 用于在生产环境中手动执行数据库结构更新
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../utils/database.js';
import { log } from '../utils/logger.js';

const router = Router();

/**
 * POST /api/db-migrate/execute
 * 执行数据库迁移 - 简化版本，不依赖特殊函数
 */
router.post('/execute', async (req: Request, res: Response) => {
  try {
    log.info('🚀 Starting database migration...');

    // 创建usage_quotas表 - 使用简单的字符串ID
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS usage_quotas (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        resource_type TEXT NOT NULL,
        used_count INTEGER DEFAULT 0,
        limit_count INTEGER,
        period_start TIMESTAMP DEFAULT NOW(),
        period_end TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, resource_type, period_start)
      );
    `;

    // 创建questions表
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS questions (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        difficulty TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'AI_REALTIME',
        status TEXT DEFAULT 'ACTIVE',
        content JSONB NOT NULL,
        correct_answer TEXT NOT NULL,
        explanation TEXT,
        audio_url TEXT,
        audio_script TEXT,
        quality_score DECIMAL(3,2) DEFAULT 0.0,
        difficulty_score DECIMAL(3,2),
        average_time INTEGER,
        success_rate DECIMAL(5,4),
        usage_count INTEGER DEFAULT 0,
        rating_count INTEGER DEFAULT 0,
        last_used_at TIMESTAMP,
        created_by TEXT REFERENCES users(id),
        ai_generated_data JSONB,
        reviewed_by TEXT,
        reviewed_at TIMESTAMP,
        review_notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;

    // 创建practice_answers表
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS practice_answers (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        question_id TEXT NOT NULL REFERENCES questions(id),
        practice_record_id TEXT NOT NULL REFERENCES practice_records(id) ON DELETE CASCADE,
        user_answer TEXT NOT NULL,
        is_correct BOOLEAN NOT NULL,
        time_spent INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, question_id, practice_record_id)
      );
    `;

    // 创建question_ratings表
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS question_ratings (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        question_id TEXT NOT NULL REFERENCES questions(id),
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        clarity INTEGER CHECK (clarity >= 1 AND clarity <= 5),
        difficulty INTEGER CHECK (difficulty >= 1 AND difficulty <= 5),
        quality INTEGER CHECK (quality >= 1 AND quality <= 5),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, question_id)
      );
    `;

    // 创建payment_transactions表
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS payment_transactions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        stripe_session_id TEXT UNIQUE,
        stripe_payment_id TEXT UNIQUE,
        amount INTEGER NOT NULL,
        currency TEXT DEFAULT 'jpy',
        status TEXT NOT NULL,
        subscription_id TEXT REFERENCES user_subscriptions(id),
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;

    // 为practice_records表添加新字段
    try {
      await prisma.$executeRaw`
        ALTER TABLE practice_records 
        ADD COLUMN IF NOT EXISTS real_questions INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS ai_pool_questions INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS realtime_questions INTEGER DEFAULT 0;
      `;
    } catch (error) {
      log.warn('Failed to add columns to practice_records (may already exist)', { error });
    }

    // 创建索引
    try {
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS idx_questions_type_difficulty ON questions(type, difficulty, source, status);
      `;
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS idx_questions_quality ON questions(quality_score DESC, usage_count ASC);
      `;
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS idx_usage_quotas_user_resource ON usage_quotas(user_id, resource_type, period_start);
      `;
    } catch (error) {
      log.warn('Failed to create some indexes (may already exist)', { error });
    }

    log.info('✅ Database migration completed successfully');

    res.json({
      success: true,
      message: 'Database migration completed successfully',
      timestamp: new Date().toISOString(),
      tablesCreated: [
        'usage_quotas',
        'questions', 
        'practice_answers',
        'question_ratings',
        'payment_transactions'
      ]
    });

  } catch (error) {
    log.error('❌ Database migration failed', { error });
    res.status(500).json({
      success: false,
      error: 'Database migration failed',
      details: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/db-migrate/check
 * 检查数据库表状态
 */
router.get('/check', async (req: Request, res: Response) => {
  try {
    const tables = [];
    
    // 检查各个表是否存在
    const tableChecks = [
      'usage_quotas',
      'questions',
      'practice_answers', 
      'question_ratings',
      'payment_transactions'
    ];

    for (const tableName of tableChecks) {
      try {
        const result = await prisma.$queryRaw`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = ${tableName}
          );
        `;
        tables.push({
          name: tableName,
          exists: (result as any)[0]?.exists || false
        });
      } catch (error) {
        tables.push({
          name: tableName,
          exists: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    res.json({
      success: true,
      tables,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    log.error('Failed to check database tables', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to check database tables',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;