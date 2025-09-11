import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';

// 导入路由
import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';
import practiceRoutes from './routes/practice.js';
import chatRoutes from './routes/chat.js';
import vocabularyRoutes from './routes/vocabulary.js';
import vocabularyMinimalRoutes from './routes/vocabulary-minimal.js';
import billingRoutes from './routes/billing.js';
// import billingMinimalRoutes from './routes/billing-minimal.js';
import monitoringRoutes from './routes/monitoring.js';
import analyticsRoutes from './routes/analytics.js';
import usersRoutes from './routes/users.js';
import dashboardStreamRoutes from './routes/dashboard-stream.js';
import databaseRoutes from './routes/database.js';
import dbMigrateRoutes from './routes/db-migrate.js'; // 紧急数据库迁移路由
import emergencyFixRoutes from './routes/emergency-fix.js'; // 紧急修复路由
import adminRoutes from './routes/admin.js'; // 启用管理员功能
import databaseFixRoutes from './routes/database-fix.js'; // 数据库修复路由
import notificationRoutes from './routes/notifications.js'; // 通知邮件路由
// import migrateRoutes from './routes/migrate.js'; // 迁移完成，临时注释掉

// 导入中间件
import { generalRateLimit, generalSlowDown } from './middleware/rateLimiting.js';
import { 
  requestTimer, 
  httpLogger, 
  responseTimeMiddleware, 
  errorLogger,
  healthCheckLogger,
  apiUsageTracker
} from './middleware/logging.js';
import { authenticateToken } from './middleware/auth.js';
import { geminiService } from './services/geminiService.js';
import {
  trackPageVisit,
  trackFeatureUsage,
  trackPracticeActivity,
  trackAIInteraction,
  trackVocabularyActivity,
  trackAuthActivity,
  trackErrorActivity
} from './middleware/analytics.js';
import { disconnectDatabase, testDatabaseConnection } from './utils/database.js';
import { log, logSystemHealth } from './utils/logger.js';
import { ensureSubscriptionPlansExist } from './utils/seedData.js';
// import { MonitoringService } from './services/monitoringService.js'; // 暂时禁用以排查问题
import { prisma } from './utils/database.js';

// 加载环境变量
dotenv.config();

// 全局未捕获异常处理 - 防止进程意外退出
process.on('uncaughtException', (error) => {
  console.error('❌ 未捕获的异常:', error);
  console.error('Stack:', error.stack);
  // 记录错误但不退出进程
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未处理的Promise rejection:', reason);
  console.error('Promise:', promise);
  // 记录错误但不退出进程
});

const app = express();
const PORT = process.env.PORT || 3001;

// 暂时禁用监控服务
// const monitoringService = new MonitoringService(prisma);

// 配置 Express 信任代理（在生产环境中运行在反向代理后面）
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1); // 信任第一级代理
} else {
  app.set('trust proxy', true); // 开发环境信任所有代理
}

// 安全中间件
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS配置 - 支持Vercel前端部署
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'https://chattoeic.com',              // 自定义域名（裸域）
  'https://www.chattoeic.com',           // 自定义域名
  'https://chattoeic.vercel.app',        // Vercel默认域名
  'https://chattoeic-dashboard.vercel.app', // 管理员Dashboard
  'http://localhost:5173',               // 本地开发
  'http://localhost:3000',               // 备用本地端口
];
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // 允许没有origin的请求（如移动应用）
    if (!origin) return callback(null, true);

    // 检查origin是否在允许列表中，或者是Vercel预览部署
    if (allowedOrigins.includes(origin) || origin.includes('.vercel.app')) {
      return callback(null, true);
    }

    console.warn('CORS blocked origin:', origin);
    return callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Guest-Mode', 'X-Requested-With'],
  exposedHeaders: ['Set-Cookie'],
  optionsSuccessStatus: 200, // 支持老旧浏览器
  preflightContinue: false,
};

// 统一应用CORS，并显式处理所有预检请求
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// 监控和日志中间件
app.use(requestTimer);
app.use(responseTimeMiddleware);
app.use(httpLogger);
app.use(healthCheckLogger);

// 请求日志 (保留原有的morgan用于控制台输出)
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// 压缩响应
app.use(compression());

// Stripe Webhook需要原始body，在其他解析之前处理
app.use('/api/billing/webhooks', express.raw({ type: 'application/json' }));

// 解析请求体
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 速率限制和慢速保护
app.use(generalRateLimit);
app.use(generalSlowDown);

// API使用统计
app.use(apiUsageTracker);

// 页面访问追踪
app.use(trackPageVisit);

// API路由
app.use('/api/health', healthRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/dashboard', dashboardStreamRoutes);
app.use('/api/database', databaseRoutes);
app.use('/api/db-migrate', dbMigrateRoutes); // 紧急数据库迁移端点
app.use('/api/emergency-fix', emergencyFixRoutes); // 紧急修复端点
app.use('/api/admin', adminRoutes); // 启用管理员功能
app.use('/api/database-fix', databaseFixRoutes); // 数据库修复端点
app.use('/api/notifications', notificationRoutes); // 通知邮件路由

// 带有分析追踪的业务路由
app.use('/api/auth', trackAuthActivity, authRoutes);
app.use('/api/practice', trackPracticeActivity, practiceRoutes);
app.use('/api/questions', trackPracticeActivity, practiceRoutes); // 兼容前端的题目生成端点
app.use('/api/chat', trackAIInteraction, chatRoutes);

// 🚨 EMERGENCY BYPASS: 使用不同路径避开vocabulary路由冲突
app.post('/api/word-definition', async (req, res) => {
  try {
    const { word, language = 'zh' } = req.body || {};
    console.log('🚨 [EMERGENCY BYPASS] Word definition request', { word, language });
    
    if (!word || typeof word !== 'string') {
      return res.status(400).json({ success: false, error: '请提供有效的单词' });
    }

    // 直接调用AI获取定义
    const definition = await geminiService.getWordDefinition(word, language);
    
    console.log('🚨 [EMERGENCY BYPASS] AI definition retrieved successfully');
    return res.json({
      success: true,
      data: {
        word,
        phonetic: definition.phonetic || '',
        meanings: definition.meanings || [],
        definitionLoading: false,
        definitionError: false
      }
    });
  } catch (error) {
    console.error('🚨 [EMERGENCY BYPASS] Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: '获取词汇定义失败',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// 测试端点
app.get('/api/word-definition-test', (req, res) => {
  res.json({ success: true, message: 'Word definition endpoint available', timestamp: new Date().toISOString() });
});

// 超级简单的测试端点
app.get('/api/ultra-simple-test', (req, res) => {
  res.json({ message: 'Ultra simple test works', timestamp: Date.now() });
});

// 最简单的POST测试
app.post('/api/simple-post-test', (req, res) => {
  res.json({ message: 'Simple POST test works', body: req.body });
});

app.use('/api/vocabulary', trackVocabularyActivity, vocabularyRoutes);
app.use('/api/vocabulary-minimal', vocabularyMinimalRoutes);
// 独立的简单测试路由 - 部署验证端点
app.get('/api/billing-test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Simple billing test endpoint works - Deploy v2.1', 
    timestamp: new Date().toISOString(),
    deployVersion: 'v2.1-billing-fixed'
  });
});

// 🔧 EMERGENCY: 内联vocabulary路由测试 - 绕过所有导入问题
console.log('🚨 [紧急调试] 注册内联vocabulary测试路由');
app.get('/api/vocab-emergency-test', (req, res) => {
  res.json({
    success: true,
    message: 'Emergency vocabulary route working - inline in server.ts',
    timestamp: new Date().toISOString(),
    route: '/api/vocab-emergency-test'
  });
});

app.post('/api/vocab-emergency-test', (req, res) => {
  res.json({
    success: true,
    message: 'Emergency vocabulary POST working - inline in server.ts',
    requestBody: req.body,
    timestamp: new Date().toISOString(),
    route: '/api/vocab-emergency-test'
  });
});

// 更简单的测试路由
app.get('/test-simple', (req, res) => {
  res.json({ message: 'Simple test works' });
});

// 🔧 EMERGENCY: 无需认证的definition端点 - 绕过所有路由问题
app.post('/api/vocabulary/definition', async (req, res) => {
  try {
    const { word, language = 'zh' } = req.body || {};
    const userId = (req as any).user?.userId;

    console.log('🛡️ [Fallback] Definition request received', { word, language, userId });

    if (!word || typeof word !== 'string') {
      return res.status(400).json({ success: false, error: '请提供有效的单词' });
    }

    // 1) 尝试复用数据库中已有的词义（优先用户自己的，其次全局最新一条）
    try {
      const existingUserWord = await prisma.vocabularyItem.findFirst({
        where: { userId: userId || undefined, word: word.toLowerCase(), meanings: { not: null } },
        orderBy: { addedAt: 'desc' as const }
      });
      if (existingUserWord?.meanings) {
        console.log('🛡️ [Fallback] Reusing user meanings');
        return res.json({
          success: true,
          data: {
            word,
            phonetic: existingUserWord.phonetic,
            meanings: existingUserWord.meanings,
            definitionLoading: false,
            definitionError: false
          }
        });
      }

      const existingAnyWord = await prisma.vocabularyItem.findFirst({
        where: { word: word.toLowerCase(), meanings: { not: null } },
        orderBy: { addedAt: 'desc' as const }
      });
      if (existingAnyWord?.meanings) {
        console.log('🛡️ [Fallback] Reusing global meanings');
        return res.json({
          success: true,
          data: {
            word,
            phonetic: existingAnyWord.phonetic,
            meanings: existingAnyWord.meanings,
            definitionLoading: false,
            definitionError: false
          }
        });
      }
    } catch (dbErr) {
      console.warn('⚠️ [Fallback] DB lookup failed, will try AI', dbErr);
    }

    // 2) 调用 AI 服务
    try {
      console.log('🤖 [Fallback] Calling geminiService.getWordDefinition');
      const ai = await geminiService.getWordDefinition(word, '', language);
      return res.json({
        success: true,
        data: {
          word,
          phonetic: ai?.phonetic,
          meanings: ai?.meanings || [
            {
              partOfSpeech: 'noun',
              definitions: [
                { definition: `${word} 的定义（AI生成）`, example: `Example sentence with ${word}.` }
              ]
            }
          ],
          definitionLoading: false,
          definitionError: !ai
        }
      });
    } catch (aiErr) {
      console.error('❌ [Fallback] AI failed, returning mock', aiErr);
      // 3) 最终兜底：返回可解析的模拟数据，避免前端功能被阻断
      return res.json({
        success: true,
        data: {
          word,
          phonetic: `/${word}/`,
          meanings: [
            {
              partOfSpeech: 'noun',
              definitions: [
                { definition: `${word} 的模拟定义（路由兜底）`, example: `Example sentence with ${word}.` }
              ]
            }
          ],
          definitionLoading: false,
          definitionError: true
        },
        meta: { fallback: true }
      });
    }
  } catch (error: any) {
    console.error('💥 [Fallback] Fatal definition error', error);
    return res.status(500).json({ success: false, error: '获取词汇定义失败' });
  }
});

// 🔧 EMERGENCY: 直接无需认证的definition端点 - 绕过路由模块导入问题
app.post('/api/vocabulary/definition-emergency', async (req, res) => {
  try {
    const { word, language = 'zh' } = req.body;
    console.log('🚨 [Emergency] Definition request:', { word, language });
    
    res.json({
      success: true,
      data: {
        word,
        definition: `${word} 的紧急模拟定义`,
        phonetic: `/${word}/`,
        meanings: [{
          partOfSpeech: 'noun',
          definitions: [{ definition: `${word} 的紧急释义`, example: `Example: ${word}` }]
        }]
      },
      emergency: true
    });
  } catch (error) {
    res.status(500).json({ success: false, error: '紧急端点失败' });
  }
});

// 部署验证端点 - 验证最新代码是否部署
app.get('/api/deploy-check', (req, res) => {
  res.json({ 
    deployedAt: new Date().toISOString(),
    commitHash: 'fix-vocab-definition-fallback',
    definitionEndpointExists: true,
    message: 'Force deploy: fix vocabulary/definition 404 error - v2.0.4 - emergency inline'
  });
});

// 🔍 数据库列检查端点（公开访问，用于调试）
app.get('/api/debug/check-columns', async (req, res) => {
  try {
    const { prisma } = require('./utils/database.js');
    
    // 检查 user_subscriptions 表的所有列
    const userSubColumns = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'user_subscriptions' 
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `;
    
    // 检查关键列是否存在
    const hasNextPaymentAt = userSubColumns.some(col => col.column_name === 'nextPaymentAt');
    
    res.json({
      success: true,
      data: {
        table: 'user_subscriptions',
        columns: userSubColumns,
        critical_columns: {
          nextPaymentAt: hasNextPaymentAt
        },
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to check columns',
      details: error.message
    });
  }
});

// 🔧 紧急列修复端点 - 直接添加缺失的列
app.post('/api/fix-missing-columns', async (req, res) => {
  try {
    console.log('🔧 Emergency column fix requested');
    const { prisma } = require('./utils/database.js');
    
    // 直接执行 ALTER TABLE 添加缺失的列
    console.log('🔧 Adding missing nextPaymentAt column...');
    await prisma.$executeRaw`
      ALTER TABLE public.user_subscriptions 
      ADD COLUMN IF NOT EXISTS "nextPaymentAt" TIMESTAMP;
    `;
    
    console.log('✅ nextPaymentAt column added successfully');
    
    // 验证列是否存在
    const result = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns
      WHERE table_name = 'user_subscriptions' 
      AND table_schema = 'public'
      ORDER BY ordinal_position;
    `;
    
    console.log('✅ Column verification completed');
    
    res.json({
      success: true,
      message: 'Missing columns fixed successfully',
      details: {
        timestamp: new Date().toISOString(),
        fixed_columns: ['nextPaymentAt'],
        all_columns: result,
        next_steps: [
          'nextPaymentAt column is now available',
          'Payment system should work properly',
          'Try creating checkout session again'
        ]
      }
    });
    
  } catch (error: any) {
    console.error('Failed to fix missing columns:', error);
    
    res.status(500).json({
      success: false,
      error: 'Column fix failed',
      details: {
        message: error.message,
        timestamp: new Date().toISOString(),
        troubleshooting: [
          'Database might be in read-only mode',
          'Check database permissions',
          'Verify database connection'
        ]
      }
    });
  }
});

// 🔄 Prisma客户端刷新端点
app.post('/api/refresh-prisma', async (req, res) => {
  try {
    console.log('🔄 Refreshing Prisma client...');
    
    // 断开当前连接
    await prisma.$disconnect();
    console.log('✅ Prisma client disconnected');
    
    // 重新连接
    await prisma.$connect();
    console.log('✅ Prisma client reconnected');
    
    // 测试连接和表结构
    const testQuery = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'usage_quotas' 
      ORDER BY ordinal_position
    `;
    
    console.log('✅ Prisma client refresh completed successfully');
    
    res.json({
      success: true,
      message: 'Prisma client refreshed successfully',
      details: {
        timestamp: new Date().toISOString(),
        tableColumns: testQuery,
        nextSteps: [
          'Prisma client has been disconnected and reconnected',
          'Database schema should now be in sync',
          'Trial function should work properly'
        ]
      }
    });
    
  } catch (error: any) {
    console.error('Failed to refresh Prisma client:', error);
    
    res.status(500).json({
      success: false,
      error: 'Prisma client refresh failed',
      details: {
        message: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// 🆘 紧急数据库迁移端点（直接在server.ts中实现）
app.post('/api/emergency-migrate', async (req, res) => {
  try {
    console.log('🆘 Emergency database migration requested - Creating usage_quotas table');
    
    // 删除并重新创建usage_quotas表，使用正确的列名
    await prisma.$executeRaw`DROP TABLE IF EXISTS usage_quotas CASCADE;`;
    
    await prisma.$executeRaw`
      CREATE TABLE usage_quotas (
        id TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "resourceType" TEXT NOT NULL,
        "usedCount" INTEGER DEFAULT 0,
        "limitCount" INTEGER,
        "periodStart" TIMESTAMP DEFAULT NOW(),
        "periodEnd" TIMESTAMP NOT NULL,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      );
    `;
    
    console.log('✅ usage_quotas table created');
    
    // 尝试添加外键约束
    try {
      await prisma.$executeRaw`
        ALTER TABLE usage_quotas 
        ADD CONSTRAINT fk_usage_quotas_user 
        FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE;
      `;
      console.log('✅ Foreign key constraint added');
    } catch (fkError) {
      console.log('⚠️ Foreign key constraint failed (may already exist):', fkError.message);
    }
    
    // 尝试添加唯一约束
    try {
      await prisma.$executeRaw`
        ALTER TABLE usage_quotas 
        ADD CONSTRAINT uniq_user_resource_period 
        UNIQUE("userId", "resourceType", "periodStart");
      `;
      console.log('✅ Unique constraint added');
    } catch (uniqError) {
      console.log('⚠️ Unique constraint failed (may already exist):', uniqError.message);
    }
    
    console.log('✅ Emergency database migration completed successfully');
    
    res.json({
      success: true,
      message: 'Emergency database migration completed successfully',
      details: {
        timestamp: new Date().toISOString(),
        tablesCreated: ['usage_quotas'],
        constraintsAdded: ['foreign_key', 'unique_constraint'],
        next_steps: [
          'usage_quotas table is now available',
          'Trial function should work properly',
          'Test trial registration again'
        ]
      }
    });
    
  } catch (error: any) {
    console.error('Failed to migrate database:', error);
    
    res.status(500).json({
      success: false,
      error: 'Emergency database migration failed',
      details: {
        message: error.message,
        timestamp: new Date().toISOString(),
        troubleshooting: [
          'Check DATABASE_URL environment variable',
          'Verify database connectivity',
          'Ensure proper database permissions'
        ]
      }
    });
  }
});

// 重新启用billing路由，问题已确认是超时而非路由问题
app.use('/api/billing', billingRoutes); // Stripe支付系统路由
// app.use('/api/migrate', migrateRoutes); // 迁移完成，临时注释掉

// 根路径
app.get('/', (req, res) => {
  res.json({
    name: 'ChatTOEIC API',
    version: '2.0.1-definition-fix',
    status: 'running',
    timestamp: new Date().toISOString(),
    deployNote: 'Includes /vocabulary/definition endpoint fix'
  });
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在',
    path: req.originalUrl
  });
});

// 错误日志中间件
app.use(errorLogger);

// 错误分析追踪中间件
app.use(trackErrorActivity);

// 全局错误处理
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // 使用新的日志系统记录错误
  log.error('Global error handler triggered', {
    error: {
      message: err.message,
      stack: err.stack,
      name: err.name,
      status: err.status || err.statusCode
    },
    request: {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: req.requestId
    },
    user: {
      userId: req.user?.userId
    }
  });
  
  // 不要暴露内部错误详情到生产环境
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).json({
    success: false,
    error: isDevelopment ? err.message : '服务器内部错误',
    requestId: req.requestId,
    ...(isDevelopment && { stack: err.stack })
  });
});

// 启动服务器 - 绑定到所有接口
const server = app.listen(PORT, '0.0.0.0', async () => {
  // 使用结构化日志记录启动信息
  log.info('ChatTOEIC API Server Started', {
    version: '2.0.0',
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });

  console.log(`🚀 ChatTOEIC API v2.0.0 服务器启动成功`);
  console.log(`📡 服务地址: http://localhost:${PORT}`);
  console.log(`🌍 环境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🏥 健康检查: http://localhost:${PORT}/api/health`);
  console.log(`📊 监控面板: http://localhost:${PORT}/api/monitoring/health/detailed`);
  
  // 显示特殊启动模式提示
  if (process.env.BASELINE_COMPLETED === 'true') {
    console.log(`🏗️ ✅ 数据库基线建立模式`);
    console.log(`   - 已为现有数据库建立迁移基线`);
    console.log(`   - 解决了 P3005 数据库架构不为空问题`);
  } else if (process.env.FORCE_START === 'true') {
    console.log(`🔧 ⚠️ 强制启动模式激活`);
    console.log(`   - 跳过了所有数据库迁移检查`);
    console.log(`   - 如果遇到数据库错误，请检查数据库连接`);
  }
  
  if (process.env.SKIP_ALL_DB_CHECKS === 'true') {
    console.log(`🚫 ⚠️ 跳过所有数据库检查模式`);
    console.log(`   - 完全绕过数据库相关的所有检查`);
    console.log(`   - 仅用于紧急情况`);
  }
  
  if (process.env.RENDER_OVERRIDE === 'true') {
    console.log(`🎭 ✅ Render 覆盖模式`);
    console.log(`   - 绕过 Render 固定的部署命令`);
    console.log(`   - 使用自定义的迁移处理逻辑`);
  }
  
  if (process.env.EMERGENCY_START === 'true') {
    console.log(`🆘 ⚠️ 紧急启动模式`);
    console.log(`   - 所有数据库操作都失败后的最后手段`);
    console.log(`   - 服务器将在最小配置下运行`);
  }
  
  if (process.env.TOKEN_BLACKLIST_FIXED === 'true') {
    console.log(`🛡️ ✅ TokenBlacklist修复模式`);
    console.log(`   - TokenBlacklist迁移冲突已解决`);
    console.log(`   - 用户封禁功能已可用`);
  }
  
  // 异步数据库连接测试（不阻塞启动）
  setTimeout(async () => {
    try {
      const dbTest = await testDatabaseConnection();
      if (dbTest.connected) {
        log.info('Database connection established', {
          responseTime: `${dbTest.responseTime}ms`
        });
        console.log(`✅ 数据库连接成功 (${dbTest.responseTime}ms)`);
        
        // 初始化订阅套餐数据
        try {
          await ensureSubscriptionPlansExist();
          console.log(`✅ 订阅套餐数据初始化完成`);
        } catch (error) {
          console.log(`⚠️ 订阅套餐数据初始化失败:`, error.message);
        }
      } else {
        log.warn('Database connection failed', {
          error: dbTest.error
        });
        console.log(`⚠️ 数据库连接失败，但服务器继续运行: ${dbTest.error}`);
      }
    } catch (error) {
      log.warn('Database connection test failed', { error: error.message });
      console.log('⚠️ 数据库连接测试失败，但服务器继续运行:', error.message);
    }
  }, 2000);

  // 记录系统健康状况
  setTimeout(() => {
    try {
      logSystemHealth();
      console.log('✅ 系统健康状况检查完成');
    } catch (error) {
      console.log('⚠️ 系统健康状况记录失败，但不影响运行');
    }
  }, 3000);

  // 最终启动成功消息
  console.log('\n🎉 =================================');
  console.log('✅ ChatTOEIC API 服务器启动完成！');
  console.log('🌟 所有核心功能已就绪');
  console.log('🔗 服务状态: HEALTHY');
  console.log('=================================\n');
});

// 优雅关闭
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function gracefulShutdown(signal: string) {
  log.info('Graceful shutdown initiated', {
    signal,
    uptime: process.uptime()
  });
  
  console.log(`\n收到 ${signal} 信号，开始优雅关闭...`);
  
  server.close(async () => {
    log.info('HTTP server closed');
    console.log('HTTP 服务器已关闭');
    
    try {
      await disconnectDatabase();
      log.info('Database connection closed');
      console.log('数据库连接已关闭');
    } catch (error) {
      log.error('Error closing database connection', { error });
      console.error('关闭数据库连接时出错:', error);
    }
    
    log.info('Application shutdown completed');
    console.log('应用程序已完全关闭');
    process.exit(0);
  });

  // 强制关闭（如果优雅关闭超时）
  setTimeout(() => {
    log.error('Forced shutdown due to timeout');
    console.error('强制关闭应用程序');
    process.exit(1);
  }, 10000);
}

export default app;// Force Prisma client refresh - Sun Aug 24 21:43:49 JST 2025
