# CLAUDE.md

## 📋 仓库信息

**前端仓库：** https://github.com/Kaedeeeeeeeeee/ChatTOEIC_BuildInAI_Frontend
**后端仓库：** https://github.com/Kaedeeeeeeeeee/ChatTOEIC_BuildInAI_Backend

**部署地址：**
- 前端生产环境：待配置 (Vercel)
- 后端API地址：待配置 (Render)

**自动部署设置：**
- 前端：推送到 ChatTOEIC_BuildInAI_Frontend 仓库会自动触发 Vercel 部署
- 后端：推送到 ChatTOEIC_BuildInAI_Backend 仓库会自动触发 Render 部署

## 📁 项目文件夹结构与仓库对应关系

**主工作目录：** `ChatTOEIC_bulidinAI/` （本目录）

### 前端项目：
- **本地目录：** `ChatTOEIC_BuildInAI_Frontend/`
- **连接仓库：** https://github.com/Kaedeeeeeeeeee/ChatTOEIC_BuildInAI_Frontend
- **部署平台：** Vercel
- **生产地址：** 待配置

### 后端项目：
- **本地目录：** `ChatToeic_BuildInAI_Backend/`
- **连接仓库：** https://github.com/Kaedeeeeeeeeee/ChatTOEIC_BuildInAI_Backend
- **部署平台：** Render
- **API地址：** 待配置

### 其他相关文件夹说明：
在项目根目录 `/Users/user/project/` 下还存在以下文件夹，但它们不是主要工作目录：

- `ChatTOEIC-Frontend-Clone/` - 前端仓库的克隆副本（开发备份）
- `ChatTOEIC-Frontend-Temp/` - 临时文件夹（实际连接到后端仓库，命名有误导性）
- `ChatTOEIC/` - 后端仓库的另一个克隆副本

**⚠️ 重要提醒：**
- 主要开发工作应在 `ChatTOEIC_bulidinAI/` 目录下进行
- 这是Chrome Built-in AI Challenge 2025的专用开发目录
- 新仓库ChatTOEIC_BuildInAI_Frontend和ChatTOEIC_BuildInAI_Backend将用于比赛部署

## ⚠️ 关键部署注意事项

### 1. Vercel部署配置问题
**问题：** 当仓库同时包含根目录和子目录（如`frontend/`）的完整前端项目时，Vercel默认会从根目录构建，可能导致部署旧版本代码。

**症状识别：**
- Git提交记录显示最新代码已推送
- Vercel显示部署成功，但网站显示的是旧版本功能
- 本地`frontend/`目录的修改没有体现在生产环境

**解决方案：**
- 在仓库根目录创建`vercel.json`配置文件
- 指定构建目录：`"buildCommand": "cd frontend && npm run build"`
- 指定输出目录：`"outputDirectory": "frontend/dist"`
- 指定安装命令：`"installCommand": "cd frontend && npm install"`

### 2. vercel.json配置文件冲突
**问题：** 同一仓库中存在多个`vercel.json`文件（根目录、`public/`目录、子目录等）会造成配置冲突。

**解决方案：**
- 删除不必要的`vercel.json`文件（如`public/vercel.json`）
- 保持单一的根目录配置文件
- 确保配置文件指向正确的构建目录

### 3. TypeScript编译错误排查
**常见错误类型：**
- 导入路径错误：检查`import`语句是否匹配实际的`export`
- 重复组件声明：确保组件名称唯一，避免在同一文件中重复声明
- API服务导入问题：验证服务类的正确导出名称

**排查步骤：**
1. 本地运行`npm run build`检查编译错误
2. 逐个修复TypeScript错误
3. 确认所有导入路径和导出名称正确匹配
4. 推送修复后等待Vercel重新部署

### 4. 部署验证方法
**验证步骤：**
1. 添加明显的版本标识（如页面标题、版本号等）
2. 推送更改并等待部署完成
3. 检查生产环境是否显示新的标识
4. 确认所有新功能正常工作后清理临时标识

**调试技巧：**
- 使用浏览器开发者工具检查网络请求
- 清除浏览器缓存或使用无痕模式
- 检查Vercel部署日志确认构建过程

---

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ChatTOEIC is a full-stack AI-powered TOEIC practice application that helps users improve their English proficiency through interactive practice sessions, AI-assisted learning, and intelligent vocabulary management.

**Current Technology Stack (v1.3.1):**
- Frontend: React 19 + TypeScript + Vite
- State Management: Zustand
- Styling: Tailwind CSS v4
- Database: IndexedDB (via Dexie) - **MIGRATING TO POSTGRESQL**
- AI Integration: Google Gemini API
- Testing: Vitest + Testing Library
- Routing: React Router v7

**Target Technology Stack (v2.0 - In Development):**
- Frontend: React 19 + TypeScript + Vite (unchanged)
- State Management: Zustand (unchanged)
- Styling: Tailwind CSS v4 (unchanged)
- Backend: Node.js + TypeScript + Express
- Database: PostgreSQL + Prisma ORM
- Authentication: JWT + bcrypt + OAuth 2.0
- AI Integration: Google Gemini API (server-side)
- Testing: Vitest + Testing Library + Jest (backend)
- Deployment: Vercel (frontend) + Render (backend + database)

## Development Commands

```bash
# Navigate to the main application directory
cd ai-toeic-practice

# Development server
npm run dev

# Build for production
npm run build

# Run tests
npm test              # Watch mode
npm run test:run      # Single run
npm run test:ui       # UI mode

# Linting
npm run lint

# Preview production build
npm run preview
```

## Project Architecture

### Directory Structure
```
src/
├── components/          # React components organized by feature
│   ├── common/         # Shared components (ErrorBoundary, Modal, etc.)
│   ├── home/           # Home page components
│   ├── practice/       # Practice session components
│   ├── review/         # AI chat and review components
│   ├── revision/       # Wrong questions revision
│   └── layout/         # Layout components
├── stores/             # Zustand state management
├── services/           # Business logic and external API calls
├── types/              # TypeScript type definitions
├── router/             # React Router configuration
└── utils/              # Utility functions and constants
```

### State Management (Zustand)

The application uses these main stores:

1. **practiceStore** - Manages practice sessions, question generation, and answer submission
2. **chatStore** - Handles AI conversations and chat history  
3. **userStore** - User preferences, settings, and score calculations
4. **vocabularyStore** - Vocabulary management and spaced repetition system

### Service Layer

Key services providing business logic:

- **geminiAPI.ts** - Google Gemini API integration with rate limiting and error handling
- **storageService.ts** - IndexedDB operations using Dexie
- **errorService.ts** - Centralized error handling and logging
- **scoreCalculator.ts** - TOEIC score estimation algorithms
- **prompts.ts** - AI prompt templates and builders

## Key Features

### AI Integration
- Question generation using Gemini API
- Interactive AI chat for learning assistance
- Intelligent error analysis and explanations
- API key management with local storage

### Practice System
- Configurable practice sessions (difficulty, question count, time limits)
- Real-time progress tracking
- Wrong question collection for revision
- Score estimation based on performance

### Data Persistence
- Offline-first architecture using IndexedDB
- Practice history and chat logs storage
- Data export/import functionality
- Automatic backup and health checks

## Development Guidelines

### API Key Setup
The application requires a Google Gemini API key. Users configure this through the UI, and it's stored in localStorage. For development:

1. Get API key from Google AI Studio
2. Configure through the application UI or set in localStorage as 'gemini_api_key'

### Error Handling
- All API calls go through centralized error handling in `errorService`
- Network errors are handled gracefully with retry mechanisms  
- Offline fallbacks are provided where possible

### Testing Strategy
- Component tests use Testing Library
- Service layer has comprehensive unit tests
- Integration tests cover API interactions
- Test setup includes jsdom environment

### TypeScript Usage
- Strict type checking enabled
- Comprehensive type definitions in `src/types/`
- Type guards and validation functions provided
- Runtime type validation for external data

## Common Development Tasks

### Adding New Question Types
1. Update `QuestionType` enum in `src/types/question.ts`
2. Modify question generation prompts in `src/services/prompts.ts`
3. Update UI components to handle new question format
4. Add corresponding tests

### Extending AI Capabilities
1. Create new prompt templates in `src/services/prompts.ts`
2. Add new methods to `GeminiAPIService` class
3. Update relevant stores to use new AI features
4. Handle new error scenarios

### Adding New Storage Entities
1. Define new table in `src/services/storageService.ts`
2. Create corresponding TypeScript types
3. Add CRUD operations and validation
4. Update backup/restore functionality

## Configuration

### Environment Variables
No environment variables are required. Configuration is handled through:
- User preferences stored in IndexedDB
- API keys stored in localStorage
- Build-time configuration in `vite.config.ts`

### Gemini API Configuration
- Model: gemini-1.5-flash
- Rate limits: 60 requests/minute, 1000 requests/day
- Request timeout: 30 seconds
- Retry logic with exponential backoff

## Troubleshooting

### Common Issues
1. **API Rate Limits** - Check rate limit status in developer tools
2. **Storage Quota** - Monitor IndexedDB usage via storage health checks
3. **Network Errors** - Verify API key and network connectivity
4. **Build Errors** - Ensure TypeScript types are correctly defined

### Debug Tools
- Error service provides detailed error logging
- Storage service includes health check utilities
- Rate limit status can be queried from GeminiAPIService
- React dev tools for component inspection

## Performance Considerations

- Questions are generated in batches to minimize API calls
- Chat history is paginated to avoid memory issues
- IndexedDB operations are optimized with proper indexing
- Component lazy loading for route-based code splitting
- Zustand provides efficient state updates without unnecessary re-renders

---

# 📋 ChatTOEIC v2.0 Full-Stack Migration Plan

## 🎯 Architecture Overview

**System Architecture:**
```
User Browser
    ↓ HTTPS
Frontend (React + Vite) on Vercel
    ↓ REST API
Backend (Node.js + Express) on Render
    ↓ SQL Queries
PostgreSQL Database on Render
    ↓ External API
Google Gemini API (server-side)
```

**Authentication Flow:**
```
1. User Registration/Login → Backend API
2. Backend validates → PostgreSQL
3. Backend generates JWT → Returns to Frontend  
4. Frontend stores JWT → Includes in API requests
5. Backend validates JWT → Processes requests
```

## 🗄️ Database Design (PostgreSQL)

### Core Tables Structure:

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE,
    username VARCHAR(100) NOT NULL,
    avatar_url VARCHAR(500),
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP
);

-- Authentication methods (supports multiple login types)
CREATE TABLE user_auths (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    auth_type VARCHAR(20) NOT NULL, -- 'email', 'google', 'wechat'
    auth_id VARCHAR(255) NOT NULL,  -- email/provider ID
    password_hash VARCHAR(255),     -- only for email auth
    provider_data JSONB,            -- third-party data
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(auth_type, auth_id)
);

-- Practice sessions
CREATE TABLE practice_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_type VARCHAR(50) NOT NULL,
    difficulty VARCHAR(20) NOT NULL,
    questions JSONB NOT NULL,
    answers JSONB,
    score INTEGER,
    part_scores JSONB,
    time_spent INTEGER,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Vocabulary system
CREATE TABLE vocabulary_words (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    word VARCHAR(255) NOT NULL,
    definition TEXT,
    phonetic VARCHAR(100),
    audio_url VARCHAR(500),
    context TEXT,
    meanings JSONB,
    review_data JSONB,
    tags TEXT[],
    mastered BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, word)
);

-- AI Chat sessions
CREATE TABLE chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    context_type VARCHAR(50),
    context_id UUID,
    messages JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- API usage tracking
CREATE TABLE api_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    api_type VARCHAR(50),
    tokens_used INTEGER,
    cost_usd DECIMAL(10,4),
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Database Indexes:
```sql
-- Performance indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_sessions_user_created ON practice_sessions(user_id, created_at DESC);
CREATE INDEX idx_vocabulary_user_word ON vocabulary_words(user_id, word);
CREATE INDEX idx_chat_user_context ON chat_sessions(user_id, context_type, context_id);

-- Full-text search for vocabulary
CREATE INDEX idx_vocabulary_search ON vocabulary_words 
USING GIN (to_tsvector('english', word || ' ' || COALESCE(definition, '')));
```

## 🔒 Authentication System Design

### JWT Implementation:
```typescript
// JWT Payload Structure
interface JWTPayload {
  userId: string;
  email?: string;
  username: string;
  authMethods: string[];
  iat: number;
  exp: number;
}

// Token Management
const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
const refreshToken = jwt.sign({ userId }, REFRESH_SECRET, { expiresIn: '7d' });
```

### OAuth Integration:
```typescript
// Google OAuth Flow
app.get('/api/auth/google', passport.authenticate('google'));
app.get('/api/auth/google/callback', 
  passport.authenticate('google'),
  (req, res) => {
    const token = generateJWT(req.user);
    res.redirect(`${FRONTEND_URL}?token=${token}`);
  }
);

// WeChat OAuth (future)
app.get('/api/auth/wechat', (req, res) => {
  const authUrl = `https://open.weixin.qq.com/connect/qrconnect?appid=${WECHAT_APP_ID}&redirect_uri=${CALLBACK_URL}`;
  res.redirect(authUrl);
});
```

## 🚀 API Endpoints Design

### Authentication Endpoints:
```typescript
POST   /api/auth/register           // Email registration
POST   /api/auth/login              // Email login
POST   /api/auth/refresh            // Refresh JWT token
POST   /api/auth/logout             // Logout (blacklist token)
GET    /api/auth/google             // Google OAuth initiate
GET    /api/auth/google/callback    // Google OAuth callback
GET    /api/auth/wechat             // WeChat OAuth initiate
GET    /api/auth/wechat/callback    // WeChat OAuth callback
```

### Practice Endpoints:
```typescript
GET    /api/practice/sessions       // Get user's practice history
POST   /api/practice/sessions       // Create new practice session
PUT    /api/practice/sessions/:id   // Update session (submit answers)
DELETE /api/practice/sessions/:id   // Delete session
POST   /api/practice/questions      // Generate questions via Gemini API
```

### Vocabulary Endpoints:
```typescript
GET    /api/vocabulary              // Get user's vocabulary words
POST   /api/vocabulary              // Add new word
PUT    /api/vocabulary/:id          // Update word (notes, review data)
DELETE /api/vocabulary/:id          // Delete word
GET    /api/vocabulary/review       // Get words needing review
POST   /api/vocabulary/review/:id   // Mark word as reviewed
GET    /api/vocabulary/search       // Search vocabulary
```

### AI Chat Endpoints:
```typescript
GET    /api/chat/sessions           // Get chat sessions
POST   /api/chat/sessions           // Create new chat session
POST   /api/chat/message            // Send message to AI
PUT    /api/chat/sessions/:id       // Update chat session
```

### User Management:
```typescript
GET    /api/user/profile            // Get user profile
PUT    /api/user/profile            // Update user profile
GET    /api/user/stats              // Get learning statistics
POST   /api/user/export             // Export user data
POST   /api/user/import             // Import user data
DELETE /api/user/account            // Delete user account
```

## 📦 Backend Project Structure

```
chattoeic-api/
├── src/
│   ├── controllers/          # Route handlers
│   │   ├── authController.ts
│   │   ├── practiceController.ts
│   │   ├── vocabularyController.ts
│   │   └── chatController.ts
│   ├── middleware/           # Express middleware
│   │   ├── auth.ts          # JWT verification
│   │   ├── rateLimiter.ts   # API rate limiting
│   │   ├── validation.ts    # Request validation
│   │   └── errorHandler.ts  # Error handling
│   ├── services/            # Business logic
│   │   ├── authService.ts   # Authentication logic
│   │   ├── geminiService.ts # AI API integration
│   │   ├── emailService.ts  # Email notifications
│   │   └── encryptionService.ts # Data encryption
│   ├── models/              # Database models (Prisma)
│   │   └── schema.prisma    # Database schema
│   ├── routes/              # API routes
│   │   ├── auth.ts
│   │   ├── practice.ts
│   │   ├── vocabulary.ts
│   │   └── chat.ts
│   ├── utils/               # Utility functions
│   │   ├── jwt.ts
│   │   ├── bcrypt.ts
│   │   ├── validators.ts
│   │   └── constants.ts
│   ├── types/               # TypeScript types
│   │   ├── auth.ts
│   │   ├── practice.ts
│   │   └── api.ts
│   └── app.ts               # Express app setup
├── prisma/                  # Database migrations
│   ├── migrations/
│   └── seed.ts             # Database seeding
├── tests/                   # Test files
│   ├── auth.test.ts
│   ├── practice.test.ts
│   └── vocabulary.test.ts
├── docker-compose.yml       # Local development
├── Dockerfile              # Production build
└── package.json
```

## 🔄 Migration Strategy

### Phase 1: Backend Infrastructure (Week 1-2)
1. Set up Node.js + Express project
2. Configure PostgreSQL + Prisma
3. Implement basic authentication (email + JWT)
4. Create core database models
5. Set up development environment (Docker)

### Phase 2: Authentication System (Week 3)
1. Implement user registration/login
2. Add JWT middleware
3. Create protected route handlers
4. Frontend authentication integration
5. Add Google OAuth integration

### Phase 3: Data Migration (Week 4-5)
1. Create data migration scripts (IndexedDB → PostgreSQL)
2. Implement practice session APIs
3. Migrate vocabulary system
4. Update frontend to use backend APIs
5. Maintain backward compatibility during transition

### Phase 4: AI Integration & Polish (Week 6-7)
1. Move Gemini API calls to backend
2. Implement chat session management
3. Add API usage tracking
4. Security hardening
5. Performance optimization
6. Production deployment

### Phase 5: Advanced Features (Week 8+)
1. WeChat OAuth integration
2. Advanced analytics
3. Email notifications
4. Data export/import
5. Admin panel

## 🛡️ Security Considerations

### Data Protection:
- Password hashing with bcrypt (salt rounds: 12)
- JWT secrets stored in environment variables
- HTTPS enforcement
- CORS configuration
- Rate limiting on sensitive endpoints
- Input validation and sanitization
- SQL injection prevention (Prisma ORM)

### API Security:
```typescript
// Rate limiting example
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
});

// Input validation example
const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(12).max(128),
  username: z.string().min(2).max(50),
});
```

### Privacy Compliance:
- GDPR-compliant data deletion
- User consent management
- Data encryption at rest
- Audit logging for sensitive operations
- Regular security updates

## 📈 Monitoring & Analytics

### Performance Metrics:
- API response times
- Database query performance  
- User engagement metrics
- Error rates and types
- AI API usage and costs

### Logging Strategy:
```typescript
// Structured logging with Winston
logger.info('User login attempt', {
  userId: user.id,
  email: user.email,
  ip: req.ip,
  userAgent: req.get('User-Agent'),
  success: true,
  timestamp: new Date()
});
```

## 💰 Cost Management

### Development Costs:
- Render: $0 (within free tier)
- Development tools: $0-99 (optional)
- Domain: $10-15/year (optional)

### Production Estimates:
- Render (backend + database): $10-25/month
- Vercel (frontend): $0 (free tier)
- Gemini API: Pay-per-use (estimated $5-20/month)
- **Total: $15-50/month** (scales with usage)

## 🧪 Testing Strategy

### Backend Testing:
- Unit tests: Jest + Supertest
- Integration tests: Database + API endpoints
- Authentication tests: JWT + OAuth flows
- Load testing: Artillery or k6

### End-to-End Testing:
- Playwright for user flows
- Authentication scenarios
- Practice session workflows
- Vocabulary management

---

# 📋 Development TODO List

This comprehensive TODO list will guide the v2.0 full-stack migration. Each phase builds upon the previous one, ensuring a systematic and safe transition from the current IndexedDB-based frontend-only application to a full-stack architecture.

## 📊 Timeline Estimates

- **Phase 1-2**: Backend Infrastructure & Auth (2-3 weeks)
- **Phase 3-4**: Frontend Integration & Practice Migration (2-3 weeks)
- **Phase 5-6**: Vocabulary & Chat Migration (2 weeks)
- **Phase 7-8**: Production Deployment & Testing (1-2 weeks)
- **Phase 9-10**: Advanced Features & Documentation (2-4 weeks)

**Total Estimated Time: 9-14 weeks** (2-3.5 months)

## 🎯 Success Criteria

### Phase Completion Criteria:

**Phase 1 Complete When:**
- ✅ Backend server runs locally via Docker
- ✅ PostgreSQL database accessible via pgAdmin
- ✅ Prisma migrations work correctly
- ✅ Basic health check endpoint responds

**Phase 2 Complete When:**
- ✅ Users can register with email/password
- ✅ Users can login and receive JWT tokens
- ✅ JWT middleware protects routes correctly
- ✅ Google OAuth login works end-to-end

**Phase 3 Complete When:**
- ✅ Frontend can authenticate with backend
- ✅ Auth state persists across browser sessions
- ✅ Protected routes redirect properly
- ✅ User profile displays correctly

**Phase 4 Complete When:**
- ✅ Practice sessions save to PostgreSQL
- ✅ Questions generate via backend API
- ✅ Existing IndexedDB data migrates successfully
- ✅ Score calculation works with new data

**Phase 5 Complete When:**
- ✅ Vocabulary CRUD operations work via API
- ✅ Spaced repetition algorithm runs server-side
- ✅ Full-text search returns relevant results
- ✅ Existing vocabulary data migrates successfully

**Phase 6 Complete When:**
- ✅ AI chat sessions persist across devices
- ✅ Chat context links to practice sessions
- ✅ Gemini API calls route through backend
- ✅ Chat history paginated and searchable

**Phase 7 Complete When:**
- ✅ Application deploys successfully to Render
- ✅ Database backups configured and tested
- ✅ HTTPS certificates active
- ✅ Environment variables secured

**Phase 8 Complete When:**
- ✅ >80% test coverage on critical paths
- ✅ All API endpoints tested
- ✅ Security vulnerabilities addressed
- ✅ Performance meets benchmarks

## 🔧 Development Standards

### Code Quality Requirements:
- **TypeScript strict mode**: All code must pass strict type checking
- **ESLint compliance**: Follow established linting rules
- **Test coverage**: >70% coverage for new backend code
- **API documentation**: All endpoints documented with OpenAPI spec
- **Error handling**: Consistent error responses and logging

### Security Requirements:
- **Input validation**: All user inputs validated with Zod schemas
- **Rate limiting**: Applied to all public endpoints
- **JWT security**: Short-lived access tokens (15min) with refresh tokens
- **HTTPS only**: No HTTP traffic in production
- **Environment variables**: All secrets stored securely

### Database Standards:
- **Migration-driven**: All schema changes via Prisma migrations
- **Foreign key constraints**: Proper referential integrity
- **Indexing**: Performance-critical queries must be indexed  
- **Backup verification**: Regular backup restoration tests
- **Data validation**: Database constraints match application logic

## 📈 Monitoring & KPIs

### Development Metrics:
- **API Response Time**: <200ms for 95th percentile
- **Database Query Time**: <50ms for common queries
- **Test Execution Time**: Full test suite <5 minutes
- **Build Time**: Backend + Frontend <3 minutes
- **Deployment Time**: <5 minutes end-to-end

### Production Metrics:
- **Uptime**: >99.9% availability
- **Error Rate**: <1% of requests result in 5xx errors
- **User Authentication**: <2% login failure rate
- **Data Consistency**: Zero data loss incidents
- **API Usage**: Track costs stay within budget

## 🚨 Risk Management

### Technical Risks & Mitigation:
1. **Data Migration Failures**
   - Mitigation: Extensive testing with production-like data
   - Rollback: Maintain IndexedDB as fallback during transition

2. **Authentication Security Issues**
   - Mitigation: Security audit and penetration testing
   - Monitoring: Automated security scanning in CI/CD

3. **Database Performance Problems**
   - Mitigation: Load testing and query optimization
   - Monitoring: Real-time performance alerts

4. **Third-party API Failures** (Gemini, OAuth)
   - Mitigation: Circuit breakers and graceful degradation
   - Fallbacks: Cached responses and offline modes

### Business Risks & Mitigation:
1. **Extended Downtime During Migration**
   - Mitigation: Blue-green deployment strategy
   - Communication: User notifications about maintenance windows

2. **User Experience Regression**
   - Mitigation: A/B testing and gradual rollout
   - Rollback: Quick revert to previous version capability

3. **Budget Overrun**
   - Monitoring: Daily cost tracking and alerts
   - Controls: Usage quotas and circuit breakers

## 📚 Additional Resources

### Essential Documentation:
- [Prisma Documentation](https://www.prisma.io/docs/)
- [Express.js Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [JWT Best Current Practices](https://datatracker.ietf.org/doc/html/rfc8725)
- [OAuth 2.0 Security Best Practices](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)
- [PostgreSQL Performance Tuning](https://www.postgresql.org/docs/current/performance-tips.html)

### Development Tools:
- **API Testing**: Thunder Client (VS Code) or Postman
- **Database Management**: pgAdmin or TablePlus
- **Monitoring**: Render built-in monitoring
- **Logging**: Winston for structured logging
- **Testing**: Jest + Supertest for API testing

---

**Next Steps**: Begin with Phase 1 by creating the backend project structure. The TodoWrite tool above contains the detailed task breakdown for systematic implementation.

**Remember**: Each completed phase should be thoroughly tested before proceeding to the next. The migration strategy prioritizes data safety and user experience continuity above development speed.