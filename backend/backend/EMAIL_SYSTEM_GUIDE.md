# ChatTOEIC 邮件系统使用指南

## 📧 系统概述

ChatTOEIC邮件系统是一个完整的企业级邮件服务解决方案，支持多种类型的邮件发送：

- **认证邮件**: 注册验证、密码重置、邮箱变更
- **系统通知**: 安全警报、系统维护、活动报告  
- **功能公告**: 新功能发布、重大更新、Beta测试邀请

## 🏗️ 技术架构

```
Frontend ←→ Backend API ←→ Email Services ←→ Resend API ←→ User Inbox
                ↓
          React Email Templates
```

### 核心组件

1. **邮件服务层** (`/src/services/`)
   - `emailService.ts` - 基础邮件发送服务
   - `authEmailService.ts` - 认证相关邮件
   - `notificationEmailService.ts` - 通知邮件
   - `verificationService.ts` - 验证码管理
   - `passwordResetService.ts` - 密码重置管理
   - `emailChangeService.ts` - 邮箱变更管理

2. **邮件模板** (`/src/emails/templates/`)
   - `auth/` - 认证相关模板
   - `notifications/` - 系统通知模板
   - `components/` - 可复用组件

3. **API端点** (`/src/routes/`)
   - `auth.ts` - 认证相关邮件API
   - `notifications.ts` - 通知邮件API

## 🚀 快速开始

### 1. 环境配置

```env
# .env 文件
RESEND_API_KEY=re_xxxxxxxxx
FRONTEND_URL=https://www.chattoeic.com
JWT_SECRET=your_jwt_secret
```

### 2. 基础使用

```typescript
import { authEmailService } from './services/authEmailService';

// 发送注册验证邮件
await authEmailService.sendRegistrationVerificationEmail(
  'user@example.com',
  '张三'
);
```

## 📝 API端点使用指南

### 认证邮件API (`/api/auth/`)

#### 📬 发送注册验证邮件
注册用户时自动发送，无需手动调用。

#### 🔄 重新发送验证邮件
```http
POST /api/auth/resend-verification
Content-Type: application/json

{
  "email": "user@example.com"
}
```

#### ✅ 验证邮箱
```http
POST /api/auth/verify-email
Content-Type: application/json

{
  "email": "user@example.com",
  "code": "123456"
}
```

#### 🔐 请求密码重置
```http
POST /api/auth/request-password-reset
Content-Type: application/json

{
  "email": "user@example.com"
}
```

#### 🆕 重置密码
```http
POST /api/auth/reset-password
Content-Type: application/json

{
  "token": "reset_token_here",
  "newPassword": "newSecurePassword123"
}
```

#### 📧 请求邮箱变更
```http
POST /api/auth/request-email-change
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "newEmail": "newemail@example.com"
}
```

#### 🔍 验证邮箱变更
```http
POST /api/auth/verify-email-change
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "newEmail": "newemail@example.com",
  "code": "123456"
}
```

### 通知邮件API (`/api/notifications/`) - 需要管理员权限

#### 🚨 发送安全警报
```http
POST /api/notifications/security-alert
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json

{
  "userIds": ["user-uuid-1", "user-uuid-2"],
  "alertType": "login",
  "options": {
    "location": "北京，中国",
    "ipAddress": "192.168.1.1",
    "userAgent": "Chrome/91.0"
  }
}
```

#### 🔧 发送系统维护通知
```http
POST /api/notifications/maintenance
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json

{
  "userIds": ["user-uuid-1"],
  "maintenanceType": "scheduled",
  "options": {
    "startTime": "2024-01-15 02:00",
    "endTime": "2024-01-15 06:00",
    "duration": "4小时",
    "reason": "数据库升级",
    "affectedServices": ["学习练习", "AI聊天"]
  }
}
```

#### 📊 发送活动报告
```http
POST /api/notifications/activity-report
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json

{
  "userIds": ["user-uuid-1"],
  "periodType": "weekly",
  "activityData": {
    "practiceCount": 10,
    "studyHours": 8.5,
    "questionsAnswered": 250,
    "correctRate": 85,
    "streakDays": 7,
    "newWords": 45,
    "achievementsUnlocked": 3
  },
  "options": {
    "periodStart": "2024-01-08",
    "periodEnd": "2024-01-14",
    "topAchievements": ["连续学习7天", "正确率超过80%"],
    "recommendations": ["继续保持学习节奏", "可以尝试更难的题目"]
  }
}
```

#### 🚀 发送功能公告
```http
POST /api/notifications/feature-announcement
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json

{
  "userIds": ["user-uuid-1"],
  "announcementType": "new_feature",
  "options": {
    "title": "AI智能学习助手2.0",
    "releaseDate": "2024-01-15",
    "features": [
      {
        "name": "个性化学习路径",
        "description": "基于您的学习数据，为您量身定制最优学习计划",
        "icon": "🎯",
        "benefits": [
          "提高学习效率30%",
          "个性化难度调节",
          "智能复习提醒"
        ]
      }
    ],
    "ctaText": "立即体验",
    "ctaUrl": "https://www.chattoeic.com/ai-assistant",
    "videoUrl": "https://www.youtube.com/watch?v=demo"
  }
}
```

#### 📢 广播邮件（发送给所有活跃用户）
```http
POST /api/notifications/broadcast/feature-announcement
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json

{
  "announcementType": "major_update",
  "options": {
    "title": "ChatTOEIC 3.0 重磅发布",
    "releaseDate": "2024-02-01",
    "features": [...],
    "ctaText": "立即升级体验"
  }
}
```

## 🎨 邮件模板定制

### 创建自定义模板

1. **创建模板文件**
```tsx
// src/emails/templates/custom/MyCustomEmail.tsx
import React from 'react';
import { Text, Section } from '@react-email/components';
import { Layout, Button } from '../../components';

interface MyCustomEmailProps {
  userName: string;
  customData: string;
}

export default function MyCustomEmail({ userName, customData }: MyCustomEmailProps) {
  return (
    <Layout preview={`自定义邮件 - ${userName}`}>
      <Section>
        <Text className="text-xl font-bold text-blue-600 mb-4">
          你好，{userName}！
        </Text>
        <Text className="text-gray-700 mb-4">
          {customData}
        </Text>
        <Button href="https://www.chattoeic.com">
          立即查看
        </Button>
      </Section>
    </Layout>
  );
}
```

2. **在服务中使用**
```typescript
import MyCustomEmail from '../emails/templates/custom/MyCustomEmail';

const emailTemplate = React.createElement(MyCustomEmail, {
  userName: '用户名',
  customData: '自定义数据'
});

await emailService.sendEmail({
  to: 'user@example.com',
  subject: '自定义邮件标题',
  template: emailTemplate
});
```

## 🔒 安全特性

### 1. 速率限制
- 每15分钟最多5次认证请求
- 防止邮件轰炸攻击

### 2. 令牌安全
- JWT认证保护敏感操作
- 密码重置令牌加密存储
- 验证码限时有效

### 3. 输入验证
- Zod模式验证所有输入
- 邮箱格式验证
- SQL注入防护

## 📊 监控与分析

### 邮件发送统计
```http
GET /api/notifications/stats
Authorization: Bearer <admin_jwt_token>
```

响应示例：
```json
{
  "success": true,
  "data": {
    "notificationStats": {
      "totalSent": 1250,
      "byType": {
        "security_alert": 45,
        "maintenance": 12,
        "activity": 890,
        "announcement": 303
      },
      "lastSent": "2024-01-15T10:30:00Z"
    },
    "userStats": {
      "verified": 850,
      "unverified": 150
    }
  }
}
```

## 🚨 错误处理

### 常见错误码

| 错误码 | 描述 | 解决方案 |
|--------|------|----------|
| `invalid_email_format` | 邮箱格式错误 | 检查邮箱格式 |
| `verification_code_expired` | 验证码过期 | 重新发送验证码 |
| `too_many_requests` | 请求过于频繁 | 等待后重试 |
| `email_send_failed` | 邮件发送失败 | 检查网络和API密钥 |

### 错误响应格式
```json
{
  "success": false,
  "error": "error_code_here",
  "message": "用户友好的错误消息",
  "details": "详细的技术信息（仅开发环境）"
}
```

## 🔧 最佳实践

### 1. 邮件发送
- 使用异步发送避免阻塞用户操作
- 实现重试机制处理临时故障
- 记录发送日志便于问题排查

### 2. 模板设计
- 保持移动端友好的响应式设计
- 使用一致的品牌风格
- 提供明确的行动召唤按钮

### 3. 用户体验
- 提供明确的邮件发送反馈
- 允许用户控制邮件接收偏好
- 实现邮件预览功能

## 🔗 相关资源

- [Resend API文档](https://resend.com/docs)
- [React Email文档](https://react.email)
- [Tailwind CSS文档](https://tailwindcss.com)

## ❓ 常见问题

**Q: 如何自定义邮件样式？**
A: 修改 `src/emails/components/Layout.tsx` 中的默认样式，或在具体模板中使用Tailwind CSS类。

**Q: 邮件发送失败怎么办？**
A: 检查Resend API密钥是否正确，网络连接是否正常，查看服务器日志获取详细错误信息。

**Q: 如何添加新的邮件类型？**
A: 1. 在对应目录创建新模板 2. 在相应服务中添加发送方法 3. 在路由中添加API端点

**Q: 可以批量发送邮件吗？**
A: 是的，使用 `sendBatchNotification` 方法或广播端点可以批量发送邮件。

---

💡 **提示**: 在生产环境部署前，请确保所有环境变量正确配置，并进行充分的邮件发送测试。