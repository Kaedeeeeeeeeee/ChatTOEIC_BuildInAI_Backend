#!/bin/bash

# ChatTOEIC Railway 部署脚本

echo "🚂 开始部署到Railway..."

# 检查Railway CLI
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI未安装，请先运行: npm install -g @railway/cli"
    exit 1
fi

# 检查是否已登录
railway whoami > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "🔐 请先登录Railway: railway login"
    exit 1
fi

# 部署应用
echo "📦 部署应用到Railway..."
railway up

# 运行数据库迁移
echo "🗄️ 运行数据库迁移..."
railway run npx prisma migrate deploy --schema=prisma/schema.prisma

# 生成Prisma客户端
echo "⚙️ 生成Prisma客户端..."
railway run npx prisma generate --schema=prisma/schema.prisma

# 获取应用URL
echo "🌐 获取应用URL..."
RAILWAY_URL=$(railway domain 2>/dev/null | head -1)

if [ ! -z "$RAILWAY_URL" ]; then
    echo "✅ 部署成功！"
    echo "📱 应用地址: $RAILWAY_URL"
    echo "🔧 请更新前端 VITE_API_BASE_URL 为: $RAILWAY_URL"
else
    echo "⚠️ 无法获取应用URL，请手动检查Railway面板"
fi

echo "🎉 Railway部署完成！"