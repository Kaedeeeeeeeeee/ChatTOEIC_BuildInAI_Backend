#!/bin/bash
set -e

echo "🗄️ 开始数据库设置..."

# 运行数据库迁移
echo "⚡ 运行数据库迁移..."
npx prisma migrate deploy --schema=prisma/schema.prisma

# 运行种子脚本
echo "🌱 运行种子数据脚本..."
npx tsx prisma/seed.ts

echo "✅ 数据库设置完成！"