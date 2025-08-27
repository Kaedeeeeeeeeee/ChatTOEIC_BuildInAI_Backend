# 📧 ChatTOEIC 邮件系统配置指南

## 环境变量配置

为了使邮件系统正常工作，需要在 `.env` 文件中添加以下环境变量：

```env
# Resend 邮件服务配置
RESEND_API_KEY=your_resend_api_key_here

# 邮件发送配置
EMAIL_FROM=ChatTOEIC <noreply@chattoeic.com>

# 前端URL (用于生成验证链接)
FRONTEND_URL=https://www.chattoeic.com
```

## Resend API Key 获取步骤

1. 访问 [Resend](https://resend.com) 官网
2. 注册账号并登录
3. 创建新的 API Key
4. 将 API Key 复制到 `.env` 文件中

## 邮件系统功能

### ✅ 已实现功能

1. **注册验证邮件**
   - 用户注册后自动发送验证码邮件
   - 10分钟有效期
   - 最多5次验证尝试

2. **邮件验证API**
   - `POST /api/auth/verify-email` - 验证邮箱
   - `POST /api/auth/resend-verification` - 重发验证邮件
   - `GET /api/auth/verification-status` - 查询验证状态

3. **邮件模板组件**
   - React Email 组件化模板
   - Tailwind CSS 样式
   - 响应式设计

### 🔄 开发中功能

- 密码重置邮件
- 邮箱变更确认邮件
- 系统通知邮件
- 功能推送邮件

## 数据库扩展

新增了以下数据表：

- `EmailLog` - 邮件发送记录
- `EmailTemplate` - 邮件模板管理
- `UserEmailPreference` - 用户邮件偏好
- `EmailStats` - 邮件统计

## API 端点

### 认证相关邮件

```typescript
// 注册时自动发送验证邮件
POST /api/auth/register
{
  "email": "user@example.com",
  "password": "password123",
  "name": "用户名"
}

// 验证邮箱
POST /api/auth/verify-email
{
  "email": "user@example.com",
  "code": "123456"
}

// 重发验证邮件
POST /api/auth/resend-verification
{
  "email": "user@example.com"
}

// 查询验证状态
GET /api/auth/verification-status?email=user@example.com
```

## 邮件模板

### 注册验证邮件

- **模板位置**: `src/emails/templates/auth/VerificationEmail.tsx`
- **包含内容**: 
  - 个性化问候语
  - 6位验证码
  - 一键验证按钮
  - 功能介绍
  - 安全提示

### 基础组件

- `Layout` - 通用邮件布局
- `Header` - ChatTOEIC 品牌头部
- `Footer` - 统一页脚和退订链接
- `Button` - CTA 按钮组件
- `VerificationCode` - 验证码展示组件

## 错误处理

邮件系统包含完善的错误处理：

- 验证码过期自动清理
- 发送失败重试机制
- 详细的错误日志记录
- 用户友好的错误消息

## 监控与统计

- 邮件发送成功/失败统计
- 用户邮件偏好管理
- 发送记录持久化存储
- 性能监控指标

## 下一步开发

1. 创建密码重置邮件模板
2. 实现邮箱变更确认流程
3. 添加系统通知邮件
4. 开发功能推送邮件系统
5. 实现邮件统计分析面板