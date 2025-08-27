-- 添加题目池相关字段到 practice_records 表
-- 解决 Prisma P2022 错误: column "realQuestions" does not exist

-- 添加 realQuestions 字段（使用的真实题目数）
ALTER TABLE "practice_records" ADD COLUMN "realQuestions" INTEGER NOT NULL DEFAULT 0;

-- 添加 aiPoolQuestions 字段（使用的AI池题目数）
ALTER TABLE "practice_records" ADD COLUMN "aiPoolQuestions" INTEGER NOT NULL DEFAULT 0;

-- 添加 realtimeQuestions 字段（使用的实时AI题目数）
ALTER TABLE "practice_records" ADD COLUMN "realtimeQuestions" INTEGER NOT NULL DEFAULT 0;