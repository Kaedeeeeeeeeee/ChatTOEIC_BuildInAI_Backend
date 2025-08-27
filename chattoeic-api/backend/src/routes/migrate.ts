import { Router, Request, Response } from 'express';
import { prisma } from '../utils/database.js';

const router = Router();

// 临时迁移端点 - 扩展vocabulary_items表
router.post('/vocabulary-fields',
  async (req: Request, res: Response) => {
    try {
      console.log('🔄 开始应用vocabulary表结构迁移...');
      
      // 执行原始SQL以添加新字段
      const migrationQueries = [
        `ALTER TABLE vocabulary_items ADD COLUMN IF NOT EXISTS phonetic VARCHAR;`,
        `ALTER TABLE vocabulary_items ADD COLUMN IF NOT EXISTS "audioUrl" VARCHAR;`,
        `ALTER TABLE vocabulary_items ADD COLUMN IF NOT EXISTS context VARCHAR;`,
        `ALTER TABLE vocabulary_items ADD COLUMN IF NOT EXISTS meanings JSONB;`,
        `ALTER TABLE vocabulary_items ADD COLUMN IF NOT EXISTS language VARCHAR DEFAULT 'en';`,
        `ALTER TABLE vocabulary_items ADD COLUMN IF NOT EXISTS reading VARCHAR;`,
        `ALTER TABLE vocabulary_items ADD COLUMN IF NOT EXISTS jlpt TEXT[] DEFAULT '{}';`,
        `ALTER TABLE vocabulary_items ADD COLUMN IF NOT EXISTS commonality BOOLEAN;`,
        `ALTER TABLE vocabulary_items ADD COLUMN IF NOT EXISTS "sourceType" VARCHAR;`,
        `ALTER TABLE vocabulary_items ADD COLUMN IF NOT EXISTS "sourceId" VARCHAR;`,
        `ALTER TABLE vocabulary_items ADD COLUMN IF NOT EXISTS notes VARCHAR;`,
        `ALTER TABLE vocabulary_items ADD COLUMN IF NOT EXISTS mastered BOOLEAN DEFAULT false;`,
        `ALTER TABLE vocabulary_items ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';`,
        `ALTER TABLE vocabulary_items ADD COLUMN IF NOT EXISTS "definitionLoading" BOOLEAN DEFAULT false;`,
        `ALTER TABLE vocabulary_items ADD COLUMN IF NOT EXISTS "definitionError" BOOLEAN DEFAULT false;`,
        `ALTER TABLE vocabulary_items ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP DEFAULT NOW();`,
        `ALTER TABLE vocabulary_items ALTER COLUMN definition DROP NOT NULL;`
      ];

      // 执行每个迁移查询
      for (const query of migrationQueries) {
        console.log(`执行查询: ${query}`);
        await prisma.$executeRawUnsafe(query);
      }

      // 添加触发器
      await prisma.$executeRawUnsafe(`
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW."updatedAt" = NOW();
            RETURN NEW;
        END;
        $$ language 'plpgsql';
      `);

      await prisma.$executeRawUnsafe(`
        DROP TRIGGER IF EXISTS update_vocabulary_items_updated_at ON vocabulary_items;
      `);

      await prisma.$executeRawUnsafe(`
        CREATE TRIGGER update_vocabulary_items_updated_at
            BEFORE UPDATE ON vocabulary_items
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
      `);

      console.log('✅ Vocabulary表结构迁移完成!');

      res.json({
        success: true,
        message: 'Vocabulary表结构迁移成功完成',
        migratedFields: [
          'phonetic', 'audioUrl', 'context', 'meanings', 'language',
          'reading', 'jlpt', 'commonality', 'sourceType', 'sourceId',
          'notes', 'mastered', 'tags', 'definitionLoading', 
          'definitionError', 'updatedAt'
        ]
      });
    } catch (error) {
      console.error('❌ Vocabulary表迁移失败:', error);
      res.status(500).json({
        success: false,
        error: '数据库迁移失败',
        details: error instanceof Error ? error.message : '未知错误'
      });
    }
  }
);

export default router;