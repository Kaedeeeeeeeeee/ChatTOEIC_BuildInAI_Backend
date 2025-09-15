-- CreateEnum
-- 添加用户活跃状态字段，用于真正的用户禁用功能

-- 为用户表添加is_active字段
ALTER TABLE "users" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- 为现有用户设置默认值（所有现有用户默认为活跃状态）
UPDATE "users" SET "isActive" = true WHERE "isActive" IS NULL;

-- 添加索引以优化查询性能
CREATE INDEX "users_isActive_idx" ON "users"("isActive");