# 数据库Schema修复说明

## 问题描述
练习记录无法保存到数据库，历史记录页面显示为空。

## 根本原因
`practice_records`表缺少以下必需字段：
- `realQuestions`
- `aiPoolQuestions`
- `realtimeQuestions`

## 修复方案
执行了以下操作来修复数据库schema：

```bash
# 1. 创建环境配置文件
cp .env.example .env
# 编辑DATABASE_URL指向本地PostgreSQL

# 2. 创建数据库
createdb chattoeic_buildinai_db

# 3. 同步Prisma schema到数据库
npx prisma db push
```

## 验证修复
```sql
-- 验证字段已添加
\d practice_records

-- 确认字段存在：
-- realQuestions     | integer | not null | 0
-- aiPoolQuestions   | integer | not null | 0
-- realtimeQuestions | integer | not null | 0
```

## 部署说明
生产环境需要：
1. 确保数据库包含最新的schema
2. 运行`npx prisma migrate deploy`或`npx prisma db push`
3. 验证`practice_records`表包含必需字段

## 修复日期
2025-09-18

## 相关提交
- Frontend API配置修复: ChatTOEIC_BuildInAI_Frontend@1b0f89e