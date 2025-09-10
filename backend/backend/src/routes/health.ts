import { Router, Request, Response } from 'express';
import { testDatabaseConnection } from '../utils/database.js';
import { HealthStatus, DetailedHealthStatus } from '../types/index.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = Router();

// 基础健康检查
router.get('/', async (req: Request, res: Response) => {
  const healthStatus: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '2.0.1-force-deploy'
  };

  res.status(200).json(healthStatus);
});

// 临时billing测试端点
router.get('/billing-test', async (req: Request, res: Response) => {
  res.json({
    success: true,
    service: 'billing-test',
    message: 'Billing test endpoint in health router works',
    timestamp: new Date().toISOString()
  });
});

// 详细健康检查
router.get('/detailed', async (req: Request, res: Response) => {
  try {
    // 检查是否跳过数据库检查
    const skipDbCheck = process.env.SKIP_ALL_DB_CHECKS === 'true' || process.env.EMERGENCY_START === 'true';
    
    // 测试数据库连接（如果未跳过）
    let dbStatus;
    if (skipDbCheck) {
      dbStatus = {
        connected: false,
        responseTime: 0,
        error: 'Database checks skipped in emergency mode'
      };
    } else {
      dbStatus = await testDatabaseConnection();
    }
    
    // 获取内存使用情况
    const memUsage = process.memoryUsage();
    
    const detailedStatus: DetailedHealthStatus = {
      status: skipDbCheck ? 'healthy' : (dbStatus.connected ? 'healthy' : 'unhealthy'),
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '2.0.1-force-deploy',
      database: dbStatus,
      memory: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        free: Math.round((memUsage.heapTotal - memUsage.heapUsed) / 1024 / 1024), // MB
        total: Math.round(memUsage.heapTotal / 1024 / 1024) // MB
      },
      services: {
        gemini: await testGeminiAPI()
      },
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        FRONTEND_URL: process.env.FRONTEND_URL,
        hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
        hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
        hasJwtSecret: !!process.env.JWT_SECRET,
        hasJwtRefreshSecret: !!process.env.JWT_REFRESH_SECRET,
        hasGeminiApiKey: !!process.env.GEMINI_API_KEY,
        emergencyMode: skipDbCheck,
        skipDbChecks: process.env.SKIP_ALL_DB_CHECKS === 'true',
        emergencyStart: process.env.EMERGENCY_START === 'true',
        bypassMigrations: process.env.BYPASS_MIGRATIONS === 'true'
      }
    };

    const statusCode = detailedStatus.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(detailedStatus);
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '2.0.1-force-deploy',
      error: 'Health check failed'
    });
  }
});

// 就绪检查 (Railway使用)
router.get('/ready', async (req: Request, res: Response) => {
  try {
    const skipDbCheck = process.env.SKIP_ALL_DB_CHECKS === 'true' || process.env.EMERGENCY_START === 'true';
    
    if (skipDbCheck) {
      res.status(200).json({ 
        ready: true, 
        mode: 'emergency',
        note: 'Database checks bypassed, basic service ready'
      });
    } else {
      const dbStatus = await testDatabaseConnection();
      
      if (dbStatus.connected) {
        res.status(200).json({ ready: true });
      } else {
        res.status(503).json({ ready: false, reason: 'Database not connected' });
      }
    }
  } catch (error) {
    res.status(503).json({ ready: false, reason: 'Health check failed' });
  }
});

// 存活检查
router.get('/live', (req: Request, res: Response) => {
  res.status(200).json({
    alive: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 度量指标
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    const metrics = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      process: {
        pid: process.pid,
        version: process.version,
        platform: process.platform,
        arch: process.arch
      }
    };

    res.status(200).json(metrics);
  } catch (error) {
    console.error('Metrics collection failed:', error);
    res.status(500).json({
      error: 'Failed to collect metrics'
    });
  }
});

// 简单的Gemini API测试端点
router.get('/gemini-test', async (req: Request, res: Response) => {
  try {
    console.log('🧪 Simple Gemini API test started...');
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.json({
        success: false,
        error: 'GEMINI_API_KEY not configured',
        details: {
          apiKeyPresent: false,
          apiKeyLength: 0
        }
      });
    }

    console.log('API Key found, length:', apiKey.length);
    
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    console.log('Model initialized, making test request...');
    const result = await model.generateContent('Say hello');
    const response = await result.response;
    const text = response.text();
    
    console.log('✅ Test successful, response:', text.substring(0, 50));
    
    res.json({
      success: true,
      message: 'Gemini API working correctly',
      details: {
        apiKeyPresent: true,
        apiKeyLength: apiKey.length,
        responseLength: text.length,
        responsePreview: text.substring(0, 100)
      }
    });
  } catch (error: any) {
    console.error('❌ Gemini test failed:', error);
    res.json({
      success: false,
      error: error.message,
      details: {
        errorType: error.constructor.name,
        errorCode: error.code,
        errorStatus: error.status,
        stack: error.stack?.split('\n').slice(0, 3)
      }
    });
  }
});

// Gemini API测试函数
async function testGeminiAPI() {
  const result = {
    available: false,
    configured: !!process.env.GEMINI_API_KEY,
    accessible: false,
    responseTime: null as number | null,
    error: null as string | null,
    rateLimit: {
      remaining: 100,
      resetTime: new Date(Date.now() + 60 * 60 * 1000).toISOString()
    }
  };

  if (!process.env.GEMINI_API_KEY) {
    result.error = 'GEMINI_API_KEY环境变量未设置';
    return result;
  }

  try {
    console.log('🧪 Testing Gemini API connection...');
    const startTime = Date.now();
    
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    // 发送简单测试请求
    const testResult = await model.generateContent('Please respond with exactly: "API_TEST_SUCCESS"');
    const response = await testResult.response;
    const text = response.text();
    
    result.responseTime = Date.now() - startTime;
    
    if (text && text.includes('API_TEST_SUCCESS')) {
      result.available = true;
      result.accessible = true;
      console.log('✅ Gemini API test successful');
    } else {
      result.error = `意外的响应内容: ${text.substring(0, 100)}`;
      console.log('⚠️ Gemini API响应异常:', text);
    }
  } catch (error: any) {
    console.error('❌ Gemini API test failed:', error);
    result.error = error.message;
    
    // 检查具体错误类型
    if (error.message?.includes('API_KEY') || error.message?.includes('Invalid API key')) {
      result.error = 'API密钥无效';
    } else if (error.message?.includes('quota') || error.message?.includes('QUOTA_EXCEEDED')) {
      result.error = '配额已耗尽';
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNRESET') {
      result.error = '网络连接失败';
    }
  }

  return result;
}

export default router;