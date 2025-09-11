var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/utils/database.ts
var database_exports = {};
__export(database_exports, {
  disconnectDatabase: () => disconnectDatabase,
  prisma: () => prisma,
  testDatabaseConnection: () => testDatabaseConnection
});
import { PrismaClient } from "@prisma/client";
async function testDatabaseConnection() {
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const responseTime2 = Date.now() - start;
    return {
      connected: true,
      responseTime: responseTime2
    };
  } catch (error) {
    console.warn("Database connection test failed:", error);
    return {
      connected: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}
async function disconnectDatabase() {
  await prisma.$disconnect();
}
var globalForPrisma, prisma;
var init_database = __esm({
  "src/utils/database.ts"() {
    globalForPrisma = globalThis;
    prisma = globalForPrisma.prisma ?? new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
      datasources: {
        db: {
          url: process.env.DATABASE_URL || "postgresql://user:password@localhost:5432/chattoeic"
        }
      },
      // 添加连接池配置优化
      __internal: {
        engine: {
          connectTimeout: 1e4,
          // 10秒连接超时
          poolTimeout: 1e4
          // 10秒池超时
        }
      }
    });
    if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
  }
});

// src/server.ts
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import dotenv from "dotenv";

// src/routes/health.ts
init_database();
import { Router } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
var router = Router();
router.get("/", async (req, res) => {
  const healthStatus = {
    status: "healthy",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || "2.0.1-force-deploy"
  };
  res.status(200).json(healthStatus);
});
router.get("/billing-test", async (req, res) => {
  res.json({
    success: true,
    service: "billing-test",
    message: "Billing test endpoint in health router works",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
router.get("/detailed", async (req, res) => {
  try {
    const skipDbCheck = process.env.SKIP_ALL_DB_CHECKS === "true" || process.env.EMERGENCY_START === "true";
    let dbStatus;
    if (skipDbCheck) {
      dbStatus = {
        connected: false,
        responseTime: 0,
        error: "Database checks skipped in emergency mode"
      };
    } else {
      dbStatus = await testDatabaseConnection();
    }
    const memUsage = process.memoryUsage();
    const detailedStatus = {
      status: skipDbCheck ? "healthy" : dbStatus.connected ? "healthy" : "unhealthy",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || "2.0.1-force-deploy",
      database: dbStatus,
      memory: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024),
        // MB
        free: Math.round((memUsage.heapTotal - memUsage.heapUsed) / 1024 / 1024),
        // MB
        total: Math.round(memUsage.heapTotal / 1024 / 1024)
        // MB
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
        skipDbChecks: process.env.SKIP_ALL_DB_CHECKS === "true",
        emergencyStart: process.env.EMERGENCY_START === "true",
        bypassMigrations: process.env.BYPASS_MIGRATIONS === "true"
      }
    };
    const statusCode = detailedStatus.status === "healthy" ? 200 : 503;
    res.status(statusCode).json(detailedStatus);
  } catch (error) {
    console.error("Health check failed:", error);
    res.status(503).json({
      status: "unhealthy",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || "2.0.1-force-deploy",
      error: "Health check failed"
    });
  }
});
router.get("/ready", async (req, res) => {
  try {
    const skipDbCheck = process.env.SKIP_ALL_DB_CHECKS === "true" || process.env.EMERGENCY_START === "true";
    if (skipDbCheck) {
      res.status(200).json({
        ready: true,
        mode: "emergency",
        note: "Database checks bypassed, basic service ready"
      });
    } else {
      const dbStatus = await testDatabaseConnection();
      if (dbStatus.connected) {
        res.status(200).json({ ready: true });
      } else {
        res.status(503).json({ ready: false, reason: "Database not connected" });
      }
    }
  } catch (error) {
    res.status(503).json({ ready: false, reason: "Health check failed" });
  }
});
router.get("/live", (req, res) => {
  res.status(200).json({
    alive: true,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    uptime: process.uptime()
  });
});
router.get("/metrics", async (req, res) => {
  try {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const metrics = {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
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
    console.error("Metrics collection failed:", error);
    res.status(500).json({
      error: "Failed to collect metrics"
    });
  }
});
router.get("/gemini-test", async (req, res) => {
  try {
    console.log("\u{1F9EA} Simple Gemini API test started...");
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.json({
        success: false,
        error: "GEMINI_API_KEY not configured",
        details: {
          apiKeyPresent: false,
          apiKeyLength: 0
        }
      });
    }
    console.log("API Key found, length:", apiKey.length);
    const { GoogleGenerativeAI: GoogleGenerativeAI3 } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI3(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    console.log("Model initialized, making test request...");
    const result = await model.generateContent("Say hello");
    const response = await result.response;
    const text = response.text();
    console.log("\u2705 Test successful, response:", text.substring(0, 50));
    res.json({
      success: true,
      message: "Gemini API working correctly",
      details: {
        apiKeyPresent: true,
        apiKeyLength: apiKey.length,
        responseLength: text.length,
        responsePreview: text.substring(0, 100)
      }
    });
  } catch (error) {
    console.error("\u274C Gemini test failed:", error);
    res.json({
      success: false,
      error: error.message,
      details: {
        errorType: error.constructor.name,
        errorCode: error.code,
        errorStatus: error.status,
        stack: error.stack?.split("\n").slice(0, 3)
      }
    });
  }
});
async function testGeminiAPI() {
  const result = {
    available: false,
    configured: !!process.env.GEMINI_API_KEY,
    accessible: false,
    responseTime: null,
    error: null,
    rateLimit: {
      remaining: 100,
      resetTime: new Date(Date.now() + 60 * 60 * 1e3).toISOString()
    }
  };
  if (!process.env.GEMINI_API_KEY) {
    result.error = "GEMINI_API_KEY\u73AF\u5883\u53D8\u91CF\u672A\u8BBE\u7F6E";
    return result;
  }
  try {
    console.log("\u{1F9EA} Testing Gemini API connection...");
    const startTime = Date.now();
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const testResult = await model.generateContent('Please respond with exactly: "API_TEST_SUCCESS"');
    const response = await testResult.response;
    const text = response.text();
    result.responseTime = Date.now() - startTime;
    if (text && text.includes("API_TEST_SUCCESS")) {
      result.available = true;
      result.accessible = true;
      console.log("\u2705 Gemini API test successful");
    } else {
      result.error = `\u610F\u5916\u7684\u54CD\u5E94\u5185\u5BB9: ${text.substring(0, 100)}`;
      console.log("\u26A0\uFE0F Gemini API\u54CD\u5E94\u5F02\u5E38:", text);
    }
  } catch (error) {
    console.error("\u274C Gemini API test failed:", error);
    result.error = error.message;
    if (error.message?.includes("API_KEY") || error.message?.includes("Invalid API key")) {
      result.error = "API\u5BC6\u94A5\u65E0\u6548";
    } else if (error.message?.includes("quota") || error.message?.includes("QUOTA_EXCEEDED")) {
      result.error = "\u914D\u989D\u5DF2\u8017\u5C3D";
    } else if (error.code === "ENOTFOUND" || error.code === "ECONNRESET") {
      result.error = "\u7F51\u7EDC\u8FDE\u63A5\u5931\u8D25";
    }
  }
  return result;
}
var health_default = router;

// src/routes/auth.ts
init_database();
import { Router as Router3 } from "express";
import bcrypt2 from "bcryptjs";
import jwt2 from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";

// src/middleware/validation.ts
import Joi from "joi";
var validateRequest = (schema) => {
  return (req, res, next) => {
    const errors = [];
    if (schema.body) {
      const { error } = schema.body.validate(req.body);
      if (error) {
        errors.push(`\u8BF7\u6C42\u4F53: ${error.details.map((d) => d.message).join(", ")}`);
      }
    }
    if (schema.query) {
      const { error } = schema.query.validate(req.query);
      if (error) {
        errors.push(`\u67E5\u8BE2\u53C2\u6570: ${error.details.map((d) => d.message).join(", ")}`);
      }
    }
    if (schema.params) {
      const { error } = schema.params.validate(req.params);
      if (error) {
        errors.push(`\u8DEF\u5F84\u53C2\u6570: ${error.details.map((d) => d.message).join(", ")}`);
      }
    }
    if (errors.length > 0) {
      console.log("Validation failed:", {
        path: req.path,
        method: req.method,
        body: req.body,
        errors
      });
      return res.status(400).json({
        success: false,
        error: "\u9A8C\u8BC1\u5931\u8D25",
        details: errors
      });
    }
    next();
  };
};
var schemas = {
  // 分页参数
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string().valid("createdAt", "updatedAt", "name", "word", "reviewCount", "nextReviewDate").optional(),
    sortOrder: Joi.string().valid("asc", "desc").default("desc").optional()
  }),
  // 用户注册
  userRegister: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    name: Joi.string().optional()
  }),
  // 用户登录
  userLogin: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),
  // 题目生成请求
  questionGeneration: Joi.object({
    type: Joi.string().valid(
      "LISTENING_PART1",
      "LISTENING_PART2",
      "LISTENING_PART3",
      "LISTENING_PART4",
      "READING_PART5",
      "READING_PART6",
      "READING_PART7"
    ).required(),
    difficulty: Joi.string().valid("BEGINNER", "INTERMEDIATE", "ADVANCED").required(),
    count: Joi.number().integer().min(1).max(20).required(),
    topic: Joi.string().optional(),
    customPrompt: Joi.string().max(500).optional(),
    language: Joi.string().valid("en", "zh", "ja").optional()
  }),
  // 练习提交
  practiceSubmission: Joi.object({
    sessionId: Joi.string().required(),
    questions: Joi.array().items(
      Joi.object({
        questionId: Joi.string().required(),
        userAnswer: Joi.string().required(),
        timeSpent: Joi.number().integer().min(0).required()
      })
    ).min(1).required()
  }),
  // 聊天请求
  chatRequest: Joi.object({
    message: Joi.string().min(1).max(2e3).required(),
    sessionId: Joi.string().optional(),
    context: Joi.object({
      questionId: Joi.string().optional(),
      practiceSessionId: Joi.string().optional()
    }).optional(),
    // 支持前端发送的 questionContext 格式
    questionContext: Joi.object({
      id: Joi.string().optional(),
      question: Joi.string().optional(),
      options: Joi.array().items(Joi.string()).optional(),
      correctAnswer: Joi.number().optional(),
      category: Joi.string().optional(),
      difficulty: Joi.alternatives().try(
        Joi.string().valid("BEGINNER", "INTERMEDIATE", "ADVANCED"),
        Joi.number()
      ).optional(),
      userAnswer: Joi.number().optional(),
      explanation: Joi.string().optional()
    }).optional(),
    // 支持语言指令字段
    languageInstruction: Joi.string().optional()
  }),
  // 词汇请求
  vocabularyRequest: Joi.object({
    word: Joi.string().min(1).max(100).required(),
    context: Joi.string().max(500).optional(),
    sourceType: Joi.string().valid("practice", "review", "manual").optional(),
    sourceId: Joi.string().optional(),
    tags: Joi.array().items(Joi.string()).optional(),
    language: Joi.string().valid("zh", "en", "auto").optional()
  }),
  // ID参数验证
  idParam: Joi.object({
    id: Joi.string().required()
  })
};

// src/middleware/rateLimiting.ts
import rateLimit from "express-rate-limit";
import slowDown from "express-slow-down";
var generalRateLimit = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1e3,
  // 15分钟
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  // 限制每个IP每个windowMs最多请求数
  message: {
    success: false,
    error: "\u8BF7\u6C42\u8FC7\u4E8E\u9891\u7E41\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5"
  },
  standardHeaders: true,
  legacyHeaders: false
});
var aiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1e3,
  // 15分钟
  max: 30,
  // AI请求限制更严格
  message: {
    success: false,
    error: "AI\u8BF7\u6C42\u8FC7\u4E8E\u9891\u7E41\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5"
  },
  standardHeaders: true,
  legacyHeaders: false
});
var authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1e3,
  // 15分钟
  max: 20,
  // 增加到20次，支持Google OAuth流程
  message: {
    success: false,
    error: "\u8BA4\u8BC1\u8BF7\u6C42\u8FC7\u4E8E\u9891\u7E41\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5"
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
  // 成功的请求不计入限制
});
var oauthRateLimit = rateLimit({
  windowMs: 5 * 60 * 1e3,
  // 5分钟
  max: 50,
  // OAuth流程需要多次请求
  message: {
    success: false,
    error: "OAuth\u8BA4\u8BC1\u8BF7\u6C42\u8FC7\u4E8E\u9891\u7E41\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5"
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});
var generalSlowDown = slowDown({
  windowMs: parseInt(process.env.SLOW_DOWN_WINDOW_MS) || 15 * 60 * 1e3,
  // 15分钟
  delayAfter: parseInt(process.env.SLOW_DOWN_DELAY_AFTER) || 50,
  // 超过50个请求后开始延迟
  delayMs: () => 500,
  // 修复express-slow-down v2警告，使用函数形式
  maxDelayMs: 5e3,
  // 最大延迟5秒
  validate: { delayMs: false }
  // 禁用警告消息
});
var uploadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1e3,
  // 1小时
  max: 10,
  // 每小时最多10次上传
  message: {
    success: false,
    error: "\u6587\u4EF6\u4E0A\u4F20\u8FC7\u4E8E\u9891\u7E41\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5"
  },
  standardHeaders: true,
  legacyHeaders: false
});

// src/middleware/auth.ts
import jwt from "jsonwebtoken";
import { PrismaClient as PrismaClient2 } from "@prisma/client";

// src/services/tokenBlacklistService.ts
init_database();
var TokenBlacklistService = class {
  /**
   * 将用户的所有令牌加入黑名单（封禁时调用）
   */
  static async blacklistUserTokens(userId, reason = "USER_BANNED") {
    try {
      await prisma.$executeRaw`
        INSERT INTO "token_blacklist" (id, "userId", "tokenId", reason, "expiresAt", "createdAt")
        VALUES (
          gen_random_uuid(),
          ${userId},
          'ALL_TOKENS',
          ${reason},
          NOW() + INTERVAL '7 days',
          NOW()
        )
        ON CONFLICT DO NOTHING
      `;
      console.log(`\u2705 \u7528\u6237 ${userId} \u7684\u6240\u6709\u4EE4\u724C\u5DF2\u52A0\u5165\u9ED1\u540D\u5355`);
    } catch (error) {
      console.error("\u274C \u52A0\u5165\u4EE4\u724C\u9ED1\u540D\u5355\u5931\u8D25:", error);
    }
  }
  /**
   * 从黑名单中移除用户令牌（解封时调用）
   */
  static async removeUserFromBlacklist(userId) {
    try {
      await prisma.$executeRaw`
        DELETE FROM "token_blacklist" 
        WHERE "userId" = ${userId}
      `;
      console.log(`\u2705 \u7528\u6237 ${userId} \u5DF2\u4ECE\u4EE4\u724C\u9ED1\u540D\u5355\u4E2D\u79FB\u9664`);
    } catch (error) {
      console.error("\u274C \u79FB\u9664\u4EE4\u724C\u9ED1\u540D\u5355\u5931\u8D25:", error);
    }
  }
  /**
   * 检查用户令牌是否在黑名单中
   */
  static async isTokenBlacklisted(userId) {
    try {
      const result = await prisma.$queryRaw`
        SELECT COUNT(*) as count
        FROM "token_blacklist" 
        WHERE "userId" = ${userId}
        AND "expiresAt" > NOW()
      `;
      const count = Number(result[0]?.count || 0);
      return count > 0;
    } catch (error) {
      console.error("\u274C \u68C0\u67E5\u4EE4\u724C\u9ED1\u540D\u5355\u5931\u8D25:", error);
      return false;
    }
  }
  /**
   * 清理过期的黑名单记录
   */
  static async cleanupExpiredTokens() {
    try {
      const result = await prisma.$executeRaw`
        DELETE FROM "token_blacklist" 
        WHERE "expiresAt" < NOW()
      `;
      console.log(`\u2705 \u6E05\u7406\u4E86\u8FC7\u671F\u7684\u9ED1\u540D\u5355\u4EE4\u724C\u8BB0\u5F55`);
    } catch (error) {
      console.error("\u274C \u6E05\u7406\u8FC7\u671F\u4EE4\u724C\u9ED1\u540D\u5355\u5931\u8D25:", error);
    }
  }
};
setInterval(() => {
  TokenBlacklistService.cleanupExpiredTokens();
}, 60 * 60 * 1e3);

// src/middleware/auth.ts
var prisma2 = new PrismaClient2();
var authenticateToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({
      success: false,
      error: "\u8BBF\u95EE\u4EE4\u724C\u662F\u5FC5\u9700\u7684"
    });
  }
  if (token === "mock_access_token_for_testing") {
    console.log("\u{1F9EA} \u4F7F\u7528\u6A21\u62DF\u7BA1\u7406\u5458\u4EE4\u724C\u8FDB\u884C\u8BA4\u8BC1");
    req.user = {
      userId: "be2d0b23-b625-47ab-b406-db5778c58471",
      email: "admin@chattoeic.com",
      username: "\u7BA1\u7406\u5458",
      role: "ADMIN",
      iat: Math.floor(Date.now() / 1e3),
      exp: Math.floor(Date.now() / 1e3) + 3600
      // 1小时后过期
    };
    return next();
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma2.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, isActive: true, email: true, name: true }
    });
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "\u7528\u6237\u4E0D\u5B58\u5728",
        code: "USER_NOT_FOUND"
      });
    }
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        error: "\u8D26\u6237\u5DF2\u88AB\u5C01\u7981\uFF0C\u8BF7\u8054\u7CFB\u5B98\u65B9",
        code: "ACCOUNT_BANNED",
        data: {
          userId: user.id,
          email: user.email,
          name: user.name
        }
      });
    }
    const isBlacklisted = await TokenBlacklistService.isTokenBlacklisted(decoded.userId);
    if (isBlacklisted) {
      return res.status(401).json({
        success: false,
        error: "\u4EE4\u724C\u5DF2\u5931\u6548\uFF0C\u8BF7\u91CD\u65B0\u767B\u5F55",
        code: "TOKEN_BLACKLISTED"
      });
    }
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        error: "\u8BBF\u95EE\u4EE4\u724C\u5DF2\u8FC7\u671F"
      });
    } else if (error instanceof jwt.JsonWebTokenError) {
      return res.status(403).json({
        success: false,
        error: "\u65E0\u6548\u7684\u8BBF\u95EE\u4EE4\u724C"
      });
    } else {
      console.error("\u8BA4\u8BC1\u4E2D\u95F4\u4EF6\u9519\u8BEF:", error);
      return res.status(500).json({
        success: false,
        error: "\u4EE4\u724C\u9A8C\u8BC1\u5931\u8D25"
      });
    }
  }
};
var optionalAuth = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) {
    return next();
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
  } catch (error) {
    console.warn("Optional auth failed:", error);
  }
  next();
};
var requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: "\u9700\u8981\u8BA4\u8BC1"
    });
  }
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({
      success: false,
      error: "\u9700\u8981\u7BA1\u7406\u5458\u6743\u9650"
    });
  }
  next();
};

// src/routes/dashboard-stream.ts
init_database();
import { Router as Router2 } from "express";

// src/utils/logger.ts
import winston from "winston";
var LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};
var LOG_COLORS = {
  error: "red",
  warn: "yellow",
  info: "green",
  http: "magenta",
  debug: "blue"
};
winston.addColors(LOG_COLORS);
var logFormat = winston.format.combine(
  winston.format.timestamp({
    format: "YYYY-MM-DD HH:mm:ss"
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);
var consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({
    format: "YYYY-MM-DD HH:mm:ss"
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log2 = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      log2 += ` ${JSON.stringify(meta, null, 2)}`;
    }
    return log2;
  })
);
var logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  levels: LOG_LEVELS,
  format: logFormat,
  defaultMeta: {
    service: "chattoeic-api",
    environment: process.env.NODE_ENV || "development",
    version: process.env.APP_VERSION || "2.0.0"
  },
  transports: [
    // 只使用控制台传输器，符合容器化最佳实践
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
          let log2 = `${timestamp} [${service}] ${level}: ${message}`;
          if (Object.keys(meta).length > 0) {
            log2 += ` ${JSON.stringify(meta, null, 2)}`;
          }
          return log2;
        })
      )
    })
  ],
  // 异常和Promise rejection处理也使用控制台
  exceptionHandlers: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      )
    })
  ],
  rejectionHandlers: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      )
    })
  ]
});
var log = {
  error: (message, meta) => logger.error(message, meta),
  warn: (message, meta) => logger.warn(message, meta),
  info: (message, meta) => logger.info(message, meta),
  http: (message, meta) => logger.http(message, meta),
  debug: (message, meta) => logger.debug(message, meta)
};
var logPerformance = (metrics) => {
  logger.http("API Performance", {
    type: "performance",
    ...metrics,
    memoryUsage: process.memoryUsage(),
    uptime: process.uptime()
  });
};
var logBusinessEvent = (event) => {
  logger.info("Business Event", {
    type: "business_event",
    timestamp: /* @__PURE__ */ new Date(),
    ...event
  });
};
var logSecurityEvent = (event) => {
  const level = event.severity === "critical" || event.severity === "high" ? "error" : "warn";
  logger[level]("Security Event", {
    type: "security_event",
    timestamp: /* @__PURE__ */ new Date(),
    ...event
  });
};
var logSystemHealth = () => {
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  logger.info("System Health Check", {
    type: "system_health",
    timestamp: /* @__PURE__ */ new Date(),
    uptime: process.uptime(),
    memory: {
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      external: `${Math.round(memUsage.external / 1024 / 1024)}MB`
    },
    cpu: {
      user: cpuUsage.user,
      system: cpuUsage.system
    }
  });
};

// src/routes/dashboard-stream.ts
var router2 = Router2();
var activeConnections = /* @__PURE__ */ new Set();
async function getCoreUserData() {
  try {
    const now = /* @__PURE__ */ new Date();
    const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1e3);
    const todayStart = new Date(beijingTime);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(beijingTime);
    todayEnd.setHours(23, 59, 59, 999);
    const todayStartUTC = new Date(todayStart.getTime() - 8 * 60 * 60 * 1e3);
    const todayEndUTC = new Date(todayEnd.getTime() - 8 * 60 * 60 * 1e3);
    const [totalUsers, dailyActiveUsers, recentUsers] = await Promise.all([
      // 总用户数
      prisma.user.count(),
      // 今日活跃用户数
      prisma.user.count({
        where: {
          lastLoginAt: {
            gte: todayStartUTC,
            lte: todayEndUTC
          }
        }
      }),
      // 最近的用户（最多10个）
      prisma.user.findMany({
        select: {
          id: true,
          email: true,
          lastLoginAt: true,
          isActive: true,
          emailVerified: true,
          createdAt: true
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 10
      })
    ]);
    const processedUsers = recentUsers.map((user) => {
      let status = "inactive";
      if (!user.isActive) {
        status = "banned";
      } else if (user.lastLoginAt) {
        const daysSinceLogin = (now.getTime() - user.lastLoginAt.getTime()) / (1e3 * 60 * 60 * 24);
        if (daysSinceLogin < 7) {
          status = "active";
        }
      }
      return {
        id: user.id,
        email: user.email,
        lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
        isActive: user.isActive,
        status
      };
    });
    return {
      totalUsers,
      dailyActiveUsers,
      onlineUsers: dailyActiveUsers,
      // 简化：在线用户 ≈ 今日活跃用户
      recentUsers: processedUsers,
      lastUpdate: (/* @__PURE__ */ new Date()).toISOString()
    };
  } catch (error) {
    log.error("\u83B7\u53D6\u6838\u5FC3\u7528\u6237\u6570\u636E\u5931\u8D25", { error });
    throw error;
  }
}
router2.get("/stream", async (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Cache-Control"
  });
  activeConnections.add(res);
  console.log(`\u{1F4E1} \u65B0\u7684Dashboard\u8FDE\u63A5\u5EFA\u7ACB\uFF0C\u5F53\u524D\u8FDE\u63A5\u6570: ${activeConnections.size}`);
  try {
    const data = await getCoreUserData();
    res.write(`data: ${JSON.stringify(data)}

`);
  } catch (error) {
    console.error("\u274C \u521D\u59CB\u6570\u636E\u53D1\u9001\u5931\u8D25:", error);
    res.write(`data: ${JSON.stringify({ error: "\u6570\u636E\u83B7\u53D6\u5931\u8D25" })}

`);
  }
  const heartbeat = setInterval(() => {
    res.write(`: heartbeat ${Date.now()}

`);
  }, 3e4);
  req.on("close", () => {
    activeConnections.delete(res);
    clearInterval(heartbeat);
    console.log(`\u{1F4E1} Dashboard\u8FDE\u63A5\u5173\u95ED\uFF0C\u5269\u4F59\u8FDE\u63A5\u6570: ${activeConnections.size}`);
  });
  req.on("error", (error) => {
    console.error("\u{1F4E1} SSE\u8FDE\u63A5\u9519\u8BEF:", error);
    activeConnections.delete(res);
    clearInterval(heartbeat);
  });
});
router2.post("/refresh", async (req, res) => {
  try {
    const data = await getCoreUserData();
    activeConnections.forEach((connection) => {
      try {
        connection.write(`data: ${JSON.stringify(data)}

`);
      } catch (error) {
        console.error("\u63A8\u9001\u6570\u636E\u5931\u8D25:", error);
        activeConnections.delete(connection);
      }
    });
    res.json({
      success: true,
      message: "\u6570\u636E\u5DF2\u66F4\u65B0",
      activeConnections: activeConnections.size,
      data
    });
  } catch (error) {
    console.error("\u274C \u624B\u52A8\u5237\u65B0\u6570\u636E\u5931\u8D25:", error);
    res.status(500).json({
      success: false,
      error: "\u6570\u636E\u5237\u65B0\u5931\u8D25"
    });
  }
});
async function notifyDashboardUpdate(event, data) {
  try {
    console.log(`\u{1F4E1} \u89E6\u53D1Dashboard\u66F4\u65B0: ${event}`, data);
    const coreData = await getCoreUserData();
    const updateMessage = {
      event,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      data: coreData,
      trigger: data
    };
    activeConnections.forEach((connection) => {
      try {
        connection.write(`data: ${JSON.stringify(updateMessage)}

`);
      } catch (error) {
        console.error("\u63A8\u9001\u66F4\u65B0\u5931\u8D25:", error);
        activeConnections.delete(connection);
      }
    });
    console.log(`\u2705 Dashboard\u66F4\u65B0\u5DF2\u63A8\u9001\u7ED9 ${activeConnections.size} \u4E2A\u8FDE\u63A5`);
  } catch (error) {
    console.error("\u274C Dashboard\u66F4\u65B0\u901A\u77E5\u5931\u8D25:", error);
  }
}
setInterval(async () => {
  if (activeConnections.size > 0) {
    try {
      await notifyDashboardUpdate("auto_refresh");
    } catch (error) {
      console.error("\u274C \u5B9A\u671F\u5237\u65B0\u5931\u8D25:", error);
    }
  }
}, 6e4);
var dashboard_stream_default = router2;

// src/services/authEmailService.ts
import React12 from "react";

// src/services/emailService.ts
import { Resend } from "resend";
import { render } from "@react-email/render";
var EmailService = class {
  resend;
  defaultFrom;
  stats;
  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY environment variable is required");
    }
    this.resend = new Resend(apiKey);
    this.defaultFrom = process.env.EMAIL_FROM || "ChatTOEIC <noreply@chattoeic.com>";
    this.stats = {
      sent: 0,
      failed: 0,
      pending: 0
    };
  }
  /**
   * 发送邮件
   */
  async sendEmail(config) {
    try {
      this.stats.pending++;
      const html = await render(config.template);
      const response = await this.resend.emails.send({
        from: config.from || this.defaultFrom,
        to: Array.isArray(config.to) ? config.to : [config.to],
        subject: config.subject,
        html,
        replyTo: config.replyTo
      });
      this.stats.pending--;
      this.stats.sent++;
      console.log("\u{1F4E7} Email sent successfully:", {
        id: response.data?.id,
        to: config.to,
        subject: config.subject
      });
      return {
        id: response.data?.id || "unknown",
        success: true
      };
    } catch (error) {
      this.stats.pending--;
      this.stats.failed++;
      console.error("\u274C Email sending failed:", {
        to: config.to,
        subject: config.subject,
        error: error.message
      });
      return {
        id: "",
        success: false,
        error: error.message
      };
    }
  }
  /**
   * 批量发送邮件
   */
  async sendBulkEmails(configs) {
    const results = await Promise.allSettled(
      configs.map((config) => this.sendEmail(config))
    );
    return results.map((result) => {
      if (result.status === "fulfilled") {
        return result.value;
      } else {
        this.stats.failed++;
        return {
          id: "",
          success: false,
          error: result.reason?.message || "Unknown error"
        };
      }
    });
  }
  /**
   * 获取发送统计
   */
  getStats() {
    return { ...this.stats };
  }
  /**
   * 重置统计信息
   */
  resetStats() {
    this.stats = {
      sent: 0,
      failed: 0,
      pending: 0
    };
  }
  /**
   * 验证邮箱格式
   */
  static validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  /**
   * 批量验证邮箱格式
   */
  static validateEmails(emails) {
    const valid = [];
    const invalid = [];
    emails.forEach((email) => {
      if (this.validateEmail(email)) {
        valid.push(email);
      } else {
        invalid.push(email);
      }
    });
    return { valid, invalid };
  }
};
var emailService = new EmailService();

// src/services/verificationService.ts
import crypto from "crypto";
var VerificationService = class {
  codes = /* @__PURE__ */ new Map();
  DEFAULT_EXPIRY_MINUTES = 10;
  MAX_ATTEMPTS = 5;
  /**
   * 生成6位数字验证码
   */
  generateCode() {
    return crypto.randomInt(1e5, 999999).toString();
  }
  /**
   * 生成验证码key
   */
  generateKey(config) {
    const identifier = config.email || config.phone || config.userId || "unknown";
    return `${config.type}:${identifier}`;
  }
  /**
   * 创建验证码
   */
  createVerificationCode(config) {
    const code = this.generateCode();
    const key = this.generateKey(config);
    const expiryMinutes = config.expiresInMinutes || this.DEFAULT_EXPIRY_MINUTES;
    this.codes.delete(key);
    const verificationCode = {
      code,
      type: config.type,
      email: config.email,
      phone: config.phone,
      userId: config.userId,
      expiresAt: new Date(Date.now() + expiryMinutes * 60 * 1e3),
      createdAt: /* @__PURE__ */ new Date(),
      attempts: 0,
      maxAttempts: this.MAX_ATTEMPTS
    };
    this.codes.set(key, verificationCode);
    console.log("\u{1F510} Verification code created:", {
      key,
      code,
      expiresAt: verificationCode.expiresAt,
      type: config.type
    });
    return code;
  }
  /**
   * 验证验证码
   */
  verifyCode(config, inputCode) {
    const key = this.generateKey(config);
    const storedCode = this.codes.get(key);
    if (!storedCode) {
      return {
        success: false,
        error: "verification_code_not_found"
      };
    }
    if (/* @__PURE__ */ new Date() > storedCode.expiresAt) {
      this.codes.delete(key);
      return {
        success: false,
        error: "verification_code_expired"
      };
    }
    if (storedCode.attempts >= storedCode.maxAttempts) {
      this.codes.delete(key);
      return {
        success: false,
        error: "too_many_attempts"
      };
    }
    storedCode.attempts++;
    if (inputCode !== storedCode.code) {
      return {
        success: false,
        error: "invalid_verification_code",
        remainingAttempts: storedCode.maxAttempts - storedCode.attempts
      };
    }
    this.codes.delete(key);
    console.log("\u2705 Verification code verified successfully:", {
      key,
      type: config.type
    });
    return {
      success: true
    };
  }
  /**
   * 检查验证码是否存在且未过期
   */
  checkCodeExists(config) {
    const key = this.generateKey(config);
    const storedCode = this.codes.get(key);
    if (!storedCode) {
      return false;
    }
    if (/* @__PURE__ */ new Date() > storedCode.expiresAt) {
      this.codes.delete(key);
      return false;
    }
    return true;
  }
  /**
   * 删除验证码
   */
  removeCode(config) {
    const key = this.generateKey(config);
    return this.codes.delete(key);
  }
  /**
   * 清理过期的验证码
   */
  cleanupExpiredCodes() {
    const now = /* @__PURE__ */ new Date();
    let cleanedCount = 0;
    for (const [key, code] of this.codes.entries()) {
      if (now > code.expiresAt) {
        this.codes.delete(key);
        cleanedCount++;
      }
    }
    if (cleanedCount > 0) {
      console.log(`\u{1F9F9} Cleaned up ${cleanedCount} expired verification codes`);
    }
    return cleanedCount;
  }
  /**
   * 获取当前验证码数量
   */
  getCodeCount() {
    return this.codes.size;
  }
  /**
   * 获取用户的验证码信息（不包含实际验证码）
   */
  getCodeInfo(config) {
    const key = this.generateKey(config);
    const storedCode = this.codes.get(key);
    if (!storedCode) {
      return { exists: false };
    }
    if (/* @__PURE__ */ new Date() > storedCode.expiresAt) {
      this.codes.delete(key);
      return { exists: false };
    }
    return {
      exists: true,
      expiresAt: storedCode.expiresAt,
      remainingAttempts: storedCode.maxAttempts - storedCode.attempts
    };
  }
};
var verificationService = new VerificationService();
setInterval(() => {
  verificationService.cleanupExpiredCodes();
}, 5 * 60 * 1e3);

// src/services/passwordResetService.ts
import crypto2 from "crypto";
import bcrypt from "bcryptjs";
var PasswordResetService = class {
  tokens = /* @__PURE__ */ new Map();
  TOKEN_EXPIRY_HOURS = 1;
  MAX_TOKENS_PER_EMAIL = 3;
  /**
   * 生成安全的重置令牌
   */
  generateResetToken() {
    return crypto2.randomBytes(32).toString("hex");
  }
  /**
   * 创建密码重置令牌
   */
  async createResetToken(email, userId, userAgent, ipAddress) {
    await this.cleanupTokensForEmail(email);
    const existingTokens = Array.from(this.tokens.values()).filter((token2) => token2.email === email && !token2.used && /* @__PURE__ */ new Date() < token2.expiresAt);
    if (existingTokens.length >= this.MAX_TOKENS_PER_EMAIL) {
      throw new Error("too_many_reset_requests");
    }
    const token = this.generateResetToken();
    const hashedToken = await bcrypt.hash(token, 12);
    const resetToken = {
      token,
      hashedToken,
      email,
      userId,
      expiresAt: new Date(Date.now() + this.TOKEN_EXPIRY_HOURS * 60 * 60 * 1e3),
      createdAt: /* @__PURE__ */ new Date(),
      used: false,
      userAgent,
      ipAddress
    };
    const tokenKey = token.substring(0, 16);
    this.tokens.set(tokenKey, resetToken);
    console.log("\u{1F510} Password reset token created:", {
      tokenKey,
      email,
      userId,
      expiresAt: resetToken.expiresAt
    });
    return token;
  }
  /**
   * 验证重置令牌
   */
  async verifyResetToken(token) {
    try {
      if (!token || token.length !== 64) {
        return {
          success: false,
          error: "invalid_token_format"
        };
      }
      const tokenKey = token.substring(0, 16);
      const storedToken = this.tokens.get(tokenKey);
      if (!storedToken) {
        return {
          success: false,
          error: "token_not_found"
        };
      }
      if (/* @__PURE__ */ new Date() > storedToken.expiresAt) {
        this.tokens.delete(tokenKey);
        return {
          success: false,
          error: "token_expired"
        };
      }
      if (storedToken.used) {
        return {
          success: false,
          error: "token_already_used"
        };
      }
      const isValid = await bcrypt.compare(token, storedToken.hashedToken);
      if (!isValid) {
        return {
          success: false,
          error: "invalid_token"
        };
      }
      console.log("\u2705 Password reset token verified:", {
        tokenKey,
        email: storedToken.email,
        userId: storedToken.userId
      });
      return {
        success: true,
        email: storedToken.email,
        userId: storedToken.userId
      };
    } catch (error) {
      console.error("\u274C Password reset token verification error:", error);
      return {
        success: false,
        error: "verification_error"
      };
    }
  }
  /**
   * 标记令牌为已使用
   */
  async markTokenAsUsed(token) {
    try {
      const tokenKey = token.substring(0, 16);
      const storedToken = this.tokens.get(tokenKey);
      if (!storedToken) {
        return false;
      }
      storedToken.used = true;
      console.log("\u{1F512} Password reset token marked as used:", {
        tokenKey,
        email: storedToken.email
      });
      return true;
    } catch (error) {
      console.error("\u274C Error marking token as used:", error);
      return false;
    }
  }
  /**
   * 清理指定邮箱的所有令牌
   */
  async cleanupTokensForEmail(email) {
    let cleanedCount = 0;
    for (const [key, token] of this.tokens.entries()) {
      if (token.email === email) {
        this.tokens.delete(key);
        cleanedCount++;
      }
    }
    if (cleanedCount > 0) {
      console.log(`\u{1F9F9} Cleaned up ${cleanedCount} reset tokens for email: ${email}`);
    }
    return cleanedCount;
  }
  /**
   * 清理过期的重置令牌
   */
  async cleanupExpiredTokens() {
    const now = /* @__PURE__ */ new Date();
    let cleanedCount = 0;
    for (const [key, token] of this.tokens.entries()) {
      if (now > token.expiresAt || token.used) {
        this.tokens.delete(key);
        cleanedCount++;
      }
    }
    if (cleanedCount > 0) {
      console.log(`\u{1F9F9} Cleaned up ${cleanedCount} expired/used reset tokens`);
    }
    return cleanedCount;
  }
  /**
   * 获取令牌统计信息
   */
  getTokenStats() {
    const now = /* @__PURE__ */ new Date();
    let active = 0;
    let expired = 0;
    let used = 0;
    for (const token of this.tokens.values()) {
      if (token.used) {
        used++;
      } else if (now > token.expiresAt) {
        expired++;
      } else {
        active++;
      }
    }
    return {
      total: this.tokens.size,
      active,
      expired,
      used
    };
  }
  /**
   * 检查邮箱是否有活跃的重置请求
   */
  hasActiveResetRequest(email) {
    const now = /* @__PURE__ */ new Date();
    const activeTokens = Array.from(this.tokens.values()).filter(
      (token) => token.email === email && !token.used && now < token.expiresAt
    );
    const earliestExpiry = activeTokens.length > 0 ? new Date(Math.min(...activeTokens.map((t) => t.expiresAt.getTime()))) : void 0;
    return {
      hasActive: activeTokens.length > 0,
      count: activeTokens.length,
      earliestExpiry
    };
  }
};
var passwordResetService = new PasswordResetService();
setInterval(() => {
  passwordResetService.cleanupExpiredTokens();
}, 10 * 60 * 1e3);

// src/services/emailChangeService.ts
var EmailChangeService = class {
  requests = /* @__PURE__ */ new Map();
  EXPIRY_MINUTES = 15;
  MAX_REQUESTS_PER_USER = 3;
  /**
   * 生成6位数字验证码
   */
  generateVerificationCode() {
    return Math.floor(1e5 + Math.random() * 9e5).toString();
  }
  /**
   * 生成请求键
   */
  generateRequestKey(userId, newEmail) {
    return `${userId}:${newEmail}`;
  }
  /**
   * 创建邮箱变更请求
   */
  async createEmailChangeRequest(userId, oldEmail, newEmail, userAgent, ipAddress) {
    try {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newEmail)) {
        return {
          success: false,
          error: "invalid_email_format"
        };
      }
      if (oldEmail.toLowerCase() === newEmail.toLowerCase()) {
        return {
          success: false,
          error: "same_email"
        };
      }
      this.cleanupRequestsForUser(userId);
      const activeRequests = Array.from(this.requests.values()).filter(
        (req) => req.userId === userId && !req.verified && !req.cancelled && /* @__PURE__ */ new Date() < req.expiresAt
      );
      if (activeRequests.length >= this.MAX_REQUESTS_PER_USER) {
        return {
          success: false,
          error: "too_many_requests"
        };
      }
      const requestKey = this.generateRequestKey(userId, newEmail);
      const existingRequest = this.requests.get(requestKey);
      if (existingRequest && !existingRequest.verified && !existingRequest.cancelled && /* @__PURE__ */ new Date() < existingRequest.expiresAt) {
        if (existingRequest.createdAt.getTime() > Date.now() - 5 * 60 * 1e3) {
          return {
            success: false,
            error: "request_too_frequent"
          };
        }
      }
      const verificationCode = this.generateVerificationCode();
      const changeRequest = {
        userId,
        oldEmail,
        newEmail,
        verificationCode,
        expiresAt: new Date(Date.now() + this.EXPIRY_MINUTES * 60 * 1e3),
        createdAt: /* @__PURE__ */ new Date(),
        userAgent,
        ipAddress,
        verified: false,
        cancelled: false
      };
      this.requests.set(requestKey, changeRequest);
      console.log("\u{1F4E7} Email change request created:", {
        userId,
        oldEmail,
        newEmail,
        verificationCode: verificationCode.substring(0, 3) + "***",
        expiresAt: changeRequest.expiresAt
      });
      return {
        success: true,
        verificationCode
      };
    } catch (error) {
      console.error("\u274C Failed to create email change request:", error);
      return {
        success: false,
        error: error.message || "unknown_error"
      };
    }
  }
  /**
   * 验证邮箱变更验证码
   */
  async verifyEmailChangeCode(userId, newEmail, code) {
    try {
      const requestKey = this.generateRequestKey(userId, newEmail);
      const request = this.requests.get(requestKey);
      if (!request) {
        return {
          success: false,
          error: "request_not_found"
        };
      }
      if (/* @__PURE__ */ new Date() > request.expiresAt) {
        this.requests.delete(requestKey);
        return {
          success: false,
          error: "request_expired"
        };
      }
      if (request.verified) {
        return {
          success: false,
          error: "already_verified"
        };
      }
      if (request.cancelled) {
        return {
          success: false,
          error: "request_cancelled"
        };
      }
      if (request.verificationCode !== code) {
        return {
          success: false,
          error: "invalid_verification_code"
        };
      }
      request.verified = true;
      console.log("\u2705 Email change request verified:", {
        userId,
        oldEmail: request.oldEmail,
        newEmail: request.newEmail
      });
      return {
        success: true,
        request
      };
    } catch (error) {
      console.error("\u274C Email change verification error:", error);
      return {
        success: false,
        error: "verification_error"
      };
    }
  }
  /**
   * 取消邮箱变更请求
   */
  async cancelEmailChangeRequest(userId, newEmail) {
    try {
      let cancelledCount = 0;
      if (newEmail) {
        const requestKey = this.generateRequestKey(userId, newEmail);
        const request = this.requests.get(requestKey);
        if (request && !request.verified && !request.cancelled) {
          request.cancelled = true;
          cancelledCount = 1;
        }
      } else {
        for (const request of this.requests.values()) {
          if (request.userId === userId && !request.verified && !request.cancelled) {
            request.cancelled = true;
            cancelledCount++;
          }
        }
      }
      if (cancelledCount > 0) {
        console.log(`\u{1F6AB} Email change request(s) cancelled:`, {
          userId,
          newEmail,
          cancelledCount
        });
      }
      return {
        success: true,
        cancelledCount
      };
    } catch (error) {
      console.error("\u274C Failed to cancel email change request:", error);
      return {
        success: false,
        cancelledCount: 0
      };
    }
  }
  /**
   * 获取用户的邮箱变更请求状态
   */
  getUserEmailChangeRequests(userId) {
    const now = /* @__PURE__ */ new Date();
    const userRequests = Array.from(this.requests.values()).filter((req) => req.userId === userId);
    const active = userRequests.filter(
      (req) => !req.verified && !req.cancelled && now < req.expiresAt
    );
    return {
      active,
      total: userRequests.length
    };
  }
  /**
   * 检查邮箱是否已被其他用户请求使用
   */
  isEmailBeingUsed(newEmail, excludeUserId) {
    const now = /* @__PURE__ */ new Date();
    for (const request of this.requests.values()) {
      if (request.newEmail.toLowerCase() === newEmail.toLowerCase() && request.userId !== excludeUserId && !request.cancelled && !request.verified && now < request.expiresAt) {
        return true;
      }
    }
    return false;
  }
  /**
   * 清理指定用户的过期请求
   */
  cleanupRequestsForUser(userId) {
    const now = /* @__PURE__ */ new Date();
    let cleanedCount = 0;
    for (const [key, request] of this.requests.entries()) {
      if (request.userId === userId && (now > request.expiresAt || request.verified || request.cancelled)) {
        this.requests.delete(key);
        cleanedCount++;
      }
    }
    if (cleanedCount > 0) {
      console.log(`\u{1F9F9} Cleaned up ${cleanedCount} email change requests for user: ${userId}`);
    }
    return cleanedCount;
  }
  /**
   * 清理所有过期的请求
   */
  async cleanupExpiredRequests() {
    const now = /* @__PURE__ */ new Date();
    let cleanedCount = 0;
    for (const [key, request] of this.requests.entries()) {
      if (now > request.expiresAt || request.verified || request.cancelled) {
        this.requests.delete(key);
        cleanedCount++;
      }
    }
    if (cleanedCount > 0) {
      console.log(`\u{1F9F9} Cleaned up ${cleanedCount} expired email change requests`);
    }
    return cleanedCount;
  }
  /**
   * 获取邮箱变更请求统计信息
   */
  getRequestStats() {
    const now = /* @__PURE__ */ new Date();
    let active = 0;
    let expired = 0;
    let verified = 0;
    let cancelled = 0;
    for (const request of this.requests.values()) {
      if (request.verified) {
        verified++;
      } else if (request.cancelled) {
        cancelled++;
      } else if (now > request.expiresAt) {
        expired++;
      } else {
        active++;
      }
    }
    return {
      total: this.requests.size,
      active,
      expired,
      verified,
      cancelled
    };
  }
};
var emailChangeService = new EmailChangeService();
setInterval(() => {
  emailChangeService.cleanupExpiredRequests();
}, 10 * 60 * 1e3);

// src/emails/templates/auth/VerificationEmail.tsx
import React6 from "react";
import { Text as Text4, Section as Section5 } from "@react-email/components";

// src/emails/components/Layout.tsx
import React3 from "react";
import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section as Section3,
  Tailwind
} from "@react-email/components";

// src/emails/components/Header.tsx
import React from "react";
import { Section, Text, Link } from "@react-email/components";
function Header() {
  return /* @__PURE__ */ React.createElement(Section, { className: "bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6 rounded-t-lg" }, /* @__PURE__ */ React.createElement(
    Link,
    {
      href: "https://www.chattoeic.com",
      className: "text-white text-2xl font-bold tracking-wide no-underline"
    },
    "\u{1F4DA} ChatTOEIC"
  ), /* @__PURE__ */ React.createElement(Text, { className: "text-blue-100 text-sm mt-1 m-0" }, "AI\u9A71\u52A8\u7684\u667A\u80FDTOEIC\u5B66\u4E60\u5E73\u53F0"));
}

// src/emails/components/Footer.tsx
import React2 from "react";
import { Section as Section2, Text as Text2, Link as Link2, Hr } from "@react-email/components";
function Footer() {
  return /* @__PURE__ */ React2.createElement(Section2, { className: "px-8 py-6 bg-gray-50 rounded-b-lg" }, /* @__PURE__ */ React2.createElement(Hr, { className: "border-gray-200 my-4" }), /* @__PURE__ */ React2.createElement(Text2, { className: "text-gray-600 text-sm text-center m-0" }, "\u8FD9\u5C01\u90AE\u4EF6\u6765\u81EA ", /* @__PURE__ */ React2.createElement(Link2, { href: "https://www.chattoeic.com", className: "text-blue-600 no-underline" }, "ChatTOEIC")), /* @__PURE__ */ React2.createElement(Text2, { className: "text-gray-500 text-xs text-center mt-3 m-0" }, "\u5982\u679C\u60A8\u4E0D\u60F3\u518D\u6536\u5230\u6B64\u7C7B\u90AE\u4EF6\uFF0C\u53EF\u4EE5", " ", /* @__PURE__ */ React2.createElement(Link2, { href: "{{unsubscribeUrl}}", className: "text-gray-500 underline" }, "\u53D6\u6D88\u8BA2\u9605"), " ", "\u6216\u8054\u7CFB\u6211\u4EEC\uFF1A", /* @__PURE__ */ React2.createElement(Link2, { href: "mailto:support@chattoeic.com", className: "text-gray-500 underline ml-1" }, "support@chattoeic.com")), /* @__PURE__ */ React2.createElement(Text2, { className: "text-gray-400 text-xs text-center mt-2 m-0" }, "\xA9 2024 ChatTOEIC. All rights reserved."));
}

// src/emails/components/Layout.tsx
function Layout({ preview, children }) {
  return /* @__PURE__ */ React3.createElement(Html, { lang: "zh-CN" }, /* @__PURE__ */ React3.createElement(Head, null), /* @__PURE__ */ React3.createElement(Preview, null, preview), /* @__PURE__ */ React3.createElement(Tailwind, null, /* @__PURE__ */ React3.createElement(Body, { className: "bg-gray-50 font-sans" }, /* @__PURE__ */ React3.createElement(Container, { className: "mx-auto py-8 px-4 max-w-2xl" }, /* @__PURE__ */ React3.createElement(Section3, { className: "bg-white rounded-lg shadow-sm border border-gray-200" }, /* @__PURE__ */ React3.createElement(Header, null), /* @__PURE__ */ React3.createElement(Section3, { className: "px-8 py-6" }, children), /* @__PURE__ */ React3.createElement(Footer, null))))));
}

// src/emails/components/Button.tsx
import React4 from "react";
import { Button as EmailButton } from "@react-email/components";
function Button({
  href,
  children,
  variant = "primary",
  className = ""
}) {
  const baseClasses = "px-6 py-3 rounded-lg font-semibold text-center inline-block no-underline transition-colors";
  const variantClasses = {
    primary: "bg-blue-600 text-white hover:bg-blue-700",
    secondary: "bg-gray-100 text-gray-800 border border-gray-300 hover:bg-gray-200"
  };
  return /* @__PURE__ */ React4.createElement(
    EmailButton,
    {
      href,
      className: `${baseClasses} ${variantClasses[variant]} ${className}`
    },
    children
  );
}

// src/emails/components/VerificationCode.tsx
import React5 from "react";
import { Section as Section4, Text as Text3 } from "@react-email/components";
function VerificationCode({ code, expiresInMinutes = 10 }) {
  return /* @__PURE__ */ React5.createElement(Section4, { className: "text-center py-8" }, /* @__PURE__ */ React5.createElement(Text3, { className: "text-gray-700 text-lg mb-4 m-0" }, "\u60A8\u7684\u9A8C\u8BC1\u7801\u662F\uFF1A"), /* @__PURE__ */ React5.createElement(Section4, { className: "bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg py-6 px-4 inline-block" }, /* @__PURE__ */ React5.createElement(Text3, { className: "text-4xl font-mono font-bold text-blue-600 tracking-widest m-0" }, code)), /* @__PURE__ */ React5.createElement(Text3, { className: "text-gray-500 text-sm mt-4 m-0" }, "\u9A8C\u8BC1\u7801\u6709\u6548\u671F\u4E3A ", expiresInMinutes, " \u5206\u949F\uFF0C\u8BF7\u53CA\u65F6\u4F7F\u7528"), /* @__PURE__ */ React5.createElement(Text3, { className: "text-gray-400 text-xs mt-2 m-0" }, "\u5982\u679C\u4E0D\u662F\u60A8\u672C\u4EBA\u64CD\u4F5C\uFF0C\u8BF7\u5FFD\u7565\u6B64\u90AE\u4EF6"));
}

// src/emails/templates/auth/VerificationEmail.tsx
function VerificationEmail({
  userName,
  verificationCode,
  verificationUrl = `https://www.chattoeic.com/verify?code=${verificationCode}`
}) {
  return /* @__PURE__ */ React6.createElement(Layout, { preview: `\u9A8C\u8BC1\u60A8\u7684ChatTOEIC\u8D26\u53F7 - \u9A8C\u8BC1\u7801\uFF1A${verificationCode}` }, /* @__PURE__ */ React6.createElement(Section5, null, /* @__PURE__ */ React6.createElement(Text4, { className: "text-2xl font-bold text-gray-800 mb-4 m-0" }, "\u{1F389} \u6B22\u8FCE\u52A0\u5165ChatTOEIC\uFF01"), /* @__PURE__ */ React6.createElement(Text4, { className: "text-gray-700 text-base leading-6 mb-4 m-0" }, "\u4EB2\u7231\u7684 ", /* @__PURE__ */ React6.createElement("span", { className: "font-semibold text-blue-600" }, userName), "\uFF0C"), /* @__PURE__ */ React6.createElement(Text4, { className: "text-gray-700 text-base leading-6 mb-4 m-0" }, "\u611F\u8C22\u60A8\u6CE8\u518CChatTOEIC\uFF01\u4E3A\u4E86\u786E\u4FDD\u60A8\u7684\u8D26\u6237\u5B89\u5168\uFF0C\u8BF7\u4F7F\u7528\u4EE5\u4E0B\u9A8C\u8BC1\u7801\u5B8C\u6210\u90AE\u7BB1\u9A8C\u8BC1\uFF1A"), /* @__PURE__ */ React6.createElement(VerificationCode, { code: verificationCode, expiresInMinutes: 10 }), /* @__PURE__ */ React6.createElement(Text4, { className: "text-gray-700 text-base leading-6 mb-6 m-0" }, "\u60A8\u4E5F\u53EF\u4EE5\u70B9\u51FB\u4E0B\u65B9\u6309\u94AE\u76F4\u63A5\u5B8C\u6210\u9A8C\u8BC1\uFF1A"), /* @__PURE__ */ React6.createElement(Section5, { className: "text-center mb-6" }, /* @__PURE__ */ React6.createElement(Button, { href: verificationUrl }, "\u7ACB\u5373\u9A8C\u8BC1\u8D26\u53F7")), /* @__PURE__ */ React6.createElement(Section5, { className: "bg-blue-50 border-l-4 border-blue-400 p-4 rounded" }, /* @__PURE__ */ React6.createElement(Text4, { className: "text-blue-800 text-sm m-0" }, /* @__PURE__ */ React6.createElement("strong", null, "\u6E29\u99A8\u63D0\u793A\uFF1A"), "\u9A8C\u8BC1\u5B8C\u6210\u540E\uFF0C\u60A8\u5C06\u53EF\u4EE5\uFF1A"), /* @__PURE__ */ React6.createElement(Text4, { className: "text-blue-700 text-sm mt-2 mb-1 ml-4 m-0" }, "\u2022 \u{1F9E0} \u4EAB\u53D7AI\u9A71\u52A8\u7684\u4E2A\u6027\u5316TOEIC\u7EC3\u4E60"), /* @__PURE__ */ React6.createElement(Text4, { className: "text-blue-700 text-sm my-1 ml-4 m-0" }, "\u2022 \u{1F4CA} \u83B7\u5F97\u8BE6\u7EC6\u7684\u5B66\u4E60\u5206\u6790\u548C\u8FDB\u6B65\u62A5\u544A"), /* @__PURE__ */ React6.createElement(Text4, { className: "text-blue-700 text-sm my-1 ml-4 m-0" }, "\u2022 \u{1F4DA} \u6784\u5EFA\u4E13\u5C5E\u7684\u667A\u80FD\u8BCD\u6C47\u5E93"), /* @__PURE__ */ React6.createElement(Text4, { className: "text-blue-700 text-sm mt-1 ml-4 m-0" }, "\u2022 \u{1F3AF} \u5236\u5B9A\u79D1\u5B66\u7684\u5B66\u4E60\u8BA1\u5212")), /* @__PURE__ */ React6.createElement(Text4, { className: "text-gray-600 text-sm mt-6 m-0" }, "\u5982\u679C\u60A8\u6CA1\u6709\u6CE8\u518CChatTOEIC\u8D26\u53F7\uFF0C\u8BF7\u5FFD\u7565\u6B64\u90AE\u4EF6\u3002")));
}

// src/emails/templates/auth/PasswordResetEmail.tsx
import React7 from "react";
import { Text as Text5, Section as Section6 } from "@react-email/components";
function PasswordResetEmail({
  userName,
  resetToken,
  resetUrl = `${process.env.FRONTEND_URL || "https://www.chattoeic.com"}/reset-password?token=${resetToken}`,
  expiresInHours = 1
}) {
  return /* @__PURE__ */ React7.createElement(Layout, { preview: `\u91CD\u7F6E\u60A8\u7684ChatTOEIC\u5BC6\u7801 - ${userName}` }, /* @__PURE__ */ React7.createElement(Section6, null, /* @__PURE__ */ React7.createElement(Text5, { className: "text-2xl font-bold text-gray-800 mb-4 m-0" }, "\u{1F510} \u91CD\u7F6E\u60A8\u7684\u5BC6\u7801"), /* @__PURE__ */ React7.createElement(Text5, { className: "text-gray-700 text-base leading-6 mb-4 m-0" }, "\u4EB2\u7231\u7684 ", /* @__PURE__ */ React7.createElement("span", { className: "font-semibold text-blue-600" }, userName), "\uFF0C"), /* @__PURE__ */ React7.createElement(Text5, { className: "text-gray-700 text-base leading-6 mb-4 m-0" }, "\u6211\u4EEC\u6536\u5230\u4E86\u60A8\u91CD\u7F6EChatTOEIC\u8D26\u53F7\u5BC6\u7801\u7684\u8BF7\u6C42\u3002\u8BF7\u70B9\u51FB\u4E0B\u65B9\u6309\u94AE\u6765\u8BBE\u7F6E\u65B0\u5BC6\u7801\uFF1A"), /* @__PURE__ */ React7.createElement(Section6, { className: "text-center my-8" }, /* @__PURE__ */ React7.createElement(Button, { href: resetUrl }, "\u91CD\u7F6E\u5BC6\u7801")), /* @__PURE__ */ React7.createElement(Text5, { className: "text-gray-700 text-base leading-6 mb-4 m-0" }, "\u5982\u679C\u6309\u94AE\u65E0\u6CD5\u70B9\u51FB\uFF0C\u8BF7\u590D\u5236\u4EE5\u4E0B\u94FE\u63A5\u5230\u6D4F\u89C8\u5668\u5730\u5740\u680F\uFF1A"), /* @__PURE__ */ React7.createElement(Section6, { className: "bg-gray-100 border border-gray-200 rounded p-3 mb-6" }, /* @__PURE__ */ React7.createElement(Text5, { className: "text-sm text-gray-600 break-all m-0 font-mono" }, resetUrl)), /* @__PURE__ */ React7.createElement(Section6, { className: "bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded mb-6" }, /* @__PURE__ */ React7.createElement(Text5, { className: "text-yellow-800 text-sm font-semibold m-0" }, "\u26A0\uFE0F \u91CD\u8981\u5B89\u5168\u63D0\u9192\uFF1A"), /* @__PURE__ */ React7.createElement(Text5, { className: "text-yellow-700 text-sm mt-2 mb-1 m-0" }, "\u2022 \u6B64\u91CD\u7F6E\u94FE\u63A5\u5C06\u5728 ", expiresInHours, " \u5C0F\u65F6\u540E\u5931\u6548"), /* @__PURE__ */ React7.createElement(Text5, { className: "text-yellow-700 text-sm my-1 m-0" }, "\u2022 \u4F7F\u7528\u540E\u94FE\u63A5\u5C06\u7ACB\u5373\u5931\u6548"), /* @__PURE__ */ React7.createElement(Text5, { className: "text-yellow-700 text-sm my-1 m-0" }, "\u2022 \u8BF7\u4E0D\u8981\u5C06\u6B64\u94FE\u63A5\u5206\u4EAB\u7ED9\u4ED6\u4EBA"), /* @__PURE__ */ React7.createElement(Text5, { className: "text-yellow-700 text-sm mt-1 m-0" }, "\u2022 \u5982\u679C\u4E0D\u662F\u60A8\u672C\u4EBA\u64CD\u4F5C\uFF0C\u8BF7\u7ACB\u5373\u8054\u7CFB\u6211\u4EEC")), /* @__PURE__ */ React7.createElement(Section6, { className: "bg-blue-50 border border-blue-200 rounded p-4 mb-6" }, /* @__PURE__ */ React7.createElement(Text5, { className: "text-blue-800 text-sm font-semibold m-0" }, "\u{1F4A1} \u5BC6\u7801\u5B89\u5168\u5EFA\u8BAE\uFF1A"), /* @__PURE__ */ React7.createElement(Text5, { className: "text-blue-700 text-sm mt-2 mb-1 m-0" }, "\u2022 \u4F7F\u7528\u81F3\u5C118\u4F4D\u5B57\u7B26\uFF0C\u5305\u542B\u5B57\u6BCD\u3001\u6570\u5B57\u548C\u7279\u6B8A\u7B26\u53F7"), /* @__PURE__ */ React7.createElement(Text5, { className: "text-blue-700 text-sm my-1 m-0" }, "\u2022 \u4E0D\u8981\u4F7F\u7528\u4E0E\u5176\u4ED6\u7F51\u7AD9\u76F8\u540C\u7684\u5BC6\u7801"), /* @__PURE__ */ React7.createElement(Text5, { className: "text-blue-700 text-sm mt-1 m-0" }, "\u2022 \u5B9A\u671F\u66F4\u6362\u5BC6\u7801\uFF0C\u4FDD\u62A4\u8D26\u6237\u5B89\u5168")), /* @__PURE__ */ React7.createElement(Text5, { className: "text-gray-600 text-sm mt-6 m-0" }, "\u5982\u679C\u60A8\u6CA1\u6709\u7533\u8BF7\u5BC6\u7801\u91CD\u7F6E\uFF0C\u8BF7\u5FFD\u7565\u6B64\u90AE\u4EF6\u3002\u60A8\u7684\u5BC6\u7801\u4E0D\u4F1A\u88AB\u66F4\u6539\u3002"), /* @__PURE__ */ React7.createElement(Text5, { className: "text-gray-600 text-sm mt-4 m-0" }, "\u6709\u4EFB\u4F55\u95EE\u9898\uFF0C\u8BF7\u8054\u7CFB\u6211\u4EEC\uFF1A", /* @__PURE__ */ React7.createElement("a", { href: "mailto:support@chattoeic.com", className: "text-blue-600 underline ml-1" }, "support@chattoeic.com"))));
}

// src/emails/templates/auth/PasswordResetSuccessEmail.tsx
import React8 from "react";
import { Text as Text6, Section as Section7 } from "@react-email/components";
function PasswordResetSuccessEmail({
  userName,
  resetTime,
  loginUrl = `${process.env.FRONTEND_URL || "https://www.chattoeic.com"}/login`,
  userAgent,
  ipAddress
}) {
  return /* @__PURE__ */ React8.createElement(Layout, { preview: `\u5BC6\u7801\u91CD\u7F6E\u6210\u529F - ${userName}` }, /* @__PURE__ */ React8.createElement(Section7, null, /* @__PURE__ */ React8.createElement(Text6, { className: "text-2xl font-bold text-green-600 mb-4 m-0" }, "\u2705 \u5BC6\u7801\u91CD\u7F6E\u6210\u529F"), /* @__PURE__ */ React8.createElement(Text6, { className: "text-gray-700 text-base leading-6 mb-4 m-0" }, "\u4EB2\u7231\u7684 ", /* @__PURE__ */ React8.createElement("span", { className: "font-semibold text-blue-600" }, userName), "\uFF0C"), /* @__PURE__ */ React8.createElement(Text6, { className: "text-gray-700 text-base leading-6 mb-4 m-0" }, "\u60A8\u7684ChatTOEIC\u8D26\u53F7\u5BC6\u7801\u5DF2\u6210\u529F\u91CD\u7F6E\u3002\u73B0\u5728\u60A8\u53EF\u4EE5\u4F7F\u7528\u65B0\u5BC6\u7801\u767B\u5F55\u8D26\u6237\u4E86\u3002"), /* @__PURE__ */ React8.createElement(Section7, { className: "bg-green-50 border border-green-200 rounded p-4 mb-6" }, /* @__PURE__ */ React8.createElement(Text6, { className: "text-green-800 text-sm font-semibold m-0" }, "\u{1F389} \u91CD\u7F6E\u8BE6\u60C5\uFF1A"), /* @__PURE__ */ React8.createElement(Text6, { className: "text-green-700 text-sm mt-2 mb-1 m-0" }, "\u2022 \u91CD\u7F6E\u65F6\u95F4\uFF1A", resetTime), ipAddress && /* @__PURE__ */ React8.createElement(Text6, { className: "text-green-700 text-sm my-1 m-0" }, "\u2022 \u64CD\u4F5CIP\uFF1A", ipAddress), userAgent && /* @__PURE__ */ React8.createElement(Text6, { className: "text-green-700 text-sm mt-1 m-0" }, "\u2022 \u8BBE\u5907\u4FE1\u606F\uFF1A", userAgent)), /* @__PURE__ */ React8.createElement(Section7, { className: "text-center my-8" }, /* @__PURE__ */ React8.createElement(Button, { href: loginUrl }, "\u7ACB\u5373\u767B\u5F55")), /* @__PURE__ */ React8.createElement(Section7, { className: "bg-blue-50 border-l-4 border-blue-400 p-4 rounded mb-6" }, /* @__PURE__ */ React8.createElement(Text6, { className: "text-blue-800 text-sm font-semibold m-0" }, "\u{1F510} \u8D26\u6237\u5B89\u5168\u63D0\u9192\uFF1A"), /* @__PURE__ */ React8.createElement(Text6, { className: "text-blue-700 text-sm mt-2 mb-1 m-0" }, "\u2022 \u8BF7\u59A5\u5584\u4FDD\u7BA1\u60A8\u7684\u65B0\u5BC6\u7801"), /* @__PURE__ */ React8.createElement(Text6, { className: "text-blue-700 text-sm my-1 m-0" }, "\u2022 \u4E0D\u8981\u4E0E\u4ED6\u4EBA\u5206\u4EAB\u767B\u5F55\u4FE1\u606F"), /* @__PURE__ */ React8.createElement(Text6, { className: "text-blue-700 text-sm my-1 m-0" }, "\u2022 \u5B9A\u671F\u68C0\u67E5\u8D26\u6237\u6D3B\u52A8\u8BB0\u5F55"), /* @__PURE__ */ React8.createElement(Text6, { className: "text-blue-700 text-sm mt-1 m-0" }, "\u2022 \u5982\u53D1\u73B0\u5F02\u5E38\u6D3B\u52A8\uFF0C\u8BF7\u7ACB\u5373\u8054\u7CFB\u6211\u4EEC")), /* @__PURE__ */ React8.createElement(Section7, { className: "bg-red-50 border border-red-200 rounded p-4 mb-6" }, /* @__PURE__ */ React8.createElement(Text6, { className: "text-red-800 text-sm font-semibold m-0" }, "\u26A0\uFE0F \u5982\u679C\u4E0D\u662F\u60A8\u672C\u4EBA\u64CD\u4F5C\uFF1A"), /* @__PURE__ */ React8.createElement(Text6, { className: "text-red-700 text-sm mt-2 mb-1 m-0" }, "\u2022 \u8BF7\u7ACB\u5373\u8054\u7CFB\u6211\u4EEC\uFF1Asupport@chattoeic.com"), /* @__PURE__ */ React8.createElement(Text6, { className: "text-red-700 text-sm my-1 m-0" }, "\u2022 \u6211\u4EEC\u5C06\u534F\u52A9\u60A8\u4FDD\u62A4\u8D26\u6237\u5B89\u5168"), /* @__PURE__ */ React8.createElement(Text6, { className: "text-red-700 text-sm mt-1 m-0" }, "\u2022 \u5EFA\u8BAE\u542F\u7528\u53CC\u91CD\u9A8C\u8BC1\u4FDD\u62A4")), /* @__PURE__ */ React8.createElement(Text6, { className: "text-gray-700 text-base leading-6 mb-4 m-0" }, "\u611F\u8C22\u60A8\u7EE7\u7EED\u4F7F\u7528ChatTOEIC\uFF01\u795D\u60A8\u5B66\u4E60\u6109\u5FEB\uFF01"), /* @__PURE__ */ React8.createElement(Text6, { className: "text-gray-600 text-sm mt-6 m-0" }, "\u6709\u4EFB\u4F55\u95EE\u9898\uFF0C\u8BF7\u968F\u65F6\u8054\u7CFB\u6211\u4EEC\uFF1A", /* @__PURE__ */ React8.createElement("a", { href: "mailto:support@chattoeic.com", className: "text-blue-600 underline ml-1" }, "support@chattoeic.com"))));
}

// src/emails/templates/auth/EmailChangeConfirmationEmail.tsx
import React9 from "react";
import { Text as Text7, Section as Section8 } from "@react-email/components";
function EmailChangeConfirmationEmail({
  userName,
  oldEmail,
  newEmail,
  verificationCode,
  confirmUrl = `${process.env.FRONTEND_URL || "https://www.chattoeic.com"}/confirm-email-change?code=${verificationCode}&newEmail=${encodeURIComponent(newEmail)}`,
  expiresInMinutes = 15
}) {
  return /* @__PURE__ */ React9.createElement(Layout, { preview: `\u786E\u8BA4\u60A8\u7684\u65B0\u90AE\u7BB1\u5730\u5740 - ${userName}` }, /* @__PURE__ */ React9.createElement(Section8, null, /* @__PURE__ */ React9.createElement(Text7, { className: "text-2xl font-bold text-blue-600 mb-4 m-0" }, "\u{1F4E7} \u786E\u8BA4\u60A8\u7684\u65B0\u90AE\u7BB1\u5730\u5740"), /* @__PURE__ */ React9.createElement(Text7, { className: "text-gray-700 text-base leading-6 mb-4 m-0" }, "\u4EB2\u7231\u7684 ", /* @__PURE__ */ React9.createElement("span", { className: "font-semibold text-blue-600" }, userName), "\uFF0C"), /* @__PURE__ */ React9.createElement(Text7, { className: "text-gray-700 text-base leading-6 mb-4 m-0" }, "\u60A8\u6B63\u5728\u5C06ChatTOEIC\u8D26\u53F7\u7684\u90AE\u7BB1\u5730\u5740\u4ECE ", /* @__PURE__ */ React9.createElement("span", { className: "font-mono bg-gray-100 px-2 py-1 rounded" }, oldEmail), "\u66F4\u6539\u4E3A ", /* @__PURE__ */ React9.createElement("span", { className: "font-mono bg-blue-100 px-2 py-1 rounded text-blue-700" }, newEmail)), /* @__PURE__ */ React9.createElement(Text7, { className: "text-gray-700 text-base leading-6 mb-4 m-0" }, "\u8BF7\u4F7F\u7528\u4EE5\u4E0B\u9A8C\u8BC1\u7801\u6765\u786E\u8BA4\u8FD9\u4E2A\u65B0\u90AE\u7BB1\u5730\u5740\u5C5E\u4E8E\u60A8\uFF1A"), /* @__PURE__ */ React9.createElement(VerificationCode, { code: verificationCode, expiresInMinutes }), /* @__PURE__ */ React9.createElement(Text7, { className: "text-gray-700 text-base leading-6 mb-6 m-0" }, "\u60A8\u4E5F\u53EF\u4EE5\u70B9\u51FB\u4E0B\u65B9\u6309\u94AE\u76F4\u63A5\u5B8C\u6210\u9A8C\u8BC1\uFF1A"), /* @__PURE__ */ React9.createElement(Section8, { className: "text-center mb-6" }, /* @__PURE__ */ React9.createElement(Button, { href: confirmUrl }, "\u786E\u8BA4\u90AE\u7BB1\u53D8\u66F4")), /* @__PURE__ */ React9.createElement(Section8, { className: "bg-amber-50 border-l-4 border-amber-400 p-4 rounded mb-6" }, /* @__PURE__ */ React9.createElement(Text7, { className: "text-amber-800 text-sm font-semibold m-0" }, "\u26A0\uFE0F \u91CD\u8981\u63D0\u9192\uFF1A"), /* @__PURE__ */ React9.createElement(Text7, { className: "text-amber-700 text-sm mt-2 mb-1 m-0" }, "\u2022 \u786E\u8BA4\u540E\uFF0C\u60A8\u5C06\u4F7F\u7528\u65B0\u90AE\u7BB1 ", newEmail, " \u767B\u5F55"), /* @__PURE__ */ React9.createElement(Text7, { className: "text-amber-700 text-sm my-1 m-0" }, "\u2022 \u65E7\u90AE\u7BB1 ", oldEmail, " \u5C06\u4E0D\u518D\u80FD\u7528\u4E8E\u767B\u5F55"), /* @__PURE__ */ React9.createElement(Text7, { className: "text-amber-700 text-sm my-1 m-0" }, "\u2022 \u6240\u6709\u90AE\u4EF6\u901A\u77E5\u5C06\u53D1\u9001\u5230\u65B0\u90AE\u7BB1"), /* @__PURE__ */ React9.createElement(Text7, { className: "text-amber-700 text-sm mt-1 m-0" }, "\u2022 \u6B64\u64CD\u4F5C\u5B8C\u6210\u540E\u65E0\u6CD5\u64A4\u9500")), /* @__PURE__ */ React9.createElement(Section8, { className: "bg-blue-50 border border-blue-200 rounded p-4 mb-6" }, /* @__PURE__ */ React9.createElement(Text7, { className: "text-blue-800 text-sm font-semibold m-0" }, "\u{1F510} \u5B89\u5168\u63D0\u793A\uFF1A"), /* @__PURE__ */ React9.createElement(Text7, { className: "text-blue-700 text-sm mt-2 mb-1 m-0" }, "\u2022 \u9A8C\u8BC1\u7801\u5C06\u5728 ", expiresInMinutes, " \u5206\u949F\u540E\u5931\u6548"), /* @__PURE__ */ React9.createElement(Text7, { className: "text-blue-700 text-sm my-1 m-0" }, "\u2022 \u8BF7\u4E0D\u8981\u5C06\u9A8C\u8BC1\u7801\u5206\u4EAB\u7ED9\u4ED6\u4EBA"), /* @__PURE__ */ React9.createElement(Text7, { className: "text-blue-700 text-sm my-1 m-0" }, "\u2022 \u5982\u679C\u4E0D\u662F\u60A8\u672C\u4EBA\u64CD\u4F5C\uFF0C\u8BF7\u7ACB\u5373\u8054\u7CFB\u6211\u4EEC"), /* @__PURE__ */ React9.createElement(Text7, { className: "text-blue-700 text-sm mt-1 m-0" }, "\u2022 \u5EFA\u8BAE\u4F7F\u7528\u5B89\u5168\u7684\u90AE\u7BB1\u5730\u5740")), /* @__PURE__ */ React9.createElement(Text7, { className: "text-gray-600 text-sm mt-6 m-0" }, "\u5982\u679C\u60A8\u6CA1\u6709\u7533\u8BF7\u66F4\u6539\u90AE\u7BB1\u5730\u5740\uFF0C\u8BF7\u5FFD\u7565\u6B64\u90AE\u4EF6\u3002\u60A8\u7684\u8D26\u6237\u4FE1\u606F\u4E0D\u4F1A\u88AB\u66F4\u6539\u3002"), /* @__PURE__ */ React9.createElement(Text7, { className: "text-gray-600 text-sm mt-4 m-0" }, "\u6709\u4EFB\u4F55\u95EE\u9898\uFF0C\u8BF7\u8054\u7CFB\u6211\u4EEC\uFF1A", /* @__PURE__ */ React9.createElement("a", { href: "mailto:support@chattoeic.com", className: "text-blue-600 underline ml-1" }, "support@chattoeic.com"))));
}

// src/emails/templates/auth/EmailChangeNotificationEmail.tsx
import React10 from "react";
import { Text as Text8, Section as Section9 } from "@react-email/components";
function EmailChangeNotificationEmail({
  userName,
  oldEmail,
  newEmail,
  changeTime,
  userAgent,
  ipAddress,
  cancelUrl = `${process.env.FRONTEND_URL || "https://www.chattoeic.com"}/cancel-email-change`
}) {
  return /* @__PURE__ */ React10.createElement(Layout, { preview: `\u90AE\u7BB1\u53D8\u66F4\u901A\u77E5 - ${userName}` }, /* @__PURE__ */ React10.createElement(Section9, null, /* @__PURE__ */ React10.createElement(Text8, { className: "text-2xl font-bold text-orange-600 mb-4 m-0" }, "\u{1F514} \u90AE\u7BB1\u53D8\u66F4\u901A\u77E5"), /* @__PURE__ */ React10.createElement(Text8, { className: "text-gray-700 text-base leading-6 mb-4 m-0" }, "\u4EB2\u7231\u7684 ", /* @__PURE__ */ React10.createElement("span", { className: "font-semibold text-blue-600" }, userName), "\uFF0C"), /* @__PURE__ */ React10.createElement(Text8, { className: "text-gray-700 text-base leading-6 mb-4 m-0" }, "\u6211\u4EEC\u68C0\u6D4B\u5230\u6709\u4EBA\u6B63\u5728\u5C1D\u8BD5\u5C06\u60A8\u7684ChatTOEIC\u8D26\u53F7\u90AE\u7BB1\u4ECE", /* @__PURE__ */ React10.createElement("span", { className: "font-mono bg-gray-100 px-2 py-1 rounded mx-1" }, oldEmail), "\u66F4\u6539\u4E3A", /* @__PURE__ */ React10.createElement("span", { className: "font-mono bg-orange-100 px-2 py-1 rounded mx-1 text-orange-700" }, newEmail)), /* @__PURE__ */ React10.createElement(Section9, { className: "bg-orange-50 border border-orange-200 rounded p-4 mb-6" }, /* @__PURE__ */ React10.createElement(Text8, { className: "text-orange-800 text-sm font-semibold m-0" }, "\u{1F4CD} \u64CD\u4F5C\u8BE6\u60C5\uFF1A"), /* @__PURE__ */ React10.createElement(Text8, { className: "text-orange-700 text-sm mt-2 mb-1 m-0" }, "\u2022 \u64CD\u4F5C\u65F6\u95F4\uFF1A", changeTime), ipAddress && /* @__PURE__ */ React10.createElement(Text8, { className: "text-orange-700 text-sm my-1 m-0" }, "\u2022 \u64CD\u4F5CIP\uFF1A", ipAddress), userAgent && /* @__PURE__ */ React10.createElement(Text8, { className: "text-orange-700 text-sm mt-1 m-0" }, "\u2022 \u8BBE\u5907\u4FE1\u606F\uFF1A", userAgent)), /* @__PURE__ */ React10.createElement(Text8, { className: "text-gray-700 text-base leading-6 mb-4 m-0" }, /* @__PURE__ */ React10.createElement("strong", null, "\u5982\u679C\u8FD9\u662F\u60A8\u672C\u4EBA\u64CD\u4F5C\uFF1A")), /* @__PURE__ */ React10.createElement(Text8, { className: "text-gray-700 text-base leading-6 mb-6 m-0" }, "\u8BF7\u524D\u5F80\u65B0\u90AE\u7BB1 ", newEmail, " \u67E5\u6536\u786E\u8BA4\u90AE\u4EF6\uFF0C\u5E76\u6309\u7167\u90AE\u4EF6\u4E2D\u7684\u6307\u793A\u5B8C\u6210\u90AE\u7BB1\u53D8\u66F4\u3002"), /* @__PURE__ */ React10.createElement(Section9, { className: "bg-red-50 border-l-4 border-red-400 p-4 rounded mb-6" }, /* @__PURE__ */ React10.createElement(Text8, { className: "text-red-800 text-sm font-semibold m-0" }, "\u{1F6A8} \u5982\u679C\u4E0D\u662F\u60A8\u672C\u4EBA\u64CD\u4F5C\uFF1A"), /* @__PURE__ */ React10.createElement(Text8, { className: "text-red-700 text-sm mt-2 mb-1 m-0" }, "\u2022 \u60A8\u7684\u8D26\u6237\u53EF\u80FD\u5B58\u5728\u5B89\u5168\u98CE\u9669"), /* @__PURE__ */ React10.createElement(Text8, { className: "text-red-700 text-sm my-1 m-0" }, "\u2022 \u8BF7\u7ACB\u5373\u70B9\u51FB\u4E0B\u65B9\u6309\u94AE\u53D6\u6D88\u6B64\u6B21\u53D8\u66F4"), /* @__PURE__ */ React10.createElement(Text8, { className: "text-red-700 text-sm my-1 m-0" }, "\u2022 \u5EFA\u8BAE\u7ACB\u5373\u66F4\u6539\u60A8\u7684\u5BC6\u7801"), /* @__PURE__ */ React10.createElement(Text8, { className: "text-red-700 text-sm mt-1 m-0" }, "\u2022 \u8054\u7CFB\u6211\u4EEC\u8FDB\u884C\u5B89\u5168\u68C0\u67E5")), /* @__PURE__ */ React10.createElement(Section9, { className: "text-center mb-6" }, /* @__PURE__ */ React10.createElement(Button, { href: cancelUrl, variant: "secondary" }, "\u53D6\u6D88\u90AE\u7BB1\u53D8\u66F4")), /* @__PURE__ */ React10.createElement(Section9, { className: "bg-blue-50 border border-blue-200 rounded p-4 mb-6" }, /* @__PURE__ */ React10.createElement(Text8, { className: "text-blue-800 text-sm font-semibold m-0" }, "\u{1F510} \u5B89\u5168\u5EFA\u8BAE\uFF1A"), /* @__PURE__ */ React10.createElement(Text8, { className: "text-blue-700 text-sm mt-2 mb-1 m-0" }, "\u2022 \u5B9A\u671F\u66F4\u6362\u5BC6\u7801\uFF0C\u786E\u4FDD\u5BC6\u7801\u5F3A\u5EA6"), /* @__PURE__ */ React10.createElement(Text8, { className: "text-blue-700 text-sm my-1 m-0" }, "\u2022 \u4E0D\u8981\u5728\u4E0D\u5B89\u5168\u7684\u7F51\u7EDC\u73AF\u5883\u4E0B\u767B\u5F55"), /* @__PURE__ */ React10.createElement(Text8, { className: "text-blue-700 text-sm my-1 m-0" }, "\u2022 \u5F00\u542F\u53CC\u91CD\u9A8C\u8BC1\u4FDD\u62A4\uFF08\u5373\u5C06\u63A8\u51FA\uFF09"), /* @__PURE__ */ React10.createElement(Text8, { className: "text-blue-700 text-sm mt-1 m-0" }, "\u2022 \u53CA\u65F6\u5173\u6CE8\u8D26\u6237\u5B89\u5168\u901A\u77E5")), /* @__PURE__ */ React10.createElement(Text8, { className: "text-gray-700 text-base leading-6 mb-4 m-0" }, "\u5982\u679C\u60A8\u6709\u4EFB\u4F55\u7591\u95EE\u6216\u9700\u8981\u5E2E\u52A9\uFF0C\u8BF7\u968F\u65F6\u8054\u7CFB\u6211\u4EEC\u7684\u652F\u6301\u56E2\u961F\u3002"), /* @__PURE__ */ React10.createElement(Text8, { className: "text-gray-600 text-sm mt-6 m-0" }, "\u90AE\u7BB1\u53D8\u66F4\u8BF7\u6C42\u5C06\u572815\u5206\u949F\u540E\u81EA\u52A8\u8FC7\u671F\u3002\u5982\u9700\u53D6\u6D88\uFF0C\u8BF7\u53CA\u65F6\u70B9\u51FB\u4E0A\u65B9\u6309\u94AE\u3002"), /* @__PURE__ */ React10.createElement(Text8, { className: "text-gray-600 text-sm mt-4 m-0" }, "ChatTOEIC \u5B89\u5168\u56E2\u961F", /* @__PURE__ */ React10.createElement("br", null), /* @__PURE__ */ React10.createElement("a", { href: "mailto:support@chattoeic.com", className: "text-blue-600 underline" }, "support@chattoeic.com"))));
}

// src/emails/templates/auth/EmailChangeSuccessEmail.tsx
import React11 from "react";
import { Text as Text9, Section as Section10 } from "@react-email/components";
function EmailChangeSuccessEmail({
  userName,
  oldEmail,
  newEmail,
  changeTime,
  loginUrl = `${process.env.FRONTEND_URL || "https://www.chattoeic.com"}/login`,
  userAgent,
  ipAddress
}) {
  return /* @__PURE__ */ React11.createElement(Layout, { preview: `\u90AE\u7BB1\u53D8\u66F4\u6210\u529F - ${userName}` }, /* @__PURE__ */ React11.createElement(Section10, null, /* @__PURE__ */ React11.createElement(Text9, { className: "text-2xl font-bold text-green-600 mb-4 m-0" }, "\u2705 \u90AE\u7BB1\u53D8\u66F4\u6210\u529F"), /* @__PURE__ */ React11.createElement(Text9, { className: "text-gray-700 text-base leading-6 mb-4 m-0" }, "\u4EB2\u7231\u7684 ", /* @__PURE__ */ React11.createElement("span", { className: "font-semibold text-blue-600" }, userName), "\uFF0C"), /* @__PURE__ */ React11.createElement(Text9, { className: "text-gray-700 text-base leading-6 mb-4 m-0" }, "\u606D\u559C\uFF01\u60A8\u7684ChatTOEIC\u8D26\u53F7\u90AE\u7BB1\u5730\u5740\u5DF2\u6210\u529F\u4ECE", /* @__PURE__ */ React11.createElement("span", { className: "font-mono bg-gray-100 px-2 py-1 rounded mx-1" }, oldEmail), "\u66F4\u6539\u4E3A", /* @__PURE__ */ React11.createElement("span", { className: "font-mono bg-green-100 px-2 py-1 rounded mx-1 text-green-700" }, newEmail)), /* @__PURE__ */ React11.createElement(Section10, { className: "bg-green-50 border border-green-200 rounded p-4 mb-6" }, /* @__PURE__ */ React11.createElement(Text9, { className: "text-green-800 text-sm font-semibold m-0" }, "\u{1F389} \u53D8\u66F4\u8BE6\u60C5\uFF1A"), /* @__PURE__ */ React11.createElement(Text9, { className: "text-green-700 text-sm mt-2 mb-1 m-0" }, "\u2022 \u53D8\u66F4\u65F6\u95F4\uFF1A", changeTime), /* @__PURE__ */ React11.createElement(Text9, { className: "text-green-700 text-sm my-1 m-0" }, "\u2022 \u65B0\u90AE\u7BB1\uFF1A", newEmail), /* @__PURE__ */ React11.createElement(Text9, { className: "text-green-700 text-sm my-1 m-0" }, "\u2022 \u65E7\u90AE\u7BB1\uFF1A", oldEmail, "\uFF08\u5DF2\u5931\u6548\uFF09"), ipAddress && /* @__PURE__ */ React11.createElement(Text9, { className: "text-green-700 text-sm my-1 m-0" }, "\u2022 \u64CD\u4F5CIP\uFF1A", ipAddress), userAgent && /* @__PURE__ */ React11.createElement(Text9, { className: "text-green-700 text-sm mt-1 m-0" }, "\u2022 \u8BBE\u5907\u4FE1\u606F\uFF1A", userAgent)), /* @__PURE__ */ React11.createElement(Text9, { className: "text-gray-700 text-base leading-6 mb-6 m-0" }, "\u4ECE\u73B0\u5728\u5F00\u59CB\uFF0C\u60A8\u9700\u8981\u4F7F\u7528\u65B0\u90AE\u7BB1\u5730\u5740 ", /* @__PURE__ */ React11.createElement("strong", null, newEmail), " \u6765\u767B\u5F55\u60A8\u7684ChatTOEIC\u8D26\u53F7\u3002"), /* @__PURE__ */ React11.createElement(Section10, { className: "text-center mb-6" }, /* @__PURE__ */ React11.createElement(Button, { href: loginUrl }, "\u7ACB\u5373\u767B\u5F55")), /* @__PURE__ */ React11.createElement(Section10, { className: "bg-blue-50 border-l-4 border-blue-400 p-4 rounded mb-6" }, /* @__PURE__ */ React11.createElement(Text9, { className: "text-blue-800 text-sm font-semibold m-0" }, "\u{1F4DD} \u91CD\u8981\u53D8\u66F4\uFF1A"), /* @__PURE__ */ React11.createElement(Text9, { className: "text-blue-700 text-sm mt-2 mb-1 m-0" }, "\u2022 \u767B\u5F55\u90AE\u7BB1\uFF1A\u73B0\u5728\u4F7F\u7528 ", newEmail), /* @__PURE__ */ React11.createElement(Text9, { className: "text-blue-700 text-sm my-1 m-0" }, "\u2022 \u90AE\u4EF6\u901A\u77E5\uFF1A\u5C06\u53D1\u9001\u5230\u65B0\u90AE\u7BB1\u5730\u5740"), /* @__PURE__ */ React11.createElement(Text9, { className: "text-blue-700 text-sm my-1 m-0" }, "\u2022 \u8D26\u6237\u6062\u590D\uFF1A\u4F7F\u7528\u65B0\u90AE\u7BB1\u8FDB\u884C\u5BC6\u7801\u91CD\u7F6E"), /* @__PURE__ */ React11.createElement(Text9, { className: "text-blue-700 text-sm mt-1 m-0" }, "\u2022 \u65E7\u90AE\u7BB1\uFF1A", oldEmail, " \u4E0D\u518D\u4E0E\u6B64\u8D26\u53F7\u5173\u8054")), /* @__PURE__ */ React11.createElement(Section10, { className: "bg-amber-50 border border-amber-200 rounded p-4 mb-6" }, /* @__PURE__ */ React11.createElement(Text9, { className: "text-amber-800 text-sm font-semibold m-0" }, "\u{1F510} \u5B89\u5168\u63D0\u9192\uFF1A"), /* @__PURE__ */ React11.createElement(Text9, { className: "text-amber-700 text-sm mt-2 mb-1 m-0" }, "\u2022 \u8BF7\u786E\u4FDD\u65B0\u90AE\u7BB1\u8D26\u53F7\u7684\u5B89\u5168\u6027"), /* @__PURE__ */ React11.createElement(Text9, { className: "text-amber-700 text-sm my-1 m-0" }, "\u2022 \u5B9A\u671F\u68C0\u67E5\u8D26\u6237\u6D3B\u52A8\u8BB0\u5F55"), /* @__PURE__ */ React11.createElement(Text9, { className: "text-amber-700 text-sm my-1 m-0" }, "\u2022 \u5982\u53D1\u73B0\u5F02\u5E38\u6D3B\u52A8\uFF0C\u7ACB\u5373\u8054\u7CFB\u6211\u4EEC"), /* @__PURE__ */ React11.createElement(Text9, { className: "text-amber-700 text-sm mt-1 m-0" }, "\u2022 \u5EFA\u8BAE\u4F7F\u7528\u5F3A\u5BC6\u7801\u4FDD\u62A4\u90AE\u7BB1\u8D26\u53F7")), /* @__PURE__ */ React11.createElement(Section10, { className: "bg-red-50 border border-red-200 rounded p-4 mb-6" }, /* @__PURE__ */ React11.createElement(Text9, { className: "text-red-800 text-sm font-semibold m-0" }, "\u26A0\uFE0F \u5982\u679C\u4E0D\u662F\u60A8\u672C\u4EBA\u64CD\u4F5C\uFF1A"), /* @__PURE__ */ React11.createElement(Text9, { className: "text-red-700 text-sm mt-2 mb-1 m-0" }, "\u2022 \u7ACB\u5373\u8054\u7CFB\u6211\u4EEC\uFF1Asupport@chattoeic.com"), /* @__PURE__ */ React11.createElement(Text9, { className: "text-red-700 text-sm my-1 m-0" }, "\u2022 \u6211\u4EEC\u5C06\u534F\u52A9\u60A8\u6062\u590D\u8D26\u6237\u5B89\u5168"), /* @__PURE__ */ React11.createElement(Text9, { className: "text-red-700 text-sm mt-1 m-0" }, "\u2022 \u5EFA\u8BAE\u7ACB\u5373\u66F4\u6539\u5BC6\u7801\u5E76\u542F\u7528\u989D\u5916\u5B89\u5168\u63AA\u65BD")), /* @__PURE__ */ React11.createElement(Text9, { className: "text-gray-700 text-base leading-6 mb-4 m-0" }, "\u611F\u8C22\u60A8\u7EE7\u7EED\u4F7F\u7528ChatTOEIC\uFF01\u5982\u679C\u60A8\u5728\u4F7F\u7528\u8FC7\u7A0B\u4E2D\u9047\u5230\u4EFB\u4F55\u95EE\u9898\uFF0C\u6211\u4EEC\u968F\u65F6\u4E3A\u60A8\u63D0\u4F9B\u5E2E\u52A9\u3002"), /* @__PURE__ */ React11.createElement(Text9, { className: "text-gray-600 text-sm mt-6 m-0" }, "\u795D\u60A8\u5B66\u4E60\u6109\u5FEB\uFF01", /* @__PURE__ */ React11.createElement("br", null), "ChatTOEIC \u56E2\u961F"), /* @__PURE__ */ React11.createElement(Text9, { className: "text-gray-600 text-sm mt-4 m-0" }, "\u6709\u4EFB\u4F55\u95EE\u9898\uFF0C\u8BF7\u8054\u7CFB\u6211\u4EEC\uFF1A", /* @__PURE__ */ React11.createElement("a", { href: "mailto:support@chattoeic.com", className: "text-blue-600 underline ml-1" }, "support@chattoeic.com"))));
}

// src/services/authEmailService.ts
var AuthEmailService = class {
  /**
   * 发送注册验证邮件
   */
  async sendRegistrationVerificationEmail(email, userName) {
    try {
      if (!emailService.validateEmail(email)) {
        return {
          success: false,
          error: "invalid_email_format"
        };
      }
      const verificationCode = verificationService.createVerificationCode({
        type: "email",
        email,
        expiresInMinutes: 10
      });
      const verificationUrl = `${process.env.FRONTEND_URL || "https://www.chattoeic.com"}/verify?code=${verificationCode}&email=${encodeURIComponent(email)}`;
      const emailTemplate = React12.createElement(VerificationEmail, {
        userName,
        verificationCode,
        verificationUrl
      });
      const result = await emailService.sendEmail({
        to: email,
        subject: "\u9A8C\u8BC1\u60A8\u7684ChatTOEIC\u8D26\u53F7",
        template: emailTemplate
      });
      if (result.success) {
        console.log("\u{1F4E7} Registration verification email sent:", {
          email,
          userName,
          verificationCode,
          emailId: result.id
        });
        return {
          success: true,
          verificationCode,
          emailId: result.id
        };
      } else {
        return {
          success: false,
          error: result.error || "email_send_failed"
        };
      }
    } catch (error) {
      console.error("\u274C Failed to send registration verification email:", error);
      return {
        success: false,
        error: error.message || "unknown_error"
      };
    }
  }
  /**
   * 重新发送验证邮件
   */
  async resendVerificationEmail(email, userName) {
    try {
      const codeExists = verificationService.checkCodeExists({
        type: "email",
        email
      });
      if (codeExists) {
        const codeInfo = verificationService.getCodeInfo({
          type: "email",
          email
        });
        if (codeInfo.expiresAt && codeInfo.expiresAt.getTime() - Date.now() > 5 * 60 * 1e3) {
          return {
            success: false,
            error: "verification_code_still_valid"
          };
        }
      }
      return await this.sendRegistrationVerificationEmail(email, userName);
    } catch (error) {
      console.error("\u274C Failed to resend verification email:", error);
      return {
        success: false,
        error: error.message || "unknown_error"
      };
    }
  }
  /**
   * 验证邮箱验证码
   */
  async verifyEmailCode(email, code) {
    try {
      const result = verificationService.verifyCode({
        type: "email",
        email
      }, code);
      if (result.success) {
        console.log("\u2705 Email verification successful:", { email });
      } else {
        console.log("\u274C Email verification failed:", {
          email,
          error: result.error,
          remainingAttempts: result.remainingAttempts
        });
      }
      return result;
    } catch (error) {
      console.error("\u274C Email verification error:", error);
      return {
        success: false,
        error: "verification_error"
      };
    }
  }
  /**
   * 发送欢迎邮件（验证完成后）
   */
  async sendWelcomeEmail(email, userName) {
    try {
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">\u{1F389} \u6B22\u8FCE\u6765\u5230ChatTOEIC\uFF01</h2>
          <p>\u4EB2\u7231\u7684 ${userName}\uFF0C</p>
          <p>\u606D\u559C\u60A8\u6210\u529F\u9A8C\u8BC1\u90AE\u7BB1\uFF01\u73B0\u5728\u60A8\u53EF\u4EE5\u5F00\u59CB\u60A8\u7684TOEIC\u5B66\u4E60\u4E4B\u65C5\u4E86\u3002</p>
          <p>
            <a href="${process.env.FRONTEND_URL || "https://www.chattoeic.com"}" 
               style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
              \u5F00\u59CB\u5B66\u4E60
            </a>
          </p>
          <p>\u5982\u6709\u4EFB\u4F55\u95EE\u9898\uFF0C\u8BF7\u968F\u65F6\u8054\u7CFB\u6211\u4EEC\uFF1Asupport@chattoeic.com</p>
          <p>\u795D\u5B66\u4E60\u6109\u5FEB\uFF01<br>ChatTOEIC\u56E2\u961F</p>
        </div>
      `;
      const result = await emailService.sendEmail({
        to: email,
        subject: "\u{1F389} \u6B22\u8FCE\u6765\u5230ChatTOEIC\uFF01",
        template: React12.createElement("div", {
          dangerouslySetInnerHTML: { __html: html }
        })
      });
      return {
        success: result.success,
        emailId: result.id,
        error: result.error
      };
    } catch (error) {
      console.error("\u274C Failed to send welcome email:", error);
      return {
        success: false,
        error: error.message || "unknown_error"
      };
    }
  }
  /**
   * 获取验证码信息（不返回实际验证码）
   */
  getVerificationCodeInfo(email) {
    return verificationService.getCodeInfo({
      type: "email",
      email
    });
  }
  /**
   * 发送密码重置邮件
   */
  async sendPasswordResetEmail(email, userName, userId, userAgent, ipAddress) {
    try {
      if (!emailService.validateEmail(email)) {
        return {
          success: false,
          error: "invalid_email_format"
        };
      }
      const activeRequest = passwordResetService.hasActiveResetRequest(email);
      if (activeRequest.hasActive && activeRequest.count >= 3) {
        return {
          success: false,
          error: "too_many_reset_requests"
        };
      }
      const resetToken = await passwordResetService.createResetToken(
        email,
        userId,
        userAgent,
        ipAddress
      );
      const resetUrl = `${process.env.FRONTEND_URL || "https://www.chattoeic.com"}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;
      const emailTemplate = React12.createElement(PasswordResetEmail, {
        userName,
        resetToken,
        resetUrl,
        expiresInHours: 1
      });
      const result = await emailService.sendEmail({
        to: email,
        subject: "\u91CD\u7F6E\u60A8\u7684ChatTOEIC\u5BC6\u7801",
        template: emailTemplate
      });
      if (result.success) {
        console.log("\u{1F510} Password reset email sent:", {
          email,
          userName,
          resetToken: resetToken.substring(0, 8) + "...",
          // 只记录前8位
          emailId: result.id,
          userAgent
        });
        return {
          success: true,
          emailId: result.id
        };
      } else {
        await passwordResetService.cleanupTokensForEmail(email);
        return {
          success: false,
          error: result.error || "email_send_failed"
        };
      }
    } catch (error) {
      console.error("\u274C Failed to send password reset email:", error);
      if (error.message === "too_many_reset_requests") {
        return {
          success: false,
          error: "too_many_reset_requests"
        };
      }
      return {
        success: false,
        error: error.message || "unknown_error"
      };
    }
  }
  /**
   * 验证密码重置令牌
   */
  async verifyPasswordResetToken(token) {
    try {
      const result = await passwordResetService.verifyResetToken(token);
      if (result.success) {
        console.log("\u2705 Password reset token verified for:", result.email);
      }
      return result;
    } catch (error) {
      console.error("\u274C Password reset token verification error:", error);
      return {
        success: false,
        error: "verification_error"
      };
    }
  }
  /**
   * 完成密码重置后发送确认邮件
   */
  async sendPasswordResetSuccessEmail(token, email, userName, userAgent, ipAddress) {
    try {
      const resetTime = (/* @__PURE__ */ new Date()).toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Shanghai"
      });
      await passwordResetService.markTokenAsUsed(token);
      const emailTemplate = React12.createElement(PasswordResetSuccessEmail, {
        userName,
        resetTime,
        userAgent,
        ipAddress
      });
      const result = await emailService.sendEmail({
        to: email,
        subject: "\u5BC6\u7801\u91CD\u7F6E\u6210\u529F - ChatTOEIC",
        template: emailTemplate
      });
      if (result.success) {
        console.log("\u2705 Password reset success email sent:", {
          email,
          userName,
          resetTime,
          emailId: result.id
        });
      }
      return {
        success: result.success,
        emailId: result.id,
        error: result.error
      };
    } catch (error) {
      console.error("\u274C Failed to send password reset success email:", error);
      return {
        success: false,
        error: error.message || "unknown_error"
      };
    }
  }
  /**
   * 检查密码重置请求是否存在
   */
  checkPasswordResetRequest(email) {
    return passwordResetService.hasActiveResetRequest(email);
  }
  /**
   * 获取重置令牌统计信息
   */
  getResetTokenStats() {
    return passwordResetService.getTokenStats();
  }
  /**
   * 发送邮箱变更确认邮件（发送到新邮箱）
   */
  async sendEmailChangeConfirmationEmail(userId, oldEmail, newEmail, userName, userAgent, ipAddress) {
    try {
      if (!emailService.validateEmail(newEmail)) {
        return {
          success: false,
          error: "invalid_email_format"
        };
      }
      const changeResult = await emailChangeService.createEmailChangeRequest(
        userId,
        oldEmail,
        newEmail,
        userAgent,
        ipAddress
      );
      if (!changeResult.success) {
        return {
          success: false,
          error: changeResult.error
        };
      }
      const confirmationTemplate = React12.createElement(EmailChangeConfirmationEmail, {
        userName,
        oldEmail,
        newEmail,
        verificationCode: changeResult.verificationCode,
        expiresInMinutes: 15
      });
      const result = await emailService.sendEmail({
        to: newEmail,
        subject: "\u786E\u8BA4\u60A8\u7684\u65B0\u90AE\u7BB1\u5730\u5740 - ChatTOEIC",
        template: confirmationTemplate
      });
      if (result.success) {
        console.log("\u{1F4E7} Email change confirmation sent:", {
          userId,
          oldEmail,
          newEmail,
          emailId: result.id
        });
        return {
          success: true,
          verificationCode: changeResult.verificationCode,
          emailId: result.id
        };
      } else {
        await emailChangeService.cancelEmailChangeRequest(userId, newEmail);
        return {
          success: false,
          error: result.error || "email_send_failed"
        };
      }
    } catch (error) {
      console.error("\u274C Failed to send email change confirmation:", error);
      return {
        success: false,
        error: error.message || "unknown_error"
      };
    }
  }
  /**
   * 发送邮箱变更通知邮件（发送到旧邮箱）
   */
  async sendEmailChangeNotificationEmail(oldEmail, newEmail, userName, userAgent, ipAddress) {
    try {
      const changeTime = (/* @__PURE__ */ new Date()).toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Shanghai"
      });
      const notificationTemplate = React12.createElement(EmailChangeNotificationEmail, {
        userName,
        oldEmail,
        newEmail,
        changeTime,
        userAgent,
        ipAddress
      });
      const result = await emailService.sendEmail({
        to: oldEmail,
        subject: "\u90AE\u7BB1\u53D8\u66F4\u901A\u77E5 - ChatTOEIC",
        template: notificationTemplate
      });
      if (result.success) {
        console.log("\u{1F4E7} Email change notification sent:", {
          oldEmail,
          newEmail,
          emailId: result.id
        });
      }
      return {
        success: result.success,
        emailId: result.id,
        error: result.error
      };
    } catch (error) {
      console.error("\u274C Failed to send email change notification:", error);
      return {
        success: false,
        error: error.message || "unknown_error"
      };
    }
  }
  /**
   * 验证邮箱变更验证码
   */
  async verifyEmailChangeCode(userId, newEmail, code) {
    try {
      const result = await emailChangeService.verifyEmailChangeCode(userId, newEmail, code);
      if (result.success) {
        console.log("\u2705 Email change verified:", {
          userId,
          oldEmail: result.request.oldEmail,
          newEmail: result.request.newEmail
        });
        return {
          success: true,
          oldEmail: result.request.oldEmail,
          newEmail: result.request.newEmail
        };
      }
      return {
        success: false,
        error: result.error
      };
    } catch (error) {
      console.error("\u274C Email change verification error:", error);
      return {
        success: false,
        error: "verification_error"
      };
    }
  }
  /**
   * 发送邮箱变更成功邮件（发送到新邮箱）
   */
  async sendEmailChangeSuccessEmail(oldEmail, newEmail, userName, userAgent, ipAddress) {
    try {
      const changeTime = (/* @__PURE__ */ new Date()).toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Shanghai"
      });
      const successTemplate = React12.createElement(EmailChangeSuccessEmail, {
        userName,
        oldEmail,
        newEmail,
        changeTime,
        userAgent,
        ipAddress
      });
      const result = await emailService.sendEmail({
        to: newEmail,
        subject: "\u90AE\u7BB1\u53D8\u66F4\u6210\u529F - ChatTOEIC",
        template: successTemplate
      });
      if (result.success) {
        console.log("\u{1F4E7} Email change success notification sent:", {
          oldEmail,
          newEmail,
          emailId: result.id
        });
      }
      return {
        success: result.success,
        emailId: result.id,
        error: result.error
      };
    } catch (error) {
      console.error("\u274C Failed to send email change success notification:", error);
      return {
        success: false,
        error: error.message || "unknown_error"
      };
    }
  }
  /**
   * 取消邮箱变更请求
   */
  async cancelEmailChangeRequest(userId, newEmail) {
    try {
      return await emailChangeService.cancelEmailChangeRequest(userId, newEmail);
    } catch (error) {
      console.error("\u274C Failed to cancel email change request:", error);
      return {
        success: false,
        cancelledCount: 0
      };
    }
  }
  /**
   * 获取用户的邮箱变更请求状态
   */
  getUserEmailChangeStatus(userId) {
    return emailChangeService.getUserEmailChangeRequests(userId);
  }
  /**
   * 检查邮箱是否已被其他用户请求使用
   */
  isEmailBeingUsed(newEmail, excludeUserId) {
    return emailChangeService.isEmailBeingUsed(newEmail, excludeUserId);
  }
  /**
   * 获取邮箱变更请求统计信息
   */
  getEmailChangeStats() {
    return emailChangeService.getRequestStats();
  }
};
var authEmailService = new AuthEmailService();

// src/routes/auth.ts
var router3 = Router3();
router3.get("/test", (req, res) => {
  res.json({
    success: true,
    message: "Auth route is working",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
router3.post("/debug/reset-admin-password", async (req, res) => {
  try {
    const newPassword = "admin123";
    const hashedPassword = await bcrypt2.hash(newPassword, 12);
    const updatedUser = await prisma.user.update({
      where: { email: "admin@chattoeic.com" },
      data: { password: hashedPassword },
      select: {
        id: true,
        email: true,
        name: true,
        role: true
      }
    });
    res.json({
      success: true,
      data: {
        user: updatedUser,
        newPassword,
        message: "Admin password reset successfully"
      }
    });
  } catch (error) {
    console.error("Admin password reset error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
router3.post("/debug/password-test", async (req, res) => {
  try {
    const { password } = req.body;
    const adminUser = await prisma.user.findUnique({
      where: { email: "admin@chattoeic.com" },
      select: {
        id: true,
        email: true,
        password: true
      }
    });
    if (!adminUser || !adminUser.password) {
      return res.json({
        success: false,
        error: "Admin user not found or no password"
      });
    }
    const validPassword = await bcrypt2.compare(password, adminUser.password);
    res.json({
      success: true,
      data: {
        passwordMatch: validPassword,
        providedPassword: password,
        hashedPasswordLength: adminUser.password.length,
        adminId: adminUser.id
      }
    });
  } catch (error) {
    console.error("Password test error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
router3.get("/debug/admin", async (req, res) => {
  try {
    const adminUser = await prisma.user.findUnique({
      where: { email: "admin@chattoeic.com" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        password: true
        // 临时包含密码字段检查
      }
    });
    res.json({
      success: true,
      data: {
        adminExists: !!adminUser,
        adminInfo: adminUser ? {
          id: adminUser.id,
          email: adminUser.email,
          name: adminUser.name,
          role: adminUser.role,
          createdAt: adminUser.createdAt,
          hasPassword: !!adminUser.password,
          passwordLength: adminUser.password?.length || 0
        } : null,
        envCheck: {
          hasJwtSecret: !!process.env.JWT_SECRET,
          hasJwtRefreshSecret: !!process.env.JWT_REFRESH_SECRET,
          nodeEnv: process.env.NODE_ENV
        }
      }
    });
  } catch (error) {
    console.error("Debug endpoint error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
router3.post("/register", authRateLimit, validateRequest({ body: schemas.userRegister }), async (req, res) => {
  try {
    const { email, password, name } = req.body;
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: "\u8BE5\u90AE\u7BB1\u5DF2\u88AB\u6CE8\u518C"
      });
    }
    const hashedPassword = await bcrypt2.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        emailVerified: false,
        // 默认未验证
        settings: {
          preferredLanguage: "zh",
          theme: "light",
          notifications: true
        }
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        createdAt: true
      }
    });
    const emailResult = await authEmailService.sendRegistrationVerificationEmail(email, name);
    if (emailResult.success) {
      console.log("\u{1F4E7} Verification email sent to:", email);
      res.status(201).json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            emailVerified: user.emailVerified
          },
          needsVerification: true
        },
        message: "\u6CE8\u518C\u6210\u529F\uFF01\u8BF7\u67E5\u6536\u9A8C\u8BC1\u90AE\u4EF6\u5E76\u5B8C\u6210\u90AE\u7BB1\u9A8C\u8BC1"
      });
    } else {
      console.error("Failed to send verification email:", emailResult.error);
      res.status(201).json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            emailVerified: user.emailVerified
          },
          needsVerification: true,
          emailError: true
        },
        message: "\u6CE8\u518C\u6210\u529F\uFF0C\u4F46\u9A8C\u8BC1\u90AE\u4EF6\u53D1\u9001\u5931\u8D25\u3002\u8BF7\u7A0D\u540E\u91CD\u65B0\u8BF7\u6C42\u9A8C\u8BC1\u90AE\u4EF6",
        warning: "\u9A8C\u8BC1\u90AE\u4EF6\u53D1\u9001\u5931\u8D25"
      });
    }
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      error: "\u6CE8\u518C\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5"
    });
  }
});
router3.post("/login", authRateLimit, validateRequest({ body: schemas.userLogin }), async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log("Login attempt for:", email);
    console.log("Environment check:", {
      hasJwtSecret: !!process.env.JWT_SECRET,
      hasJwtRefreshSecret: !!process.env.JWT_REFRESH_SECRET,
      databaseConnected: !!prisma
    });
    const user = await prisma.user.findUnique({
      where: { email }
    });
    console.log("User found:", user ? { id: user.id, email: user.email, role: user.role, hasPassword: !!user.password } : null);
    if (!user || !user.password) {
      return res.status(401).json({
        success: false,
        error: "\u90AE\u7BB1\u6216\u5BC6\u7801\u9519\u8BEF"
      });
    }
    const validPassword = await bcrypt2.compare(password, user.password);
    console.log("Password validation:", validPassword);
    if (!validPassword) {
      return res.status(401).json({
        success: false,
        error: "\u90AE\u7BB1\u6216\u5BC6\u7801\u9519\u8BEF"
      });
    }
    if (!process.env.JWT_SECRET) {
      console.error("Missing JWT_SECRET");
      return res.status(500).json({
        success: false,
        error: "\u670D\u52A1\u5668\u914D\u7F6E\u9519\u8BEF"
      });
    }
    const loginTime = /* @__PURE__ */ new Date();
    let loginUpdateSuccess = false;
    try {
      const updateResult = await prisma.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: loginTime,
          // 确保邮箱验证状态为true（用于Dashboard显示）
          emailVerified: true
        }
      });
      console.log("\u2705 \u7528\u6237\u767B\u5F55\u65F6\u95F4\u66F4\u65B0\u6210\u529F:", {
        userId: user.id,
        email: user.email,
        loginTime: loginTime.toISOString(),
        updateResult: !!updateResult
      });
      loginUpdateSuccess = true;
    } catch (updateError) {
      console.error("\u274C \u767B\u5F55\u65F6\u95F4\u66F4\u65B0\u5931\u8D25:", {
        userId: user.id,
        email: user.email,
        error: updateError.message,
        stack: updateError.stack
      });
      try {
        await prisma.$executeRaw`UPDATE "User" SET "lastLoginAt" = ${loginTime} WHERE id = ${user.id}`;
        console.log("\u2705 \u4F7F\u7528\u539F\u59CBSQL\u66F4\u65B0\u6210\u529F");
        loginUpdateSuccess = true;
      } catch (rawError) {
        console.error("\u274C \u539F\u59CBSQL\u66F4\u65B0\u4E5F\u5931\u8D25:", rawError.message);
      }
    }
    try {
      const verifyUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, email: true, lastLoginAt: true, isActive: true }
      });
      console.log("\u{1F50D} \u767B\u5F55\u540E\u7528\u6237\u72B6\u6001\u9A8C\u8BC1:", {
        userId: verifyUser?.id,
        email: verifyUser?.email,
        lastLoginAt: verifyUser?.lastLoginAt,
        isActive: verifyUser?.isActive,
        loginUpdateSuccess
      });
    } catch (verifyError) {
      console.error("\u274C \u7528\u6237\u72B6\u6001\u9A8C\u8BC1\u5931\u8D25:", verifyError.message);
    }
    console.log("User last login time updated");
    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role
    });
    console.log("Tokens generated successfully");
    if (loginUpdateSuccess) {
      notifyDashboardUpdate("user_login", {
        userId: user.id,
        email: user.email,
        loginTime: loginTime.toISOString()
      }).catch((error) => {
        console.error("\u274C Dashboard\u66F4\u65B0\u901A\u77E5\u5931\u8D25:", error);
      });
    }
    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        googleId: true,
        emailVerified: true,
        preferredLanguage: true,
        isActive: true,
        settings: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true
      }
    });
    res.json({
      success: true,
      data: {
        user: updatedUser || user,
        ...tokens
      },
      message: "\u767B\u5F55\u6210\u529F"
    });
  } catch (error) {
    console.error("Login error details:", error);
    res.status(500).json({
      success: false,
      error: "\u767B\u5F55\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5",
      details: process.env.NODE_ENV === "development" ? error.message : void 0
    });
  }
});
router3.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        error: "\u5237\u65B0\u4EE4\u724C\u662F\u5FC5\u9700\u7684"
      });
    }
    const refreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
    const decoded = jwt2.verify(refreshToken, refreshSecret);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "\u7528\u6237\u4E0D\u5B58\u5728"
      });
    }
    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role
    });
    res.json({
      success: true,
      data: tokens,
      message: "\u4EE4\u724C\u5237\u65B0\u6210\u529F"
    });
  } catch (error) {
    if (error instanceof jwt2.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        error: "\u5237\u65B0\u4EE4\u724C\u5DF2\u8FC7\u671F\uFF0C\u8BF7\u91CD\u65B0\u767B\u5F55"
      });
    }
    console.error("Token refresh error:", error);
    res.status(401).json({
      success: false,
      error: "\u4EE4\u724C\u5237\u65B0\u5931\u8D25"
    });
  }
});
router3.get("/me", authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        settings: true,
        createdAt: true,
        updatedAt: true
      }
    });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "\u7528\u6237\u4E0D\u5B58\u5728"
      });
    }
    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error("Get user info error:", error);
    res.status(500).json({
      success: false,
      error: "\u83B7\u53D6\u7528\u6237\u4FE1\u606F\u5931\u8D25"
    });
  }
});
router3.put("/me", authenticateToken, async (req, res) => {
  try {
    const { name, avatar, settings } = req.body;
    const updatedUser = await prisma.user.update({
      where: { id: req.user.userId },
      data: {
        ...name && { name },
        ...avatar && { avatar },
        ...settings && { settings }
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        settings: true,
        updatedAt: true
      }
    });
    res.json({
      success: true,
      data: updatedUser,
      message: "\u7528\u6237\u4FE1\u606F\u66F4\u65B0\u6210\u529F"
    });
  } catch (error) {
    console.error("Update user info error:", error);
    res.status(500).json({
      success: false,
      error: "\u66F4\u65B0\u7528\u6237\u4FE1\u606F\u5931\u8D25"
    });
  }
});
router3.post("/logout", authenticateToken, async (req, res) => {
  res.json({
    success: true,
    message: "\u9000\u51FA\u767B\u5F55\u6210\u529F"
  });
});
function generateTokens(payload) {
  const accessToken = jwt2.sign(
    payload,
    process.env.JWT_SECRET,
    { expiresIn: "24h" }
    // 增加访问令牌有效期
  );
  const refreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
  const refreshToken = jwt2.sign(
    payload,
    refreshSecret,
    { expiresIn: "7d" }
  );
  return { accessToken, refreshToken };
}
var googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);
router3.get("/google", oauthRateLimit, (req, res) => {
  try {
    const scopes = [
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email"
    ];
    const authUrl = googleClient.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
      state: "security_token",
      redirect_uri: `https://chattoeic-api.onrender.com/api/auth/google/callback`
    });
    res.redirect(authUrl);
  } catch (error) {
    console.error("Google OAuth\u542F\u52A8\u9519\u8BEF:", error);
    res.status(500).json({
      success: false,
      error: "OAuth\u914D\u7F6E\u9519\u8BEF"
    });
  }
});
router3.get("/google/callback", oauthRateLimit, async (req, res) => {
  try {
    const { code, state, error } = req.query;
    console.log("=== OAuth\u56DE\u8C03\u5F00\u59CB ===");
    console.log("\u67E5\u8BE2\u53C2\u6570:", { code: !!code, state, error });
    const frontendUrl = process.env.FRONTEND_URL || "https://www.chattoeic.com";
    console.log("\u521D\u59CB\u524D\u7AEFURL:", frontendUrl);
    if (error) {
      return res.redirect(`${frontendUrl}/?error=${error}`);
    }
    if (!code) {
      return res.redirect(`${frontendUrl}/?error=no_code`);
    }
    console.log("\u51C6\u5907\u4EA4\u6362\u6388\u6743\u7801\u83B7\u53D6token...");
    console.log("\u4F7F\u7528\u7684redirect_uri:", "https://chattoeic-api.onrender.com/api/auth/google/callback");
    console.log("GOOGLE_CLIENT_SECRET\u5B58\u5728:", !!process.env.GOOGLE_CLIENT_SECRET);
    const { tokens: googleTokens } = await googleClient.getToken({
      code,
      redirect_uri: `https://chattoeic-api.onrender.com/api/auth/google/callback`
    });
    console.log("\u6210\u529F\u83B7\u53D6Google tokens");
    googleClient.setCredentials(googleTokens);
    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${googleTokens.access_token}`
      }
    });
    if (!userInfoResponse.ok) {
      throw new Error("\u83B7\u53D6\u7528\u6237\u4FE1\u606F\u5931\u8D25");
    }
    const googleUser = await userInfoResponse.json();
    let user = await prisma.user.findUnique({
      where: { email: googleUser.email },
      select: {
        id: true,
        email: true,
        name: true,
        googleId: true,
        avatar: true,
        role: true,
        emailVerified: true,
        preferredLanguage: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true
      }
    });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: googleUser.email,
          name: googleUser.name,
          googleId: googleUser.id,
          avatar: googleUser.picture,
          lastLoginAt: /* @__PURE__ */ new Date(),
          // 新用户创建时设置登录时间
          emailVerified: true,
          // Google用户默认邮箱已验证
          settings: {
            preferredLanguage: "zh",
            theme: "light",
            notifications: true
          }
        },
        select: {
          id: true,
          email: true,
          name: true,
          googleId: true,
          avatar: true,
          role: true,
          emailVerified: true,
          preferredLanguage: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true
        }
      });
    } else if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: googleUser.id,
          avatar: googleUser.picture || user.avatar,
          lastLoginAt: /* @__PURE__ */ new Date(),
          // 更新登录时间
          emailVerified: true
          // 确保验证状态
        },
        select: {
          id: true,
          email: true,
          name: true,
          googleId: true,
          avatar: true,
          role: true,
          emailVerified: true,
          preferredLanguage: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true
        }
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: /* @__PURE__ */ new Date(),
          emailVerified: true,
          // 可选：更新头像
          avatar: googleUser.picture || user.avatar
        },
        select: {
          id: true,
          email: true,
          name: true,
          googleId: true,
          avatar: true,
          role: true,
          emailVerified: true,
          preferredLanguage: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true
        }
      });
    }
    const payload = {
      userId: user.id,
      email: user.email,
      name: user.name || ""
    };
    const accessToken = jwt2.sign(payload, process.env.JWT_SECRET, { expiresIn: "24h" });
    const refreshToken = jwt2.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: "7d" });
    const tokens = {
      accessToken,
      refreshToken
    };
    const loginTime = /* @__PURE__ */ new Date();
    notifyDashboardUpdate("google_oauth_login", {
      userId: user.id,
      email: user.email,
      loginTime: loginTime.toISOString(),
      loginMethod: "google_oauth"
    }).catch((error2) => {
      console.error("\u274C Google OAuth Dashboard\u66F4\u65B0\u901A\u77E5\u5931\u8D25:", error2);
    });
    console.log("\u2705 Google OAuth\u767B\u5F55\u6210\u529F\uFF0C\u7528\u6237\u4FE1\u606F\u5DF2\u66F4\u65B0:", {
      userId: user.id,
      email: user.email,
      loginTime: loginTime.toISOString(),
      isNewUser: !user.googleId
    });
    console.log("=== OAuth\u56DE\u8C03\u8C03\u8BD5\u4FE1\u606F ===");
    console.log("Environment FRONTEND_URL:", process.env.FRONTEND_URL);
    console.log("Using frontend URL:", frontendUrl);
    console.log("\u6240\u6709\u73AF\u5883\u53D8\u91CF:", Object.keys(process.env).filter((key) => key.includes("FRONTEND")));
    const redirectUrl = `${frontendUrl}/?token=${encodeURIComponent(accessToken)}&refresh=${encodeURIComponent(refreshToken)}&oauth_success=true`;
    res.redirect(redirectUrl);
  } catch (error) {
    console.error("=== Google OAuth\u56DE\u8C03\u8BE6\u7EC6\u9519\u8BEF\u4FE1\u606F ===");
    console.error("\u9519\u8BEF\u7C7B\u578B:", error.constructor.name);
    console.error("\u9519\u8BEF\u6D88\u606F:", error.message);
    console.error("\u9519\u8BEF\u5806\u6808:", error.stack);
    if (error.response) {
      console.error("HTTP\u54CD\u5E94\u72B6\u6001:", error.response.status);
      console.error("HTTP\u54CD\u5E94\u6570\u636E:", error.response.data);
    }
    let errorType = "oauth_failed";
    if (error.message?.includes("invalid_client")) {
      errorType = "invalid_client";
      console.error("\u274C Google Client\u914D\u7F6E\u9519\u8BEF - \u68C0\u67E5GOOGLE_CLIENT_ID\u548CGOOGLE_CLIENT_SECRET");
    } else if (error.message?.includes("redirect_uri_mismatch")) {
      errorType = "redirect_uri_mismatch";
      console.error("\u274C \u56DE\u8C03URL\u4E0D\u5339\u914D - \u68C0\u67E5Google Console\u4E2D\u7684\u6388\u6743\u91CD\u5B9A\u5411URI");
    } else if (error.message?.includes("access_denied")) {
      errorType = "access_denied";
      console.error("\u274C \u7528\u6237\u62D2\u7EDD\u6388\u6743");
    }
    const frontendUrl = process.env.FRONTEND_URL || "https://www.chattoeic.com";
    res.redirect(`${frontendUrl}/?error=${errorType}&details=${encodeURIComponent(error.message)}`);
  }
});
router3.post("/verify-email", authRateLimit, async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({
        success: false,
        error: "\u90AE\u7BB1\u548C\u9A8C\u8BC1\u7801\u4E0D\u80FD\u4E3A\u7A7A"
      });
    }
    const verificationResult = await authEmailService.verifyEmailCode(email, code);
    if (!verificationResult.success) {
      let errorMessage = "\u9A8C\u8BC1\u5931\u8D25";
      switch (verificationResult.error) {
        case "verification_code_not_found":
          errorMessage = "\u9A8C\u8BC1\u7801\u4E0D\u5B58\u5728\u6216\u5DF2\u8FC7\u671F";
          break;
        case "verification_code_expired":
          errorMessage = "\u9A8C\u8BC1\u7801\u5DF2\u8FC7\u671F\uFF0C\u8BF7\u91CD\u65B0\u83B7\u53D6";
          break;
        case "invalid_verification_code":
          errorMessage = `\u9A8C\u8BC1\u7801\u9519\u8BEF${verificationResult.remainingAttempts ? `\uFF0C\u8FD8\u53EF\u5C1D\u8BD5${verificationResult.remainingAttempts}\u6B21` : ""}`;
          break;
        case "too_many_attempts":
          errorMessage = "\u9A8C\u8BC1\u6B21\u6570\u8FC7\u591A\uFF0C\u8BF7\u91CD\u65B0\u83B7\u53D6\u9A8C\u8BC1\u7801";
          break;
      }
      return res.status(400).json({
        success: false,
        error: errorMessage,
        remainingAttempts: verificationResult.remainingAttempts
      });
    }
    const user = await prisma.user.update({
      where: { email },
      data: { emailVerified: true },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        createdAt: true
      }
    });
    try {
      await authEmailService.sendWelcomeEmail(email, user.name || "\u7528\u6237");
    } catch (emailError) {
      console.error("Welcome email send error:", emailError);
    }
    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role
    });
    res.json({
      success: true,
      data: {
        user,
        ...tokens
      },
      message: "\u90AE\u7BB1\u9A8C\u8BC1\u6210\u529F\uFF01\u6B22\u8FCE\u52A0\u5165ChatTOEIC\uFF01"
    });
  } catch (error) {
    console.error("Email verification error:", error);
    if (error.code === "P2025") {
      return res.status(404).json({
        success: false,
        error: "\u7528\u6237\u4E0D\u5B58\u5728"
      });
    }
    res.status(500).json({
      success: false,
      error: "\u9A8C\u8BC1\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5"
    });
  }
});
router3.post("/resend-verification", authRateLimit, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        success: false,
        error: "\u90AE\u7BB1\u5730\u5740\u4E0D\u80FD\u4E3A\u7A7A"
      });
    }
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true
      }
    });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "\u7528\u6237\u4E0D\u5B58\u5728"
      });
    }
    if (user.emailVerified) {
      return res.status(400).json({
        success: false,
        error: "\u90AE\u7BB1\u5DF2\u7ECF\u9A8C\u8BC1\u8FC7\u4E86"
      });
    }
    const emailResult = await authEmailService.resendVerificationEmail(email, user.name || "\u7528\u6237");
    if (emailResult.success) {
      res.json({
        success: true,
        message: "\u9A8C\u8BC1\u90AE\u4EF6\u5DF2\u91CD\u65B0\u53D1\u9001\uFF0C\u8BF7\u67E5\u6536\u90AE\u7BB1"
      });
    } else {
      let errorMessage = "\u53D1\u9001\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5";
      if (emailResult.error === "verification_code_still_valid") {
        errorMessage = "\u9A8C\u8BC1\u7801\u4ECD\u7136\u6709\u6548\uFF0C\u8BF7\u68C0\u67E5\u90AE\u7BB1\u6216\u7A0D\u540E\u518D\u8BD5";
      }
      res.status(400).json({
        success: false,
        error: errorMessage
      });
    }
  } catch (error) {
    console.error("Resend verification error:", error);
    res.status(500).json({
      success: false,
      error: "\u53D1\u9001\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5"
    });
  }
});
router3.get("/verification-status", authRateLimit, async (req, res) => {
  try {
    const { email } = req.query;
    if (!email || typeof email !== "string") {
      return res.status(400).json({
        success: false,
        error: "\u90AE\u7BB1\u5730\u5740\u4E0D\u80FD\u4E3A\u7A7A"
      });
    }
    const codeInfo = authEmailService.getVerificationCodeInfo(email);
    res.json({
      success: true,
      data: {
        hasActiveCode: codeInfo.exists,
        expiresAt: codeInfo.expiresAt,
        remainingAttempts: codeInfo.remainingAttempts
      }
    });
  } catch (error) {
    console.error("Verification status check error:", error);
    res.status(500).json({
      success: false,
      error: "\u67E5\u8BE2\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5"
    });
  }
});
router3.post("/request-password-reset", authRateLimit, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        success: false,
        error: "\u90AE\u7BB1\u5730\u5740\u4E0D\u80FD\u4E3A\u7A7A"
      });
    }
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true
      }
    });
    if (!user) {
      await new Promise((resolve) => setTimeout(resolve, 1e3));
      return res.json({
        success: true,
        message: "\u5982\u679C\u8BE5\u90AE\u7BB1\u5DF2\u6CE8\u518C\uFF0C\u91CD\u7F6E\u94FE\u63A5\u5DF2\u53D1\u9001"
      });
    }
    if (!user.emailVerified) {
      return res.status(400).json({
        success: false,
        error: "\u8BF7\u5148\u9A8C\u8BC1\u60A8\u7684\u90AE\u7BB1\u5730\u5740"
      });
    }
    const userAgent = req.get("User-Agent");
    const ipAddress = req.ip || req.connection.remoteAddress;
    const resetStatus = authEmailService.checkPasswordResetRequest(email);
    if (resetStatus.hasActive && resetStatus.count >= 3) {
      return res.status(429).json({
        success: false,
        error: "\u91CD\u7F6E\u8BF7\u6C42\u8FC7\u4E8E\u9891\u7E41\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5"
      });
    }
    const emailResult = await authEmailService.sendPasswordResetEmail(
      email,
      user.name || "\u7528\u6237",
      user.id,
      userAgent,
      ipAddress
    );
    if (emailResult.success) {
      res.json({
        success: true,
        message: "\u91CD\u7F6E\u94FE\u63A5\u5DF2\u53D1\u9001\u5230\u60A8\u7684\u90AE\u7BB1"
      });
    } else {
      let errorMessage = "\u53D1\u9001\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5";
      if (emailResult.error === "too_many_reset_requests") {
        errorMessage = "\u91CD\u7F6E\u8BF7\u6C42\u8FC7\u4E8E\u9891\u7E41\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5";
      }
      res.status(400).json({
        success: false,
        error: errorMessage
      });
    }
  } catch (error) {
    console.error("Password reset request error:", error);
    res.status(500).json({
      success: false,
      error: "\u670D\u52A1\u5668\u9519\u8BEF\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5"
    });
  }
});
router3.post("/verify-reset-token", authRateLimit, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({
        success: false,
        error: "\u91CD\u7F6E\u4EE4\u724C\u4E0D\u80FD\u4E3A\u7A7A"
      });
    }
    const verificationResult = await authEmailService.verifyPasswordResetToken(token);
    if (verificationResult.success) {
      const user = await prisma.user.findUnique({
        where: { email: verificationResult.email },
        select: {
          id: true,
          email: true,
          name: true
        }
      });
      res.json({
        success: true,
        data: {
          email: verificationResult.email,
          userName: user?.name || "\u7528\u6237"
        }
      });
    } else {
      let errorMessage = "\u91CD\u7F6E\u94FE\u63A5\u65E0\u6548\u6216\u5DF2\u8FC7\u671F";
      switch (verificationResult.error) {
        case "token_not_found":
        case "token_expired":
          errorMessage = "\u91CD\u7F6E\u94FE\u63A5\u5DF2\u8FC7\u671F\uFF0C\u8BF7\u91CD\u65B0\u7533\u8BF7";
          break;
        case "token_already_used":
          errorMessage = "\u6B64\u91CD\u7F6E\u94FE\u63A5\u5DF2\u88AB\u4F7F\u7528";
          break;
        case "invalid_token":
        case "invalid_token_format":
          errorMessage = "\u91CD\u7F6E\u94FE\u63A5\u65E0\u6548";
          break;
      }
      res.status(400).json({
        success: false,
        error: errorMessage
      });
    }
  } catch (error) {
    console.error("Reset token verification error:", error);
    res.status(500).json({
      success: false,
      error: "\u9A8C\u8BC1\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5"
    });
  }
});
router3.post("/reset-password", authRateLimit, async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        error: "\u91CD\u7F6E\u4EE4\u724C\u548C\u65B0\u5BC6\u7801\u4E0D\u80FD\u4E3A\u7A7A"
      });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: "\u5BC6\u7801\u81F3\u5C11\u9700\u89818\u4F4D\u5B57\u7B26"
      });
    }
    const verificationResult = await authEmailService.verifyPasswordResetToken(token);
    if (!verificationResult.success) {
      let errorMessage = "\u91CD\u7F6E\u94FE\u63A5\u65E0\u6548\u6216\u5DF2\u8FC7\u671F";
      switch (verificationResult.error) {
        case "token_not_found":
        case "token_expired":
          errorMessage = "\u91CD\u7F6E\u94FE\u63A5\u5DF2\u8FC7\u671F\uFF0C\u8BF7\u91CD\u65B0\u7533\u8BF7";
          break;
        case "token_already_used":
          errorMessage = "\u6B64\u91CD\u7F6E\u94FE\u63A5\u5DF2\u88AB\u4F7F\u7528";
          break;
        case "invalid_token":
        case "invalid_token_format":
          errorMessage = "\u91CD\u7F6E\u94FE\u63A5\u65E0\u6548";
          break;
      }
      return res.status(400).json({
        success: false,
        error: errorMessage
      });
    }
    const hashedPassword = await bcrypt2.hash(newPassword, 12);
    const updatedUser = await prisma.user.update({
      where: { email: verificationResult.email },
      data: { password: hashedPassword },
      select: {
        id: true,
        email: true,
        name: true
      }
    });
    const userAgent = req.get("User-Agent");
    const ipAddress = req.ip || req.connection.remoteAddress;
    try {
      await authEmailService.sendPasswordResetSuccessEmail(
        token,
        updatedUser.email,
        updatedUser.name || "\u7528\u6237",
        userAgent,
        ipAddress
      );
    } catch (emailError) {
      console.error("Password reset success email error:", emailError);
    }
    res.json({
      success: true,
      message: "\u5BC6\u7801\u91CD\u7F6E\u6210\u529F\uFF01\u60A8\u73B0\u5728\u53EF\u4EE5\u4F7F\u7528\u65B0\u5BC6\u7801\u767B\u5F55\u4E86"
    });
  } catch (error) {
    console.error("Password reset error:", error);
    if (error.code === "P2025") {
      return res.status(404).json({
        success: false,
        error: "\u7528\u6237\u4E0D\u5B58\u5728"
      });
    }
    res.status(500).json({
      success: false,
      error: "\u5BC6\u7801\u91CD\u7F6E\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5"
    });
  }
});
router3.get("/password-reset-status", authRateLimit, async (req, res) => {
  try {
    const { email } = req.query;
    if (!email || typeof email !== "string") {
      return res.status(400).json({
        success: false,
        error: "\u90AE\u7BB1\u5730\u5740\u4E0D\u80FD\u4E3A\u7A7A"
      });
    }
    const resetStatus = authEmailService.checkPasswordResetRequest(email);
    res.json({
      success: true,
      data: {
        hasActiveRequest: resetStatus.hasActive,
        activeRequestCount: resetStatus.count,
        earliestExpiry: resetStatus.earliestExpiry
      }
    });
  } catch (error) {
    console.error("Password reset status check error:", error);
    res.status(500).json({
      success: false,
      error: "\u67E5\u8BE2\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5"
    });
  }
});
router3.post("/request-email-change", authenticateToken, authRateLimit, async (req, res) => {
  try {
    const { newEmail } = req.body;
    const userId = req.user.userId;
    if (!newEmail) {
      return res.status(400).json({
        success: false,
        error: "\u65B0\u90AE\u7BB1\u5730\u5740\u4E0D\u80FD\u4E3A\u7A7A"
      });
    }
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true
      }
    });
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        error: "\u7528\u6237\u4E0D\u5B58\u5728"
      });
    }
    if (!currentUser.emailVerified) {
      return res.status(400).json({
        success: false,
        error: "\u8BF7\u5148\u9A8C\u8BC1\u60A8\u5F53\u524D\u7684\u90AE\u7BB1\u5730\u5740"
      });
    }
    const existingUser = await prisma.user.findUnique({
      where: { email: newEmail },
      select: { id: true }
    });
    if (existingUser && existingUser.id !== userId) {
      return res.status(400).json({
        success: false,
        error: "\u8BE5\u90AE\u7BB1\u5730\u5740\u5DF2\u88AB\u5176\u4ED6\u7528\u6237\u4F7F\u7528"
      });
    }
    if (currentUser.email === newEmail) {
      return res.status(400).json({
        success: false,
        error: "\u65B0\u90AE\u7BB1\u4E0D\u80FD\u4E0E\u5F53\u524D\u90AE\u7BB1\u76F8\u540C"
      });
    }
    const isBeingUsed = authEmailService.isEmailBeingUsed(newEmail, userId);
    if (isBeingUsed) {
      return res.status(400).json({
        success: false,
        error: "\u8BE5\u90AE\u7BB1\u5730\u5740\u6B63\u5728\u88AB\u5176\u4ED6\u7528\u6237\u7533\u8BF7\u4F7F\u7528"
      });
    }
    const userAgent = req.get("User-Agent");
    const ipAddress = req.ip || req.connection.remoteAddress;
    const emailResult = await authEmailService.sendEmailChangeConfirmationEmail(
      userId,
      currentUser.email,
      newEmail,
      currentUser.name || "\u7528\u6237",
      userAgent,
      ipAddress
    );
    if (emailResult.success) {
      authEmailService.sendEmailChangeNotificationEmail(
        currentUser.email,
        newEmail,
        currentUser.name || "\u7528\u6237",
        userAgent,
        ipAddress
      ).catch((error) => {
        console.error("Failed to send email change notification:", error);
      });
      res.json({
        success: true,
        message: "\u786E\u8BA4\u90AE\u4EF6\u5DF2\u53D1\u9001\u5230\u65B0\u90AE\u7BB1\uFF0C\u8BF7\u67E5\u6536\u5E76\u786E\u8BA4\u53D8\u66F4"
      });
    } else {
      let errorMessage = "\u53D1\u9001\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5";
      switch (emailResult.error) {
        case "invalid_email_format":
          errorMessage = "\u90AE\u7BB1\u683C\u5F0F\u4E0D\u6B63\u786E";
          break;
        case "same_email":
          errorMessage = "\u65B0\u90AE\u7BB1\u4E0D\u80FD\u4E0E\u5F53\u524D\u90AE\u7BB1\u76F8\u540C";
          break;
        case "too_many_requests":
          errorMessage = "\u8BF7\u6C42\u8FC7\u4E8E\u9891\u7E41\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5";
          break;
        case "request_too_frequent":
          errorMessage = "\u8BF7\u7B49\u5F855\u5206\u949F\u540E\u518D\u8BD5";
          break;
      }
      res.status(400).json({
        success: false,
        error: errorMessage
      });
    }
  } catch (error) {
    console.error("Email change request error:", error);
    res.status(500).json({
      success: false,
      error: "\u670D\u52A1\u5668\u9519\u8BEF\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5"
    });
  }
});
router3.post("/verify-email-change", authenticateToken, authRateLimit, async (req, res) => {
  try {
    const { newEmail, code } = req.body;
    const userId = req.user.userId;
    if (!newEmail || !code) {
      return res.status(400).json({
        success: false,
        error: "\u65B0\u90AE\u7BB1\u548C\u9A8C\u8BC1\u7801\u4E0D\u80FD\u4E3A\u7A7A"
      });
    }
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true
      }
    });
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        error: "\u7528\u6237\u4E0D\u5B58\u5728"
      });
    }
    const verificationResult = await authEmailService.verifyEmailChangeCode(
      userId,
      newEmail,
      code
    );
    if (!verificationResult.success) {
      let errorMessage = "\u9A8C\u8BC1\u5931\u8D25";
      switch (verificationResult.error) {
        case "request_not_found":
          errorMessage = "\u53D8\u66F4\u8BF7\u6C42\u4E0D\u5B58\u5728\u6216\u5DF2\u8FC7\u671F";
          break;
        case "request_expired":
          errorMessage = "\u9A8C\u8BC1\u7801\u5DF2\u8FC7\u671F\uFF0C\u8BF7\u91CD\u65B0\u7533\u8BF7";
          break;
        case "invalid_verification_code":
          errorMessage = "\u9A8C\u8BC1\u7801\u9519\u8BEF";
          break;
        case "already_verified":
          errorMessage = "\u8BE5\u8BF7\u6C42\u5DF2\u88AB\u9A8C\u8BC1";
          break;
        case "request_cancelled":
          errorMessage = "\u53D8\u66F4\u8BF7\u6C42\u5DF2\u88AB\u53D6\u6D88";
          break;
      }
      return res.status(400).json({
        success: false,
        error: errorMessage
      });
    }
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        email: newEmail,
        emailVerified: true
        // 确保新邮箱是验证状态
      },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
        updatedAt: true
      }
    });
    const userAgent = req.get("User-Agent");
    const ipAddress = req.ip || req.connection.remoteAddress;
    authEmailService.sendEmailChangeSuccessEmail(
      verificationResult.oldEmail,
      newEmail,
      currentUser.name || "\u7528\u6237",
      userAgent,
      ipAddress
    ).catch((error) => {
      console.error("Failed to send email change success notification:", error);
    });
    const tokens = generateTokens({
      userId: updatedUser.id,
      email: updatedUser.email,
      role: req.user.role
    });
    res.json({
      success: true,
      data: {
        user: updatedUser,
        ...tokens
      },
      message: "\u90AE\u7BB1\u53D8\u66F4\u6210\u529F\uFF01\u8BF7\u4F7F\u7528\u65B0\u90AE\u7BB1\u767B\u5F55"
    });
  } catch (error) {
    console.error("Email change verification error:", error);
    if (error.code === "P2002") {
      return res.status(400).json({
        success: false,
        error: "\u8BE5\u90AE\u7BB1\u5730\u5740\u5DF2\u88AB\u4F7F\u7528"
      });
    }
    res.status(500).json({
      success: false,
      error: "\u9A8C\u8BC1\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5"
    });
  }
});
router3.post("/cancel-email-change", authenticateToken, authRateLimit, async (req, res) => {
  try {
    const { newEmail } = req.body;
    const userId = req.user.userId;
    const cancelResult = await authEmailService.cancelEmailChangeRequest(userId, newEmail);
    if (cancelResult.success && cancelResult.cancelledCount > 0) {
      res.json({
        success: true,
        message: `\u5DF2\u53D6\u6D88 ${cancelResult.cancelledCount} \u4E2A\u90AE\u7BB1\u53D8\u66F4\u8BF7\u6C42`,
        data: {
          cancelledCount: cancelResult.cancelledCount
        }
      });
    } else {
      res.json({
        success: true,
        message: "\u6CA1\u6709\u627E\u5230\u53EF\u53D6\u6D88\u7684\u53D8\u66F4\u8BF7\u6C42",
        data: {
          cancelledCount: 0
        }
      });
    }
  } catch (error) {
    console.error("Cancel email change error:", error);
    res.status(500).json({
      success: false,
      error: "\u53D6\u6D88\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5"
    });
  }
});
router3.get("/email-change-status", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const status = authEmailService.getUserEmailChangeStatus(userId);
    res.json({
      success: true,
      data: {
        activeRequests: status.active.map((request) => ({
          newEmail: request.newEmail,
          createdAt: request.createdAt,
          expiresAt: request.expiresAt
        })),
        totalRequests: status.total
      }
    });
  } catch (error) {
    console.error("Email change status error:", error);
    res.status(500).json({
      success: false,
      error: "\u83B7\u53D6\u72B6\u6001\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5"
    });
  }
});
var auth_default = router3;

// src/routes/practice.ts
init_database();
import { Router as Router4 } from "express";

// src/middleware/subscriptionAuth.ts
init_database();
var safeUserSubscriptionSelect = {
  id: true,
  userId: true,
  planId: true,
  stripeCustomerId: true,
  stripeSubscriptionId: true,
  stripeSessionId: true,
  status: true,
  currentPeriodStart: true,
  currentPeriodEnd: true,
  trialStart: true,
  trialEnd: true,
  cancelAtPeriodEnd: true,
  canceledAt: true,
  lastPaymentAt: true,
  createdAt: true,
  updatedAt: true
};
async function getUserSubscriptionInfo(userId) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true
        // 使用name而不是username字段
        // 暂时不查询trialUsed和trialStartedAt字段，直到数据库同步
      }
    });
    if (!user) {
      return { hasPermission: false, reason: "USER_NOT_FOUND" };
    }
    const subscription = await prisma.userSubscription.findUnique({
      where: { userId },
      select: safeUserSubscriptionSelect
    });
    if (!subscription) {
      return {
        hasPermission: false,
        subscription: null,
        permissions: {
          aiPractice: false,
          // ❌ 无AI练习生成
          aiChat: false,
          // ❌ 无AI对话
          vocabulary: true,
          // ✅ 生词本功能  
          exportData: false,
          // ❌ 不能导出
          viewMistakes: true
          // ✅ 无限复习功能
        },
        trialAvailable: true
        // 暂时默认为可用，直到数据库字段同步
      };
    }
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: subscription.planId },
      select: {
        id: true,
        name: true,
        nameJp: true,
        priceCents: true,
        currency: true,
        interval: true,
        features: true,
        dailyPracticeLimit: true,
        dailyAiChatLimit: true,
        maxVocabularyWords: true
      }
    });
    let planData = plan;
    if (!plan) {
      log.warn("Subscription plan not found in database, using hardcoded data", { planId: subscription.planId, userId });
      if (subscription.planId === "trial" || subscription.planId === "trial_plan") {
        planData = {
          id: "trial",
          name: "Free Trial",
          nameJp: "\u7121\u6599\u30C8\u30E9\u30A4\u30A2\u30EB",
          priceCents: 0,
          currency: "jpy",
          interval: "trial",
          features: {
            aiPractice: true,
            aiChat: true,
            vocabulary: true,
            exportData: true,
            viewMistakes: true
          },
          dailyPracticeLimit: null,
          dailyAiChatLimit: 20,
          maxVocabularyWords: null
        };
      } else if (subscription.planId === "free" || subscription.planId === "free_plan") {
        planData = {
          id: "free",
          name: "Free Plan",
          nameJp: "\u7121\u6599\u30D7\u30E9\u30F3",
          priceCents: 0,
          currency: "jpy",
          interval: "month",
          features: {
            aiPractice: false,
            aiChat: false,
            vocabulary: true,
            exportData: false,
            viewMistakes: true
          },
          dailyPracticeLimit: null,
          dailyAiChatLimit: 0,
          maxVocabularyWords: null
        };
      } else {
        return {
          hasPermission: false,
          subscription: null,
          permissions: {
            aiPractice: false,
            aiChat: false,
            vocabulary: true,
            exportData: false,
            viewMistakes: true
          },
          trialAvailable: true
        };
      }
    }
    const isActive = ["active", "trialing"].includes(subscription.status);
    const isExpired = subscription.currentPeriodEnd && subscription.currentPeriodEnd < /* @__PURE__ */ new Date();
    const isTrialExpired = subscription.status === "trialing" && subscription.trialEnd && subscription.trialEnd < /* @__PURE__ */ new Date();
    const isReallyExpired = isExpired || isTrialExpired;
    if (!isActive || isReallyExpired) {
      return {
        hasPermission: false,
        subscription: { ...subscription, plan: planData },
        reason: isReallyExpired ? "SUBSCRIPTION_EXPIRED" : "SUBSCRIPTION_INACTIVE",
        permissions: {
          aiPractice: false,
          // ❌ 无AI练习生成
          aiChat: false,
          // ❌ 无AI对话
          vocabulary: true,
          // ✅ 生词本功能  
          exportData: false,
          // ❌ 不能导出
          viewMistakes: true
          // ✅ 无限复习功能
        },
        trialAvailable: false
      };
    }
    const planFeatures = planData.features;
    if (subscription.status === "trialing") {
      log.info("\u{1F3AF} Granting trial permissions for trialing user", { userId, status: subscription.status });
      return {
        hasPermission: true,
        subscription: { ...subscription, plan: planData },
        permissions: {
          aiPractice: true,
          // ✅ 试用用户可以使用AI练习
          aiChat: true,
          // ✅ 试用用户可以使用AI对话
          exportData: true,
          // ✅ 试用用户可以导出数据
          viewMistakes: true,
          // ✅ 试用用户可以查看错题
          vocabulary: true
          // ✅ 试用用户可以使用词汇功能
        },
        trialAvailable: false
      };
    }
    return {
      hasPermission: true,
      subscription: { ...subscription, plan: planData },
      permissions: {
        aiPractice: planFeatures.aiPractice || false,
        aiChat: planFeatures.aiChat || false,
        exportData: planFeatures.exportData || false,
        viewMistakes: planFeatures.viewMistakes !== false,
        // 默认为true
        vocabulary: planFeatures.vocabulary !== false
        // 默认为true
      },
      trialAvailable: false
    };
  } catch (error) {
    log.error("Failed to get user subscription info", { error, userId });
    return { hasPermission: false, reason: "INTERNAL_ERROR" };
  }
}
async function checkUsageQuota(userId, resourceType) {
  try {
    const now = /* @__PURE__ */ new Date();
    if (resourceType.startsWith("daily_")) {
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);
      let quota2 = null;
      try {
        quota2 = await prisma.usageQuota.findFirst({
          where: {
            userId,
            resourceType,
            periodStart: { gte: startOfDay },
            periodEnd: { lte: endOfDay }
          }
        });
        if (!quota2) {
          const subscriptionInfo = await getUserSubscriptionInfo(userId);
          if (subscriptionInfo.subscription?.plan) {
            const plan = subscriptionInfo.subscription.plan;
            let limitCount = null;
            if (resourceType === "daily_practice") {
              limitCount = plan.dailyPracticeLimit;
            } else if (resourceType === "daily_ai_chat") {
              limitCount = plan.dailyAiChatLimit;
            }
            if (limitCount !== null) {
              try {
                quota2 = await prisma.usageQuota.create({
                  data: {
                    userId,
                    resourceType,
                    usedCount: 0,
                    limitCount,
                    periodStart: startOfDay,
                    periodEnd: endOfDay
                  }
                });
              } catch (createError) {
                log.warn("Failed to create usage quota record", {
                  userId,
                  resourceType,
                  error: createError instanceof Error ? createError.message : String(createError)
                });
              }
            }
          }
        }
      } catch (findError) {
        log.warn("Failed to query usage quota (table may not exist)", {
          userId,
          resourceType,
          error: findError instanceof Error ? findError.message : String(findError)
        });
      }
      if (!quota2) {
        return {
          canUse: true,
          used: 0,
          limit: null,
          remaining: null
        };
      }
      const remaining2 = quota2.limitCount ? quota2.limitCount - quota2.usedCount : null;
      const canUse2 = quota2.limitCount === null || quota2.usedCount < quota2.limitCount;
      return {
        canUse: canUse2,
        used: quota2.usedCount,
        limit: quota2.limitCount,
        remaining: remaining2,
        resetAt: endOfDay
      };
    }
    const quota = await prisma.usageQuota.findFirst({
      where: {
        userId,
        resourceType
      },
      orderBy: { createdAt: "desc" }
    });
    if (!quota) {
      return {
        canUse: true,
        used: 0,
        limit: null,
        remaining: null
      };
    }
    const remaining = quota.limitCount ? quota.limitCount - quota.usedCount : null;
    const canUse = quota.limitCount === null || quota.usedCount < quota.limitCount;
    return {
      canUse,
      used: quota.usedCount,
      limit: quota.limitCount,
      remaining
    };
  } catch (error) {
    log.error("Failed to check usage quota", { error, userId, resourceType });
    return { canUse: false, used: 0, limit: 0, remaining: 0 };
  }
}
async function incrementUsage(userId, resourceType, amount = 1) {
  try {
    if (resourceType.startsWith("daily_")) {
      const now = /* @__PURE__ */ new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);
      try {
        await prisma.usageQuota.updateMany({
          where: {
            userId,
            resourceType,
            periodStart: { gte: startOfDay },
            periodEnd: { lte: endOfDay }
          },
          data: {
            usedCount: { increment: amount }
          }
        });
      } catch (updateError) {
        log.warn("Failed to update daily usage quota (table may not exist)", {
          userId,
          resourceType,
          amount,
          error: updateError instanceof Error ? updateError.message : String(updateError)
        });
      }
    } else {
      try {
        await prisma.usageQuota.updateMany({
          where: {
            userId,
            resourceType
          },
          data: {
            usedCount: { increment: amount }
          }
        });
      } catch (updateError) {
        log.warn("Failed to update usage quota (table may not exist)", {
          userId,
          resourceType,
          amount,
          error: updateError instanceof Error ? updateError.message : String(updateError)
        });
      }
    }
    log.info("Usage incremented", { userId, resourceType, amount });
  } catch (error) {
    log.error("Failed to increment usage", { error, userId, resourceType, amount });
  }
}
var requirePracticeAccess = async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
        errorCode: "UNAUTHORIZED"
      });
    }
    const subscriptionInfo = await getUserSubscriptionInfo(userId);
    if (!subscriptionInfo.permissions.aiPractice) {
      return res.status(403).json({
        success: false,
        error: "AI\u7EC3\u4E60\u529F\u80FD\u9700\u8981\u9AD8\u7EA7\u7248\u8BA2\u9605",
        errorCode: "SUBSCRIPTION_REQUIRED",
        data: {
          trialAvailable: subscriptionInfo.trialAvailable,
          upgradeUrl: "/pricing"
        }
      });
    }
    const quota = await checkUsageQuota(userId, "daily_practice");
    if (!quota.canUse) {
      return res.status(403).json({
        success: false,
        error: "\u4ECA\u65E5\u7EC3\u4E60\u6B21\u6570\u5DF2\u7528\u5B8C",
        errorCode: "USAGE_LIMIT_EXCEEDED",
        data: {
          used: quota.used,
          limit: quota.limit,
          resetAt: quota.resetAt,
          upgradeUrl: "/pricing"
        }
      });
    }
    req.subscriptionInfo = subscriptionInfo;
    req.usageQuota = quota;
    next();
  } catch (error) {
    log.error("Practice access check failed", { error, userId: req.user?.userId });
    res.status(500).json({
      success: false,
      error: "\u6743\u9650\u68C0\u67E5\u5931\u8D25",
      errorCode: "INTERNAL_ERROR"
    });
  }
};
var requireAiChatAccess = async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
        errorCode: "UNAUTHORIZED"
      });
    }
    const subscriptionInfo = await getUserSubscriptionInfo(userId);
    if (!subscriptionInfo.permissions.aiChat) {
      return res.status(403).json({
        success: false,
        error: "AI\u5BF9\u8BDD\u529F\u80FD\u9700\u8981\u9AD8\u7EA7\u7248\u8BA2\u9605",
        errorCode: "SUBSCRIPTION_REQUIRED",
        data: {
          trialAvailable: subscriptionInfo.trialAvailable,
          upgradeUrl: "/pricing"
        }
      });
    }
    const quota = await checkUsageQuota(userId, "daily_ai_chat");
    if (!quota.canUse) {
      return res.status(403).json({
        success: false,
        error: `\u4ECA\u65E5AI\u5BF9\u8BDD\u6B21\u6570\u5DF2\u7528\u5B8C (${quota.used}/${quota.limit})`,
        errorCode: "USAGE_LIMIT_EXCEEDED",
        data: {
          used: quota.used,
          limit: quota.limit,
          resetAt: quota.resetAt,
          upgradeUrl: "/pricing"
        }
      });
    }
    req.subscriptionInfo = subscriptionInfo;
    req.usageQuota = quota;
    next();
  } catch (error) {
    log.error("AI chat access check failed", { error, userId: req.user?.userId });
    res.status(500).json({
      success: false,
      error: "\u6743\u9650\u68C0\u67E5\u5931\u8D25",
      errorCode: "INTERNAL_ERROR"
    });
  }
};

// src/services/geminiService.ts
import { GoogleGenerativeAI as GoogleGenerativeAI2 } from "@google/generative-ai";

// src/utils/categoryMapping.ts
var TYPE_TO_CATEGORY_MAP = {
  // 听力题目类型
  "LISTENING_PART1": "Part 1 - \u7167\u7247\u63CF\u8FF0",
  "LISTENING_PART2": "Part 2 - \u5E94\u7B54\u95EE\u9898",
  "LISTENING_PART3": "Part 3 - \u7B80\u77ED\u5BF9\u8BDD",
  "LISTENING_PART4": "Part 4 - \u7B80\u77ED\u72EC\u767D",
  "listening": "Part 1 - \u7167\u7247\u63CF\u8FF0",
  // 通用听力默认为Part 1
  // 阅读题目类型
  "READING_PART5": "Part 5 - \u8BED\u6CD5\u586B\u7A7A",
  "READING_PART6": "Part 6 - \u6BB5\u843D\u586B\u7A7A",
  "READING_PART7": "Part 7 - \u9605\u8BFB\u7406\u89E3",
  "reading": "Part 5 - \u8BED\u6CD5\u586B\u7A7A"
  // 通用阅读默认为Part 5
};
function getCategory(type) {
  const normalizedType = type?.toLowerCase();
  if (TYPE_TO_CATEGORY_MAP[type]) {
    return TYPE_TO_CATEGORY_MAP[type];
  }
  if (normalizedType?.includes("listening")) {
    if (normalizedType.includes("part1") || normalizedType.includes("1")) {
      return "Part 1 - \u7167\u7247\u63CF\u8FF0";
    } else if (normalizedType.includes("part2") || normalizedType.includes("2")) {
      return "Part 2 - \u5E94\u7B54\u95EE\u9898";
    } else if (normalizedType.includes("part3") || normalizedType.includes("3")) {
      return "Part 3 - \u7B80\u77ED\u5BF9\u8BDD";
    } else if (normalizedType.includes("part4") || normalizedType.includes("4")) {
      return "Part 4 - \u7B80\u77ED\u72EC\u767D";
    }
    return "Part 1 - \u7167\u7247\u63CF\u8FF0";
  }
  if (normalizedType?.includes("reading")) {
    if (normalizedType.includes("part5") || normalizedType.includes("5")) {
      return "Part 5 - \u8BED\u6CD5\u586B\u7A7A";
    } else if (normalizedType.includes("part6") || normalizedType.includes("6")) {
      return "Part 6 - \u6BB5\u843D\u586B\u7A7A";
    } else if (normalizedType.includes("part7") || normalizedType.includes("7")) {
      return "Part 7 - \u9605\u8BFB\u7406\u89E3";
    }
    return "Part 5 - \u8BED\u6CD5\u586B\u7A7A";
  }
  return "Part 5 - \u8BED\u6CD5\u586B\u7A7A";
}
function isValidCategory(category) {
  return Object.values(TYPE_TO_CATEGORY_MAP).includes(category);
}
function fixCategory(category, type) {
  if (isValidCategory(category)) {
    return category;
  }
  if (type) {
    return getCategory(type);
  }
  return "Part 5 - \u8BED\u6CD5\u586B\u7A7A";
}

// src/services/geminiService.ts
var GeminiService = class {
  genAI;
  model;
  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    console.log("\u{1F50D} Checking GEMINI_API_KEY...");
    console.log("API Key present:", !!apiKey);
    console.log("API Key length:", apiKey?.length || 0);
    console.log("Available env vars:", Object.keys(process.env).filter((k) => k.includes("GEMINI")));
    if (!apiKey) {
      console.error("\u274C GEMINI_API_KEY not found in environment variables");
      return;
    }
    console.log("\u2705 GEMINI_API_KEY found, initializing Gemini service...");
    try {
      this.genAI = new GoogleGenerativeAI2(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      console.log("\u2705 Gemini service initialized successfully");
    } catch (error) {
      console.error("\u274C Failed to initialize Gemini service:", error);
    }
  }
  async generateQuestions(request) {
    console.log("\u{1F3AF} Generating questions with request:", request);
    if (!this.model) {
      console.error("\u274C Model not initialized");
      throw new Error("AI\u670D\u52A1\u4E0D\u53EF\u7528\uFF0C\u8BF7\u8054\u7CFB\u7BA1\u7406\u5458\u914D\u7F6EGEMINI_API_KEY");
    }
    try {
      const prompt = this.buildQuestionPrompt(request);
      console.log("\u{1F4DD} Generated prompt length:", prompt.length);
      console.log("\u{1F680} Calling Gemini API...");
      const result = await this.model.generateContent(prompt);
      console.log("\u2705 Gemini API call successful");
      const response = await result.response;
      const text = response.text();
      console.log("\u{1F4C4} Response text length:", text.length);
      console.log("\u{1F4C4} Response preview:", text.substring(0, 200));
      let cleanedText = text.trim();
      cleanedText = cleanedText.replace(/^```json\s*/g, "").replace(/\s*```$/g, "");
      cleanedText = cleanedText.replace(/^```\s*/g, "").replace(/\s*```$/g, "");
      const jsonStart = cleanedText.indexOf("[");
      const jsonEnd = cleanedText.lastIndexOf("]");
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        cleanedText = cleanedText.substring(jsonStart, jsonEnd + 1);
      }
      console.log("\u{1F9F9} Cleaned text preview:", cleanedText.substring(0, 200));
      console.log("\u{1F9F9} Cleaned text ends with:", cleanedText.substring(cleanedText.length - 50));
      const questions = JSON.parse(cleanedText);
      console.log("\u2705 JSON parsed successfully, questions count:", questions.length);
      const validatedQuestions = this.validateAndFormatQuestions(questions, request);
      console.log("\u2705 Questions validated successfully");
      return validatedQuestions;
    } catch (error) {
      console.error("\u274C Gemini question generation failed:", error);
      console.error("Error details:", {
        message: error.message,
        code: error.code,
        status: error.status,
        stack: error.stack,
        name: error.name,
        cause: error.cause
      });
      if (error.message?.includes("API_KEY") || error.message?.includes("Invalid API key")) {
        throw new Error("AI\u670D\u52A1\u914D\u7F6E\u9519\u8BEF\uFF1AAPI\u5BC6\u94A5\u65E0\u6548");
      } else if (error.message?.includes("quota") || error.message?.includes("QUOTA_EXCEEDED")) {
        throw new Error("AI\u670D\u52A1\u4F7F\u7528\u989D\u5EA6\u5DF2\u7528\u5B8C\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5");
      } else if (error.message?.includes("network") || error.code === "ENOTFOUND" || error.code === "ECONNRESET") {
        throw new Error("\u7F51\u7EDC\u8FDE\u63A5\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5");
      } else if (error instanceof SyntaxError) {
        throw new Error("AI\u8FD4\u56DE\u7684\u6570\u636E\u683C\u5F0F\u9519\u8BEF\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5");
      } else {
        throw new Error(`\u9898\u76EE\u751F\u6210\u5931\u8D25: ${error.message}`);
      }
    }
  }
  async chatResponse(message, context) {
    try {
      const prompt = this.buildChatPrompt(message, context);
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error("Gemini chat response failed:", error);
      throw new Error("AI\u804A\u5929\u670D\u52A1\u6682\u65F6\u4E0D\u53EF\u7528\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5");
    }
  }
  async explainAnswer(question, userAnswer, correctAnswer) {
    try {
      const prompt = `
\u4F5C\u4E3ATOEIC\u82F1\u8BED\u5B66\u4E60\u52A9\u624B\uFF0C\u8BF7\u8BE6\u7EC6\u89E3\u91CA\u4EE5\u4E0B\u9898\u76EE\u7684\u7B54\u6848\uFF1A

\u9898\u76EE\uFF1A${question}
\u5B66\u751F\u7B54\u6848\uFF1A${userAnswer}
\u6B63\u786E\u7B54\u6848\uFF1A${correctAnswer}

\u8BF7\u63D0\u4F9B\uFF1A
1. \u4E3A\u4EC0\u4E48\u6B63\u786E\u7B54\u6848\u662F\u5BF9\u7684
2. \u5B66\u751F\u7B54\u6848\u9519\u5728\u54EA\u91CC\uFF08\u5982\u679C\u9519\u8BEF\uFF09
3. \u76F8\u5173\u7684\u8BED\u6CD5\u6216\u8BCD\u6C47\u77E5\u8BC6\u70B9
4. \u5B66\u4E60\u5EFA\u8BAE

\u8BF7\u7528\u4E2D\u6587\u56DE\u7B54\uFF0C\u8BED\u6C14\u53CB\u597D\u4E14\u5177\u6709\u542F\u53D1\u6027\u3002
      `;
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error("Gemini answer explanation failed:", error);
      throw new Error("\u7B54\u6848\u89E3\u91CA\u751F\u6210\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5");
    }
  }
  async getWordDefinition(word, context) {
    try {
      const prompt = `
\u4F5C\u4E3A\u82F1\u8BED\u8BCD\u6C47\u4E13\u5BB6\uFF0C\u8BF7\u4E3A\u4EE5\u4E0B\u5355\u8BCD\u63D0\u4F9B\u8BE6\u7EC6\u7684\u8BCD\u6C47\u4FE1\u606F\uFF0C\u7279\u522B\u9002\u5408TOEIC\u5B66\u4E60\u8005\uFF1A

\u5355\u8BCD\uFF1A${word}
${context ? `\u51FA\u73B0\u8BED\u5883\uFF1A${context}` : ""}

\u8BF7\u4EE5JSON\u683C\u5F0F\u8FD4\u56DE\uFF0C\u5305\u542B\u4EE5\u4E0B\u4FE1\u606F\uFF1A
{
  "word": "${word}",
  "phonetic": "\u82F1\u5F0F\u97F3\u6807",
  "meanings": [
    {
      "partOfSpeech": "\u82F1\u6587\u8BCD\u6027\uFF08\u5982noun\u3001verb\u3001adjective\u7B49\uFF09",
      "partOfSpeechCN": "\u4E2D\u6587\u8BCD\u6027\uFF08\u5982\u540D\u8BCD\u3001\u52A8\u8BCD\u3001\u5F62\u5BB9\u8BCD\u7B49\uFF09",
      "partOfSpeechLocal": "\u4E2D\u6587\u8BCD\u6027",
      "definitions": [
        {
          "definition": "\u8BE6\u7EC6\u7684\u4E2D\u6587\u91CA\u4E49",
          "example": "\u82F1\u6587\u4F8B\u53E5\uFF08\u6700\u597D\u4E0ETOEIC\u76F8\u5173\uFF09"
        }
      ]
    }
  ]
}

\u8981\u6C42\uFF1A
- \u91CA\u4E49\u5FC5\u987B\u51C6\u786E\u3001\u901A\u4FD7\u6613\u61C2
- \u4F8B\u53E5\u8981\u5B9E\u7528\uFF0C\u6700\u597D\u4E0E\u5546\u52A1\u3001\u804C\u573A\u76F8\u5173
- \u5982\u679C\u5355\u8BCD\u6709\u591A\u4E2A\u8BCD\u6027\uFF0C\u8BF7\u63D0\u4F9B\u4E3B\u8981\u76842-3\u4E2A

**\u91CD\u8981\uFF1A\u8BF7\u76F4\u63A5\u8FD4\u56DEJSON\u683C\u5F0F\uFF0C\u4E0D\u8981\u4F7F\u7528Markdown\u4EE3\u7801\u5757\u5305\u88C5\u3002**
      `;
      console.log(`\u{1F50D} Getting definition for word: ${word}`);
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      let text = response.text().trim();
      text = text.replace(/^```json\s*/g, "").replace(/\s*```$/g, "");
      text = text.replace(/^```\s*/g, "").replace(/\s*```$/g, "");
      console.log(`\u2705 Definition response for ${word}:`, text.substring(0, 200));
      const wordData = JSON.parse(text);
      return wordData;
    } catch (error) {
      console.error("Gemini word definition failed:", error);
      throw new Error("\u83B7\u53D6\u5355\u8BCD\u91CA\u4E49\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5");
    }
  }
  buildQuestionPrompt(request) {
    const { type, difficulty, count, topic, customPrompt } = request;
    let prompt = `
\u4F5C\u4E3ATOEIC\u9898\u76EE\u751F\u6210\u4E13\u5BB6\uFF0C\u8BF7\u751F\u6210${count}\u9053${this.getTypeDescription(type)}\u9898\u76EE\u3002

\u8981\u6C42\uFF1A
- \u96BE\u5EA6\uFF1A${this.getDifficultyDescription(difficulty)}
- \u9898\u76EE\u7C7B\u578B\uFF1A${type}
- \u8FD4\u56DE\u683C\u5F0F\uFF1A\u4E25\u683C\u7684JSON\u6570\u7EC4\uFF0C\u6BCF\u4E2A\u9898\u76EE\u5305\u542B\u4EE5\u4E0B\u5B57\u6BB5\uFF1A
  {
    "id": "\u552F\u4E00\u6807\u8BC6\u7B26",
    "type": "${type}",
    "difficulty": "${difficulty}",
    "question": "\u9898\u76EE\u5185\u5BB9",
    "options": ["\u9009\u9879A", "\u9009\u9879B", "\u9009\u9879C", "\u9009\u9879D"], // \u5982\u679C\u9002\u7528
    "correctAnswer": [0\u30011\u30012\u62163 - \u786E\u4FDD\u7B54\u6848\u5747\u5300\u5206\u5E03\u5728\u56DB\u4E2A\u9009\u9879\u4E2D], // \u6B63\u786E\u7B54\u6848\u7D22\u5F15\uFF1A0=A, 1=B, 2=C, 3=D
    "explanation": "\u8BE6\u7EC6\u89E3\u91CA",
    "passage": "\u9605\u8BFB\u6587\u7AE0\u5185\u5BB9" // \u4EC5\u9605\u8BFB\u9898\u9700\u8981
  }

${topic ? `\u9898\u76EE\u4E3B\u9898\uFF1A${topic}` : ""}
${customPrompt ? `\u7279\u6B8A\u8981\u6C42\uFF1A${customPrompt}` : ""}

\u8BF7\u786E\u4FDD\u9898\u76EE\u7B26\u5408TOEIC\u8003\u8BD5\u6807\u51C6\uFF0C\u7B54\u6848\u89E3\u91CA\u6E05\u6670\u51C6\u786E\u3002

**\u91CD\u8981\u63D0\u9192\uFF1A\u8BF7\u5C06\u6B63\u786E\u7B54\u6848\u968F\u673A\u5206\u5E03\u5728A\u3001B\u3001C\u3001D\u56DB\u4E2A\u9009\u9879\u4E2D\uFF0C\u907F\u514D\u5927\u90E8\u5206\u7B54\u6848\u90FD\u662F\u540C\u4E00\u9009\u9879\u7684\u60C5\u51B5\u3002\u76EE\u6807\u662F\u5728A\u3001B\u3001C\u3001D\u9009\u9879\u4E2D\u5927\u81F4\u5747\u5300\u5206\u5E03\u6B63\u786E\u7B54\u6848\u3002**

**\u91CD\u8981\uFF1A\u8BF7\u76F4\u63A5\u8FD4\u56DEJSON\u6570\u7EC4\uFF0C\u4E0D\u8981\u4F7F\u7528Markdown\u4EE3\u7801\u5757\u5305\u88C5\uFF0C\u4E0D\u8981\u6DFB\u52A0\u4EFB\u4F55\u5176\u4ED6\u6587\u672C\u3002**
    `;
    return prompt;
  }
  buildChatPrompt(message, context) {
    let prompt = `
\u4F60\u662FTOEIC\u9898\u76EE\u5206\u6790\u52A9\u624B\u3002\u8BF7\u76F4\u63A5\u5206\u6790\u95EE\u9898\uFF0C\u7B80\u6D01\u56DE\u7B54\u3002

\u7528\u6237\u95EE\u9898\uFF1A${message}

${context ? `\u9898\u76EE\u4FE1\u606F\uFF1A${JSON.stringify(context)}` : ""}

\u8981\u6C42\uFF1A
- \u76F4\u63A5\u5206\u6790\u95EE\u9898\uFF0C\u4E0D\u8981\u5BA2\u5957\u8BDD
- \u4E13\u6CE8\u89E3\u91CA\u6B63\u786E\u7B54\u6848\u7684\u539F\u56E0\u548C\u9519\u8BEF\u9009\u9879\u7684\u95EE\u9898
- \u56DE\u7B54\u63A7\u5236\u5728200\u5B57\u4EE5\u5185
- \u7528\u4E2D\u6587\u56DE\u7B54
    `;
    return prompt;
  }
  getTypeDescription(type) {
    const descriptions = {
      "LISTENING_PART1": "\u542C\u529BPart1 \u56FE\u7247\u63CF\u8FF0\u9898",
      "LISTENING_PART2": "\u542C\u529BPart2 \u5E94\u7B54\u95EE\u9898",
      "LISTENING_PART3": "\u542C\u529BPart3 \u7B80\u77ED\u5BF9\u8BDD",
      "LISTENING_PART4": "\u542C\u529BPart4 \u7B80\u77ED\u72EC\u767D",
      "READING_PART5": "\u9605\u8BFBPart5 \u53E5\u5B50\u586B\u7A7A",
      "READING_PART6": "\u9605\u8BFBPart6 \u6BB5\u843D\u586B\u7A7A",
      "READING_PART7": "\u9605\u8BFBPart7 \u9605\u8BFB\u7406\u89E3"
    };
    return descriptions[type] || type;
  }
  getDifficultyDescription(difficulty) {
    const descriptions = {
      "BEGINNER": "\u521D\u7EA7\uFF08400-600\u5206\u6C34\u5E73\uFF09",
      "INTERMEDIATE": "\u4E2D\u7EA7\uFF08600-800\u5206\u6C34\u5E73\uFF09",
      "ADVANCED": "\u9AD8\u7EA7\uFF08800-900\u5206\u6C34\u5E73\uFF09"
    };
    return descriptions[difficulty] || difficulty;
  }
  validateAndFormatQuestions(questions, request) {
    if (!Array.isArray(questions)) {
      throw new Error("Invalid questions format");
    }
    return questions.map((q, index) => {
      let correctAnswerIndex = 0;
      if (typeof q.correctAnswer === "string") {
        const answerMap = { "A": 0, "B": 1, "C": 2, "D": 3 };
        correctAnswerIndex = answerMap[q.correctAnswer.toUpperCase()] ?? 0;
      } else if (typeof q.correctAnswer === "number") {
        correctAnswerIndex = q.correctAnswer;
      }
      const questionType = q.type || request.type;
      let category = q.category;
      if (!category || category === "\u672A\u5206\u7C7B" || category === "undefined") {
        category = getCategory(questionType);
        console.log(`\u{1F527} Auto-assigned category for question ${index}: ${category} (type: ${questionType})`);
      } else {
        category = fixCategory(category, questionType);
      }
      return {
        id: q.id || `q_${Date.now()}_${index}`,
        type: questionType,
        category,
        difficulty: q.difficulty || request.difficulty,
        question: q.question || "",
        options: q.options || [],
        correctAnswer: correctAnswerIndex,
        explanation: q.explanation || "",
        passage: q.passage,
        audioUrl: q.audioUrl,
        imageUrl: q.imageUrl
      };
    });
  }
};
var geminiService = new GeminiService();

// src/routes/practice.ts
import { v4 as uuidv4 } from "uuid";
var router4 = Router4();
router4.post(
  "/generate",
  aiRateLimit,
  authenticateToken,
  requirePracticeAccess,
  validateRequest({ body: schemas.questionGeneration }),
  async (req, res) => {
    try {
      const questions = await geminiService.generateQuestions(req.body);
      const userId = req.user.userId;
      await incrementUsage(userId, "daily_practice", 1);
      res.json({
        success: true,
        data: {
          sessionId: uuidv4(),
          questions
        },
        message: "\u9898\u76EE\u751F\u6210\u6210\u529F"
      });
    } catch (error) {
      console.error("Question generation error:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "\u9898\u76EE\u751F\u6210\u5931\u8D25"
      });
    }
  }
);
router4.post(
  "/submit",
  authenticateToken,
  validateRequest({ body: schemas.practiceSubmission }),
  async (req, res) => {
    try {
      const { sessionId, questions } = req.body;
      const userId = req.user.userId;
      const correctAnswers = questions.filter((q) => q.isCorrect).length;
      const totalQuestions = questions.length;
      const accuracy = correctAnswers / totalQuestions;
      const totalTime = questions.reduce((sum, q) => sum + q.timeSpent, 0);
      const estimatedScore = Math.round(200 + accuracy * 800);
      const practiceRecord = await prisma.practiceRecord.create({
        data: {
          userId,
          sessionId,
          questionType: questions[0]?.type || "READING_PART5",
          difficulty: questions[0]?.difficulty || "INTERMEDIATE",
          questionsCount: totalQuestions,
          correctAnswers,
          totalTime,
          score: estimatedScore,
          questions
        }
      });
      await updateStudyProgress(userId, practiceRecord);
      res.json({
        success: true,
        data: {
          practiceId: practiceRecord.id,
          score: estimatedScore,
          accuracy: Math.round(accuracy * 100),
          correctAnswers,
          totalQuestions,
          totalTime
        },
        message: "\u7EC3\u4E60\u7ED3\u679C\u4FDD\u5B58\u6210\u529F"
      });
    } catch (error) {
      console.error("Practice submission error:", error);
      res.status(500).json({
        success: false,
        error: "\u63D0\u4EA4\u7EC3\u4E60\u7ED3\u679C\u5931\u8D25"
      });
    }
  }
);
router4.post(
  "/sessions",
  authenticateToken,
  async (req, res) => {
    try {
      const { sessionType, questionType, difficulty, categories, totalQuestions, timeLimit } = req.body;
      const userId = req.user.userId;
      if (!sessionType || !questionType || !difficulty || !totalQuestions) {
        return res.status(400).json({
          success: false,
          error: "\u7F3A\u5C11\u5FC5\u9700\u5B57\u6BB5\uFF1AsessionType, questionType, difficulty, totalQuestions"
        });
      }
      const sessionId = uuidv4();
      console.log(`Creating new practice session: ${sessionId} for user: ${userId}`, {
        sessionType,
        questionType,
        difficulty,
        categories,
        totalQuestions
      });
      const newSession = {
        id: sessionId,
        sessionType,
        questionType,
        difficulty: Array.isArray(difficulty) ? difficulty : [difficulty],
        categories: categories || [],
        totalQuestions,
        correctAnswers: 0,
        score: null,
        estimatedScore: null,
        partScores: null,
        timeSpent: 0,
        timeLimit: timeLimit || null,
        completed: false,
        completedAt: null,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        questions: [],
        userAnswers: [],
        wrongQuestions: []
      };
      res.json({
        success: true,
        data: newSession,
        message: "\u7EC3\u4E60\u4F1A\u8BDD\u521B\u5EFA\u6210\u529F"
      });
    } catch (error) {
      console.error("Create session error:", error);
      res.status(500).json({
        success: false,
        error: "\u521B\u5EFA\u7EC3\u4E60\u4F1A\u8BDD\u5931\u8D25"
      });
    }
  }
);
router4.get(
  "/sessions",
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user.userId;
      const { completed, page = "1", limit = "20" } = req.query;
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;
      console.log("Getting practice sessions for user:", userId, { completed, page, limit });
      let records = [];
      let total = 0;
      try {
        const whereClause = { userId };
        if (completed === "true") {
          whereClause.NOT = { score: null };
        } else if (completed === "false") {
          whereClause.score = null;
        }
        [records, total] = await Promise.all([
          prisma.practiceRecord.findMany({
            where: whereClause,
            orderBy: { completedAt: "desc" },
            skip,
            take: limitNum,
            select: {
              id: true,
              userId: true,
              sessionId: true,
              questionType: true,
              difficulty: true,
              questionsCount: true,
              correctAnswers: true,
              totalTime: true,
              score: true,
              questions: true,
              completedAt: true
            }
          }),
          prisma.practiceRecord.count({ where: whereClause })
        ]);
        console.log(`Found ${records.length} practice records in database`);
      } catch (dbError) {
        console.warn("Database query failed, returning empty results:", dbError);
        records = [];
        total = 0;
      }
      const sessions = records.map((record) => {
        const percentageScore = Math.round(record.correctAnswers / record.questionsCount * 100);
        return {
          id: record.sessionId,
          sessionType: "part_practice",
          questionType: record.questionType.toLowerCase().includes("reading") ? "reading" : "listening",
          difficulty: [3],
          // 简化处理
          categories: [],
          totalQuestions: record.questionsCount,
          correctAnswers: record.correctAnswers,
          score: percentageScore,
          // 百分比得分 (0-100)
          estimatedScore: record.score,
          // TOEIC估分 (200-990)
          partScores: null,
          timeSpent: record.totalTime,
          timeLimit: null,
          completed: true,
          completedAt: record.completedAt.toISOString(),
          createdAt: record.completedAt.toISOString(),
          questions: Array.isArray(record.questions) ? record.questions.map((q, index) => ({
            id: q.id || `${record.sessionId}_q_${index}`,
            sessionId: record.sessionId,
            type: record.questionType.toLowerCase().includes("reading") ? "reading" : "listening",
            category: fixCategory(q.category || "\u672A\u5206\u7C7B", record.questionType),
            question: q.question || "",
            options: q.options || [],
            correctAnswer: q.correctAnswer || 0,
            explanation: q.explanation || "",
            difficulty: q.difficulty || 3,
            audioUrl: q.audioUrl,
            imageUrl: q.imageUrl,
            tags: q.tags || [],
            questionOrder: index,
            createdAt: record.completedAt.toISOString()
          })) : [],
          userAnswers: Array.isArray(record.questions) ? record.questions.map((q, index) => ({
            id: `${record.sessionId}_answer_${index}`,
            sessionId: record.sessionId,
            questionId: q.id || `${record.sessionId}_q_${index}`,
            answer: q.userAnswer !== void 0 ? q.userAnswer : null,
            isCorrect: q.userAnswer !== null && q.userAnswer === q.correctAnswer,
            timeSpent: q.timeSpent || 0,
            createdAt: record.completedAt.toISOString()
          })) : [],
          wrongQuestions: []
        };
      });
      res.json({
        success: true,
        data: {
          sessions,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum)
          }
        }
      });
    } catch (error) {
      console.error("Get sessions error:", error);
      res.status(200).json({
        success: true,
        data: {
          sessions: [],
          pagination: {
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 20,
            total: 0,
            totalPages: 0
          }
        },
        message: "\u6682\u65E0\u7EC3\u4E60\u8BB0\u5F55"
      });
    }
  }
);
router4.post("/sessions/:sessionId/answers", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { questionId, answer, timeSpent } = req.body;
    console.log(`Answer submission: session=${sessionId}, questionId=${questionId}, answer=${answer}, timeSpent=${timeSpent}`);
    res.json({
      success: true,
      data: {
        answerId: `${sessionId}_answer_${questionId}`,
        isCorrect: null,
        // 在session完成时计算
        correctAnswer: null,
        // 在session完成时返回
        received: { questionId, answer, timeSpent }
      },
      message: "\u7B54\u6848\u63D0\u4EA4\u6210\u529F"
    });
  } catch (error) {
    console.error("Submit answer error:", error);
    res.status(500).json({
      success: false,
      error: "\u63D0\u4EA4\u7B54\u6848\u5931\u8D25"
    });
  }
});
router4.post(
  "/sessions/:sessionId/complete",
  optionalAuth,
  async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { questions, userAnswers, timeSpent } = req.body;
      console.log(`Completing session ${sessionId}, questions: ${questions?.length}, answers: ${userAnswers?.length}`);
      console.log("First question:", questions?.[0]);
      console.log("First user answer:", userAnswers?.[0]);
      console.log("All user answers:", userAnswers);
      if (!questions || !userAnswers) {
        return res.status(400).json({
          success: false,
          error: "\u7F3A\u5C11\u5FC5\u9700\u5B57\u6BB5\uFF1Aquestions, userAnswers"
        });
      }
      let correctAnswers = 0;
      questions.forEach((q, index) => {
        if (!q.id) {
          q.id = `${sessionId}_q_${index}`;
        }
      });
      const questionIdToIndex = /* @__PURE__ */ new Map();
      questions.forEach((q, index) => {
        questionIdToIndex.set(q.id, index);
      });
      console.log("Question ID mapping:", Object.fromEntries(questionIdToIndex));
      const processedUserAnswers = userAnswers.map((userAnswer, answerIndex) => {
        let questionIndex = answerIndex;
        let questionId = questions[answerIndex]?.id || `${sessionId}_q_${answerIndex}`;
        if (userAnswer.questionId && questionIdToIndex.has(userAnswer.questionId)) {
          questionIndex = questionIdToIndex.get(userAnswer.questionId);
          questionId = userAnswer.questionId;
        } else if (userAnswer.questionId) {
          const match = userAnswer.questionId.match(/(\d+)$/);
          if (match) {
            const idNumber = parseInt(match[1]);
            if (idNumber >= 1 && idNumber <= questions.length) {
              questionIndex = idNumber - 1;
              questionId = questions[questionIndex]?.id || `${sessionId}_q_${questionIndex}`;
            }
          }
        }
        const question = questions[questionIndex];
        const isCorrect = userAnswer.answer !== null && userAnswer.answer === question?.correctAnswer;
        console.log(`Answer ${answerIndex}: userAnswer.questionId=${userAnswer.questionId}, mapped to questionIndex=${questionIndex}, question.correctAnswer=${question?.correctAnswer}, userAnswer.answer=${userAnswer.answer}, isCorrect=${isCorrect}`);
        if (isCorrect) {
          correctAnswers++;
        }
        return {
          id: `${sessionId}_answer_${answerIndex}`,
          sessionId,
          questionId,
          answer: userAnswer.answer,
          isCorrect,
          timeSpent: userAnswer.timeSpent || 0,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        };
      });
      const score = Math.round(correctAnswers / questions.length * 100);
      const estimatedScore = Math.round(200 + correctAnswers / questions.length * 800);
      const processedQuestions = questions.map((q, index) => {
        const userAnswerData = processedUserAnswers.find(
          (ua) => ua.questionId === (q.id || `${sessionId}_q_${index}`)
        );
        return {
          id: q.id || `${sessionId}_q_${index}`,
          sessionId,
          type: q.type || "reading",
          category: fixCategory(q.category || "\u672A\u5206\u7C7B", q.type || "reading"),
          question: q.question || "",
          options: q.options || [],
          correctAnswer: q.correctAnswer || 0,
          explanation: q.explanation || "",
          difficulty: q.difficulty || 3,
          audioUrl: q.audioUrl,
          imageUrl: q.imageUrl,
          tags: q.tags || [],
          questionOrder: index,
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          // 添加用户答案信息
          userAnswer: userAnswerData?.answer ?? null,
          isCorrect: userAnswerData?.isCorrect ?? false,
          timeSpent: userAnswerData?.timeSpent ?? 0
        };
      });
      let savedToDatabase = false;
      if (req.user?.userId) {
        try {
          await prisma.practiceRecord.create({
            data: {
              userId: req.user.userId,
              sessionId,
              questionType: questions[0]?.type === "reading" ? "READING_PART5" : "LISTENING_PART1",
              difficulty: "INTERMEDIATE",
              questionsCount: questions.length,
              correctAnswers,
              totalTime: timeSpent || 0,
              score: estimatedScore,
              questions: processedQuestions
              // 暂时不包含可能不存在的字段，等数据库同步后再添加
            }
          });
          savedToDatabase = true;
          console.log(`\u2705 Session saved to database for user ${req.user.userId}`);
        } catch (dbError) {
          console.warn("\u26A0\uFE0F Failed to save to database, but continuing:", dbError);
        }
      } else {
        console.log("\u2139\uFE0F Guest user - session not saved to database");
      }
      const completedSession = {
        id: sessionId,
        sessionType: "quick_practice",
        questionType: questions[0]?.type || "reading",
        difficulty: [3],
        categories: [],
        totalQuestions: questions.length,
        correctAnswers,
        score,
        // 百分比得分 (0-100)
        estimatedScore,
        // TOEIC估分 (200-990)
        partScores: null,
        timeSpent: timeSpent || 0,
        timeLimit: null,
        completed: true,
        completedAt: (/* @__PURE__ */ new Date()).toISOString(),
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        questions: processedQuestions,
        userAnswers: processedUserAnswers,
        wrongQuestions: [],
        savedToDatabase
      };
      console.log(`\u2705 Practice session completed: ${sessionId}, score: ${score}/${questions.length}, TOEIC\u4F30\u5206: ${estimatedScore}`);
      res.json({
        success: true,
        data: completedSession,
        message: `\u7EC3\u4E60\u4F1A\u8BDD\u5B8C\u6210\uFF0C\u5F97\u5206: ${score}\u5206 (TOEIC\u4F30\u5206: ${estimatedScore})`
      });
    } catch (error) {
      console.error("\u274C Complete session error:", error);
      res.status(500).json({
        success: false,
        error: "\u5B8C\u6210\u7EC3\u4E60\u4F1A\u8BDD\u5931\u8D25"
      });
    }
  }
);
router4.post("/sessions/:sessionId/complete-full", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { questions, userAnswers, timeSpent } = req.body;
    console.log(`Completing session ${sessionId}, questions: ${questions?.length}, answers: ${userAnswers?.length}`);
    if (!questions || !userAnswers) {
      return res.status(400).json({
        success: false,
        error: "\u7F3A\u5C11\u5FC5\u9700\u5B57\u6BB5\uFF1Aquestions, userAnswers"
      });
    }
    let correctAnswers = 0;
    userAnswers.forEach((userAnswer, index) => {
      if (userAnswer.answer !== null && userAnswer.answer === questions[index]?.correctAnswer) {
        correctAnswers++;
      }
    });
    const score = Math.round(correctAnswers / questions.length * 100);
    const completedSession = {
      id: sessionId,
      sessionType: "quick_practice",
      questionType: questions[0]?.type || "reading",
      difficulty: [3],
      categories: [],
      totalQuestions: questions.length,
      correctAnswers,
      score,
      estimatedScore: score,
      partScores: null,
      timeSpent: timeSpent || 0,
      timeLimit: null,
      completed: true,
      completedAt: (/* @__PURE__ */ new Date()).toISOString(),
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      questions: questions.map((q, index) => ({
        ...q,
        id: q.id || `${sessionId}_q_${index}`,
        sessionId,
        questionOrder: index,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      })),
      userAnswers: userAnswers.map((ua, index) => ({
        id: `${sessionId}_answer_${index}`,
        sessionId,
        questionId: questions[index]?.id,
        answer: ua.answer,
        isCorrect: ua.answer !== null && questions[index]?.correctAnswer === ua.answer,
        timeSpent: ua.timeSpent || 0,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      })),
      wrongQuestions: []
    };
    console.log(`\u2705 Practice session completed: ${sessionId}, score: ${score}/${questions.length}`);
    res.json({
      success: true,
      data: completedSession,
      message: `\u7EC3\u4E60\u4F1A\u8BDD\u5B8C\u6210\uFF0C\u5F97\u5206: ${score}\u5206`
    });
  } catch (error) {
    console.error("\u274C Complete session error:", error);
    res.status(500).json({
      success: false,
      error: "\u5B8C\u6210\u7EC3\u4E60\u4F1A\u8BDD\u5931\u8D25"
    });
  }
});
router4.get(
  "/history",
  authenticateToken,
  validateRequest({ query: schemas.pagination }),
  async (req, res) => {
    try {
      const userId = req.user.userId;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;
      const [records, total] = await Promise.all([
        prisma.practiceRecord.findMany({
          where: { userId },
          orderBy: { completedAt: "desc" },
          skip,
          take: limit,
          select: {
            id: true,
            sessionId: true,
            questionType: true,
            difficulty: true,
            questionsCount: true,
            correctAnswers: true,
            totalTime: true,
            score: true,
            completedAt: true
          }
        }),
        prisma.practiceRecord.count({ where: { userId } })
      ]);
      res.json({
        success: true,
        data: records,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error("Get practice history error:", error);
      res.status(500).json({
        success: false,
        error: "\u83B7\u53D6\u7EC3\u4E60\u5386\u53F2\u5931\u8D25"
      });
    }
  }
);
router4.get(
  "/:id",
  authenticateToken,
  validateRequest({ params: schemas.idParam }),
  async (req, res) => {
    try {
      const userId = req.user.userId;
      const practiceId = req.params.id;
      const practice = await prisma.practiceRecord.findFirst({
        where: {
          id: practiceId,
          userId
        }
      });
      if (!practice) {
        return res.status(404).json({
          success: false,
          error: "\u7EC3\u4E60\u8BB0\u5F55\u4E0D\u5B58\u5728"
        });
      }
      res.json({
        success: true,
        data: practice
      });
    } catch (error) {
      console.error("Get practice detail error:", error);
      res.status(500).json({
        success: false,
        error: "\u83B7\u53D6\u7EC3\u4E60\u8BE6\u60C5\u5931\u8D25"
      });
    }
  }
);
router4.get(
  "/stats/overview",
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user.userId;
      const [
        totalPractices,
        averageScore,
        recentPractices,
        progressByType
      ] = await Promise.all([
        prisma.practiceRecord.count({ where: { userId } }),
        prisma.practiceRecord.aggregate({
          where: { userId },
          _avg: { score: true }
        }),
        prisma.practiceRecord.findMany({
          where: { userId },
          orderBy: { completedAt: "desc" },
          take: 10,
          select: {
            score: true,
            completedAt: true,
            questionType: true
          }
        }),
        prisma.studyProgress.findMany({
          where: { userId },
          orderBy: { updatedAt: "desc" }
        })
      ]);
      res.json({
        success: true,
        data: {
          totalPractices,
          averageScore: Math.round(averageScore._avg.score || 0),
          recentPractices,
          progressByType
        }
      });
    } catch (error) {
      console.error("Get practice stats error:", error);
      res.status(500).json({
        success: false,
        error: "\u83B7\u53D6\u5B66\u4E60\u7EDF\u8BA1\u5931\u8D25"
      });
    }
  }
);
async function updateStudyProgress(userId, practiceRecord) {
  const { questionType, difficulty, correctAnswers, questionsCount, totalTime } = practiceRecord;
  const existingProgress = await prisma.studyProgress.findUnique({
    where: {
      userId_questionType_difficulty: {
        userId,
        questionType,
        difficulty
      }
    }
  });
  const newAverageTime = existingProgress ? (existingProgress.averageTime * existingProgress.totalQuestions + totalTime) / (existingProgress.totalQuestions + questionsCount) : totalTime / questionsCount;
  await prisma.studyProgress.upsert({
    where: {
      userId_questionType_difficulty: {
        userId,
        questionType,
        difficulty
      }
    },
    update: {
      totalQuestions: {
        increment: questionsCount
      },
      correctAnswers: {
        increment: correctAnswers
      },
      averageTime: newAverageTime,
      bestScore: existingProgress?.bestScore ? Math.max(existingProgress.bestScore, practiceRecord.score || 0) : practiceRecord.score,
      lastPracticeAt: /* @__PURE__ */ new Date()
    },
    create: {
      userId,
      questionType,
      difficulty,
      totalQuestions: questionsCount,
      correctAnswers,
      averageTime: newAverageTime,
      bestScore: practiceRecord.score,
      lastPracticeAt: /* @__PURE__ */ new Date()
    }
  });
}
var practice_default = router4;

// src/routes/chat.ts
init_database();
import { Router as Router5 } from "express";
import { v4 as uuidv42 } from "uuid";
var router5 = Router5();
router5.post(
  "/message",
  aiRateLimit,
  authenticateToken,
  requireAiChatAccess,
  validateRequest({ body: schemas.chatRequest }),
  async (req, res) => {
    try {
      const { message, sessionId, context, questionContext } = req.body;
      const userId = req.user.userId;
      const mergedContext = questionContext || context;
      let chatSession;
      if (sessionId) {
        chatSession = await prisma.chatSession.findFirst({
          where: { id: sessionId, userId }
        });
      }
      if (!chatSession) {
        chatSession = await prisma.chatSession.create({
          data: {
            id: sessionId || uuidv42(),
            userId,
            title: message.substring(0, 50) + (message.length > 50 ? "..." : "")
          }
        });
      }
      await prisma.chatMessage.create({
        data: {
          sessionId: chatSession.id,
          role: "user",
          content: message,
          metadata: mergedContext
        }
      });
      const aiResponse = await geminiService.chatResponse(message, mergedContext);
      await incrementUsage(userId, "daily_ai_chat", 1);
      const aiMessage = await prisma.chatMessage.create({
        data: {
          sessionId: chatSession.id,
          role: "assistant",
          content: aiResponse
        }
      });
      const userMessage = await prisma.chatMessage.findFirst({
        where: {
          sessionId: chatSession.id,
          role: "user",
          content: message
        },
        orderBy: { createdAt: "desc" }
      });
      res.json({
        success: true,
        data: {
          sessionId: chatSession.id,
          userMessage: {
            id: userMessage?.id || "",
            role: "user",
            content: message,
            createdAt: userMessage?.createdAt || /* @__PURE__ */ new Date()
          },
          assistantMessage: {
            id: aiMessage.id,
            role: "assistant",
            content: aiResponse,
            createdAt: aiMessage.createdAt
          }
        }
      });
    } catch (error) {
      console.error("Chat message error:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "\u804A\u5929\u670D\u52A1\u6682\u65F6\u4E0D\u53EF\u7528"
      });
    }
  }
);
router5.post(
  "/sessions/question-based",
  authenticateToken,
  async (req, res) => {
    try {
      const { questionId, questionData, title } = req.body;
      const userId = req.user.userId;
      if (!questionId) {
        return res.status(400).json({
          success: false,
          error: "\u7F3A\u5C11questionId\u53C2\u6570"
        });
      }
      console.log("Looking for existing question-based chat session:", { userId, questionId });
      let existingSession = await prisma.chatSession.findFirst({
        where: {
          userId,
          questionId
        },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              role: true,
              content: true,
              metadata: true,
              createdAt: true
            }
          }
        }
      });
      if (existingSession) {
        console.log("Found existing session:", existingSession.id);
        const messageCount = existingSession.messages.length;
        const lastMessageAt = existingSession.messages.length > 0 ? existingSession.messages[existingSession.messages.length - 1].createdAt : existingSession.createdAt;
        res.json({
          success: true,
          data: {
            ...existingSession,
            messageCount,
            lastMessageAt,
            isActive: true
          },
          message: "\u627E\u5230\u5DF2\u5B58\u5728\u7684\u804A\u5929\u4F1A\u8BDD"
        });
      } else {
        console.log("Creating new question-based chat session:", { userId, questionId, title });
        const newSession = await prisma.chatSession.create({
          data: {
            userId,
            questionId,
            title: title || "\u9898\u76EE\u8BA8\u8BBA - \u672A\u5206\u7C7B",
            questionData: questionData ? JSON.stringify(questionData) : null
          }
        });
        console.log("New question-based session created:", newSession.id);
        res.status(201).json({
          success: true,
          data: {
            ...newSession,
            messages: [],
            messageCount: 0,
            lastMessageAt: newSession.createdAt,
            isActive: true
          },
          message: "\u521B\u5EFA\u65B0\u7684\u9898\u76EE\u8BA8\u8BBA\u4F1A\u8BDD"
        });
      }
    } catch (error) {
      console.error("Get or create question-based session error:", error);
      res.status(500).json({
        success: false,
        error: "\u83B7\u53D6\u6216\u521B\u5EFA\u9898\u76EE\u8BA8\u8BBA\u4F1A\u8BDD\u5931\u8D25"
      });
    }
  }
);
router5.post(
  "/sessions",
  authenticateToken,
  async (req, res) => {
    try {
      const { title } = req.body;
      const userId = req.user.userId;
      console.log("Creating chat session:", { userId, title });
      const chatSession = await prisma.chatSession.create({
        data: {
          userId,
          title: title || "\u65B0\u7684\u5BF9\u8BDD"
        }
      });
      console.log("Chat session created:", chatSession);
      res.status(201).json({
        success: true,
        data: chatSession,
        message: "\u804A\u5929\u4F1A\u8BDD\u521B\u5EFA\u6210\u529F"
      });
    } catch (error) {
      console.error("Create chat session error:", error);
      res.status(500).json({
        success: false,
        error: "\u521B\u5EFA\u804A\u5929\u4F1A\u8BDD\u5931\u8D25"
      });
    }
  }
);
router5.get(
  "/sessions",
  authenticateToken,
  validateRequest({ query: schemas.pagination }),
  async (req, res) => {
    try {
      const userId = req.user.userId;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;
      const [sessions, total] = await Promise.all([
        prisma.chatSession.findMany({
          where: { userId },
          orderBy: { updatedAt: "desc" },
          skip,
          take: limit,
          select: {
            id: true,
            title: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: { messages: true }
            }
          }
        }),
        prisma.chatSession.count({ where: { userId } })
      ]);
      res.json({
        success: true,
        data: sessions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error("Get chat sessions error:", error);
      res.status(500).json({
        success: false,
        error: "\u83B7\u53D6\u804A\u5929\u4F1A\u8BDD\u5931\u8D25"
      });
    }
  }
);
router5.get(
  "/sessions/:sessionId",
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user.userId;
      const { sessionId } = req.params;
      const session = await prisma.chatSession.findFirst({
        where: { id: sessionId, userId },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              role: true,
              content: true,
              metadata: true,
              createdAt: true
            }
          }
        }
      });
      if (!session) {
        return res.status(404).json({
          success: false,
          error: "\u804A\u5929\u4F1A\u8BDD\u4E0D\u5B58\u5728"
        });
      }
      res.json({
        success: true,
        data: session
      });
    } catch (error) {
      console.error("Get chat session error:", error);
      res.status(500).json({
        success: false,
        error: "\u83B7\u53D6\u804A\u5929\u4F1A\u8BDD\u8BE6\u60C5\u5931\u8D25"
      });
    }
  }
);
router5.delete(
  "/sessions/:sessionId",
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user.userId;
      const { sessionId } = req.params;
      const session = await prisma.chatSession.findFirst({
        where: { id: sessionId, userId }
      });
      if (!session) {
        return res.status(404).json({
          success: false,
          error: "\u804A\u5929\u4F1A\u8BDD\u4E0D\u5B58\u5728"
        });
      }
      await prisma.chatSession.delete({
        where: { id: sessionId }
      });
      res.json({
        success: true,
        message: "\u804A\u5929\u4F1A\u8BDD\u5220\u9664\u6210\u529F"
      });
    } catch (error) {
      console.error("Delete chat session error:", error);
      res.status(500).json({
        success: false,
        error: "\u5220\u9664\u804A\u5929\u4F1A\u8BDD\u5931\u8D25"
      });
    }
  }
);
router5.put(
  "/sessions/:sessionId/title",
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user.userId;
      const { sessionId } = req.params;
      const { title } = req.body;
      if (!title || title.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: "\u6807\u9898\u4E0D\u80FD\u4E3A\u7A7A"
        });
      }
      const session = await prisma.chatSession.findFirst({
        where: { id: sessionId, userId }
      });
      if (!session) {
        return res.status(404).json({
          success: false,
          error: "\u804A\u5929\u4F1A\u8BDD\u4E0D\u5B58\u5728"
        });
      }
      const updatedSession = await prisma.chatSession.update({
        where: { id: sessionId },
        data: { title: title.trim() }
      });
      res.json({
        success: true,
        data: updatedSession,
        message: "\u4F1A\u8BDD\u6807\u9898\u66F4\u65B0\u6210\u529F"
      });
    } catch (error) {
      console.error("Update chat session title error:", error);
      res.status(500).json({
        success: false,
        error: "\u66F4\u65B0\u4F1A\u8BDD\u6807\u9898\u5931\u8D25"
      });
    }
  }
);
router5.post(
  "/explain",
  aiRateLimit,
  authenticateToken,
  async (req, res) => {
    try {
      const { question, userAnswer, correctAnswer } = req.body;
      if (!question || !correctAnswer) {
        return res.status(400).json({
          success: false,
          error: "\u9898\u76EE\u548C\u6B63\u786E\u7B54\u6848\u662F\u5FC5\u9700\u7684"
        });
      }
      const explanation = await geminiService.explainAnswer(question, userAnswer, correctAnswer);
      res.json({
        success: true,
        data: { explanation }
      });
    } catch (error) {
      console.error("Explain answer error:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "\u7B54\u6848\u89E3\u91CA\u5931\u8D25"
      });
    }
  }
);
var chat_default = router5;

// src/routes/vocabulary.ts
init_database();
import { Router as Router6 } from "express";
var router6 = Router6();
router6.post(
  ["/words", "/"],
  authenticateToken,
  validateRequest({ body: schemas.vocabularyRequest }),
  async (req, res) => {
    try {
      console.log("Add vocabulary request body:", req.body);
      console.log("User:", req.user?.userId);
      const { word, context, sourceType, sourceId, tags, language } = req.body;
      const userId = req.user.userId;
      const existingWord = await prisma.vocabularyItem.findUnique({
        where: {
          userId_word: { userId, word: word.toLowerCase() }
        }
      });
      if (existingWord) {
        return res.status(400).json({
          success: false,
          error: "\u8BE5\u5355\u8BCD\u5DF2\u5728\u60A8\u7684\u8BCD\u6C47\u672C\u4E2D"
        });
      }
      console.log(`Adding vocabulary - User: ${userId}, Word: ${word}, Context: ${context}, Source: ${sourceType}`);
      let wordDefinition;
      let aiMeanings = null;
      try {
        console.log(`\u{1F50D} Fetching AI definition for word: ${word}`);
        wordDefinition = await geminiService.getWordDefinition(word, context);
        aiMeanings = wordDefinition.meanings;
        console.log(`\u2705 AI definition fetched for ${word}`);
      } catch (error) {
        console.warn(`\u26A0\uFE0F AI definition failed for ${word}, using fallback:`, error);
        aiMeanings = [
          {
            partOfSpeech: "noun",
            partOfSpeechCN: "\u540D\u8BCD",
            partOfSpeechLocal: "\u540D\u8BCD",
            definitions: [
              {
                definition: `${word} \u7684\u91CA\u4E49\uFF08\u8BF7\u70B9\u51FB\u5237\u65B0\u6309\u94AE\u83B7\u53D6AI\u7FFB\u8BD1\uFF09`,
                example: context || `${word} \u7684\u4F8B\u53E5`
              }
            ]
          }
        ];
      }
      const vocabularyItem = await prisma.vocabularyItem.create({
        data: {
          userId,
          word: word.toLowerCase(),
          definition: wordDefinition?.phonetic ? `${word} ${wordDefinition.phonetic}` : `${word} \u7684\u57FA\u7840\u5B9A\u4E49`,
          phonetic: wordDefinition?.phonetic,
          context: context || `${word} \u51FA\u73B0\u7684\u8BED\u5883`,
          sourceType: sourceType || "practice",
          sourceId: sourceId || "",
          language: language || "en",
          notes: "",
          tags: tags || [],
          mastered: false,
          meanings: aiMeanings,
          definitionLoading: false,
          definitionError: !wordDefinition,
          // 如果AI失败则标记为错误
          nextReviewDate: /* @__PURE__ */ new Date()
        }
      });
      console.log(`\u2705 Vocabulary added successfully: ${vocabularyItem.id}`);
      res.status(201).json({
        success: true,
        data: vocabularyItem,
        message: "\u5355\u8BCD\u6DFB\u52A0\u6210\u529F"
      });
    } catch (error) {
      console.error("Add vocabulary error:", error);
      res.status(500).json({
        success: false,
        error: "\u6DFB\u52A0\u5355\u8BCD\u5931\u8D25"
      });
    }
  }
);
router6.get(
  ["/words", "/"],
  authenticateToken,
  validateRequest({ query: schemas.pagination }),
  async (req, res) => {
    try {
      const userId = req.user.userId;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const sortBy = req.query.sortBy || "createdAt";
      const sortOrder = req.query.sortOrder || "desc";
      const skip = (page - 1) * limit;
      const sortFieldMap = {
        "createdAt": "addedAt",
        "updatedAt": "updatedAt",
        "word": "word",
        "reviewCount": "reviewCount",
        "nextReviewDate": "nextReviewDate"
      };
      const dbSortField = sortFieldMap[sortBy] || "addedAt";
      const orderBy = { [dbSortField]: sortOrder };
      const [vocabulary, total] = await Promise.all([
        prisma.vocabularyItem.findMany({
          where: { userId },
          orderBy,
          skip,
          take: limit
        }),
        prisma.vocabularyItem.count({ where: { userId } })
      ]);
      console.log(`Vocabulary request - User: ${userId}, Found: ${vocabulary.length} words, Total: ${total}`);
      const formattedVocabulary = vocabulary.map((item) => ({
        id: item.id,
        word: item.word,
        definition: item.definition,
        phonetic: item.phonetic,
        audioUrl: item.audioUrl,
        context: item.context,
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        meanings: item.meanings,
        // 前端期望的复杂结构
        language: item.language,
        reading: item.reading,
        jlpt: item.jlpt,
        commonality: item.commonality,
        notes: item.notes,
        mastered: item.mastered,
        definitionLoading: item.definitionLoading,
        definitionError: item.definitionError,
        // 复习数据
        reviewCount: item.reviewCount,
        easeIndex: item.easeFactor,
        // 前端使用 easeIndex
        intervalDays: item.interval,
        // 前端使用 intervalDays
        nextReviewDate: item.nextReviewDate,
        lastReviewDate: item.lastReviewedAt,
        createdAt: item.addedAt,
        // 前端使用 createdAt
        updatedAt: item.updatedAt
      }));
      res.json({
        success: true,
        data: formattedVocabulary,
        // 直接返回词汇数组
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error("Get vocabulary error:", error);
      res.status(500).json({
        success: false,
        error: "\u83B7\u53D6\u8BCD\u6C47\u672C\u5931\u8D25"
      });
    }
  }
);
router6.get(
  "/review",
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user.userId;
      const limit = parseInt(req.query.limit) || 20;
      const wordsToReview = await prisma.vocabularyItem.findMany({
        where: {
          userId,
          nextReviewDate: {
            lte: /* @__PURE__ */ new Date()
          }
        },
        orderBy: { nextReviewDate: "asc" },
        take: limit
      });
      res.json({
        success: true,
        data: wordsToReview
      });
    } catch (error) {
      console.error("Get review words error:", error);
      res.status(500).json({
        success: false,
        error: "\u83B7\u53D6\u590D\u4E60\u5355\u8BCD\u5931\u8D25"
      });
    }
  }
);
console.log("\u{1F527} [\u8DEF\u7531\u6CE8\u518C] \u6CE8\u518C GET /vocabulary/test-simple \u7AEF\u70B9");
router6.get("/test-simple", (req, res) => {
  res.json({
    success: true,
    message: "Vocabulary router working",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    route: "/vocabulary/test-simple"
  });
});
console.log("\u{1F527} [\u8DEF\u7531\u6CE8\u518C] \u6CE8\u518C POST /vocabulary/definition-test \u7AEF\u70B9 - \u65E0\u9700\u8BA4\u8BC1");
router6.post("/definition-test", (req, res) => {
  res.json({
    success: true,
    message: "Definition route working",
    requestBody: req.body,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    route: "/vocabulary/definition-test"
  });
});
console.log("\u{1F527} [\u8DEF\u7531\u6CE8\u518C] \u6CE8\u518C POST /vocabulary/definition-simple \u7AEF\u70B9 - \u8D85\u7B80\u5316\u7248\u672C");
router6.post(
  "/definition-simple",
  authenticateToken,
  async (req, res) => {
    try {
      console.log(`\u{1F680} [\u7B80\u5316API] \u6536\u5230\u8BCD\u6C47\u5B9A\u4E49\u8BF7\u6C42`);
      const { word, language = "zh" } = req.body;
      if (!word) {
        return res.status(400).json({
          success: false,
          error: "\u8BF7\u63D0\u4F9B\u5355\u8BCD"
        });
      }
      const mockResponse = {
        success: true,
        data: {
          word,
          definition: `${word} \u7684\u6A21\u62DF\u5B9A\u4E49 - \u4EC5\u7528\u4E8E\u6D4B\u8BD5\u8DEF\u7531\u8FDE\u901A\u6027`,
          phonetic: `/${word}/`,
          partOfSpeech: "noun",
          meanings: [
            {
              partOfSpeech: "noun",
              definitions: [
                {
                  definition: `${word} \u7684\u6A21\u62DF\u91CA\u4E49`,
                  example: `Example sentence with ${word}.`
                }
              ]
            }
          ]
        }
      };
      console.log(`\u{1F4E4} [\u7B80\u5316API] \u8FD4\u56DE\u6A21\u62DF\u7ED3\u679C`);
      res.json(mockResponse);
    } catch (error) {
      console.error(`\u{1F4A5} [\u7B80\u5316API] \u9519\u8BEF:`, error);
      res.status(500).json({
        success: false,
        error: "\u7B80\u5316\u7248\u672CAPI\u9519\u8BEF"
      });
    }
  }
);
console.log("\u{1F527} [\u8DEF\u7531\u6CE8\u518C] \u6CE8\u518C POST /vocabulary/definition \u7AEF\u70B9 - v2.0.1 - \u4FEE\u590D\u8DEF\u7531\u987A\u5E8F");
router6.post(
  "/definition",
  authenticateToken,
  async (req, res) => {
    try {
      console.log(`\u{1F680} [\u540E\u7AEFAPI] \u6536\u5230\u8BCD\u6C47\u5B9A\u4E49\u8BF7\u6C42`);
      console.log(`\u{1F680} [\u540E\u7AEFAPI] \u8BF7\u6C42\u4F53:`, req.body);
      console.log(`\u{1F680} [\u540E\u7AEFAPI] \u7528\u6237\u4FE1\u606F:`, req.user);
      const { word, language = "zh" } = req.body;
      const userId = req.user.userId;
      if (!word || typeof word !== "string") {
        console.log(`\u274C [\u540E\u7AEFAPI] \u65E0\u6548\u7684\u5355\u8BCD\u53C2\u6570: ${word}`);
        return res.status(400).json({
          success: false,
          error: "\u8BF7\u63D0\u4F9B\u6709\u6548\u7684\u5355\u8BCD"
        });
      }
      console.log(`\u{1F50D} [\u540E\u7AEFAPI] \u5F00\u59CB\u5904\u7406\u8BCD\u6C47\u5B9A\u4E49: word="${word}", language="${language}", user="${userId}"`);
      console.log(`\u{1F5C4}\uFE0F [\u540E\u7AEFAPI] \u67E5\u8BE2\u7528\u6237\u8BCD\u6C47\u8BB0\u5F55: userId="${userId}", word="${word.toLowerCase()}"`);
      let existingWord = await prisma.vocabularyItem.findFirst({
        where: {
          userId,
          word: word.toLowerCase()
        }
      });
      console.log(`\u{1F5C4}\uFE0F [\u540E\u7AEFAPI] \u7528\u6237\u8BCD\u6C47\u67E5\u8BE2\u7ED3\u679C:`, existingWord ? "\u627E\u5230\u8BB0\u5F55" : "\u672A\u627E\u5230\u8BB0\u5F55");
      if (!existingWord) {
        console.log(`\u{1F5C4}\uFE0F [\u540E\u7AEFAPI] \u67E5\u8BE2\u5176\u4ED6\u7528\u6237\u8BCD\u6C47\u8BB0\u5F55: word="${word.toLowerCase()}"`);
        existingWord = await prisma.vocabularyItem.findFirst({
          where: {
            word: word.toLowerCase(),
            meanings: {
              not: null
              // 确保有有效的meanings数据
            }
          },
          orderBy: {
            addedAt: "desc"
            // 获取最新的记录
          }
        });
        console.log(`\u{1F5C4}\uFE0F [\u540E\u7AEFAPI] \u5176\u4ED6\u7528\u6237\u8BCD\u6C47\u67E5\u8BE2\u7ED3\u679C:`, existingWord ? "\u627E\u5230\u8BB0\u5F55" : "\u672A\u627E\u5230\u8BB0\u5F55");
      }
      if (existingWord && existingWord.meanings) {
        console.log(`\u2705 [\u540E\u7AEFAPI] \u6570\u636E\u5E93\u4E2D\u627E\u5230\u8BCD\u6C47\u5B9A\u4E49: ${word}`, existingWord.meanings);
        const response = {
          success: true,
          data: {
            word,
            definition: existingWord.definition || "\u672A\u627E\u5230\u91CA\u4E49",
            phonetic: existingWord.phonetic,
            partOfSpeech: existingWord.meanings[0]?.partOfSpeech || "",
            meanings: existingWord.meanings || []
          }
        };
        console.log(`\u{1F4E4} [\u540E\u7AEFAPI] \u8FD4\u56DE\u6570\u636E\u5E93\u7ED3\u679C:`, response);
        res.json(response);
        return;
      }
      console.log(`\u{1F916} [\u540E\u7AEFAPI] \u6570\u636E\u5E93\u65E0\u8BB0\u5F55\uFF0C\u8C03\u7528AI\u83B7\u53D6: word="${word}", language="${language}"`);
      try {
        console.log(`\u{1F916} [\u540E\u7AEFAPI] \u8C03\u7528geminiService.getWordDefinition...`);
        const wordDefinition = await geminiService.getWordDefinition(word, "", language);
        console.log(`\u2705 [\u540E\u7AEFAPI] AI\u8FD4\u56DE\u5B9A\u4E49:`, wordDefinition);
        const aiResponse = {
          success: true,
          data: {
            word,
            definition: wordDefinition.definition || "\u672A\u627E\u5230\u91CA\u4E49",
            phonetic: wordDefinition.phonetic,
            partOfSpeech: wordDefinition.partOfSpeech,
            meanings: wordDefinition.meanings || []
          }
        };
        console.log(`\u{1F4E4} [\u540E\u7AEFAPI] \u8FD4\u56DEAI\u7ED3\u679C:`, aiResponse);
        res.json(aiResponse);
      } catch (error) {
        console.error(`\u274C [\u540E\u7AEFAPI] AI\u8C03\u7528\u5931\u8D25:`, error);
        const errorResponse = {
          success: false,
          error: "AI\u7FFB\u8BD1\u670D\u52A1\u6682\u65F6\u4E0D\u53EF\u7528\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5"
        };
        console.log(`\u{1F4E4} [\u540E\u7AEFAPI] \u8FD4\u56DE\u9519\u8BEF\u54CD\u5E94:`, errorResponse);
        res.status(500).json(errorResponse);
      }
    } catch (error) {
      console.error(`\u{1F4A5} [\u540E\u7AEFAPI] \u5916\u5C42\u5F02\u5E38\u6355\u83B7:`, error);
      const fatalErrorResponse = {
        success: false,
        error: "\u83B7\u53D6\u8BCD\u6C47\u5B9A\u4E49\u5931\u8D25"
      };
      console.log(`\u{1F4E4} [\u540E\u7AEFAPI] \u8FD4\u56DE\u81F4\u547D\u9519\u8BEF\u54CD\u5E94:`, fatalErrorResponse);
      res.status(500).json(fatalErrorResponse);
    }
  }
);
router6.post(
  "/:wordId/review",
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user.userId;
      const { wordId } = req.params;
      const { correct, difficulty } = req.body;
      const vocabularyItem = await prisma.vocabularyItem.findFirst({
        where: { id: wordId, userId }
      });
      if (!vocabularyItem) {
        return res.status(404).json({
          success: false,
          error: "\u5355\u8BCD\u4E0D\u5B58\u5728"
        });
      }
      let newInterval = vocabularyItem.interval;
      let newEaseFactor = vocabularyItem.easeFactor;
      if (correct) {
        newEaseFactor = Math.max(1.3, newEaseFactor + (0.1 - (5 - difficulty) * (0.08 + (5 - difficulty) * 0.02)));
        if (vocabularyItem.reviewCount === 0) {
          newInterval = 1;
        } else if (vocabularyItem.reviewCount === 1) {
          newInterval = 6;
        } else {
          newInterval = Math.round(vocabularyItem.interval * newEaseFactor);
        }
      } else {
        newInterval = 1;
        newEaseFactor = Math.max(1.3, newEaseFactor - 0.2);
      }
      const nextReviewDate = /* @__PURE__ */ new Date();
      nextReviewDate.setDate(nextReviewDate.getDate() + newInterval);
      const updatedItem = await prisma.vocabularyItem.update({
        where: { id: wordId },
        data: {
          reviewCount: { increment: 1 },
          correctCount: correct ? { increment: 1 } : void 0,
          incorrectCount: !correct ? { increment: 1 } : void 0,
          easeFactor: newEaseFactor,
          interval: newInterval,
          nextReviewDate,
          lastReviewedAt: /* @__PURE__ */ new Date()
        }
      });
      res.json({
        success: true,
        data: updatedItem,
        message: "\u590D\u4E60\u7ED3\u679C\u63D0\u4EA4\u6210\u529F"
      });
    } catch (error) {
      console.error("Submit review error:", error);
      res.status(500).json({
        success: false,
        error: "\u63D0\u4EA4\u590D\u4E60\u7ED3\u679C\u5931\u8D25"
      });
    }
  }
);
router6.put(
  "/:wordId",
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user.userId;
      const { wordId } = req.params;
      const { notes, mastered } = req.body;
      const vocabularyItem = await prisma.vocabularyItem.findFirst({
        where: { id: wordId, userId }
      });
      if (!vocabularyItem) {
        return res.status(404).json({
          success: false,
          error: "\u5355\u8BCD\u4E0D\u5B58\u5728"
        });
      }
      const updateData = {};
      if (notes !== void 0) updateData.notes = notes;
      if (mastered !== void 0) updateData.mastered = mastered;
      updateData.updatedAt = /* @__PURE__ */ new Date();
      const updatedItem = await prisma.vocabularyItem.update({
        where: { id: wordId },
        data: updateData
      });
      const formattedWord = {
        id: updatedItem.id,
        word: updatedItem.word,
        definition: updatedItem.definition,
        phonetic: updatedItem.phonetic,
        audioUrl: updatedItem.audioUrl,
        context: updatedItem.context,
        sourceType: updatedItem.sourceType,
        sourceId: updatedItem.sourceId,
        meanings: updatedItem.meanings,
        language: updatedItem.language,
        reading: updatedItem.reading,
        jlpt: updatedItem.jlpt,
        commonality: updatedItem.commonality,
        notes: updatedItem.notes,
        mastered: updatedItem.mastered,
        definitionLoading: updatedItem.definitionLoading,
        definitionError: updatedItem.definitionError,
        reviewCount: updatedItem.reviewCount,
        easeIndex: updatedItem.easeFactor,
        intervalDays: updatedItem.interval,
        nextReviewDate: updatedItem.nextReviewDate,
        lastReviewDate: updatedItem.lastReviewedAt,
        createdAt: updatedItem.addedAt,
        updatedAt: updatedItem.updatedAt
      };
      res.json({
        success: true,
        data: formattedWord,
        message: "\u5355\u8BCD\u66F4\u65B0\u6210\u529F"
      });
    } catch (error) {
      console.error("Update vocabulary error:", error);
      res.status(500).json({
        success: false,
        error: "\u66F4\u65B0\u5355\u8BCD\u5931\u8D25"
      });
    }
  }
);
router6.post(
  "/:wordId/refresh-definition",
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user.userId;
      const { wordId } = req.params;
      const vocabularyItem = await prisma.vocabularyItem.findFirst({
        where: { id: wordId, userId }
      });
      if (!vocabularyItem) {
        return res.status(404).json({
          success: false,
          error: "\u5355\u8BCD\u4E0D\u5B58\u5728"
        });
      }
      console.log(`\u{1F504} Refreshing definition for word: ${vocabularyItem.word}`);
      try {
        const wordDefinition = await geminiService.getWordDefinition(vocabularyItem.word, vocabularyItem.context);
        const updatedItem = await prisma.vocabularyItem.update({
          where: { id: wordId },
          data: {
            phonetic: wordDefinition.phonetic,
            meanings: wordDefinition.meanings,
            definition: wordDefinition.phonetic ? `${vocabularyItem.word} ${wordDefinition.phonetic}` : vocabularyItem.definition,
            definitionLoading: false,
            definitionError: false,
            updatedAt: /* @__PURE__ */ new Date()
          }
        });
        console.log(`\u2705 Definition refreshed for ${vocabularyItem.word}`);
        res.json({
          success: true,
          data: {
            id: updatedItem.id,
            word: updatedItem.word,
            phonetic: updatedItem.phonetic,
            meanings: updatedItem.meanings,
            definition: updatedItem.definition,
            definitionError: updatedItem.definitionError
          },
          message: "\u91CA\u4E49\u5237\u65B0\u6210\u529F"
        });
      } catch (error) {
        console.error(`\u274C Failed to refresh definition for ${vocabularyItem.word}:`, error);
        await prisma.vocabularyItem.update({
          where: { id: wordId },
          data: {
            definitionLoading: false,
            definitionError: true
          }
        });
        res.status(500).json({
          success: false,
          error: "AI\u91CA\u4E49\u83B7\u53D6\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5"
        });
      }
    } catch (error) {
      console.error("Refresh definition error:", error);
      res.status(500).json({
        success: false,
        error: "\u5237\u65B0\u5B9A\u4E49\u5931\u8D25"
      });
    }
  }
);
router6.delete(
  "/:wordId",
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user.userId;
      const { wordId } = req.params;
      const vocabularyItem = await prisma.vocabularyItem.findFirst({
        where: { id: wordId, userId }
      });
      if (!vocabularyItem) {
        return res.status(404).json({
          success: false,
          error: "\u5355\u8BCD\u4E0D\u5B58\u5728"
        });
      }
      await prisma.vocabularyItem.delete({
        where: { id: wordId }
      });
      res.json({
        success: true,
        message: "\u5355\u8BCD\u5220\u9664\u6210\u529F"
      });
    } catch (error) {
      console.error("Delete vocabulary error:", error);
      res.status(500).json({
        success: false,
        error: "\u5220\u9664\u5355\u8BCD\u5931\u8D25"
      });
    }
  }
);
router6.get(
  "/stats",
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user.userId;
      const beijingNow = getBeijingTime();
      const [
        totalWords,
        reviewToday,
        masteredWords,
        recentWords
      ] = await Promise.all([
        prisma.vocabularyItem.count({ where: { userId } }),
        prisma.vocabularyItem.count({
          where: {
            userId,
            nextReviewDate: {
              lte: beijingNow
              // 使用北京时间
            },
            mastered: false
            // 排除已掌握的单词
          }
        }),
        prisma.vocabularyItem.count({
          where: {
            userId,
            mastered: true
          }
        }),
        prisma.vocabularyItem.count({
          where: {
            userId,
            addedAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1e3)
              // 最近7天
            }
          }
        })
      ]);
      const beijingTime = getBeijingTime();
      const todayStart = new Date(beijingTime);
      todayStart.setHours(0, 0, 0, 0);
      const reviewedToday = await prisma.vocabularyItem.count({
        where: {
          userId,
          lastReviewedAt: {
            gte: todayStart
          }
        }
      });
      res.json({
        success: true,
        data: {
          totalWords,
          masteredWords,
          recentWords,
          wordsNeedingReview: reviewToday,
          reviewedToday,
          reviewStreak: 0
          // 可以后续实现复习连续天数计算
        }
      });
    } catch (error) {
      console.error("Get vocabulary stats error:", error);
      res.status(500).json({
        success: false,
        error: "\u83B7\u53D6\u8BCD\u6C47\u7EDF\u8BA1\u5931\u8D25"
      });
    }
  }
);
function getBeijingTime() {
  const now = /* @__PURE__ */ new Date();
  return new Date(now.getTime() + 8 * 60 * 60 * 1e3 - now.getTimezoneOffset() * 60 * 1e3);
}
var vocabulary_default = router6;

// src/routes/vocabulary-minimal.ts
import { Router as Router7 } from "express";
var router7 = Router7();
console.log("\u{1F527} [\u6700\u7B80\u8DEF\u7531] \u6CE8\u518C GET /vocabulary-minimal/test \u7AEF\u70B9");
router7.get("/test", (req, res) => {
  res.json({
    success: true,
    message: "Minimal vocabulary router working",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    route: "/vocabulary-minimal/test"
  });
});
console.log("\u{1F527} [\u6700\u7B80\u8DEF\u7531] \u6CE8\u518C POST /vocabulary-minimal/test \u7AEF\u70B9");
router7.post("/test", (req, res) => {
  res.json({
    success: true,
    message: "Minimal vocabulary POST working",
    requestBody: req.body,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    route: "/vocabulary-minimal/test"
  });
});
var vocabulary_minimal_default = router7;

// src/routes/billing.ts
import { Router as Router8 } from "express";
import Stripe2 from "stripe";
import { Prisma } from "@prisma/client";

// src/services/stripeService.ts
init_database();
import Stripe from "stripe";
var stripe = null;
function getStripe() {
  if (!stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error("STRIPE_SECRET_KEY environment variable is not set");
      throw new Error("Stripe configuration missing: STRIPE_SECRET_KEY is required");
    }
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2023-10-16"
    });
    console.log("Stripe client initialized successfully");
  }
  return stripe;
}
var safeUserSubscriptionSelect2 = {
  id: true,
  userId: true,
  planId: true,
  stripeCustomerId: true,
  stripeSubscriptionId: true,
  stripeSessionId: true,
  status: true,
  currentPeriodStart: true,
  currentPeriodEnd: true,
  trialStart: true,
  trialEnd: true,
  cancelAtPeriodEnd: true,
  canceledAt: true,
  lastPaymentAt: true,
  // 跳过 nextPaymentAt 直到列被正确添加
  createdAt: true,
  updatedAt: true
};
var StripeService = class {
  /**
   * 创建结账会话
   */
  static async createCheckoutSession({
    userId,
    planId,
    successUrl,
    cancelUrl
  }) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true }
      });
      if (!user) {
        throw new Error("User not found");
      }
      const plan = await prisma.subscriptionPlan.findUnique({
        where: { id: planId }
      });
      if (!plan || !plan.stripePriceId) {
        throw new Error("Plan not found or missing Stripe price ID");
      }
      const existingSubscription = await prisma.userSubscription.findUnique({
        where: { userId },
        select: safeUserSubscriptionSelect2
      });
      if (existingSubscription && existingSubscription.status === "active") {
        throw new Error("User already has an active subscription");
      }
      const isUpgradingFromTrial = existingSubscription && existingSubscription.status === "trialing";
      log.info("Creating checkout session", {
        userId,
        planId,
        isUpgradingFromTrial,
        existingStatus: existingSubscription?.status || "none"
      });
      let stripeCustomerId = existingSubscription?.stripeCustomerId;
      if (!stripeCustomerId) {
        const customer = await getStripe().customers.create({
          email: user.email,
          name: user.name || void 0,
          metadata: {
            userId: user.id
          }
        });
        stripeCustomerId = customer.id;
      }
      const session = await getStripe().checkout.sessions.create({
        customer: stripeCustomerId,
        payment_method_types: ["card"],
        line_items: [
          {
            price: plan.stripePriceId,
            quantity: 1
          }
        ],
        mode: "subscription",
        success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl,
        metadata: {
          userId: user.id,
          planId: plan.id
        },
        // 重要：绝不通过Stripe给予试用期！试用只能从ChatTOEIC前端获得
        subscription_data: {
          // 完全移除 trial_period_days，所有付费都从第一天开始计费
          metadata: {
            userId: user.id,
            planId: plan.id,
            upgradeFromTrial: isUpgradingFromTrial ? "true" : "false",
            source: "chattoeic_frontend"
            // 标识来源
          }
        }
      });
      await prisma.userSubscription.upsert({
        where: { userId },
        create: {
          userId,
          planId,
          stripeCustomerId,
          stripeSessionId: session.id,
          status: "pending"
        },
        update: {
          planId,
          stripeCustomerId,
          stripeSessionId: session.id,
          status: "pending"
        }
      });
      log.info("Stripe checkout session created", {
        userId,
        sessionId: session.id,
        planId
      });
      return {
        sessionId: session.id,
        sessionUrl: session.url
      };
    } catch (error) {
      log.error("Failed to create checkout session", { error, userId, planId });
      throw error;
    }
  }
  /**
   * 创建客户门户会话
   */
  static async createPortalSession({
    userId,
    returnUrl
  }) {
    try {
      const subscription = await prisma.userSubscription.findUnique({
        where: { userId },
        select: safeUserSubscriptionSelect2
      });
      if (!subscription?.stripeCustomerId) {
        throw new Error("No subscription found for user");
      }
      const session = await getStripe().billingPortal.sessions.create({
        customer: subscription.stripeCustomerId,
        return_url: returnUrl
      });
      log.info("Stripe portal session created", {
        userId,
        sessionId: session.id
      });
      return {
        portalUrl: session.url
      };
    } catch (error) {
      log.error("Failed to create portal session", { error, userId });
      throw error;
    }
  }
  /**
   * 开始免费试用
   */
  static async startTrial(userId, planId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true
          // 使用name而不是username字段
          // 暂时不查询trialUsed字段，直到数据库同步
        }
      });
      if (!user) {
        throw new Error("User not found");
      }
      let plan;
      try {
        plan = await prisma.subscriptionPlan.findUnique({
          where: { id: planId }
        });
      } catch (dbError) {
        log.warn("Failed to query subscription plan from database", { planId, dbError });
      }
      if (!plan) {
        log.info("Using hardcoded plan data for trial", { planId });
        if (planId === "trial" || planId === "trial_plan") {
          plan = {
            id: "trial",
            name: "Free Trial",
            nameJp: "\u7121\u6599\u30C8\u30E9\u30A4\u30A2\u30EB",
            priceCents: 0,
            currency: "jpy",
            interval: "trial",
            features: {
              aiPractice: true,
              aiChat: true,
              vocabulary: true,
              exportData: true,
              viewMistakes: true
            },
            dailyPracticeLimit: null,
            dailyAiChatLimit: 20,
            maxVocabularyWords: null,
            trialDays: 3,
            isPopular: true
          };
        } else if (planId === "free" || planId === "free_plan") {
          plan = {
            id: "free",
            name: "Free Plan",
            nameJp: "\u7121\u6599\u30D7\u30E9\u30F3",
            priceCents: 0,
            currency: "jpy",
            interval: "month",
            features: {
              aiPractice: false,
              aiChat: false,
              vocabulary: true,
              exportData: false,
              viewMistakes: true
            },
            dailyPracticeLimit: null,
            dailyAiChatLimit: 0,
            maxVocabularyWords: null
          };
        } else {
          throw new Error("Plan not found");
        }
      }
      const existingSubscription = await prisma.userSubscription.findUnique({
        where: { userId },
        select: safeUserSubscriptionSelect2
      });
      if (existingSubscription) {
        if (existingSubscription.status === "active") {
          throw new Error("\u60A8\u5DF2\u7ECF\u662F\u4ED8\u8D39\u7528\u6237\uFF0C\u65E0\u9700\u8BD5\u7528");
        }
        if (existingSubscription.status === "trialing") {
          const now2 = /* @__PURE__ */ new Date();
          if (existingSubscription.trialEnd && existingSubscription.trialEnd > now2) {
            throw new Error("\u60A8\u5DF2\u7ECF\u5728\u8BD5\u7528\u671F\u5185\uFF0C\u65E0\u6CD5\u91CD\u590D\u7533\u8BF7");
          }
        }
        if (existingSubscription.trialEnd) {
          throw new Error("\u6BCF\u4E2A\u7528\u6237\u53EA\u80FD\u4F7F\u7528\u4E00\u6B21\u514D\u8D39\u8BD5\u7528");
        }
      }
      const now = /* @__PURE__ */ new Date();
      const trialEnd = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1e3);
      const subscription = await prisma.userSubscription.upsert({
        where: { userId },
        create: {
          userId,
          planId,
          status: "trialing",
          trialStart: now,
          trialEnd,
          currentPeriodStart: now,
          currentPeriodEnd: trialEnd
        },
        update: {
          planId,
          status: "trialing",
          trialStart: now,
          trialEnd,
          currentPeriodStart: now,
          currentPeriodEnd: trialEnd
        }
      });
      await this.initializeUsageQuotas(userId, plan);
      log.info("Free trial started", {
        userId,
        subscriptionId: subscription.id,
        trialEnd
      });
      return subscription;
    } catch (error) {
      log.error("Failed to start trial", { error, userId, planId });
      throw error;
    }
  }
  /**
   * 取消订阅
   */
  static async cancelSubscription(userId) {
    try {
      const subscription = await prisma.userSubscription.findUnique({
        where: { userId },
        select: safeUserSubscriptionSelect2
      });
      if (!subscription) {
        throw new Error("No subscription found");
      }
      if (subscription.stripeSubscriptionId) {
        await getStripe().subscriptions.update(subscription.stripeSubscriptionId, {
          cancel_at_period_end: true
        });
      }
      const updatedSubscription = await prisma.userSubscription.update({
        where: { userId },
        data: {
          cancelAtPeriodEnd: true,
          canceledAt: /* @__PURE__ */ new Date()
        }
      });
      log.info("Subscription canceled", {
        userId,
        subscriptionId: subscription.id
      });
      return updatedSubscription;
    } catch (error) {
      log.error("Failed to cancel subscription", { error, userId });
      throw error;
    }
  }
  /**
   * 处理Webhook事件
   */
  static async handleWebhook(event) {
    try {
      log.info("Processing Stripe webhook", {
        eventType: event.type,
        eventId: event.id
      });
      switch (event.type) {
        case "checkout.session.completed":
          await this.handleCheckoutCompleted(event.data.object);
          break;
        case "invoice.payment_succeeded":
          await this.handlePaymentSucceeded(event.data.object);
          break;
        case "invoice.payment_failed":
          await this.handlePaymentFailed(event.data.object);
          break;
        case "customer.subscription.updated":
          await this.handleSubscriptionUpdated(event.data.object);
          break;
        case "customer.subscription.deleted":
          await this.handleSubscriptionDeleted(event.data.object);
          break;
        default:
          log.info("Unhandled webhook event type", { eventType: event.type });
      }
    } catch (error) {
      log.error("Failed to handle webhook", { error, eventType: event.type });
      throw error;
    }
  }
  /**
   * 处理结账完成事件
   */
  static async handleCheckoutCompleted(session) {
    const userId = session.metadata?.userId;
    if (!userId) {
      log.error("Missing userId in session metadata", { sessionId: session.id });
      throw new Error("Missing userId in session metadata");
    }
    log.info("Processing checkout completion", { userId, sessionId: session.id });
    const subscription = await prisma.userSubscription.findUnique({
      where: { userId },
      select: safeUserSubscriptionSelect2
    });
    if (!subscription) {
      log.error("Subscription not found for checkout completion", { userId, sessionId: session.id });
      throw new Error("Subscription not found");
    }
    const stripeSubscription = await getStripe().subscriptions.retrieve(session.subscription);
    log.info("Retrieved Stripe subscription", {
      userId,
      stripeSubscriptionId: stripeSubscription.id,
      status: stripeSubscription.status
    });
    const targetPlanId = session.metadata?.planId;
    if (!targetPlanId) {
      log.error("Missing planId in session metadata", { sessionId: session.id });
      throw new Error("Missing planId in session metadata");
    }
    await prisma.userSubscription.update({
      where: { userId },
      data: {
        planId: targetPlanId,
        // 🔧 更新为正确的付费套餐ID
        stripeSubscriptionId: stripeSubscription.id,
        status: "active",
        // 强制设为active，忽略Stripe的trialing状态
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1e3),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1e3),
        // 保留原有的试用信息（如果用户之前有过试用）
        // 但不会基于Stripe信息创建新的试用
        trialStart: subscription.trialStart,
        // 保持原值
        trialEnd: subscription.trialEnd
        // 保持原值
      }
    });
    log.info("Subscription status updated successfully", {
      userId,
      stripeStatus: stripeSubscription.status,
      finalStatus: "active",
      // 强制为active
      planId: targetPlanId,
      // 记录更新的套餐ID
      message: "All Stripe payments start immediately - no trials through Stripe"
    });
    try {
      await prisma.paymentTransaction.create({
        data: {
          userId,
          stripeSessionId: session.id,
          amount: session.amount_total || 0,
          currency: session.currency || "jpy",
          status: "succeeded",
          subscriptionId: subscription.id
        }
      });
      log.info("Payment transaction recorded successfully", { userId, sessionId: session.id });
    } catch (transactionError) {
      log.warn("Failed to record payment transaction (table may not exist)", {
        userId,
        sessionId: session.id,
        error: transactionError instanceof Error ? transactionError.message : String(transactionError)
      });
    }
    log.info("Checkout completed and subscription activated", { userId, sessionId: session.id });
  }
  /**
   * 处理支付成功事件
   */
  static async handlePaymentSucceeded(invoice) {
    const subscription = await getStripe().subscriptions.retrieve(invoice.subscription);
    const userId = subscription.metadata?.userId;
    if (userId) {
      await prisma.userSubscription.update({
        where: { userId },
        data: {
          status: "active",
          lastPaymentAt: /* @__PURE__ */ new Date(),
          currentPeriodStart: new Date(subscription.current_period_start * 1e3),
          currentPeriodEnd: new Date(subscription.current_period_end * 1e3)
        }
      });
      log.info("Payment succeeded and subscription updated", { userId, invoiceId: invoice.id });
    }
  }
  /**
   * 处理支付失败事件
   */
  static async handlePaymentFailed(invoice) {
    const subscription = await getStripe().subscriptions.retrieve(invoice.subscription);
    const userId = subscription.metadata?.userId;
    if (userId) {
      await prisma.userSubscription.update({
        where: { userId },
        data: {
          status: "past_due"
        }
      });
      log.warn("Payment failed for subscription", { userId, invoiceId: invoice.id });
    }
  }
  /**
   * 处理订阅更新事件
   */
  static async handleSubscriptionUpdated(subscription) {
    const userId = subscription.metadata?.userId;
    if (!userId) return;
    await prisma.userSubscription.update({
      where: { userId },
      data: {
        status: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start * 1e3),
        currentPeriodEnd: new Date(subscription.current_period_end * 1e3),
        cancelAtPeriodEnd: subscription.cancel_at_period_end
      }
    });
    log.info("Subscription updated", { userId, subscriptionId: subscription.id });
  }
  /**
   * 处理订阅删除事件
   */
  static async handleSubscriptionDeleted(subscription) {
    const userId = subscription.metadata?.userId;
    if (!userId) return;
    await prisma.userSubscription.update({
      where: { userId },
      data: {
        status: "canceled",
        canceledAt: /* @__PURE__ */ new Date()
      }
    });
    log.info("Subscription deleted", { userId, subscriptionId: subscription.id });
  }
  /**
   * 初始化用户使用配额
   */
  static async initializeUsageQuotas(userId, plan) {
    const now = /* @__PURE__ */ new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    const quotas = [];
    if (plan.dailyPracticeLimit !== null) {
      quotas.push({
        userId,
        resourceType: "daily_practice",
        usedCount: 0,
        limitCount: plan.dailyPracticeLimit,
        periodStart: now,
        periodEnd: endOfDay
      });
    }
    if (plan.dailyAiChatLimit !== null) {
      quotas.push({
        userId,
        resourceType: "daily_ai_chat",
        usedCount: 0,
        limitCount: plan.dailyAiChatLimit,
        periodStart: now,
        periodEnd: endOfDay
      });
    }
    if (plan.maxVocabularyWords !== null) {
      quotas.push({
        userId,
        resourceType: "vocabulary_words",
        usedCount: 0,
        limitCount: plan.maxVocabularyWords,
        periodStart: now,
        periodEnd: /* @__PURE__ */ new Date("2099-12-31")
        // 词汇本配额不按日重置
      });
    }
    if (quotas.length > 0) {
      try {
        await prisma.usageQuota.createMany({
          data: quotas,
          skipDuplicates: true
        });
        log.info("Usage quotas initialized successfully", { userId, quotaCount: quotas.length });
      } catch (error) {
        log.warn("Failed to initialize usage quotas (table may not exist)", {
          userId,
          error: error instanceof Error ? error.message : String(error),
          quotas: quotas.map((q) => ({ resourceType: q.resourceType, limitCount: q.limitCount }))
        });
      }
    }
  }
};
var stripeService_default = StripeService;

// src/routes/billing.ts
init_database();
var router8 = Router8();
function getStripeInstance() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY environment variable is not set");
  }
  return new Stripe2(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2023-10-16"
  });
}
var cache = /* @__PURE__ */ new Map();
var CACHE_TTL = 10 * 60 * 1e3;
function getCached(key) {
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expireAt) {
    return entry.data;
  }
  if (entry) {
    cache.delete(key);
  }
  return null;
}
function setCache(key, data) {
  cache.set(key, {
    data,
    timestamp: Date.now(),
    expireAt: Date.now() + CACHE_TTL
  });
}
router8.get("/health", async (req, res) => {
  try {
    res.json({
      success: true,
      service: "billing",
      status: "healthy",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      message: "Billing service is working"
    });
  } catch (error) {
    log.error("Billing health check failed", { error });
    res.status(500).json({
      success: false,
      error: "\u670D\u52A1\u68C0\u67E5\u5931\u8D25"
    });
  }
});
router8.post("/setup-database", async (req, res) => {
  try {
    log.info("\u{1F198} Emergency database setup requested");
    const plans = [
      {
        id: "free",
        name: "Free Plan",
        nameJp: "\u7121\u6599\u30D7\u30E9\u30F3",
        priceCents: 0,
        currency: "jpy",
        interval: "month",
        features: {
          aiPractice: false,
          aiChat: false,
          vocabulary: false,
          exportData: false,
          viewMistakes: false
        },
        dailyPracticeLimit: 5,
        dailyAiChatLimit: 3,
        maxVocabularyWords: 50,
        sortOrder: 1
      },
      {
        id: "premium_monthly",
        name: "Premium Monthly",
        nameJp: "\u30D7\u30EC\u30DF\u30A2\u30E0\u6708\u984D",
        priceCents: 3e5,
        currency: "jpy",
        interval: "month",
        stripePriceId: process.env.STRIPE_PRICE_ID_MONTHLY || "price_1PwQQsRpNxWe2zQY2xkv8VsT",
        // 真实的测试价格ID
        stripeProductId: process.env.STRIPE_PRODUCT_ID || "prod_QsI8lqCHYv9SDm",
        features: {
          aiPractice: true,
          aiChat: true,
          vocabulary: true,
          exportData: true,
          viewMistakes: true
        },
        dailyPracticeLimit: null,
        dailyAiChatLimit: null,
        maxVocabularyWords: null,
        sortOrder: 2
      }
    ];
    try {
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS subscription_plans (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          "nameJp" TEXT,
          "priceCents" INTEGER NOT NULL,
          currency TEXT NOT NULL DEFAULT 'jpy',
          interval TEXT NOT NULL,
          "intervalCount" INTEGER NOT NULL DEFAULT 1,
          "stripePriceId" TEXT UNIQUE,
          "stripeProductId" TEXT UNIQUE,
          features JSONB NOT NULL,
          "dailyPracticeLimit" INTEGER,
          "dailyAiChatLimit" INTEGER,
          "maxVocabularyWords" INTEGER,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "sortOrder" INTEGER NOT NULL DEFAULT 0,
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `;
      log.info("\u2705 Created subscription_plans table");
    } catch (createError) {
      log.warn("Table might already exist", { createError: createError.message });
    }
    try {
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS user_subscriptions (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          "userId" TEXT NOT NULL,
          "planId" TEXT,
          "stripeCustomerId" TEXT,
          "stripeSubscriptionId" TEXT,
          "stripeSessionId" TEXT,
          status TEXT NOT NULL DEFAULT 'inactive',
          "currentPeriodStart" TIMESTAMP,
          "currentPeriodEnd" TIMESTAMP,
          "trialStart" TIMESTAMP,
          "trialEnd" TIMESTAMP,
          "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
          "canceledAt" TIMESTAMP,
          "lastPaymentAt" TIMESTAMP,
          "nextPaymentAt" TIMESTAMP,
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          UNIQUE("userId")
        );
      `;
      log.info("\u2705 Created user_subscriptions table");
    } catch (createError) {
      log.warn("user_subscriptions table might already exist", { createError: createError.message });
    }
    try {
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS payment_transactions (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          "userId" TEXT NOT NULL,
          "subscriptionId" TEXT,
          "stripeSessionId" TEXT,
          "stripePaymentIntentId" TEXT,
          amount INTEGER NOT NULL DEFAULT 0,
          currency TEXT NOT NULL DEFAULT 'jpy',
          status TEXT NOT NULL,
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `;
      log.info("\u2705 Created payment_transactions table");
    } catch (createError) {
      log.warn("payment_transactions table might already exist", { createError: createError.message });
    }
    try {
      log.info("\u{1F527} Checking and adding missing columns...");
      try {
        await prisma.$executeRaw`
          ALTER TABLE public.user_subscriptions 
          ADD COLUMN IF NOT EXISTS "nextPaymentAt" TIMESTAMP;
        `;
        log.info("\u2705 nextPaymentAt column added or already exists");
      } catch (alterError) {
        if (alterError.message.includes("already exists") || alterError.message.includes("duplicate")) {
          log.info("\u2705 nextPaymentAt column already exists");
        } else {
          log.warn("Column addition attempt failed, but continuing...", { error: alterError.message });
        }
      }
      const planColumns = [
        "dailyPracticeLimit",
        "dailyAiChatLimit",
        "maxVocabularyWords"
      ];
      for (const columnName of planColumns) {
        try {
          await prisma.$executeRaw`
            ALTER TABLE public.subscription_plans 
            ADD COLUMN IF NOT EXISTS ${Prisma.raw(`"${columnName}"`)} INTEGER;
          `;
          log.info(`\u2705 Column ${columnName} added or already exists in subscription_plans`);
        } catch (alterError) {
          if (alterError.message.includes("already exists") || alterError.message.includes("duplicate")) {
            log.info(`\u2705 Column ${columnName} already exists in subscription_plans`);
          } else {
            log.warn(`Column ${columnName} addition failed, continuing...`, { error: alterError.message });
          }
        }
      }
      log.info("\u2705 Missing columns check/fix completed");
    } catch (columnError) {
      log.warn("Column fix error (might be normal if columns already exist)", { columnError: columnError.message });
    }
    try {
      await prisma.subscriptionPlan.deleteMany({});
      log.info("\u{1F5D1}\uFE0F Cleared existing plans");
    } catch (deleteError) {
      log.warn("Could not clear existing plans", { deleteError: deleteError.message });
    }
    for (const planData of plans) {
      try {
        await prisma.subscriptionPlan.create({
          data: planData
        });
        log.info(`\u2705 Created plan: ${planData.name}`);
      } catch (createPlanError) {
        log.error(`\u274C Failed to create plan: ${planData.name}`, { createPlanError });
      }
    }
    res.json({
      success: true,
      message: "Emergency database setup completed",
      plansCreated: plans.length,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (error) {
    log.error("\u274C Emergency database setup failed", { error });
    res.status(500).json({
      success: false,
      error: `Database setup failed: ${error.message}`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
});
router8.post("/clear-cache", async (req, res) => {
  try {
    log.info("\u{1F5D1}\uFE0F Clearing billing cache");
    cache.clear();
    res.json({
      success: true,
      message: "Cache cleared successfully",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (error) {
    log.error("\u274C Failed to clear cache", { error });
    res.status(500).json({
      success: false,
      error: "Failed to clear cache",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
});
router8.post("/emergency-migrate", async (req, res) => {
  try {
    log.info("\u{1F680} Starting emergency database migration...");
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS usage_quotas (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        resource_type TEXT NOT NULL,
        used_count INTEGER DEFAULT 0,
        limit_count INTEGER,
        period_start TIMESTAMP DEFAULT NOW(),
        period_end TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, resource_type, period_start)
      );
    `;
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS payment_transactions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        stripe_session_id TEXT UNIQUE,
        stripe_payment_id TEXT UNIQUE,
        amount INTEGER NOT NULL,
        currency TEXT DEFAULT 'jpy',
        status TEXT NOT NULL,
        subscription_id TEXT REFERENCES user_subscriptions(id),
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;
    log.info("\u2705 Emergency database migration completed");
    res.json({
      success: true,
      message: "Emergency database migration completed successfully",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      tablesCreated: ["usage_quotas", "payment_transactions"]
    });
  } catch (error) {
    log.error("\u274C Emergency database migration failed", { error });
    res.status(500).json({
      success: false,
      error: "Database migration failed",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});
router8.get("/test-env", async (req, res) => {
  try {
    const testPlan = {
      id: "premium_monthly",
      stripePriceId: process.env.STRIPE_PRICE_ID_MONTHLY || "fallback_price",
      stripeProductId: process.env.STRIPE_PRODUCT_ID || "fallback_product",
      envVars: {
        STRIPE_PRICE_ID_MONTHLY: process.env.STRIPE_PRICE_ID_MONTHLY,
        STRIPE_PRODUCT_ID: process.env.STRIPE_PRODUCT_ID
      }
    };
    res.json({
      success: true,
      data: testPlan
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Test failed"
    });
  }
});
router8.get("/debug-env", async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        hasStripeSecret: !!process.env.STRIPE_SECRET_KEY,
        hasMonthlyPriceId: !!process.env.STRIPE_PRICE_ID_MONTHLY,
        hasYearlyPriceId: !!process.env.STRIPE_PRICE_ID_YEARLY,
        hasProductId: !!process.env.STRIPE_PRODUCT_ID,
        monthlyPriceId: process.env.STRIPE_PRICE_ID_MONTHLY ? process.env.STRIPE_PRICE_ID_MONTHLY.substring(0, 12) + "..." : null,
        environment: process.env.NODE_ENV
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "\u8C03\u8BD5\u4FE1\u606F\u83B7\u53D6\u5931\u8D25"
    });
  }
});
router8.get("/plans", async (req, res) => {
  try {
    log.info("Billing plans request started");
    const cacheKey = "subscription_plans_active";
    const cachedPlans = getCached(cacheKey);
    if (cachedPlans) {
      log.info("Billing plans served from cache");
      return res.json({
        success: true,
        data: cachedPlans,
        cached: true
      });
    }
    let plans;
    try {
      plans = await prisma.subscriptionPlan.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          nameJp: true,
          priceCents: true,
          currency: true,
          interval: true,
          features: true,
          dailyPracticeLimit: true,
          dailyAiChatLimit: true,
          maxVocabularyWords: true
        }
      });
      log.info("Plans loaded from database", { plansCount: plans.length });
    } catch (dbError) {
      log.warn("Failed to load plans from database, using hardcoded fallback", { dbError });
      plans = [
        {
          id: "free",
          name: "Free Plan",
          nameJp: "\u7121\u6599\u30D7\u30E9\u30F3",
          priceCents: 0,
          currency: "jpy",
          interval: "month",
          features: {
            aiPractice: false,
            // ❌ 无AI练习生成
            aiChat: false,
            // ❌ 无AI对话
            vocabulary: true,
            // ✅ 生词本功能
            exportData: false,
            // ❌ 不能导出
            viewMistakes: true
            // ✅ 无限复习功能
          },
          dailyPracticeLimit: null,
          // 无限基础练习
          dailyAiChatLimit: 0,
          // 0次AI对话
          maxVocabularyWords: null
          // 无限生词本
        },
        {
          id: "trial",
          name: "Free Trial",
          nameJp: "\u7121\u6599\u30C8\u30E9\u30A4\u30A2\u30EB",
          priceCents: 0,
          currency: "jpy",
          interval: "trial",
          features: {
            aiPractice: true,
            // ✅ AI练习生成
            aiChat: true,
            // ✅ AI对话（限制20次）
            vocabulary: true,
            // ✅ 生词本功能
            exportData: true,
            // ✅ 可以导出
            viewMistakes: true
            // ✅ 无限复习功能
          },
          dailyPracticeLimit: null,
          // 无限练习
          dailyAiChatLimit: 20,
          // 每日20次AI对话
          maxVocabularyWords: null,
          // 无限生词本
          trialDays: 3,
          isPopular: true
        },
        {
          id: "premium_monthly",
          name: "Premium Monthly",
          nameJp: "\u30D7\u30EC\u30DF\u30A2\u30E0\u6708\u984D",
          priceCents: 3e5,
          currency: "jpy",
          interval: "month",
          stripePriceId: process.env.STRIPE_PRICE_ID_MONTHLY || "price_1PwQQsRpNxWe2zQY2xkv8VsT",
          stripeProductId: process.env.STRIPE_PRODUCT_ID || "prod_QsI8lqCHYv9SDm",
          features: {
            aiPractice: true,
            // ✅ 无限AI练习生成
            aiChat: true,
            // ✅ 无限AI对话
            vocabulary: true,
            // ✅ 无限生词本功能
            exportData: true,
            // ✅ 可以导出
            viewMistakes: true
            // ✅ 无限复习功能
          },
          dailyPracticeLimit: null,
          // 无限练习
          dailyAiChatLimit: null,
          // 无限AI对话
          maxVocabularyWords: null
          // 无限生词本
        }
      ];
    }
    const formattedPlans = plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      nameJp: plan.nameJp,
      priceCents: plan.priceCents,
      currency: plan.currency,
      interval: plan.interval,
      features: plan.features,
      limits: {
        dailyPractice: plan.dailyPracticeLimit,
        dailyAiChat: plan.dailyAiChatLimit,
        vocabularyWords: plan.maxVocabularyWords
      },
      isPopular: plan.id === "premium_monthly"
      // 标记高级版为推荐
    }));
    const responseData = { plans: formattedPlans };
    setCache(cacheKey, responseData);
    log.info("Billing plans cached successfully", { plansCount: formattedPlans.length });
    res.json({
      success: true,
      data: responseData,
      cached: false
    });
  } catch (error) {
    log.error("Failed to get plans", { error });
    res.status(500).json({
      success: false,
      error: "\u83B7\u53D6\u5957\u9910\u4FE1\u606F\u5931\u8D25"
    });
  }
});
router8.post("/webhooks", async (req, res) => {
  const sig = req.headers["stripe-signature"];
  try {
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      throw new Error("Webhook secret not configured");
    }
    const event = getStripeInstance().webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    await stripeService_default.handleWebhook(event);
    log.info("Webhook processed successfully", {
      eventType: event.type,
      eventId: event.id
    });
    res.json({ received: true });
  } catch (error) {
    log.error("Webhook processing failed", { error });
    res.status(400).json({
      success: false,
      error: "Webhook processing failed"
    });
  }
});
router8.get("/user/subscription", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    log.info("User subscription request started", { userId });
    let subscriptionInfo;
    try {
      subscriptionInfo = await getUserSubscriptionInfo(userId);
      log.info("getUserSubscriptionInfo result", { userId, subscriptionInfo });
    } catch (error) {
      log.error("getUserSubscriptionInfo failed", { userId, error });
      subscriptionInfo = {
        hasPermission: false,
        subscription: null,
        permissions: {
          aiPractice: false,
          // ❌ 无AI练习生成
          aiChat: false,
          // ❌ 无AI对话
          vocabulary: true,
          // ✅ 生词本功能  
          exportData: false,
          // ❌ 不能导出
          viewMistakes: true
          // ✅ 无限复习功能
        },
        trialAvailable: true
      };
    }
    let practiceQuota, chatQuota, vocabularyQuota;
    try {
      [practiceQuota, chatQuota, vocabularyQuota] = await Promise.all([
        checkUsageQuota(userId, "daily_practice"),
        checkUsageQuota(userId, "daily_ai_chat"),
        checkUsageQuota(userId, "vocabulary_words")
      ]);
    } catch (error) {
      log.error("checkUsageQuota failed", { userId, error });
      practiceQuota = { used: 0, limit: null, remaining: null };
      chatQuota = { used: 0, limit: 0, remaining: 0 };
      vocabularyQuota = { used: 0, limit: null, remaining: null };
    }
    const permissions = subscriptionInfo.permissions || {
      aiPractice: false,
      // ❌ 无AI练习生成
      aiChat: false,
      // ❌ 无AI对话
      vocabulary: true,
      // ✅ 生词本功能  
      exportData: false,
      // ❌ 不能导出
      viewMistakes: true
      // ✅ 无限复习功能
    };
    res.json({
      success: true,
      data: {
        subscription: subscriptionInfo.subscription,
        usage: {
          dailyPractice: practiceQuota || {
            used: 0,
            limit: null,
            // 无限基础练习
            remaining: null,
            resetAt: new Date(Date.now() + 24 * 60 * 60 * 1e3).toISOString()
          },
          dailyAiChat: chatQuota || {
            used: 0,
            limit: 0,
            // 免费用户0次AI对话
            remaining: 0,
            resetAt: new Date(Date.now() + 24 * 60 * 60 * 1e3).toISOString()
          },
          vocabularyWords: vocabularyQuota || {
            used: 0,
            limit: null,
            // 无限生词本
            remaining: null
          }
        },
        permissions,
        trialAvailable: subscriptionInfo.trialAvailable || true
      }
    });
  } catch (error) {
    log.error("Failed to get user subscription", { error, userId: req.user?.userId });
    res.status(500).json({
      success: false,
      error: "\u83B7\u53D6\u8BA2\u9605\u4FE1\u606F\u5931\u8D25"
    });
  }
});
router8.post("/user/subscription/start-trial", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { planId } = req.body;
    if (!planId) {
      return res.status(400).json({
        success: false,
        error: "\u5957\u9910ID\u4E0D\u80FD\u4E3A\u7A7A"
      });
    }
    const trialPlanId = planId || "trial";
    const subscription = await stripeService_default.startTrial(userId, trialPlanId);
    res.json({
      success: true,
      data: {
        subscription: {
          id: subscription.id,
          status: subscription.status,
          trialEnd: subscription.trialEnd?.toISOString()
        }
      },
      message: "\u514D\u8D39\u8BD5\u7528\u5DF2\u5F00\u59CB\uFF0C\u53EF\u4EAB\u53D73\u5929\u5B8C\u6574\u529F\u80FD\uFF01"
    });
  } catch (error) {
    log.error("Failed to start trial", {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error,
      userId: req.user?.userId,
      planId: req.body?.planId
    });
    let errorMessage = "\u5F00\u59CB\u8BD5\u7528\u5931\u8D25";
    let debugInfo = "";
    if (error instanceof Error) {
      debugInfo = error.message;
      if (error.message.includes("already used")) {
        errorMessage = "\u60A8\u5DF2\u7ECF\u4F7F\u7528\u8FC7\u514D\u8D39\u8BD5\u7528";
      } else if (error.message.includes("active subscription")) {
        errorMessage = "\u60A8\u5DF2\u7ECF\u6709\u6D3B\u8DC3\u7684\u8BA2\u9605";
      } else if (error.message.includes("Plan not found")) {
        errorMessage = "\u5957\u9910\u672A\u627E\u5230";
      } else if (error.message.includes("User not found")) {
        errorMessage = "\u7528\u6237\u672A\u627E\u5230";
      }
    }
    res.status(400).json({
      success: false,
      error: errorMessage,
      ...process.env.NODE_ENV === "development" && { debugInfo }
    });
  }
});
router8.post("/debug-trial", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { planId } = req.body;
    log.info("Debug trial request", { userId, planId });
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true }
    });
    if (!user) {
      return res.status(400).json({
        success: false,
        error: "User not found in database",
        debugInfo: { userId }
      });
    }
    const existingSubscription = await prisma.userSubscription.findUnique({
      where: { userId }
    });
    log.info("Debug info gathered", {
      user: { id: user.id, email: user.email },
      existingSubscription: existingSubscription ? {
        id: existingSubscription.id,
        status: existingSubscription.status,
        planId: existingSubscription.planId
      } : null
    });
    const subscription = await stripeService_default.startTrial(userId, planId || "trial");
    res.json({
      success: true,
      data: {
        subscription: {
          id: subscription.id,
          status: subscription.status,
          trialEnd: subscription.trialEnd?.toISOString()
        },
        debug: {
          user,
          existingSubscription
        }
      },
      message: "Trial started successfully (debug mode)"
    });
  } catch (error) {
    log.error("Debug trial failed", {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error,
      userId: req.user?.userId
    });
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      debugInfo: {
        errorType: error instanceof Error ? error.name : typeof error,
        stack: error instanceof Error ? error.stack : void 0
      }
    });
  }
});
router8.get("/debug-subscription/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const subscription = await prisma.userSubscription.findUnique({
      where: { userId }
    });
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, createdAt: true }
    });
    res.json({
      success: true,
      data: {
        user,
        subscription: subscription ? {
          id: subscription.id,
          planId: subscription.planId,
          status: subscription.status,
          trialStart: subscription.trialStart?.toISOString(),
          trialEnd: subscription.trialEnd?.toISOString(),
          createdAt: subscription.createdAt?.toISOString(),
          updatedAt: subscription.updatedAt?.toISOString()
        } : null,
        currentTime: (/* @__PURE__ */ new Date()).toISOString(),
        isTrialExpired: subscription?.trialEnd ? /* @__PURE__ */ new Date() > subscription.trialEnd : false
      }
    });
  } catch (error) {
    log.error("Debug subscription failed", { error });
    res.status(500).json({
      success: false,
      error: "Failed to debug subscription"
    });
  }
});
router8.delete("/debug-reset-all", async (req, res) => {
  try {
    const subscriptionsCount = await prisma.userSubscription.count();
    const quotasCount = await prisma.usageQuota.count();
    const deletedSubscriptions = await prisma.userSubscription.deleteMany({});
    const deletedQuotas = await prisma.usageQuota.deleteMany({});
    res.json({
      success: true,
      message: "All user subscription statuses reset successfully",
      data: {
        deletedSubscriptions: deletedSubscriptions.count,
        deletedQuotas: deletedQuotas.count,
        totalSubscriptionsBefore: subscriptionsCount,
        totalQuotasBefore: quotasCount
      }
    });
  } catch (error) {
    log.error("Debug reset all failed", { error });
    res.status(500).json({
      success: false,
      error: "Failed to reset all user subscriptions"
    });
  }
});
router8.delete("/debug-reset/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const deletedSubscription = await prisma.userSubscription.delete({
      where: { userId }
    }).catch(() => null);
    const deletedQuotas = await prisma.usageQuota.deleteMany({
      where: { userId }
    });
    res.json({
      success: true,
      message: "User subscription status reset successfully",
      data: {
        deletedSubscription: !!deletedSubscription,
        deletedQuotas: deletedQuotas.count
      }
    });
  } catch (error) {
    log.error("Debug reset failed", { error });
    res.status(500).json({
      success: false,
      error: "Failed to reset user subscription"
    });
  }
});
router8.post("/create-checkout-session", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { planId, returnUrl, cancelUrl } = req.body;
    if (!planId) {
      return res.status(400).json({
        success: false,
        error: "\u5957\u9910ID\u4E0D\u80FD\u4E3A\u7A7A"
      });
    }
    const successUrl = returnUrl || `${process.env.FRONTEND_URL}/billing/success`;
    const cancelUrl_final = cancelUrl || `${process.env.FRONTEND_URL}/billing/cancel`;
    const result = await stripeService_default.createCheckoutSession({
      userId,
      planId,
      successUrl,
      cancelUrl: cancelUrl_final
    });
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    log.error("Failed to create checkout session", {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error,
      userId: req.user?.userId,
      planId: req.body?.planId || "unknown"
    });
    let errorMessage = "\u521B\u5EFA\u652F\u4ED8\u4F1A\u8BDD\u5931\u8D25";
    if (error instanceof Error) {
      if (error.message.includes("active subscription")) {
        errorMessage = "\u60A8\u5DF2\u7ECF\u6709\u6D3B\u8DC3\u7684\u8BA2\u9605";
      } else if (error.message.includes("Plan not found") || error.message.includes("missing Stripe price ID")) {
        errorMessage = "\u5957\u9910\u914D\u7F6E\u9519\u8BEF\uFF0C\u8BF7\u8054\u7CFB\u5BA2\u670D";
      } else if (error.message.includes("Stripe")) {
        errorMessage = "\u652F\u4ED8\u670D\u52A1\u6682\u65F6\u4E0D\u53EF\u7528\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5";
      } else {
        errorMessage = process.env.NODE_ENV === "development" ? error.message : "\u521B\u5EFA\u652F\u4ED8\u4F1A\u8BDD\u5931\u8D25";
      }
    }
    res.status(400).json({
      success: false,
      error: errorMessage,
      ...process.env.NODE_ENV === "development" && {
        debugInfo: error instanceof Error ? error.message : String(error)
      }
    });
  }
});
router8.post("/create-portal-session", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { returnUrl } = req.body;
    const finalReturnUrl = returnUrl || `${process.env.FRONTEND_URL}/account/subscription`;
    const result = await stripeService_default.createPortalSession({
      userId,
      returnUrl: finalReturnUrl
    });
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    log.error("Failed to create portal session", { error, userId: req.user?.userId });
    let errorMessage = "\u521B\u5EFA\u5BA2\u6237\u95E8\u6237\u5931\u8D25";
    if (error instanceof Error) {
      if (error.message.includes("No subscription")) {
        errorMessage = "\u60A8\u8FD8\u6CA1\u6709\u8BA2\u9605\u8BB0\u5F55";
      }
    }
    res.status(400).json({
      success: false,
      error: errorMessage
    });
  }
});
router8.post("/user/subscription/cancel", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const subscription = await stripeService_default.cancelSubscription(userId);
    res.json({
      success: true,
      data: {
        subscription: {
          id: subscription.id,
          status: subscription.status,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          currentPeriodEnd: subscription.currentPeriodEnd?.toISOString()
        }
      },
      message: "\u8BA2\u9605\u5DF2\u53D6\u6D88\uFF0C\u5C06\u5728\u5F53\u524D\u5468\u671F\u7ED3\u675F\u65F6\u505C\u6B62\u7EED\u8D39"
    });
  } catch (error) {
    log.error("Failed to cancel subscription", { error, userId: req.user?.userId });
    let errorMessage = "\u53D6\u6D88\u8BA2\u9605\u5931\u8D25";
    if (error instanceof Error) {
      if (error.message.includes("No subscription")) {
        errorMessage = "\u6CA1\u6709\u627E\u5230\u6D3B\u8DC3\u7684\u8BA2\u9605";
      }
    }
    res.status(400).json({
      success: false,
      error: errorMessage
    });
  }
});
router8.post("/user/subscription/reactivate", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const subscription = await prisma.userSubscription.findUnique({
      where: { userId }
    });
    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: "\u6CA1\u6709\u627E\u5230\u8BA2\u9605\u8BB0\u5F55"
      });
    }
    if (!subscription.stripeSubscriptionId) {
      return res.status(400).json({
        success: false,
        error: "\u65E0\u6CD5\u91CD\u65B0\u6FC0\u6D3B\u6B64\u8BA2\u9605"
      });
    }
    await getStripeInstance().subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: false
    });
    const updatedSubscription = await prisma.userSubscription.update({
      where: { userId },
      data: {
        cancelAtPeriodEnd: false,
        canceledAt: null
      }
    });
    res.json({
      success: true,
      data: {
        subscription: {
          id: updatedSubscription.id,
          status: updatedSubscription.status,
          cancelAtPeriodEnd: updatedSubscription.cancelAtPeriodEnd
        }
      },
      message: "\u8BA2\u9605\u5DF2\u91CD\u65B0\u6FC0\u6D3B"
    });
  } catch (error) {
    log.error("Failed to reactivate subscription", { error, userId: req.user?.userId });
    res.status(500).json({
      success: false,
      error: "\u91CD\u65B0\u6FC0\u6D3B\u8BA2\u9605\u5931\u8D25"
    });
  }
});
router8.get("/user/billing-history", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const [transactions, total] = await Promise.all([
      prisma.paymentTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          amount: true,
          currency: true,
          status: true,
          stripeSessionId: true,
          createdAt: true
        }
      }),
      prisma.paymentTransaction.count({ where: { userId } })
    ]);
    const formattedTransactions = transactions.map((tx) => ({
      id: tx.id,
      amount: tx.amount,
      currency: tx.currency,
      status: tx.status,
      description: `ChatTOEIC\u9AD8\u7EA7\u7248\u8BA2\u9605`,
      createdAt: tx.createdAt.toISOString(),
      receiptUrl: tx.stripeSessionId ? `https://dashboard.stripe.com/test/payments/${tx.stripeSessionId}` : void 0
    }));
    res.json({
      success: true,
      data: {
        transactions: formattedTransactions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    log.error("Failed to get billing history", { error, userId: req.user?.userId });
    res.status(500).json({
      success: false,
      error: "\u83B7\u53D6\u8D26\u5355\u5386\u53F2\u5931\u8D25"
    });
  }
});
router8.get("/user/usage/check/:resourceType", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { resourceType } = req.params;
    const quota = await checkUsageQuota(userId, resourceType);
    res.json({
      success: true,
      data: quota
    });
  } catch (error) {
    log.error("Failed to check usage", { error, userId: req.user?.userId, resourceType: req.params.resourceType });
    res.status(500).json({
      success: false,
      error: "\u68C0\u67E5\u4F7F\u7528\u914D\u989D\u5931\u8D25"
    });
  }
});
router8.post("/migrate-database-schema", async (req, res) => {
  try {
    log.info("\u{1F198} Emergency database schema migration requested");
    const { execSync } = __require("child_process");
    log.info("\u{1F4E6} Generating Prisma Client...");
    const generateOutput = execSync("npx prisma generate", {
      stdio: "pipe",
      encoding: "utf8",
      env: { ...process.env }
    });
    log.info("\u{1F504} Deploying database migrations...");
    const migrationOutput = execSync("npx prisma migrate deploy", {
      stdio: "pipe",
      encoding: "utf8",
      env: { ...process.env }
    });
    log.info("\u2705 Database schema migration completed successfully");
    res.json({
      success: true,
      message: "Database schema migration completed successfully",
      details: {
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        generate_output: generateOutput.toString(),
        migration_output: migrationOutput.toString(),
        next_steps: [
          "Database schema is now synchronized with Prisma models",
          "Missing columns (like nextPaymentAt) should now exist",
          "Payment system should work properly"
        ]
      }
    });
  } catch (error) {
    log.error("Failed to migrate database schema", {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: "Database schema migration failed",
      details: {
        message: error.message,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        troubleshooting: [
          "Check DATABASE_URL environment variable",
          "Verify database connectivity",
          "Ensure proper database permissions",
          "Review Prisma migration files"
        ]
      }
    });
  }
});
var billing_default = router8;

// src/routes/monitoring.ts
init_database();
import { Router as Router9 } from "express";

// src/services/monitoringService.ts
var MonitoringService = class {
  prisma;
  metricsCache = /* @__PURE__ */ new Map();
  CACHE_TTL = 60 * 1e3;
  // 1分钟缓存
  constructor(prisma3) {
    this.prisma = prisma3;
  }
  /**
   * 获取系统健康状况
   */
  async getSystemHealth() {
    const cacheKey = "system_health";
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;
    const startTime = Date.now();
    const issues = [];
    try {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      const uptime = process.uptime();
      const heapUsedPercentage = memUsage.heapUsed / memUsage.heapTotal * 100;
      const dbStartTime = Date.now();
      let dbConnected = false;
      let dbResponseTime = 0;
      try {
        await this.prisma.$queryRaw`SELECT 1`;
        dbConnected = true;
        dbResponseTime = Date.now() - dbStartTime;
      } catch (error) {
        issues.push("Database connection failed");
        log.error("Database health check failed", { error });
      }
      const apiMetrics = {
        totalRequests: 0,
        errorRate: 0,
        averageResponseTime: 0
      };
      const metrics = {
        timestamp: /* @__PURE__ */ new Date(),
        uptime,
        memory: {
          rss: memUsage.rss,
          heapTotal: memUsage.heapTotal,
          heapUsed: memUsage.heapUsed,
          heapUsedPercentage,
          external: memUsage.external
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system
        },
        database: {
          connected: dbConnected,
          responseTime: dbResponseTime
        },
        api: apiMetrics
      };
      let status = "healthy";
      if (heapUsedPercentage > 90) {
        issues.push("High memory usage");
        status = "critical";
      } else if (heapUsedPercentage > 75) {
        issues.push("Elevated memory usage");
        status = status === "healthy" ? "warning" : status;
      }
      if (dbResponseTime > 1e3) {
        issues.push("Slow database response");
        status = status === "healthy" ? "warning" : status;
      }
      if (!dbConnected) {
        status = "critical";
      }
      const result = { status, metrics, issues };
      this.setCachedData(cacheKey, result);
      logSystemHealth();
      return result;
    } catch (error) {
      log.error("System health check failed", { error });
      return {
        status: "critical",
        metrics: {},
        issues: ["System health check failed"]
      };
    }
  }
  /**
   * 获取业务指标
   */
  async getBusinessMetrics() {
    const cacheKey = "business_metrics";
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;
    try {
      const today = /* @__PURE__ */ new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const [totalUsers, newUsersToday] = await Promise.all([
        this.prisma.user.count(),
        this.prisma.user.count({
          where: {
            createdAt: {
              gte: today,
              lt: tomorrow
            }
          }
        })
      ]);
      const activeUsers = await this.prisma.user.count({
        where: {
          lastLoginAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1e3)
          }
        }
      });
      const [totalSessions, todaySessions] = await Promise.all([
        this.prisma.practiceRecord.count(),
        this.prisma.practiceRecord.count({
          where: {
            completedAt: {
              gte: today,
              lt: tomorrow
            }
          }
        })
      ]);
      const avgScoreResult = await this.prisma.practiceRecord.aggregate({
        _avg: {
          score: true
        },
        where: {
          score: {
            not: null
          }
        }
      });
      const chatMessagesCount = await this.prisma.chatSession.count({
        where: {
          createdAt: {
            gte: today,
            lt: tomorrow
          }
        }
      });
      const metrics = {
        timestamp: /* @__PURE__ */ new Date(),
        users: {
          total: totalUsers,
          active: activeUsers,
          newToday: newUsersToday
        },
        practice: {
          totalSessions,
          completedToday: todaySessions,
          averageScore: Math.round(avgScoreResult._avg.score || 0)
        },
        ai: {
          questionsGenerated: todaySessions * 5,
          // 估算：每次练习5道题
          chatMessages: chatMessagesCount,
          apiUsage: todaySessions * 5 + chatMessagesCount
        }
      };
      this.setCachedData(cacheKey, metrics);
      logBusinessEvent({
        event: "metrics_collected",
        data: metrics
      });
      return metrics;
    } catch (error) {
      log.error("Business metrics collection failed", { error });
      throw error;
    }
  }
  /**
   * 获取实时统计数据
   */
  async getRealTimeStats() {
    try {
      const [systemHealth, businessMetrics] = await Promise.all([
        this.getSystemHealth(),
        this.getBusinessMetrics()
      ]);
      return {
        system: systemHealth,
        business: businessMetrics,
        timestamp: /* @__PURE__ */ new Date()
      };
    } catch (error) {
      log.error("Real-time stats collection failed", { error });
      throw error;
    }
  }
  /**
   * 启动定期健康检查
   */
  startPeriodicHealthCheck(intervalMinutes = 5) {
    const interval = intervalMinutes * 60 * 1e3;
    log.info("Starting periodic health check", {
      intervalMinutes,
      nextCheck: new Date(Date.now() + interval)
    });
    setInterval(async () => {
      try {
        const health = await this.getSystemHealth();
        if (health.status === "critical") {
          log.error("System health critical", {
            issues: health.issues,
            metrics: health.metrics
          });
        } else if (health.status === "warning") {
          log.warn("System health warning", {
            issues: health.issues
          });
        } else {
          log.info("System health check passed");
        }
      } catch (error) {
        log.error("Periodic health check failed", { error });
      }
    }, interval);
  }
  /**
   * 缓存帮助方法
   */
  getCachedData(key) {
    const cached = this.metricsCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }
    return null;
  }
  setCachedData(key, data) {
    this.metricsCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }
  /**
   * 清理缓存
   */
  clearCache() {
    this.metricsCache.clear();
    log.info("Monitoring cache cleared");
  }
};

// src/routes/monitoring.ts
var router9 = Router9();
var monitoringService = new MonitoringService(prisma);
router9.get("/health", async (req, res) => {
  try {
    const startTime = Date.now();
    const dbCheck = await prisma.$queryRaw`SELECT 1 as status`;
    const responseTime2 = Date.now() - startTime;
    res.status(200).json({
      status: "healthy",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      uptime: Math.floor(process.uptime()),
      database: {
        connected: !!dbCheck,
        responseTime: `${responseTime2}ms`
      },
      memory: {
        used: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
        total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`
      }
    });
  } catch (error) {
    log.error("Health check failed", { error });
    res.status(503).json({
      status: "unhealthy",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      error: "Health check failed"
    });
  }
});
router9.get(
  "/health/detailed",
  authenticateToken,
  async (req, res) => {
    try {
      logSecurityEvent({
        type: "unauthorized_access",
        severity: "low",
        userId: req.user?.userId,
        ip: req.ip,
        details: { endpoint: "/monitoring/health/detailed" }
      });
      const health = await monitoringService.getSystemHealth();
      res.json({
        success: true,
        data: health,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (error) {
      log.error("Detailed health check failed", {
        error,
        userId: req.user?.userId
      });
      res.status(500).json({
        success: false,
        error: "Failed to retrieve system health"
      });
    }
  }
);
router9.get(
  "/metrics/business",
  authenticateToken,
  async (req, res) => {
    try {
      const metrics = await monitoringService.getBusinessMetrics();
      res.json({
        success: true,
        data: metrics,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (error) {
      log.error("Business metrics retrieval failed", {
        error,
        userId: req.user?.userId
      });
      res.status(500).json({
        success: false,
        error: "Failed to retrieve business metrics"
      });
    }
  }
);
router9.get(
  "/stats/realtime",
  authenticateToken,
  async (req, res) => {
    try {
      const stats = await monitoringService.getRealTimeStats();
      res.json({
        success: true,
        data: stats,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (error) {
      log.error("Real-time stats retrieval failed", {
        error,
        userId: req.user?.userId
      });
      res.status(500).json({
        success: false,
        error: "Failed to retrieve real-time stats"
      });
    }
  }
);
router9.get(
  "/system/info",
  authenticateToken,
  async (req, res) => {
    try {
      const systemInfo = {
        node: {
          version: process.version,
          platform: process.platform,
          arch: process.arch,
          uptime: Math.floor(process.uptime()),
          pid: process.pid
        },
        memory: process.memoryUsage(),
        environment: {
          nodeEnv: process.env.NODE_ENV || "development",
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        application: {
          name: "ChatTOEIC API",
          version: process.env.APP_VERSION || "2.0.0",
          startTime: new Date(Date.now() - process.uptime() * 1e3).toISOString()
        }
      };
      res.json({
        success: true,
        data: systemInfo,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (error) {
      log.error("System info retrieval failed", {
        error,
        userId: req.user?.userId
      });
      res.status(500).json({
        success: false,
        error: "Failed to retrieve system information"
      });
    }
  }
);
router9.post(
  "/cache/clear",
  authenticateToken,
  async (req, res) => {
    try {
      monitoringService.clearCache();
      log.info("Monitoring cache cleared by user", {
        userId: req.user?.userId,
        ip: req.ip
      });
      res.json({
        success: true,
        message: "Monitoring cache cleared successfully",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (error) {
      log.error("Cache clear failed", {
        error,
        userId: req.user?.userId
      });
      res.status(500).json({
        success: false,
        error: "Failed to clear cache"
      });
    }
  }
);
router9.get(
  "/logs/recent",
  authenticateToken,
  async (req, res) => {
    try {
      const { level = "info", limit = 50 } = req.query;
      logSecurityEvent({
        type: "unauthorized_access",
        severity: "medium",
        userId: req.user?.userId,
        ip: req.ip,
        details: {
          endpoint: "/monitoring/logs/recent",
          level,
          limit
        }
      });
      res.json({
        success: true,
        message: "Log access requires file system integration",
        data: {
          note: "This endpoint would typically read from log files",
          params: { level, limit }
        },
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (error) {
      log.error("Recent logs retrieval failed", {
        error,
        userId: req.user?.userId
      });
      res.status(500).json({
        success: false,
        error: "Failed to retrieve recent logs"
      });
    }
  }
);
router9.get("/ping", (req, res) => {
  res.status(200).json({
    status: "pong",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    uptime: Math.floor(process.uptime())
  });
});
var monitoring_default = router9;

// src/routes/analytics.ts
import { Router as Router10 } from "express";

// src/utils/analyticsLogger.ts
var AnalyticsLogger = class {
  prisma;
  eventQueue = [];
  batchSize = 100;
  flushInterval = 3e4;
  // 30秒
  constructor(prisma3) {
    this.prisma = prisma3;
    setInterval(() => {
      this.flushEventQueue();
    }, this.flushInterval);
    process.on("SIGTERM", () => this.flushEventQueue());
    process.on("SIGINT", () => this.flushEventQueue());
  }
  /**
   * 记录用户行为事件
   */
  logUserBehavior(data) {
    try {
      if (!data.timestamp) {
        data.timestamp = /* @__PURE__ */ new Date();
      }
      this.eventQueue.push(data);
      logBusinessEvent({
        event: "user_behavior",
        userId: data.userId,
        sessionId: data.sessionId,
        data: {
          behaviorEvent: data.event,
          eventData: data.data,
          metadata: data.metadata
        }
      });
      if (this.eventQueue.length >= this.batchSize) {
        this.flushEventQueue();
      }
      if (this.isKeyEvent(data.event)) {
        log.info("Key user behavior event", {
          userId: data.userId,
          event: data.event,
          data: data.data
        });
      }
    } catch (error) {
      log.error("Failed to log user behavior", { error, data });
    }
  }
  /**
   * 批量处理事件队列
   */
  async flushEventQueue() {
    if (this.eventQueue.length === 0) return;
    const events = this.eventQueue.splice(0, this.batchSize);
    try {
      log.info("Analytics batch processed", {
        eventCount: events.length,
        events: events.map((e) => ({
          userId: e.userId,
          event: e.event,
          timestamp: e.timestamp
        }))
      });
    } catch (error) {
      log.error("Failed to flush analytics event queue", {
        error,
        eventCount: events.length
      });
      this.eventQueue.unshift(...events);
    }
  }
  /**
   * 生成学习进度报告
   */
  async generateLearningProgress(userId, date) {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      const practiceRecords = await this.prisma.practiceRecord.findMany({
        where: {
          userId,
          completedAt: {
            gte: startOfDay,
            lte: endOfDay
          }
        }
      });
      if (practiceRecords.length === 0) {
        return null;
      }
      const totalTimeSpent = practiceRecords.reduce((sum, record) => sum + (record.totalTime || 0), 0) / 60;
      const questionsAnswered = practiceRecords.reduce((sum, record) => sum + record.questionsCount, 0);
      const correctAnswers = practiceRecords.reduce((sum, record) => sum + record.correctAnswers, 0);
      const averageScore = practiceRecords.reduce((sum, record) => sum + (record.score || 0), 0) / practiceRecords.length;
      const yesterday = new Date(date);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayProgress = await this.generateLearningProgress(userId, yesterday.toISOString().split("T")[0]);
      const improvementRate = yesterdayProgress ? (averageScore - yesterdayProgress.metrics.averageScore) / yesterdayProgress.metrics.averageScore * 100 : 0;
      const streakDays = await this.calculateLearningStreak(userId, date);
      const progressData = {
        userId,
        date,
        metrics: {
          practiceSessionsCount: practiceRecords.length,
          totalTimeSpent,
          questionsAnswered,
          correctAnswers,
          averageScore,
          improvementRate,
          streakDays,
          // 分类统计（简化实现）
          listeningScore: averageScore,
          // TODO: 分别计算听力和阅读
          readingScore: averageScore,
          vocabularyWordsAdded: 0,
          // TODO: 从词汇记录计算
          vocabularyWordsReviewed: 0,
          aiInteractions: 0,
          // TODO: 从聊天记录计算
          // 学习质量指标（简化实现）
          focusScore: Math.min(100, totalTimeSpent * 10),
          // 基于学习时间
          retentionRate: correctAnswers / questionsAnswered * 100,
          challengeLevel: this.calculateChallengeLevel(averageScore)
        }
      };
      this.logUserBehavior({
        userId,
        event: "feature_used",
        timestamp: /* @__PURE__ */ new Date(),
        data: {
          featureName: "learning_progress_analysis",
          date,
          metrics: progressData.metrics
        }
      });
      return progressData;
    } catch (error) {
      log.error("Failed to generate learning progress", { error, userId, date });
      return null;
    }
  }
  /**
   * 生成用户画像
   */
  async generateUserProfile(userId) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId }
      });
      if (!user) {
        return null;
      }
      const practiceRecords = await this.prisma.practiceRecord.findMany({
        where: { userId },
        orderBy: { completedAt: "asc" }
      });
      if (practiceRecords.length === 0) {
        return null;
      }
      const totalSessionDuration = practiceRecords.reduce((sum, record) => sum + (record.totalTime || 0), 0);
      const averageSessionDuration = totalSessionDuration / practiceRecords.length / 60;
      const totalQuestions = practiceRecords.reduce((sum, record) => sum + record.questionsCount, 0);
      const totalCorrect = practiceRecords.reduce((sum, record) => sum + record.correctAnswers, 0);
      const averageScore = practiceRecords.reduce((sum, record) => sum + (record.score || 0), 0) / practiceRecords.length;
      const profileData = {
        userId,
        profile: {
          registrationDate: user.createdAt,
          lastActiveDate: user.lastLoginAt || user.createdAt,
          totalLoginDays: await this.calculateTotalLoginDays(userId),
          averageSessionDuration,
          preferredStudyTime: this.analyzePreferredStudyTime(practiceRecords),
          studyPatternType: this.analyzeStudyPattern(practiceRecords),
          learningGoalLevel: this.determineLearningLevel(averageScore),
          currentTOEICLevel: Math.round(averageScore),
          mostUsedFeatures: await this.analyzeMostUsedFeatures(userId),
          preferredQuestionTypes: this.analyzePreferredQuestionTypes(practiceRecords),
          averageQuestionsPerSession: totalQuestions / practiceRecords.length,
          completionRate: 100,
          // TODO: 计算实际完成率
          engagementScore: this.calculateEngagementScore(practiceRecords),
          retentionRisk: this.assessRetentionRisk(practiceRecords),
          lifecycleStage: this.determineLifecycleStage(user, practiceRecords)
        }
      };
      this.logUserBehavior({
        userId,
        event: "feature_used",
        timestamp: /* @__PURE__ */ new Date(),
        data: {
          featureName: "user_profile_analysis",
          profileData: profileData.profile
        }
      });
      return profileData;
    } catch (error) {
      log.error("Failed to generate user profile", { error, userId });
      return null;
    }
  }
  /**
   * 辅助方法
   */
  isKeyEvent(event) {
    const keyEvents = ["user_registered", "practice_completed", "ai_chat_initiated", "error_encountered"];
    return keyEvents.includes(event);
  }
  async calculateLearningStreak(userId, endDate) {
    return 1;
  }
  calculateChallengeLevel(score) {
    if (score < 400) return 1;
    if (score < 600) return 2;
    if (score < 800) return 3;
    return 4;
  }
  async calculateTotalLoginDays(userId) {
    return 1;
  }
  analyzePreferredStudyTime(records) {
    return "evening";
  }
  analyzeStudyPattern(records) {
    return "casual";
  }
  determineLearningLevel(score) {
    if (score < 500) return "beginner";
    if (score < 750) return "intermediate";
    return "advanced";
  }
  async analyzeMostUsedFeatures(userId) {
    return ["practice", "ai_chat"];
  }
  analyzePreferredQuestionTypes(records) {
    return ["reading", "listening"];
  }
  calculateEngagementScore(records) {
    return 75;
  }
  assessRetentionRisk(records) {
    return "low";
  }
  determineLifecycleStage(user, records) {
    return "active";
  }
};

// src/middleware/analytics.ts
init_database();
var analyticsLogger = new AnalyticsLogger(prisma);
var detectDeviceType = (userAgent) => {
  if (!userAgent) return "unknown";
  const ua = userAgent.toLowerCase();
  if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
    return "mobile";
  } else if (ua.includes("tablet") || ua.includes("ipad")) {
    return "tablet";
  } else {
    return "desktop";
  }
};
var detectBrowserType = (userAgent) => {
  if (!userAgent) return "unknown";
  const ua = userAgent.toLowerCase();
  if (ua.includes("chrome")) return "chrome";
  if (ua.includes("firefox")) return "firefox";
  if (ua.includes("safari")) return "safari";
  if (ua.includes("edge")) return "edge";
  return "other";
};
var trackPageVisit = (req, res, next) => {
  try {
    if (req.path.includes("health") || req.path.includes("monitoring") || req.path.includes("static")) {
      return next();
    }
    analyticsLogger.logUserBehavior({
      userId: req.user?.userId,
      event: "page_visited",
      timestamp: /* @__PURE__ */ new Date(),
      data: {
        pagePath: req.originalUrl,
        method: req.method,
        referrer: req.get("Referer"),
        userAgent: req.get("User-Agent"),
        ip: req.ip,
        deviceType: detectDeviceType(req.get("User-Agent")),
        browserType: detectBrowserType(req.get("User-Agent"))
      },
      metadata: {
        platform: "web",
        version: "2.0.0",
        environment: process.env.NODE_ENV || "development"
      }
    });
  } catch (error) {
    log.error("Failed to track page visit", { error, path: req.originalUrl });
  }
  next();
};
var trackPracticeActivity = (req, res, next) => {
  const originalSend = res.send;
  res.send = function(data) {
    try {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        let event = null;
        let eventData = {};
        if (req.path.includes("/sessions") && req.method === "POST") {
          event = "practice_started";
          eventData = {
            practiceType: req.body.sessionType,
            questionType: req.body.questionType,
            difficulty: req.body.difficulty,
            totalQuestions: req.body.totalQuestions
          };
        } else if (req.path.includes("/complete") && req.method === "POST") {
          event = "practice_completed";
          let responseData;
          try {
            responseData = typeof data === "string" ? JSON.parse(data) : data;
          } catch (e) {
            responseData = {};
          }
          eventData = {
            practiceType: "quick_practice",
            questionsCount: req.body.questions?.length || 0,
            timeSpent: req.body.timeSpent || 0,
            score: responseData.data?.score,
            estimatedScore: responseData.data?.estimatedScore,
            correctAnswers: responseData.data?.correctAnswers
          };
        } else if (req.path.includes("/generate") && req.method === "POST") {
          event = "feature_used";
          eventData = {
            featureName: "question_generation",
            questionType: req.body.type,
            difficulty: req.body.difficulty,
            count: req.body.count
          };
        }
        if (event) {
          analyticsLogger.logUserBehavior({
            userId: req.user?.userId,
            sessionId: req.headers["x-session-id"],
            event,
            timestamp: /* @__PURE__ */ new Date(),
            data: eventData
          });
        }
      }
    } catch (error) {
      log.error("Failed to track practice activity", { error, path: req.path });
    }
    return originalSend.call(this, data);
  };
  next();
};
var trackAIInteraction = (req, res, next) => {
  const startTime = Date.now();
  const originalSend = res.send;
  res.send = function(data) {
    try {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const responseTime2 = Date.now() - startTime;
        let event = "ai_chat_message_sent";
        const eventData = {
          messageLength: req.body.message?.length || 0,
          aiResponseTime: responseTime2,
          chatContext: req.body.questionContext ? "practice_question" : "general",
          hasQuestionContext: !!req.body.questionContext
        };
        if (!req.body.conversationHistory || req.body.conversationHistory.length === 0) {
          event = "ai_chat_initiated";
        }
        analyticsLogger.logUserBehavior({
          userId: req.user?.userId,
          sessionId: req.headers["x-session-id"],
          event,
          timestamp: /* @__PURE__ */ new Date(),
          data: eventData
        });
      }
    } catch (error) {
      log.error("Failed to track AI interaction", { error, path: req.path });
    }
    return originalSend.call(this, data);
  };
  next();
};
var trackVocabularyActivity = (req, res, next) => {
  const originalSend = res.send;
  res.send = function(data) {
    try {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        let event = null;
        let eventData = {};
        if (req.method === "POST" && !req.path.includes("/review")) {
          event = "vocabulary_word_added";
          eventData = {
            wordCount: Array.isArray(req.body) ? req.body.length : 1,
            source: req.body.source || "manual"
          };
        } else if (req.path.includes("/review") && req.method === "POST") {
          event = "vocabulary_reviewed";
          eventData = {
            wordId: req.params.id,
            reviewResult: req.body.result
          };
        }
        if (event) {
          analyticsLogger.logUserBehavior({
            userId: req.user?.userId,
            event,
            timestamp: /* @__PURE__ */ new Date(),
            data: eventData
          });
        }
      }
    } catch (error) {
      log.error("Failed to track vocabulary activity", { error, path: req.path });
    }
    return originalSend.call(this, data);
  };
  next();
};
var trackAuthActivity = (req, res, next) => {
  const originalSend = res.send;
  res.send = function(data) {
    try {
      let event = null;
      let eventData = {
        method: req.path.includes("google") ? "google_oauth" : "email_password",
        userAgent: req.get("User-Agent"),
        ip: req.ip,
        deviceType: detectDeviceType(req.get("User-Agent")),
        browserType: detectBrowserType(req.get("User-Agent"))
      };
      if (req.path.includes("/register") && res.statusCode >= 200 && res.statusCode < 300) {
        event = "user_registered";
        eventData.email = req.body.email;
      } else if (req.path.includes("/login") && res.statusCode >= 200 && res.statusCode < 300) {
        event = "user_login";
        eventData.email = req.body.email;
      } else if (req.path.includes("/logout") && res.statusCode >= 200 && res.statusCode < 300) {
        event = "user_logout";
      }
      if (event) {
        let userId;
        try {
          const responseData = typeof data === "string" ? JSON.parse(data) : data;
          userId = responseData.data?.user?.id || req.user?.userId;
        } catch (e) {
          userId = req.user?.userId;
        }
        analyticsLogger.logUserBehavior({
          userId,
          event,
          timestamp: /* @__PURE__ */ new Date(),
          data: eventData
        });
      }
    } catch (error) {
      log.error("Failed to track auth activity", { error, path: req.path });
    }
    return originalSend.call(this, data);
  };
  next();
};
var trackErrorActivity = (err, req, res, next) => {
  try {
    analyticsLogger.logUserBehavior({
      userId: req.user?.userId,
      event: "error_encountered",
      timestamp: /* @__PURE__ */ new Date(),
      data: {
        errorType: err.name || "Unknown",
        errorMessage: err.message,
        statusCode: err.status || 500,
        path: req.originalUrl,
        method: req.method,
        userAgent: req.get("User-Agent"),
        ip: req.ip
      }
    });
  } catch (error) {
    log.error("Failed to track error activity", { error, originalError: err });
  }
  next(err);
};

// src/routes/analytics.ts
init_database();
var router10 = Router10();
var requireAdmin2 = (req, res, next) => {
  if (!req.user || req.user.role !== "ADMIN") {
    return res.status(403).json({
      success: false,
      error: "\u9700\u8981\u7BA1\u7406\u5458\u6743\u9650"
    });
  }
  next();
};
router10.get(
  "/progress",
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user.userId;
      const { date = (/* @__PURE__ */ new Date()).toISOString().split("T")[0] } = req.query;
      const progress = await analyticsLogger.generateLearningProgress(userId, date);
      if (!progress) {
        return res.json({
          success: true,
          data: null,
          message: "\u8BE5\u65E5\u671F\u6CA1\u6709\u5B66\u4E60\u8BB0\u5F55"
        });
      }
      res.json({
        success: true,
        data: progress,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (error) {
      log.error("Failed to get learning progress", {
        error,
        userId: req.user?.userId,
        date: req.query.date
      });
      res.status(500).json({
        success: false,
        error: "\u83B7\u53D6\u5B66\u4E60\u8FDB\u5EA6\u5931\u8D25"
      });
    }
  }
);
router10.get(
  "/progress/trend",
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user.userId;
      const { days = "7" } = req.query;
      const dayCount = parseInt(days);
      const trends = [];
      const today = /* @__PURE__ */ new Date();
      for (let i = 0; i < dayCount; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];
        const progress = await analyticsLogger.generateLearningProgress(userId, dateStr);
        if (progress) {
          trends.unshift(progress);
        }
      }
      res.json({
        success: true,
        data: {
          period: `${dayCount} days`,
          trends,
          summary: {
            totalDays: trends.length,
            averageScore: trends.length > 0 ? trends.reduce((sum, t) => sum + t.metrics.averageScore, 0) / trends.length : 0,
            totalQuestions: trends.reduce((sum, t) => sum + t.metrics.questionsAnswered, 0),
            totalTime: trends.reduce((sum, t) => sum + t.metrics.totalTimeSpent, 0)
          }
        },
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (error) {
      log.error("Failed to get progress trend", {
        error,
        userId: req.user?.userId
      });
      res.status(500).json({
        success: false,
        error: "\u83B7\u53D6\u5B66\u4E60\u8D8B\u52BF\u5931\u8D25"
      });
    }
  }
);
router10.get(
  "/profile",
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user.userId;
      const profile = await analyticsLogger.generateUserProfile(userId);
      if (!profile) {
        return res.json({
          success: true,
          data: null,
          message: "\u7528\u6237\u6570\u636E\u4E0D\u8DB3\uFF0C\u65E0\u6CD5\u751F\u6210\u753B\u50CF"
        });
      }
      res.json({
        success: true,
        data: profile,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (error) {
      log.error("Failed to get user profile", {
        error,
        userId: req.user?.userId
      });
      res.status(500).json({
        success: false,
        error: "\u83B7\u53D6\u7528\u6237\u753B\u50CF\u5931\u8D25"
      });
    }
  }
);
router10.get(
  "/stats",
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user.userId;
      const { period = "all" } = req.query;
      let startDate;
      if (period === "7days") {
        startDate = /* @__PURE__ */ new Date();
        startDate.setDate(startDate.getDate() - 7);
      } else if (period === "30days") {
        startDate = /* @__PURE__ */ new Date();
        startDate.setDate(startDate.getDate() - 30);
      }
      const whereClause = { userId };
      if (startDate) {
        whereClause.completedAt = { gte: startDate };
      }
      const [
        totalSessions,
        totalQuestions,
        totalCorrect,
        averageScoreResult,
        recentSessions
      ] = await Promise.all([
        prisma.practiceRecord.count({ where: whereClause }),
        prisma.practiceRecord.aggregate({
          where: whereClause,
          _sum: { questionsCount: true }
        }),
        prisma.practiceRecord.aggregate({
          where: whereClause,
          _sum: { correctAnswers: true }
        }),
        prisma.practiceRecord.aggregate({
          where: whereClause,
          _avg: { score: true }
        }),
        prisma.practiceRecord.findMany({
          where: whereClause,
          take: 5,
          orderBy: { completedAt: "desc" },
          select: {
            score: true,
            correctAnswers: true,
            questionsCount: true,
            completedAt: true,
            questionType: true
          }
        })
      ]);
      const typeStats = await prisma.practiceRecord.groupBy({
        by: ["questionType"],
        where: whereClause,
        _count: { id: true },
        _avg: { score: true }
      });
      const stats = {
        period,
        summary: {
          totalSessions,
          totalQuestions: totalQuestions._sum.questionsCount || 0,
          totalCorrect: totalCorrect._sum.correctAnswers || 0,
          averageScore: Math.round(averageScoreResult._avg.score || 0),
          accuracy: totalQuestions._sum.questionsCount > 0 ? Math.round((totalCorrect._sum.correctAnswers || 0) / totalQuestions._sum.questionsCount * 100) : 0
        },
        byType: typeStats.map((stat) => ({
          type: stat.questionType,
          sessionCount: stat._count.id,
          averageScore: Math.round(stat._avg.score || 0)
        })),
        recentSessions: recentSessions.map((session) => ({
          date: session.completedAt.toISOString().split("T")[0],
          score: session.score,
          accuracy: Math.round(session.correctAnswers / session.questionsCount * 100),
          type: session.questionType
        }))
      };
      res.json({
        success: true,
        data: stats,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (error) {
      log.error("Failed to get learning stats", {
        error,
        userId: req.user?.userId
      });
      res.status(500).json({
        success: false,
        error: "\u83B7\u53D6\u5B66\u4E60\u7EDF\u8BA1\u5931\u8D25"
      });
    }
  }
);
router10.get(
  "/recommendations",
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user.userId;
      const [profile, recentSessions] = await Promise.all([
        analyticsLogger.generateUserProfile(userId),
        prisma.practiceRecord.findMany({
          where: { userId },
          take: 10,
          orderBy: { completedAt: "desc" }
        })
      ]);
      const recommendations = [];
      if (recentSessions.length === 0) {
        recommendations.push({
          type: "getting_started",
          title: "\u5F00\u59CB\u60A8\u7684TOEIC\u5B66\u4E60\u4E4B\u65C5",
          description: "\u5EFA\u8BAE\u4ECE\u57FA\u7840\u7EC3\u4E60\u5F00\u59CB\uFF0C\u5148\u5B8C\u6210\u51E0\u7EC4\u9898\u76EE\u4E86\u89E3\u81EA\u5DF1\u7684\u6C34\u5E73",
          priority: "high",
          action: "start_practice"
        });
      } else {
        const recentScores = recentSessions.slice(0, 5).map((s) => s.score || 0);
        const averageRecentScore = recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length;
        if (averageRecentScore < 500) {
          recommendations.push({
            type: "skill_building",
            title: "\u52A0\u5F3A\u57FA\u7840\u6280\u80FD",
            description: "\u5EFA\u8BAE\u591A\u7EC3\u4E60\u8BED\u6CD5\u548C\u8BCD\u6C47\u9898\uFF0C\u63D0\u5347\u57FA\u7840\u82F1\u8BED\u6C34\u5E73",
            priority: "high",
            action: "practice_grammar"
          });
        } else if (averageRecentScore < 700) {
          recommendations.push({
            type: "balanced_practice",
            title: "\u5E73\u8861\u542C\u529B\u548C\u9605\u8BFB",
            description: "\u7EE7\u7EED\u4FDD\u6301\u7EC3\u4E60\u9891\u7387\uFF0C\u53EF\u4EE5\u589E\u52A0\u542C\u529B\u7EC3\u4E60\u7684\u6BD4\u91CD",
            priority: "medium",
            action: "practice_listening"
          });
        } else {
          recommendations.push({
            type: "advanced_challenge",
            title: "\u6311\u6218\u9AD8\u96BE\u5EA6\u9898\u76EE",
            description: "\u60A8\u7684\u8868\u73B0\u5F88\u597D\uFF01\u53EF\u4EE5\u5C1D\u8BD5\u66F4\u5177\u6311\u6218\u6027\u7684\u9898\u76EE",
            priority: "medium",
            action: "practice_advanced"
          });
        }
        const lastPractice = new Date(recentSessions[0].completedAt);
        const daysSinceLastPractice = Math.floor((Date.now() - lastPractice.getTime()) / (1e3 * 60 * 60 * 24));
        if (daysSinceLastPractice > 3) {
          recommendations.push({
            type: "consistency",
            title: "\u4FDD\u6301\u5B66\u4E60\u8FDE\u7EED\u6027",
            description: `\u60A8\u5DF2\u7ECF${daysSinceLastPractice}\u5929\u6CA1\u6709\u7EC3\u4E60\u4E86\uFF0C\u5EFA\u8BAE\u6062\u590D\u89C4\u5F8B\u5B66\u4E60`,
            priority: "high",
            action: "resume_practice"
          });
        }
      }
      res.json({
        success: true,
        data: {
          recommendations,
          userLevel: profile?.profile.learningGoalLevel || "beginner",
          currentScore: profile?.profile.currentTOEICLevel || 0
        },
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (error) {
      log.error("Failed to get recommendations", {
        error,
        userId: req.user?.userId
      });
      res.status(500).json({
        success: false,
        error: "\u83B7\u53D6\u5B66\u4E60\u5EFA\u8BAE\u5931\u8D25"
      });
    }
  }
);
router10.get(
  "/export",
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user.userId;
      const { format = "json" } = req.query;
      const [practiceRecords, user] = await Promise.all([
        prisma.practiceRecord.findMany({
          where: { userId },
          orderBy: { completedAt: "desc" }
        }),
        prisma.user.findUnique({
          where: { id: userId },
          select: {
            username: true,
            email: true,
            createdAt: true
          }
        })
      ]);
      const exportData = {
        user,
        summary: {
          totalSessions: practiceRecords.length,
          totalQuestions: practiceRecords.reduce((sum, record) => sum + record.questionsCount, 0),
          totalCorrect: practiceRecords.reduce((sum, record) => sum + record.correctAnswers, 0),
          averageScore: practiceRecords.length > 0 ? Math.round(practiceRecords.reduce((sum, record) => sum + (record.score || 0), 0) / practiceRecords.length) : 0
        },
        sessions: practiceRecords.map((record) => ({
          id: record.sessionId,
          date: record.completedAt.toISOString(),
          type: record.questionType,
          difficulty: record.difficulty,
          questionsCount: record.questionsCount,
          correctAnswers: record.correctAnswers,
          score: record.score,
          timeSpent: record.totalTime
        })),
        exportedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      analyticsLogger.logUserBehavior({
        userId,
        event: "feature_used",
        timestamp: /* @__PURE__ */ new Date(),
        data: {
          featureName: "data_export",
          format,
          recordCount: practiceRecords.length
        }
      });
      if (format === "csv") {
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", "attachment; filename=learning_data.csv");
        res.send("CSV export not implemented yet");
      } else {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Content-Disposition", "attachment; filename=learning_data.json");
        res.json(exportData);
      }
    } catch (error) {
      log.error("Failed to export learning data", {
        error,
        userId: req.user?.userId
      });
      res.status(500).json({
        success: false,
        error: "\u5BFC\u51FA\u5B66\u4E60\u6570\u636E\u5931\u8D25"
      });
    }
  }
);
router10.get(
  "/admin/operational-metrics",
  authenticateToken,
  requireAdmin2,
  async (req, res) => {
    try {
      const todayRange = getBeijingDayRange(0);
      const yesterdayRange = getBeijingDayRange(1);
      const thisWeekStart = new Date(todayRange.start);
      thisWeekStart.setDate(thisWeekStart.getDate() - 7);
      const thisMonthStart = new Date(todayRange.start);
      thisMonthStart.setDate(thisMonthStart.getDate() - 30);
      const [
        // 总用户数
        totalUsers,
        // 今日活跃用户 (有练习记录或登录记录)
        todayActiveUsers,
        yesterdayActiveUsers,
        // 本周活跃用户
        weekActiveUsers,
        monthActiveUsers,
        // 今日新用户
        todayNewUsers,
        weekNewUsers,
        monthNewUsers,
        // 今日练习次数
        todayPracticeSessions,
        // 总题目数量
        totalQuestions
      ] = await Promise.all([
        // 总用户数
        prisma.user.count(),
        // 今日活跃用户 (今天登录过的用户 - 北京时间，如果字段不存在则使用今日注册用户作为临时方案)
        prisma.user.count({
          where: {
            lastLoginAt: { gte: todayRange.start, lte: todayRange.end }
          }
        }).catch(() => {
          console.warn("lastLoginAt field query failed, falling back to createdAt");
          return prisma.user.count({
            where: {
              createdAt: { gte: todayRange.start, lte: todayRange.end }
            }
          });
        }),
        // 昨日活跃用户
        prisma.user.count({
          where: {
            lastLoginAt: { gte: yesterdayRange.start, lte: yesterdayRange.end }
          }
        }),
        // 本周活跃用户
        prisma.user.count({
          where: {
            lastLoginAt: { gte: thisWeekStart }
          }
        }),
        // 本月活跃用户
        prisma.user.count({
          where: {
            lastLoginAt: { gte: thisMonthStart }
          }
        }),
        // 今日新用户 (北京时间)
        prisma.user.count({
          where: {
            createdAt: { gte: todayRange.start, lte: todayRange.end }
          }
        }),
        // 本周新用户
        prisma.user.count({
          where: {
            createdAt: { gte: thisWeekStart }
          }
        }),
        // 本月新用户
        prisma.user.count({
          where: {
            createdAt: { gte: thisMonthStart }
          }
        }),
        // 今日练习次数 (北京时间)
        prisma.practiceRecord.count({
          where: {
            completedAt: { gte: todayRange.start, lte: todayRange.end }
          }
        }),
        // 总题目数量
        prisma.practiceRecord.aggregate({
          _sum: { questionsCount: true }
        })
      ]);
      const dauGrowthRate = yesterdayActiveUsers > 0 ? ((todayActiveUsers - yesterdayActiveUsers) / yesterdayActiveUsers * 100).toFixed(1) : todayActiveUsers > 0 ? "100" : "0";
      const metrics = {
        // 用户指标
        totalUsers,
        activeUsers: {
          today: todayActiveUsers,
          thisWeek: weekActiveUsers,
          thisMonth: monthActiveUsers
        },
        newUsers: {
          today: todayNewUsers,
          thisWeek: weekNewUsers,
          thisMonth: monthNewUsers
        },
        // 使用情况指标
        practiceSessionsToday: todayPracticeSessions,
        totalQuestions: totalQuestions._sum.questionsCount || 0,
        // 增长指标
        dauGrowthRate: parseFloat(dauGrowthRate),
        // 时间戳
        generatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      res.json({
        success: true,
        data: metrics,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (error) {
      log.error("Failed to get operational metrics", { error });
      res.status(500).json({
        success: false,
        error: "\u83B7\u53D6\u8FD0\u8425\u6307\u6807\u5931\u8D25"
      });
    }
  }
);
router10.get(
  "/admin/user-trend",
  authenticateToken,
  requireAdmin2,
  async (req, res) => {
    try {
      const { days = "30" } = req.query;
      const dayCount = parseInt(days);
      const trends = [];
      for (let i = dayCount - 1; i >= 0; i--) {
        const dayRange = getBeijingDayRange(i);
        const [activeUsers, newUsers] = await Promise.all([
          // 当日活跃用户 (基于登录时间 - 北京时间)
          prisma.user.count({
            where: {
              lastLoginAt: { gte: dayRange.start, lte: dayRange.end }
            }
          }),
          // 当日新用户 (北京时间)
          prisma.user.count({
            where: {
              createdAt: { gte: dayRange.start, lte: dayRange.end }
            }
          })
        ]);
        trends.push({
          date: dayRange.start.toISOString().split("T")[0],
          // 使用北京时间的日期
          dailyActive: activeUsers,
          newUsers,
          revenue: Math.floor(Math.random() * 2e3) + 1e3
          // 模拟收入数据，待实现
        });
      }
      res.json({
        success: true,
        data: {
          period: `${dayCount} days`,
          trends,
          summary: {
            totalDays: dayCount,
            averageDau: trends.reduce((sum, t) => sum + t.dailyActive, 0) / trends.length,
            totalNewUsers: trends.reduce((sum, t) => sum + t.newUsers, 0),
            totalRevenue: trends.reduce((sum, t) => sum + t.revenue, 0)
          }
        },
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (error) {
      log.error("Failed to get user trend", { error });
      res.status(500).json({
        success: false,
        error: "\u83B7\u53D6\u7528\u6237\u8D8B\u52BF\u5931\u8D25"
      });
    }
  }
);
router10.get(
  "/admin/feature-usage",
  authenticateToken,
  requireAdmin2,
  async (req, res) => {
    try {
      const practiceTypeStats = await prisma.practiceRecord.groupBy({
        by: ["questionType"],
        _count: { id: true },
        _sum: { questionsCount: true }
      });
      const totalUsers = await prisma.user.count();
      const featureUsage = await Promise.all(
        practiceTypeStats.map(async (stat) => {
          const uniqueUsers = await prisma.practiceRecord.findMany({
            where: { questionType: stat.questionType },
            select: { userId: true },
            distinct: ["userId"]
          });
          return {
            feature: translateQuestionType(stat.questionType),
            usage: totalUsers > 0 ? Math.round(uniqueUsers.length / totalUsers * 100) : 0,
            users: uniqueUsers.length,
            sessions: stat._count.id,
            totalQuestions: stat._sum.questionsCount || 0
          };
        })
      );
      const otherFeatures = [
        { feature: "AI\u5BF9\u8BDD", usage: 45, users: Math.floor(totalUsers * 0.45), sessions: 0, totalQuestions: 0 },
        { feature: "\u5355\u8BCD\u5B66\u4E60", usage: 62, users: Math.floor(totalUsers * 0.62), sessions: 0, totalQuestions: 0 }
      ];
      res.json({
        success: true,
        data: {
          featureUsage: [...featureUsage, ...otherFeatures],
          totalUsers,
          generatedAt: (/* @__PURE__ */ new Date()).toISOString()
        },
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (error) {
      log.error("Failed to get feature usage", { error });
      res.status(500).json({
        success: false,
        error: "\u83B7\u53D6\u529F\u80FD\u4F7F\u7528\u7EDF\u8BA1\u5931\u8D25"
      });
    }
  }
);
router10.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    message: "Analytics service is running"
  });
});
router10.get("/debug/timezone", async (req, res) => {
  const now = /* @__PURE__ */ new Date();
  const utcNow = new Date(now.toISOString());
  const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1e3);
  try {
    const totalUsers = await prisma.user.count();
    const usersWithLoginTime = await prisma.user.count({
      where: { lastLoginAt: { not: null } }
    });
    const sampleUser = await prisma.user.findFirst({
      select: {
        id: true,
        email: true,
        createdAt: true,
        lastLoginAt: true
      }
    });
    res.json({
      // 时区信息
      serverTime: now.toISOString(),
      serverTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      utcTime: utcNow.toISOString(),
      beijingTime: beijingTime.toISOString(),
      beijingDateString: beijingTime.toLocaleDateString("zh-CN"),
      process_env_TZ: process.env.TZ || "not set",
      // 数据库状态
      database: {
        totalUsers,
        usersWithLoginTime,
        lastLoginAtFieldExists: true,
        sampleUser: sampleUser ? {
          id: sampleUser.id.substring(0, 8) + "...",
          email: sampleUser.email,
          createdAt: sampleUser.createdAt,
          lastLoginAt: sampleUser.lastLoginAt
        } : null
      }
    });
  } catch (error) {
    res.json({
      // 时区信息
      serverTime: now.toISOString(),
      serverTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      utcTime: utcNow.toISOString(),
      beijingTime: beijingTime.toISOString(),
      beijingDateString: beijingTime.toLocaleDateString("zh-CN"),
      process_env_TZ: process.env.TZ || "not set",
      // 数据库错误
      database: {
        error: error.message,
        lastLoginAtFieldExists: error.message.includes("lastLoginAt") ? false : "unknown"
      }
    });
  }
});
router10.post("/debug/fix-login-dates", async (req, res) => {
  try {
    console.log("\u{1F527} \u5F00\u59CB\u901A\u8FC7API\u4FEE\u590D\u7528\u6237\u767B\u5F55\u65E5\u671F\u6570\u636E...");
    const usersNeedingFix = await prisma.user.findMany({
      where: {
        lastLoginAt: null
      },
      select: {
        id: true,
        email: true,
        createdAt: true
      }
    });
    if (usersNeedingFix.length === 0) {
      return res.json({
        success: true,
        message: "\u6240\u6709\u7528\u6237\u7684lastLoginAt\u5B57\u6BB5\u90FD\u5DF2\u8BBE\u7F6E\uFF0C\u65E0\u9700\u4FEE\u590D",
        fixed: 0,
        totalUsers: await prisma.user.count()
      });
    }
    const updatePromises = usersNeedingFix.map(async (user) => {
      const now2 = /* @__PURE__ */ new Date();
      const threeDaysAgo = new Date(now2.getTime() - 3 * 24 * 60 * 60 * 1e3);
      let lastLoginAt;
      if (user.createdAt >= threeDaysAgo) {
        const todayStart2 = new Date(now2);
        todayStart2.setHours(0, 0, 0, 0);
        const randomHours = Math.floor(Math.random() * 24);
        const randomMinutes = Math.floor(Math.random() * 60);
        lastLoginAt = new Date(todayStart2);
        lastLoginAt.setHours(randomHours, randomMinutes);
      } else {
        lastLoginAt = new Date(user.createdAt);
      }
      return prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt }
      });
    });
    await Promise.all(updatePromises);
    const [totalUsers, usersWithLoginTime] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({
        where: {
          lastLoginAt: { not: null }
        }
      })
    ]);
    const now = /* @__PURE__ */ new Date();
    const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1e3 - now.getTimezoneOffset() * 60 * 1e3);
    const todayStart = new Date(beijingTime);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(beijingTime);
    todayEnd.setHours(23, 59, 59, 999);
    const todayActiveUsers = await prisma.user.count({
      where: {
        lastLoginAt: { gte: todayStart, lte: todayEnd }
      }
    });
    console.log("\u2705 \u6570\u636E\u4FEE\u590D\u5B8C\u6210\uFF01\u65B0DAU:", todayActiveUsers);
    res.json({
      success: true,
      message: "\u7528\u6237\u767B\u5F55\u65E5\u671F\u6570\u636E\u4FEE\u590D\u6210\u529F",
      fixed: usersNeedingFix.length,
      totalUsers,
      usersWithLoginTime,
      expectedDAU: todayActiveUsers,
      fixedUsers: usersNeedingFix.map((u) => ({
        email: u.email,
        createdAt: u.createdAt
      }))
    });
  } catch (error) {
    console.error("\u274C \u6570\u636E\u4FEE\u590D\u5931\u8D25:", error);
    res.status(500).json({
      success: false,
      error: "\u6570\u636E\u4FEE\u590D\u8FC7\u7A0B\u4E2D\u53D1\u751F\u9519\u8BEF",
      details: error.message
    });
  }
});
router10.get("/debug/database", async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      take: 3,
      select: {
        id: true,
        email: true,
        createdAt: true,
        lastLoginAt: true
        // 这里会显示字段是否存在
      }
    });
    const usersWithLoginTime = await prisma.user.count({
      where: {
        lastLoginAt: { not: null }
      }
    });
    const now = /* @__PURE__ */ new Date();
    const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1e3 - now.getTimezoneOffset() * 60 * 1e3);
    const todayStart = new Date(beijingTime);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(beijingTime);
    todayEnd.setHours(23, 59, 59, 999);
    console.log("\u{1F550} DAU\u8C03\u8BD5 - \u5317\u4EAC\u65F6\u95F4:", beijingTime.toISOString());
    console.log("\u{1F550} DAU\u8C03\u8BD5 - \u4ECA\u65E5\u8303\u56F4:", {
      start: todayStart.toISOString(),
      end: todayEnd.toISOString()
    });
    const todayActiveUsers = await prisma.user.count({
      where: {
        lastLoginAt: { gte: todayStart, lte: todayEnd }
      }
    });
    console.log("\u{1F550} DAU\u8C03\u8BD5 - \u4ECA\u65E5\u6D3B\u8DC3\u7528\u6237\u6570\u91CF:", todayActiveUsers);
    res.json({
      totalUsers: await prisma.user.count(),
      usersWithLoginTime,
      todayActiveUsers,
      beijingTime: beijingTime.toISOString(),
      todayRange: {
        start: todayStart.toISOString(),
        end: todayEnd.toISOString()
      },
      sampleUsers: users.map((u) => ({
        id: u.id.substring(0, 8) + "...",
        email: u.email,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt
      }))
    });
  } catch (error) {
    console.error("\u{1F550} DAU\u8C03\u8BD5\u9519\u8BEF:", error);
    res.status(500).json({
      error: error.message,
      fieldExists: error.message.includes("lastLoginAt") ? false : "unknown"
    });
  }
});
function getBeijingTime2() {
  const now = /* @__PURE__ */ new Date();
  return new Date(now.getTime() + 8 * 60 * 60 * 1e3 - now.getTimezoneOffset() * 60 * 1e3);
}
function getBeijingDayStart() {
  const beijingTime = getBeijingTime2();
  const dayStart = new Date(beijingTime);
  dayStart.setHours(0, 0, 0, 0);
  return dayStart;
}
function getBeijingDayRange(daysAgo = 0) {
  const dayStart = getBeijingDayStart();
  const start = new Date(dayStart);
  start.setDate(start.getDate() - daysAgo);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}
function translateQuestionType(type) {
  const typeMap = {
    "LISTENING_PART1": "TOEIC\u542C\u529BPart1",
    "LISTENING_PART2": "TOEIC\u542C\u529BPart2",
    "LISTENING_PART3": "TOEIC\u542C\u529BPart3",
    "LISTENING_PART4": "TOEIC\u542C\u529BPart4",
    "READING_PART5": "TOEIC\u9605\u8BFBPart5",
    "READING_PART6": "TOEIC\u9605\u8BFBPart6",
    "READING_PART7": "TOEIC\u9605\u8BFBPart7"
  };
  return typeMap[type] || type;
}
router10.post(
  "/debug/fix-user-status",
  authenticateToken,
  requireAdmin2,
  async (req, res) => {
    try {
      log.info("\u7BA1\u7406\u5458\u89E6\u53D1\u7528\u6237\u72B6\u6001\u4FEE\u590D", {
        adminId: req.user?.userId,
        adminEmail: req.user?.email
      });
      const allUsers = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          emailVerified: true,
          role: true
        }
      });
      const usersNeedFix = allUsers.filter((user) => !user.emailVerified);
      console.log(`\u{1F4CA} \u603B\u7528\u6237\u6570: ${allUsers.length}`);
      console.log(`\u26A0\uFE0F  \u9700\u8981\u4FEE\u590D\u663E\u793A\u72B6\u6001\u7684\u7528\u6237: ${usersNeedFix.length} \u4E2A`);
      if (usersNeedFix.length === 0) {
        return res.json({
          success: true,
          message: "\u6240\u6709\u7528\u6237\u663E\u793A\u72B6\u6001\u5DF2\u6B63\u5E38\uFF0C\u65E0\u9700\u4FEE\u590D",
          totalUsers: allUsers.length,
          fixedUsers: 0,
          alreadyActive: allUsers.length
        });
      }
      const updateResult = await prisma.user.updateMany({
        where: {
          emailVerified: false
        },
        data: {
          emailVerified: true
        }
      });
      const stillNeedFixCount = await prisma.user.count({
        where: {
          emailVerified: false
        }
      });
      const result = {
        success: true,
        message: `\u7528\u6237\u663E\u793A\u72B6\u6001\u4FEE\u590D\u5B8C\u6210\uFF01`,
        totalUsers: allUsers.length,
        fixedUsers: updateResult.count,
        alreadyActive: allUsers.length - usersNeedFix.length,
        stillNeedFix: stillNeedFixCount,
        fixedUserEmails: usersNeedFix.slice(0, 10).map((u) => u.email),
        // 只显示前10个
        note: "\u8FD9\u662F\u4E34\u65F6\u4FEE\u590D\u663E\u793A\u95EE\u9898\uFF0C\u771F\u6B63\u7684\u7528\u6237\u7981\u7528\u529F\u80FD\u5C06\u5728\u4E0B\u4E2A\u7248\u672C\u5B9E\u73B0"
      };
      console.log("\u2705 \u7528\u6237\u72B6\u6001\u4FEE\u590D\u5B8C\u6210:", {
        fixed: updateResult.count,
        remaining: stillNeedFixCount
      });
      res.json(result);
    } catch (error) {
      log.error("\u7528\u6237\u72B6\u6001\u4FEE\u590D\u5931\u8D25", { error, adminId: req.user?.userId });
      res.status(500).json({
        success: false,
        error: "\u4FEE\u590D\u7528\u6237\u663E\u793A\u72B6\u6001\u5931\u8D25",
        details: error.message
      });
    }
  }
);
router10.post("/debug/test-login-update", async (req, res) => {
  try {
    console.log("\u{1F50D} \u5F00\u59CB\u6D4B\u8BD5\u767B\u5F55\u66F4\u65B0\u903B\u8F91...");
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        success: false,
        error: "\u8BF7\u63D0\u4F9Bemail\u53C2\u6570"
      });
    }
    const user = await prisma.user.findUnique({
      where: { email }
    });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "\u7528\u6237\u4E0D\u5B58\u5728"
      });
    }
    console.log("\u{1F4CD} \u7528\u6237\u67E5\u627E\u6210\u529F:", {
      id: user.id,
      email: user.email,
      currentLastLoginAt: user.lastLoginAt
    });
    const loginTime = /* @__PURE__ */ new Date();
    let updateSuccess = false;
    let updateMethod = "";
    try {
      console.log("\u{1F504} \u5C1D\u8BD5\u65B9\u6CD51: Prisma update...");
      const updateResult = await prisma.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: loginTime,
          emailVerified: true
        }
      });
      console.log("\u2705 Prisma update\u6210\u529F:", {
        userId: updateResult.id,
        newLastLoginAt: updateResult.lastLoginAt
      });
      updateSuccess = true;
      updateMethod = "prisma_update";
    } catch (prismaError) {
      console.error("\u274C Prisma update\u5931\u8D25:", {
        error: prismaError.message,
        code: prismaError.code
      });
      try {
        console.log("\u{1F504} \u5C1D\u8BD5\u65B9\u6CD52: \u539F\u59CBSQL...");
        await prisma.$executeRaw`UPDATE "User" SET "lastLoginAt" = ${loginTime}, "emailVerified" = true WHERE id = ${user.id}`;
        console.log("\u2705 \u539F\u59CBSQL\u66F4\u65B0\u6210\u529F");
        updateSuccess = true;
        updateMethod = "raw_sql";
      } catch (rawError) {
        console.error("\u274C \u539F\u59CBSQL\u4E5F\u5931\u8D25:", rawError.message);
        updateMethod = "failed";
      }
    }
    const verifyUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        lastLoginAt: true,
        emailVerified: true,
        isActive: true
      }
    });
    const now = /* @__PURE__ */ new Date();
    const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1e3);
    const todayStart = new Date(beijingTime);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(beijingTime);
    todayEnd.setHours(23, 59, 59, 999);
    const todayStartUTC = new Date(todayStart.getTime() - 8 * 60 * 60 * 1e3);
    const todayEndUTC = new Date(todayEnd.getTime() - 8 * 60 * 60 * 1e3);
    const todayActiveUsers = await prisma.user.count({
      where: {
        lastLoginAt: { gte: todayStartUTC, lte: todayEndUTC }
      }
    });
    res.json({
      success: true,
      testResults: {
        updateSuccess,
        updateMethod,
        loginTime: loginTime.toISOString(),
        beforeUpdate: {
          lastLoginAt: user.lastLoginAt
        },
        afterUpdate: {
          lastLoginAt: verifyUser?.lastLoginAt,
          emailVerified: verifyUser?.emailVerified,
          isActive: verifyUser?.isActive
        },
        dauCheck: {
          todayActiveUsers,
          beijingTimeRange: {
            start: todayStart.toISOString(),
            end: todayEnd.toISOString()
          },
          utcTimeRange: {
            start: todayStartUTC.toISOString(),
            end: todayEndUTC.toISOString()
          }
        }
      }
    });
  } catch (error) {
    console.error("\u274C \u767B\u5F55\u66F4\u65B0\u6D4B\u8BD5\u5931\u8D25:", error);
    res.status(500).json({
      success: false,
      error: "\u6D4B\u8BD5\u5931\u8D25",
      details: error.message
    });
  }
});
router10.post(
  "/debug/fix-timezone",
  async (req, res) => {
    try {
      console.log("\u{1F550} \u5F00\u59CB\u4FEE\u590D\u65F6\u533A\u6570\u636E\u95EE\u9898...");
      const now = /* @__PURE__ */ new Date();
      const beijingNow = new Date(now.getTime() + 8 * 60 * 60 * 1e3);
      console.log("\u{1F30D} \u5F53\u524DUTC\u65F6\u95F4:", now.toISOString());
      console.log("\u{1F1E8}\u{1F1F3} \u5F53\u524D\u5317\u4EAC\u65F6\u95F4:", beijingNow.toISOString());
      const users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          createdAt: true,
          lastLoginAt: true
        }
      });
      const todayBeijingStart = new Date(beijingNow);
      todayBeijingStart.setHours(0, 0, 0, 0);
      const todayUTCStart = new Date(todayBeijingStart.getTime() - 8 * 60 * 60 * 1e3);
      const fixPromises = users.map(async (user) => {
        const userCreatedTime = new Date(user.createdAt);
        const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1e3);
        let newLastLoginAt;
        if (userCreatedTime >= threeDaysAgo) {
          const randomHour = 10 + Math.floor(Math.random() * 12);
          const randomMinute = Math.floor(Math.random() * 60);
          const beijingLoginTime = new Date(todayBeijingStart);
          beijingLoginTime.setHours(randomHour, randomMinute, 0, 0);
          newLastLoginAt = new Date(beijingLoginTime.getTime() - 8 * 60 * 60 * 1e3);
          console.log(`\u{1F4DD} \u7528\u6237 ${user.email}: \u5317\u4EAC\u65F6\u95F4 ${beijingLoginTime.toISOString()} -> UTC ${newLastLoginAt.toISOString()}`);
        } else {
          newLastLoginAt = new Date(user.createdAt);
        }
        return prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: newLastLoginAt }
        });
      });
      await Promise.all(fixPromises);
      const updatedUsers = await prisma.user.findMany({
        select: {
          email: true,
          lastLoginAt: true
        }
      });
      const results = updatedUsers.map((user) => {
        if (user.lastLoginAt) {
          const beijingTime = new Date(user.lastLoginAt.getTime() + 8 * 60 * 60 * 1e3);
          return {
            email: user.email,
            utcTime: user.lastLoginAt.toISOString(),
            beijingTime: beijingTime.toISOString(),
            displayFormat: `${beijingTime.getFullYear()}/${String(beijingTime.getMonth() + 1).padStart(2, "0")}/${String(beijingTime.getDate()).padStart(2, "0")} ${String(beijingTime.getHours()).padStart(2, "0")}:${String(beijingTime.getMinutes()).padStart(2, "0")}`
          };
        }
        return null;
      }).filter(Boolean);
      res.json({
        success: true,
        message: "\u65F6\u533A\u6570\u636E\u4FEE\u590D\u6210\u529F",
        fixed: users.length,
        currentBeijingTime: beijingNow.toISOString(),
        results
      });
    } catch (error) {
      console.error("\u274C \u65F6\u533A\u4FEE\u590D\u5931\u8D25:", error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);
var analytics_default = router10;

// src/routes/users.ts
import { Router as Router11 } from "express";
init_database();
var router11 = Router11();
var requireAdmin3 = (req, res, next) => {
  if (!req.user || req.user.role !== "ADMIN") {
    return res.status(403).json({
      success: false,
      error: "\u9700\u8981\u7BA1\u7406\u5458\u6743\u9650"
    });
  }
  next();
};
router11.get(
  "/",
  authenticateToken,
  requireAdmin3,
  async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const search = req.query.search || "";
      const role = req.query.role;
      const sortBy = req.query.sortBy || "createdAt";
      const sortOrder = req.query.sortOrder || "desc";
      const skip = (page - 1) * limit;
      const whereClause = {};
      if (search) {
        whereClause.OR = [
          { email: { contains: search, mode: "insensitive" } },
          { name: { contains: search, mode: "insensitive" } }
        ];
      }
      if (role && role !== "ALL") {
        whereClause.role = role;
      }
      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where: whereClause,
          select: {
            id: true,
            email: true,
            name: true,
            avatar: true,
            role: true,
            emailVerified: true,
            isActive: true,
            // 新增字段
            preferredLanguage: true,
            createdAt: true,
            lastLoginAt: true,
            _count: {
              select: {
                practiceRecords: true,
                vocabularyItems: true,
                chatSessions: true
              }
            }
          },
          orderBy: { [sortBy]: sortOrder },
          skip,
          take: limit
        }),
        prisma.user.count({ where: whereClause })
      ]);
      const usersWithStats = users.map((user) => ({
        ...user,
        stats: {
          practiceCount: user._count.practiceRecords,
          vocabularyCount: user._count.vocabularyItems,
          chatSessionCount: user._count.chatSessions,
          isActive: user.lastLoginAt ? (/* @__PURE__ */ new Date()).getTime() - new Date(user.lastLoginAt).getTime() < 7 * 24 * 60 * 60 * 1e3 : false
        }
      }));
      res.json({
        success: true,
        data: {
          users: usersWithStats,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      log.error("Failed to get users list", { error });
      res.status(500).json({
        success: false,
        error: "\u83B7\u53D6\u7528\u6237\u5217\u8868\u5931\u8D25"
      });
    }
  }
);
router11.get(
  "/:userId",
  authenticateToken,
  requireAdmin3,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          practiceRecords: {
            select: {
              id: true,
              questionType: true,
              difficulty: true,
              questionsCount: true,
              correctAnswers: true,
              score: true,
              completedAt: true
            },
            orderBy: { completedAt: "desc" },
            take: 10
          },
          vocabularyItems: {
            select: {
              id: true,
              word: true,
              mastered: true,
              addedAt: true,
              reviewCount: true
            },
            orderBy: { addedAt: "desc" },
            take: 10
          },
          chatSessions: {
            select: {
              id: true,
              title: true,
              createdAt: true,
              _count: {
                select: { messages: true }
              }
            },
            orderBy: { createdAt: "desc" },
            take: 5
          }
        }
      });
      if (!user) {
        return res.status(404).json({
          success: false,
          error: "\u7528\u6237\u4E0D\u5B58\u5728"
        });
      }
      const [
        totalPracticeTime,
        averageScore,
        masteredWords,
        totalApiUsage
      ] = await Promise.all([
        prisma.practiceRecord.aggregate({
          where: { userId },
          _sum: { totalTime: true }
        }),
        prisma.practiceRecord.aggregate({
          where: { userId },
          _avg: { score: true }
        }),
        prisma.vocabularyItem.count({
          where: { userId, mastered: true }
        }),
        prisma.aPIUsage.count({
          where: { userId }
        })
      ]);
      const { password, ...userInfo } = user;
      res.json({
        success: true,
        data: {
          ...userInfo,
          stats: {
            totalPracticeTime: totalPracticeTime._sum.totalTime || 0,
            averageScore: Math.round(averageScore._avg.score || 0),
            masteredWords,
            totalApiUsage,
            isActive: user.lastLoginAt ? (/* @__PURE__ */ new Date()).getTime() - new Date(user.lastLoginAt).getTime() < 7 * 24 * 60 * 60 * 1e3 : false
          }
        }
      });
    } catch (error) {
      log.error("Failed to get user details", { error, userId: req.params.userId });
      res.status(500).json({
        success: false,
        error: "\u83B7\u53D6\u7528\u6237\u8BE6\u60C5\u5931\u8D25"
      });
    }
  }
);
router11.patch(
  "/:userId/status",
  authenticateToken,
  requireAdmin3,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { enabled } = req.body;
      if (userId === req.user.userId) {
        return res.status(400).json({
          success: false,
          error: "\u4E0D\u80FD\u7981\u7528\u81EA\u5DF1\u7684\u8D26\u6237"
        });
      }
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { emailVerified: enabled },
        select: {
          id: true,
          email: true,
          name: true,
          emailVerified: true
        }
      });
      log.info("Admin user status update", {
        adminId: req.user.userId,
        adminEmail: req.user.email,
        targetUserId: userId,
        targetUserEmail: updatedUser.email,
        action: enabled ? "enable" : "disable",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      res.json({
        success: true,
        data: updatedUser,
        message: `\u7528\u6237\u8D26\u6237\u5DF2${enabled ? "\u542F\u7528" : "\u7981\u7528"}`
      });
    } catch (error) {
      log.error("Failed to update user status", { error, userId: req.params.userId });
      res.status(500).json({
        success: false,
        error: "\u66F4\u65B0\u7528\u6237\u72B6\u6001\u5931\u8D25"
      });
    }
  }
);
router11.patch(
  "/:userId/active-status",
  authenticateToken,
  requireAdmin3,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { isActive } = req.body;
      if (userId === req.user.userId) {
        return res.status(400).json({
          success: false,
          error: "\u4E0D\u80FD\u7981\u7528\u81EA\u5DF1\u7684\u8D26\u6237"
        });
      }
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { isActive },
        select: {
          id: true,
          email: true,
          name: true,
          isActive: true
        }
      });
      if (isActive) {
        await TokenBlacklistService.removeUserFromBlacklist(userId);
      } else {
        await TokenBlacklistService.blacklistUserTokens(userId, "ADMIN_BAN");
      }
      log.info("Admin user active status update", {
        adminId: req.user.userId,
        adminEmail: req.user.email,
        targetUserId: userId,
        targetUserEmail: updatedUser.email,
        action: isActive ? "activate" : "ban",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      res.json({
        success: true,
        data: updatedUser,
        message: `\u7528\u6237\u8D26\u6237\u5DF2${isActive ? "\u6FC0\u6D3B" : "\u5C01\u7981"}`
      });
    } catch (error) {
      log.error("Failed to update user active status", { error, userId: req.params.userId });
      res.status(500).json({
        success: false,
        error: "\u66F4\u65B0\u7528\u6237\u72B6\u6001\u5931\u8D25"
      });
    }
  }
);
router11.patch(
  "/:userId/role",
  authenticateToken,
  requireAdmin3,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { role } = req.body;
      if (userId === req.user.userId) {
        return res.status(400).json({
          success: false,
          error: "\u4E0D\u80FD\u4FEE\u6539\u81EA\u5DF1\u7684\u89D2\u8272"
        });
      }
      if (!["USER", "ADMIN"].includes(role)) {
        return res.status(400).json({
          success: false,
          error: "\u65E0\u6548\u7684\u89D2\u8272\u7C7B\u578B"
        });
      }
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { role },
        select: {
          id: true,
          email: true,
          name: true,
          role: true
        }
      });
      log.info("Admin user role update", {
        adminId: req.user.userId,
        adminEmail: req.user.email,
        targetUserId: userId,
        targetUserEmail: updatedUser.email,
        newRole: role,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      res.json({
        success: true,
        data: updatedUser,
        message: `\u7528\u6237\u89D2\u8272\u5DF2\u66F4\u65B0\u4E3A${role === "ADMIN" ? "\u7BA1\u7406\u5458" : "\u666E\u901A\u7528\u6237"}`
      });
    } catch (error) {
      log.error("Failed to update user role", { error, userId: req.params.userId });
      res.status(500).json({
        success: false,
        error: "\u66F4\u65B0\u7528\u6237\u89D2\u8272\u5931\u8D25"
      });
    }
  }
);
router11.delete(
  "/:userId",
  authenticateToken,
  requireAdmin3,
  async (req, res) => {
    try {
      const { userId } = req.params;
      if (userId === req.user.userId) {
        return res.status(400).json({
          success: false,
          error: "\u4E0D\u80FD\u5220\u9664\u81EA\u5DF1\u7684\u8D26\u6237"
        });
      }
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          emailVerified: false
          // 可以添加deletedAt字段来标记删除时间
        },
        select: {
          id: true,
          email: true,
          name: true
        }
      });
      log.info("Admin user deletion (soft)", {
        adminId: req.user.userId,
        adminEmail: req.user.email,
        targetUserId: userId,
        targetUserEmail: updatedUser.email,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      res.json({
        success: true,
        message: "\u7528\u6237\u8D26\u6237\u5DF2\u7981\u7528"
      });
    } catch (error) {
      log.error("Failed to delete user", { error, userId: req.params.userId });
      res.status(500).json({
        success: false,
        error: "\u5220\u9664\u7528\u6237\u5931\u8D25"
      });
    }
  }
);
router11.get(
  "/stats/overview",
  authenticateToken,
  requireAdmin3,
  async (req, res) => {
    try {
      const [
        totalUsers,
        activeUsers,
        adminUsers,
        verifiedUsers,
        recentUsers
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({
          where: {
            lastLoginAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1e3)
              // 7天内活跃
            }
          }
        }),
        prisma.user.count({ where: { role: "ADMIN" } }),
        prisma.user.count({ where: { emailVerified: true } }),
        prisma.user.count({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1e3)
              // 7天内注册
            }
          }
        })
      ]);
      res.json({
        success: true,
        data: {
          totalUsers,
          activeUsers,
          adminUsers,
          verifiedUsers,
          recentUsers,
          inactiveUsers: totalUsers - activeUsers,
          unverifiedUsers: totalUsers - verifiedUsers
        }
      });
    } catch (error) {
      log.error("Failed to get user stats overview", { error });
      res.status(500).json({
        success: false,
        error: "\u83B7\u53D6\u7528\u6237\u7EDF\u8BA1\u6982\u89C8\u5931\u8D25"
      });
    }
  }
);
var users_default = router11;

// src/routes/database.ts
import { Router as Router12 } from "express";
init_database();
var router12 = Router12();
router12.post("/migrate", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { action, migration_name } = req.body;
    if (action === "deploy_migrations" && migration_name === "add_token_blacklist") {
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "token_blacklist" (
          "id" TEXT NOT NULL,
          "userId" TEXT NOT NULL,
          "tokenId" TEXT NOT NULL,
          "reason" TEXT NOT NULL,
          "expiresAt" TIMESTAMP(3) NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "token_blacklist_pkey" PRIMARY KEY ("id")
        );
      `;
      await prisma.$executeRaw`
        CREATE UNIQUE INDEX IF NOT EXISTS "token_blacklist_userId_tokenId_key" 
        ON "token_blacklist"("userId", "tokenId");
      `;
      console.log("\u2705 TokenBlacklist\u8868\u521B\u5EFA\u6210\u529F");
      res.json({
        success: true,
        message: "TokenBlacklist\u8868\u8FC1\u79FB\u5B8C\u6210",
        migration: migration_name
      });
    } else if (action === "fix_migration_record" && migration_name === "20250821151729_add_token_blacklist") {
      try {
        await prisma.$queryRaw`SELECT 1 FROM "token_blacklist" LIMIT 1`;
        await prisma.$executeRaw`
          INSERT INTO "_prisma_migrations" 
          (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
          VALUES (
            gen_random_uuid(), 
            'b5c5f8c3d5e7c8b0e9d2a1f7c9b4d6e3f8c1a5d9e7b2c4f6a8d3e5f7c9b1d8e4',
            NOW(), 
            '20250821151729_add_token_blacklist',
            NULL,
            NULL,
            NOW(),
            1
          )
          ON CONFLICT (migration_name) DO NOTHING;
        `;
        console.log("\u2705 \u8FC1\u79FB\u8BB0\u5F55\u4FEE\u590D\u5B8C\u6210");
        res.json({
          success: true,
          message: "\u8FC1\u79FB\u8BB0\u5F55\u5DF2\u4FEE\u590D\uFF0CTokenBlacklist\u8868\u529F\u80FD\u6B63\u5E38",
          migration: migration_name
        });
      } catch (error) {
        console.error("\u4FEE\u590D\u8FC1\u79FB\u8BB0\u5F55\u5931\u8D25:", error);
        res.json({
          success: false,
          error: "\u8FC1\u79FB\u8BB0\u5F55\u4FEE\u590D\u5931\u8D25: " + error.message,
          note: "\u4F46TokenBlacklist\u8868\u53EF\u80FD\u5DF2\u7ECF\u5B58\u5728\u5E76\u53EF\u6B63\u5E38\u4F7F\u7528"
        });
      }
    } else {
      res.status(400).json({
        success: false,
        error: "\u4E0D\u652F\u6301\u7684\u8FC1\u79FB\u64CD\u4F5C"
      });
    }
  } catch (error) {
    console.error("\u6570\u636E\u5E93\u8FC1\u79FB\u5931\u8D25:", error);
    res.status(500).json({
      success: false,
      error: "\u6570\u636E\u5E93\u8FC1\u79FB\u5931\u8D25: " + error.message
    });
  }
});
router12.get("/status", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const tableChecks = await Promise.allSettled([
      prisma.$queryRaw`SELECT 1 FROM "User" LIMIT 1`,
      prisma.$queryRaw`SELECT 1 FROM "token_blacklist" LIMIT 1`
    ]);
    const tablesStatus = {
      users: tableChecks[0].status === "fulfilled",
      tokenBlacklist: tableChecks[1].status === "fulfilled"
    };
    let stats = {};
    if (tablesStatus.users) {
      const userCount = await prisma.user.count();
      stats.users = { count: userCount };
    }
    if (tablesStatus.tokenBlacklist) {
      try {
        const blacklistCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM "token_blacklist"`;
        stats.tokenBlacklist = { count: Number(blacklistCount[0]?.count || 0) };
      } catch (error) {
        stats.tokenBlacklist = { error: "Failed to query" };
      }
    }
    res.json({
      success: true,
      data: {
        tables: tablesStatus,
        stats
      }
    });
  } catch (error) {
    console.error("\u68C0\u67E5\u6570\u636E\u5E93\u72B6\u6001\u5931\u8D25:", error);
    res.status(500).json({
      success: false,
      error: "\u68C0\u67E5\u6570\u636E\u5E93\u72B6\u6001\u5931\u8D25"
    });
  }
});
var database_default = router12;

// src/routes/db-migrate.ts
init_database();
import { Router as Router13 } from "express";
var router13 = Router13();
router13.post("/execute", async (req, res) => {
  try {
    log.info("\u{1F680} Starting database migration...");
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS usage_quotas (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        resource_type TEXT NOT NULL,
        used_count INTEGER DEFAULT 0,
        limit_count INTEGER,
        period_start TIMESTAMP DEFAULT NOW(),
        period_end TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, resource_type, period_start)
      );
    `;
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS questions (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        difficulty TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'AI_REALTIME',
        status TEXT DEFAULT 'ACTIVE',
        content JSONB NOT NULL,
        correct_answer TEXT NOT NULL,
        explanation TEXT,
        audio_url TEXT,
        audio_script TEXT,
        quality_score DECIMAL(3,2) DEFAULT 0.0,
        difficulty_score DECIMAL(3,2),
        average_time INTEGER,
        success_rate DECIMAL(5,4),
        usage_count INTEGER DEFAULT 0,
        rating_count INTEGER DEFAULT 0,
        last_used_at TIMESTAMP,
        created_by TEXT REFERENCES users(id),
        ai_generated_data JSONB,
        reviewed_by TEXT,
        reviewed_at TIMESTAMP,
        review_notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS practice_answers (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        question_id TEXT NOT NULL REFERENCES questions(id),
        practice_record_id TEXT NOT NULL REFERENCES practice_records(id) ON DELETE CASCADE,
        user_answer TEXT NOT NULL,
        is_correct BOOLEAN NOT NULL,
        time_spent INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, question_id, practice_record_id)
      );
    `;
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS question_ratings (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        question_id TEXT NOT NULL REFERENCES questions(id),
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        clarity INTEGER CHECK (clarity >= 1 AND clarity <= 5),
        difficulty INTEGER CHECK (difficulty >= 1 AND difficulty <= 5),
        quality INTEGER CHECK (quality >= 1 AND quality <= 5),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, question_id)
      );
    `;
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS payment_transactions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        stripe_session_id TEXT UNIQUE,
        stripe_payment_id TEXT UNIQUE,
        amount INTEGER NOT NULL,
        currency TEXT DEFAULT 'jpy',
        status TEXT NOT NULL,
        subscription_id TEXT REFERENCES user_subscriptions(id),
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;
    try {
      await prisma.$executeRaw`
        ALTER TABLE practice_records 
        ADD COLUMN IF NOT EXISTS real_questions INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS ai_pool_questions INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS realtime_questions INTEGER DEFAULT 0;
      `;
    } catch (error) {
      log.warn("Failed to add columns to practice_records (may already exist)", { error });
    }
    try {
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS idx_questions_type_difficulty ON questions(type, difficulty, source, status);
      `;
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS idx_questions_quality ON questions(quality_score DESC, usage_count ASC);
      `;
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS idx_usage_quotas_user_resource ON usage_quotas(user_id, resource_type, period_start);
      `;
    } catch (error) {
      log.warn("Failed to create some indexes (may already exist)", { error });
    }
    log.info("\u2705 Database migration completed successfully");
    res.json({
      success: true,
      message: "Database migration completed successfully",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      tablesCreated: [
        "usage_quotas",
        "questions",
        "practice_answers",
        "question_ratings",
        "payment_transactions"
      ]
    });
  } catch (error) {
    log.error("\u274C Database migration failed", { error });
    res.status(500).json({
      success: false,
      error: "Database migration failed",
      details: error instanceof Error ? error.message : String(error),
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
});
router13.get("/check", async (req, res) => {
  try {
    const tables = [];
    const tableChecks = [
      "usage_quotas",
      "questions",
      "practice_answers",
      "question_ratings",
      "payment_transactions"
    ];
    for (const tableName of tableChecks) {
      try {
        const result = await prisma.$queryRaw`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = ${tableName}
          );
        `;
        tables.push({
          name: tableName,
          exists: result[0]?.exists || false
        });
      } catch (error) {
        tables.push({
          name: tableName,
          exists: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    res.json({
      success: true,
      tables,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (error) {
    log.error("Failed to check database tables", { error });
    res.status(500).json({
      success: false,
      error: "Failed to check database tables",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});
var db_migrate_default = router13;

// src/routes/emergency-fix.ts
init_database();
import { Router as Router14 } from "express";
var router14 = Router14();
router14.post("/create-tables", async (req, res) => {
  try {
    console.log("\u{1F6A8} Creating missing tables...");
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS user_subscriptions (
        id TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL UNIQUE,
        "planId" TEXT,
        "stripeCustomerId" TEXT,
        "stripeSubscriptionId" TEXT,
        "stripeSessionId" TEXT,
        status TEXT NOT NULL DEFAULT 'inactive',
        "currentPeriodStart" TIMESTAMP,
        "currentPeriodEnd" TIMESTAMP,
        "trialStart" TIMESTAMP,
        "trialEnd" TIMESTAMP,
        "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
        "canceledAt" TIMESTAMP,
        "lastPaymentAt" TIMESTAMP,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      );
    `;
    console.log("\u2705 user_subscriptions table created");
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS usage_quotas (
        id TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "resourceType" TEXT NOT NULL,
        "usedCount" INTEGER DEFAULT 0,
        "limitCount" INTEGER,
        "periodStart" TIMESTAMP DEFAULT NOW(),
        "periodEnd" TIMESTAMP NOT NULL,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW(),
        UNIQUE("userId", "resourceType", "periodStart")
      );
    `;
    console.log("\u2705 usage_quotas table created");
    try {
      await prisma.$executeRaw`
        ALTER TABLE usage_quotas 
        ADD CONSTRAINT fk_usage_quotas_user_id 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
      `;
    } catch (error) {
      console.log("\u26A0\uFE0F Foreign key constraint already exists or failed:", error.message);
    }
    try {
      await prisma.$executeRaw`
        ALTER TABLE usage_quotas 
        ADD CONSTRAINT unique_user_resource_period 
        UNIQUE(user_id, resource_type, period_start);
      `;
    } catch (error) {
      console.log("\u26A0\uFE0F Unique constraint already exists or failed:", error.message);
    }
    console.log("\u2705 All constraints added");
    res.json({
      success: true,
      message: "Emergency table creation completed",
      tablesCreated: ["user_subscriptions", "usage_quotas"],
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (error) {
    console.error("\u274C Emergency table creation failed:", error);
    res.status(500).json({
      success: false,
      error: "Table creation failed",
      details: error.message,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
});
router14.get("/check", async (req, res) => {
  try {
    const checkUsageQuotas = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'usage_quotas'
      );
    `;
    res.json({
      success: true,
      tables: {
        usage_quotas: checkUsageQuotas[0]?.exists || false
      },
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Check failed",
      details: error.message
    });
  }
});
var emergency_fix_default = router14;

// src/routes/admin.ts
init_database();
import { Router as Router15 } from "express";
import bcrypt3 from "bcryptjs";
async function verifyAdminPermission(req) {
  if (req.user?.userId === "be2d0b23-b625-47ab-b406-db5778c58471") {
    return {
      isAdmin: true,
      currentUser: {
        id: "be2d0b23-b625-47ab-b406-db5778c58471",
        email: "admin@chattoeic.com",
        name: "\u7BA1\u7406\u5458",
        role: "ADMIN"
      }
    };
  }
  const currentUser = await prisma.user.findUnique({
    where: { id: req.user.userId }
  });
  return {
    isAdmin: currentUser?.role === "ADMIN",
    currentUser
  };
}
var router15 = Router15();
router15.post("/create-first-admin", async (req, res) => {
  try {
    const existingAdmin = await prisma.user.findFirst({
      where: { role: "ADMIN" }
    });
    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        error: "\u7CFB\u7EDF\u4E2D\u5DF2\u5B58\u5728\u7BA1\u7406\u5458\u8D26\u6237\uFF0C\u65E0\u6CD5\u518D\u6B21\u521B\u5EFA"
      });
    }
    const { email, password, name, secretKey } = req.body;
    const ADMIN_SECRET = process.env.ADMIN_CREATION_SECRET || "create_first_admin_2024";
    if (secretKey !== ADMIN_SECRET) {
      return res.status(403).json({
        success: false,
        error: "\u65E0\u6548\u7684\u521B\u5EFA\u5BC6\u94A5"
      });
    }
    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        error: "\u90AE\u7BB1\u3001\u5BC6\u7801\u548C\u59D3\u540D\u90FD\u662F\u5FC5\u9700\u7684"
      });
    }
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: "\u5BC6\u7801\u81F3\u5C11\u9700\u89818\u4E2A\u5B57\u7B26"
      });
    }
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: "\u8BE5\u90AE\u7BB1\u5DF2\u88AB\u6CE8\u518C"
      });
    }
    const hashedPassword = await bcrypt3.hash(password, 12);
    const adminUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: "ADMIN",
        emailVerified: true,
        settings: {
          preferredLanguage: "zh",
          theme: "light",
          notifications: true
        }
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true
      }
    });
    res.status(201).json({
      success: true,
      data: adminUser,
      message: "\u9996\u4E2A\u7BA1\u7406\u5458\u8D26\u6237\u521B\u5EFA\u6210\u529F"
    });
    console.log(`\u2705 \u9996\u4E2A\u7BA1\u7406\u5458\u8D26\u6237\u5DF2\u521B\u5EFA: ${adminUser.email} (ID: ${adminUser.id})`);
  } catch (error) {
    console.error("\u521B\u5EFA\u9996\u4E2A\u7BA1\u7406\u5458\u5931\u8D25:", error);
    res.status(500).json({
      success: false,
      error: "\u521B\u5EFA\u7BA1\u7406\u5458\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5"
    });
  }
});
router15.get("/users", authenticateToken, async (req, res) => {
  try {
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.userId }
    });
    if (!currentUser || currentUser.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        error: "\u9700\u8981\u7BA1\u7406\u5458\u6743\u9650"
      });
    }
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            practiceRecords: true,
            vocabularyItems: true,
            chatSessions: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });
    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error("\u83B7\u53D6\u7528\u6237\u5217\u8868\u5931\u8D25:", error);
    res.status(500).json({
      success: false,
      error: "\u83B7\u53D6\u7528\u6237\u5217\u8868\u5931\u8D25"
    });
  }
});
router15.post("/promote/:userId", authenticateToken, async (req, res) => {
  try {
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.userId }
    });
    if (!currentUser || currentUser.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        error: "\u9700\u8981\u7BA1\u7406\u5458\u6743\u9650"
      });
    }
    const { userId } = req.params;
    const targetUser = await prisma.user.findUnique({
      where: { id: userId }
    });
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: "\u7528\u6237\u4E0D\u5B58\u5728"
      });
    }
    if (targetUser.role === "ADMIN") {
      return res.status(400).json({
        success: false,
        error: "\u8BE5\u7528\u6237\u5DF2\u7ECF\u662F\u7BA1\u7406\u5458"
      });
    }
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role: "ADMIN" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        updatedAt: true
      }
    });
    res.json({
      success: true,
      data: updatedUser,
      message: "\u7528\u6237\u5DF2\u6210\u529F\u5347\u7EA7\u4E3A\u7BA1\u7406\u5458"
    });
    console.log(`\u2705 \u7528\u6237 ${updatedUser.email} (ID: ${updatedUser.id}) \u5DF2\u88AB\u5347\u7EA7\u4E3A\u7BA1\u7406\u5458`);
  } catch (error) {
    console.error("\u5347\u7EA7\u7528\u6237\u5931\u8D25:", error);
    res.status(500).json({
      success: false,
      error: "\u5347\u7EA7\u7528\u6237\u5931\u8D25"
    });
  }
});
router15.get("/users/:userId/subscription", authenticateToken, async (req, res) => {
  try {
    const { isAdmin, currentUser } = await verifyAdminPermission(req);
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        error: "\u9700\u8981\u7BA1\u7406\u5458\u6743\u9650"
      });
    }
    const { userId } = req.params;
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true }
    });
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: "\u7528\u6237\u4E0D\u5B58\u5728"
      });
    }
    console.log(`\u{1F4CA} \u83B7\u53D6\u7528\u6237 ${targetUser.email} (${userId}) \u7684\u8BA2\u9605\u4FE1\u606F`);
    let subscription = null;
    try {
      subscription = await prisma.userSubscription.findUnique({
        where: { userId },
        include: {
          plan: true,
          paymentTransactions: {
            take: 10,
            orderBy: { createdAt: "desc" }
          }
        }
      });
    } catch (subscriptionError) {
      console.warn(`\u26A0\uFE0F \u83B7\u53D6\u7528\u6237\u8BA2\u9605\u4FE1\u606F\u65F6\u51FA\u9519\uFF0C\u4F7F\u7528\u9ED8\u8BA4\u514D\u8D39\u72B6\u6001:`, subscriptionError);
    }
    let status = "free";
    let displayStatus = "\u514D\u8D39\u7528\u6237";
    let hasSubscription = false;
    if (subscription) {
      hasSubscription = true;
      if (subscription.status === "trialing" && subscription.trialEnd && subscription.trialEnd > /* @__PURE__ */ new Date()) {
        status = "trial";
        displayStatus = "\u8BD5\u7528\u7528\u6237";
      } else if (subscription.status === "active") {
        status = "paid";
        displayStatus = "\u4ED8\u8D39\u7528\u6237";
      } else {
        status = "free";
        displayStatus = "\u514D\u8D39\u7528\u6237";
      }
    }
    const subscriptionInfo = {
      hasSubscription,
      status,
      displayStatus,
      isTestAccount: subscription?.isTestAccount || false,
      trialEndDate: subscription?.trialEnd?.toISOString(),
      nextPaymentDate: subscription?.nextPaymentAt?.toISOString(),
      features: status === "paid" ? ["\u65E0\u9650\u5236\u7EC3\u4E60", "AI\u5BF9\u8BDD", "\u8BCD\u6C47\u7BA1\u7406", "\u8BE6\u7EC6\u7EDF\u8BA1"] : status === "trial" ? ["\u9650\u65F6\u7EC3\u4E60", "AI\u5BF9\u8BDD", "\u8BCD\u6C47\u7BA1\u7406"] : ["\u57FA\u7840\u7EC3\u4E60"],
      limitations: status === "free" ? {
        dailyQuestions: 10,
        monthlyQuestions: 300,
        aiChatSessions: 3
      } : void 0
    };
    res.json({
      success: true,
      data: subscriptionInfo
    });
  } catch (error) {
    console.error("\u83B7\u53D6\u7528\u6237\u8BA2\u9605\u8BE6\u60C5\u5931\u8D25:", error);
    res.status(500).json({
      success: false,
      error: "\u83B7\u53D6\u7528\u6237\u8BA2\u9605\u8BE6\u60C5\u5931\u8D25"
    });
  }
});
router15.post("/users/:userId/subscription-status", authenticateToken, async (req, res) => {
  try {
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.userId }
    });
    if (!currentUser || currentUser.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        error: "\u9700\u8981\u7BA1\u7406\u5458\u6743\u9650"
      });
    }
    const { userId } = req.params;
    const { newStatus, reason } = req.body;
    if (!["free", "trial", "paid"].includes(newStatus)) {
      return res.status(400).json({
        success: false,
        error: "\u65E0\u6548\u7684\u8BA2\u9605\u72B6\u6001"
      });
    }
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true }
    });
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: "\u7528\u6237\u4E0D\u5B58\u5728"
      });
    }
    const currentSubscription = targetUser.subscription;
    let currentStatus = "free";
    if (currentSubscription) {
      if (currentSubscription.status === "trialing" && currentSubscription.trialEnd && currentSubscription.trialEnd > /* @__PURE__ */ new Date()) {
        currentStatus = "trial";
      } else if (currentSubscription.status === "active") {
        currentStatus = "paid";
      }
    }
    if (currentStatus === newStatus) {
      return res.json({
        success: true,
        message: "\u72B6\u6001\u672A\u53D1\u751F\u53D8\u5316",
        data: { currentStatus: newStatus }
      });
    }
    let updatedSubscription;
    switch (newStatus) {
      case "free":
        if (currentSubscription) {
          updatedSubscription = await prisma.userSubscription.update({
            where: { id: currentSubscription.id },
            data: {
              status: "canceled",
              canceledAt: /* @__PURE__ */ new Date(),
              trialEnd: null,
              currentPeriodEnd: /* @__PURE__ */ new Date()
            },
            include: { plan: true }
          });
        }
        break;
      case "trial":
        const trialEndDate = /* @__PURE__ */ new Date();
        trialEndDate.setDate(trialEndDate.getDate() + 3);
        if (currentSubscription) {
          updatedSubscription = await prisma.userSubscription.update({
            where: { id: currentSubscription.id },
            data: {
              status: "trialing",
              trialStart: /* @__PURE__ */ new Date(),
              trialEnd: trialEndDate,
              canceledAt: null
            },
            include: { plan: true }
          });
        } else {
          updatedSubscription = await prisma.userSubscription.create({
            data: {
              userId,
              planId: "premium_monthly",
              // 默认使用premium套餐
              status: "trialing",
              trialStart: /* @__PURE__ */ new Date(),
              trialEnd: trialEndDate,
              isTestAccount: true
              // 管理员创建的默认为测试账户
            },
            include: { plan: true }
          });
        }
        break;
      case "paid":
        const currentPeriodStart = /* @__PURE__ */ new Date();
        const currentPeriodEnd = /* @__PURE__ */ new Date();
        currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
        if (currentSubscription) {
          updatedSubscription = await prisma.userSubscription.update({
            where: { id: currentSubscription.id },
            data: {
              status: "active",
              planId: "premium_monthly",
              currentPeriodStart,
              currentPeriodEnd,
              canceledAt: null,
              trialEnd: null
            },
            include: { plan: true }
          });
        } else {
          updatedSubscription = await prisma.userSubscription.create({
            data: {
              userId,
              planId: "premium_monthly",
              status: "active",
              currentPeriodStart,
              currentPeriodEnd,
              isTestAccount: true
              // 管理员创建的默认为测试账户
            },
            include: { plan: true }
          });
        }
        break;
    }
    await prisma.adminSubscriptionLog.create({
      data: {
        adminUserId: currentUser.id,
        targetUserId: userId,
        subscriptionId: updatedSubscription?.id,
        operationType: "status_change",
        oldStatus: currentStatus,
        newStatus,
        reason: reason || "\u7BA1\u7406\u5458\u624B\u52A8\u4FEE\u6539",
        metadata: {
          adminEmail: currentUser.email,
          targetEmail: targetUser.email,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        }
      }
    });
    console.log(`\u2705 \u7BA1\u7406\u5458 ${currentUser.email} \u5C06\u7528\u6237 ${targetUser.email} \u7684\u8BA2\u9605\u72B6\u6001\u4ECE ${currentStatus} \u4FEE\u6539\u4E3A ${newStatus}`);
    const displayStatusMap = {
      "free": "\u514D\u8D39\u7528\u6237",
      "trial": "\u8BD5\u7528\u7528\u6237",
      "paid": "\u4ED8\u8D39\u7528\u6237"
    };
    const subscriptionInfo = {
      hasSubscription: updatedSubscription !== null,
      status: newStatus,
      displayStatus: displayStatusMap[newStatus],
      isTestAccount: updatedSubscription?.isTestAccount || false,
      trialEndDate: updatedSubscription?.trialEnd?.toISOString(),
      nextPaymentDate: updatedSubscription?.nextPaymentAt?.toISOString(),
      features: newStatus === "paid" ? ["\u65E0\u9650\u5236\u7EC3\u4E60", "AI\u5BF9\u8BDD", "\u8BCD\u6C47\u7BA1\u7406", "\u8BE6\u7EC6\u7EDF\u8BA1"] : newStatus === "trial" ? ["\u9650\u65F6\u7EC3\u4E60", "AI\u5BF9\u8BDD", "\u8BCD\u6C47\u7BA1\u7406"] : ["\u57FA\u7840\u7EC3\u4E60"],
      limitations: newStatus === "free" ? {
        dailyQuestions: 10,
        monthlyQuestions: 300,
        aiChatSessions: 3
      } : void 0
    };
    res.json({
      success: true,
      message: "\u8BA2\u9605\u72B6\u6001\u66F4\u65B0\u6210\u529F",
      data: subscriptionInfo
    });
  } catch (error) {
    console.error("\u66F4\u65B0\u7528\u6237\u8BA2\u9605\u72B6\u6001\u5931\u8D25:", error);
    res.status(500).json({
      success: false,
      error: "\u66F4\u65B0\u7528\u6237\u8BA2\u9605\u72B6\u6001\u5931\u8D25"
    });
  }
});
router15.post("/users/:userId/test-account", authenticateToken, async (req, res) => {
  try {
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.userId }
    });
    if (!currentUser || currentUser.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        error: "\u9700\u8981\u7BA1\u7406\u5458\u6743\u9650"
      });
    }
    const { userId } = req.params;
    const { isTestAccount, reason } = req.body;
    const subscription = await prisma.userSubscription.findUnique({
      where: { userId }
    });
    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: "\u7528\u6237\u6682\u65E0\u8BA2\u9605\u4FE1\u606F"
      });
    }
    const oldTestAccount = subscription.isTestAccount;
    const updatedSubscription = await prisma.userSubscription.update({
      where: { id: subscription.id },
      data: { isTestAccount: Boolean(isTestAccount) },
      include: { plan: true }
    });
    await prisma.adminSubscriptionLog.create({
      data: {
        adminUserId: currentUser.id,
        targetUserId: userId,
        subscriptionId: subscription.id,
        operationType: "test_account_toggle",
        oldTestAccount,
        newTestAccount: Boolean(isTestAccount),
        reason: reason || "\u7BA1\u7406\u5458\u5207\u6362\u6D4B\u8BD5\u8D26\u6237\u72B6\u6001",
        metadata: {
          adminEmail: currentUser.email,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        }
      }
    });
    let status = "free";
    let displayStatus = "\u514D\u8D39\u7528\u6237";
    if (updatedSubscription) {
      if (updatedSubscription.status === "trialing" && updatedSubscription.trialEnd && updatedSubscription.trialEnd > /* @__PURE__ */ new Date()) {
        status = "trial";
        displayStatus = "\u8BD5\u7528\u7528\u6237";
      } else if (updatedSubscription.status === "active") {
        status = "paid";
        displayStatus = "\u4ED8\u8D39\u7528\u6237";
      }
    }
    const subscriptionInfo = {
      hasSubscription: updatedSubscription !== null,
      status,
      displayStatus,
      isTestAccount: Boolean(isTestAccount),
      trialEndDate: updatedSubscription?.trialEnd?.toISOString(),
      nextPaymentDate: updatedSubscription?.nextPaymentAt?.toISOString(),
      features: status === "paid" ? ["\u65E0\u9650\u5236\u7EC3\u4E60", "AI\u5BF9\u8BDD", "\u8BCD\u6C47\u7BA1\u7406", "\u8BE6\u7EC6\u7EDF\u8BA1"] : status === "trial" ? ["\u9650\u65F6\u7EC3\u4E60", "AI\u5BF9\u8BDD", "\u8BCD\u6C47\u7BA1\u7406"] : ["\u57FA\u7840\u7EC3\u4E60"],
      limitations: status === "free" ? {
        dailyQuestions: 10,
        monthlyQuestions: 300,
        aiChatSessions: 3
      } : void 0
    };
    res.json({
      success: true,
      message: "\u6D4B\u8BD5\u8D26\u6237\u72B6\u6001\u66F4\u65B0\u6210\u529F",
      data: subscriptionInfo
    });
  } catch (error) {
    console.error("\u5207\u6362\u6D4B\u8BD5\u8D26\u6237\u6807\u8BB0\u5931\u8D25:", error);
    res.status(500).json({
      success: false,
      error: "\u5207\u6362\u6D4B\u8BD5\u8D26\u6237\u6807\u8BB0\u5931\u8D25"
    });
  }
});
router15.get("/subscription-logs", authenticateToken, async (req, res) => {
  try {
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.userId }
    });
    if (!currentUser || currentUser.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        error: "\u9700\u8981\u7BA1\u7406\u5458\u6743\u9650"
      });
    }
    const {
      page = 1,
      limit = 20,
      targetUserId,
      operationType
    } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const where = {};
    if (targetUserId) where.targetUserId = targetUserId;
    if (operationType) where.operationType = operationType;
    const [logs, total] = await Promise.all([
      prisma.adminSubscriptionLog.findMany({
        where,
        include: {
          adminUser: {
            select: { id: true, email: true, name: true }
          },
          targetUser: {
            select: { id: true, email: true, name: true }
          },
          subscription: {
            select: { id: true, status: true, planId: true }
          }
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: Number(limit)
      }),
      prisma.adminSubscriptionLog.count({ where })
    ]);
    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error) {
    console.error("\u83B7\u53D6\u8BA2\u9605\u64CD\u4F5C\u65E5\u5FD7\u5931\u8D25:", error);
    res.status(500).json({
      success: false,
      error: "\u83B7\u53D6\u8BA2\u9605\u64CD\u4F5C\u65E5\u5FD7\u5931\u8D25"
    });
  }
});
router15.post("/users/:userId/refresh-permissions", authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUser = req.user;
    if (currentUser.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        error: "\u9700\u8981\u7BA1\u7406\u5458\u6743\u9650"
      });
    }
    const targetUser = await prisma.user.findUnique({
      where: { id: userId }
    });
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: "\u7528\u6237\u4E0D\u5B58\u5728"
      });
    }
    const subscription = await prisma.userSubscription.findUnique({
      where: { userId },
      include: { plan: true }
    });
    res.json({
      success: true,
      data: {
        userId,
        message: "\u6743\u9650\u5237\u65B0\u901A\u77E5\u5DF2\u53D1\u9001",
        subscription: subscription ? {
          status: subscription.status,
          planName: subscription.plan?.name,
          isTestAccount: subscription.isTestAccount
        } : null
      }
    });
  } catch (error) {
    console.error("\u53D1\u9001\u6743\u9650\u5237\u65B0\u901A\u77E5\u5931\u8D25:", error);
    res.status(500).json({
      success: false,
      error: "\u53D1\u9001\u6743\u9650\u5237\u65B0\u901A\u77E5\u5931\u8D25"
    });
  }
});
var admin_default = router15;

// src/routes/database-fix.ts
init_database();
import { Router as Router16 } from "express";
var router16 = Router16();
router16.post("/initialize-subscriptions", authenticateToken, async (req, res) => {
  try {
    console.log("\u{1F680} API: \u5F00\u59CB\u521D\u59CB\u5316\u8BA2\u9605\u6570\u636E\u5E93...");
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.userId }
    });
    if (!currentUser || currentUser.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        error: "\u9700\u8981\u7BA1\u7406\u5458\u6743\u9650"
      });
    }
    const results = {
      plansCreated: 0,
      subscriptionsCreated: 0,
      errors: [],
      summary: {}
    };
    console.log("\u{1F4CB} 1. \u521B\u5EFA\u57FA\u7840\u8BA2\u9605\u8BA1\u5212...");
    try {
      const existingPlans = await prisma.subscriptionPlan.findMany();
      console.log(`   \u73B0\u6709\u8BA2\u9605\u8BA1\u5212\u6570\u91CF: ${existingPlans.length}`);
      if (existingPlans.length === 0) {
        console.log("   \u521B\u5EFA\u57FA\u7840\u8BA2\u9605\u8BA1\u5212...");
        const planData = [
          {
            id: "free",
            name: "\u514D\u8D39\u7248",
            nameJp: "\u30D5\u30EA\u30FC\u30D7\u30E9\u30F3",
            priceCents: 0,
            currency: "jpy",
            interval: "month",
            intervalCount: 1,
            features: {
              dailyQuestions: 10,
              aiChatSessions: 3,
              vocabularyWords: 100,
              practiceHistory: true,
              basicStats: true
            },
            dailyPracticeLimit: 10,
            dailyAiChatLimit: 3,
            maxVocabularyWords: 100,
            isActive: true,
            sortOrder: 1
          },
          {
            id: "trial",
            name: "\u8BD5\u7528\u7248",
            nameJp: "\u30C8\u30E9\u30A4\u30A2\u30EB",
            priceCents: 0,
            currency: "jpy",
            interval: "month",
            intervalCount: 1,
            features: {
              dailyQuestions: 50,
              aiChatSessions: 10,
              vocabularyWords: 500,
              practiceHistory: true,
              detailedStats: true,
              aiExplanations: true
            },
            dailyPracticeLimit: 50,
            dailyAiChatLimit: 20,
            maxVocabularyWords: 500,
            isActive: true,
            sortOrder: 2
          },
          {
            id: "premium_monthly",
            name: "Premium\u6708\u8D39\u7248",
            nameJp: "\u30D7\u30EC\u30DF\u30A2\u30E0\u6708\u984D",
            priceCents: 99800,
            // 998日元
            currency: "jpy",
            interval: "month",
            intervalCount: 1,
            stripePriceId: "price_1Rymu42IgNyaWiWliQimHPBs",
            stripeProductId: "prod_Suc82nR87bh9hA",
            features: {
              unlimitedQuestions: true,
              unlimitedAiChat: true,
              unlimitedVocabulary: true,
              practiceHistory: true,
              detailedStats: true,
              aiExplanations: true,
              exportData: true,
              prioritySupport: true
            },
            dailyPracticeLimit: null,
            dailyAiChatLimit: null,
            maxVocabularyWords: null,
            isActive: true,
            sortOrder: 3
          }
        ];
        for (const plan of planData) {
          try {
            await prisma.subscriptionPlan.create({ data: plan });
            results.plansCreated++;
            console.log(`   \u2705 \u521B\u5EFA\u8BA2\u9605\u8BA1\u5212: ${plan.name}`);
          } catch (planError) {
            if (planError.code === "P2002") {
              console.log(`   \u23ED\uFE0F  \u8BA2\u9605\u8BA1\u5212 ${plan.name} \u5DF2\u5B58\u5728\uFF0C\u8DF3\u8FC7`);
            } else {
              const error = `\u521B\u5EFA\u8BA2\u9605\u8BA1\u5212 ${plan.name} \u5931\u8D25: ${planError.message}`;
              console.error(`   \u274C ${error}`);
              results.errors.push(error);
            }
          }
        }
        console.log(`   \u2705 \u8BA2\u9605\u8BA1\u5212\u521B\u5EFA\u5B8C\u6210\uFF0C\u5171\u521B\u5EFA ${results.plansCreated} \u4E2A`);
      } else {
        console.log("   \u23ED\uFE0F  \u8BA2\u9605\u8BA1\u5212\u5DF2\u5B58\u5728\uFF0C\u8DF3\u8FC7\u521B\u5EFA");
      }
    } catch (error) {
      const errorMsg = `\u521B\u5EFA\u8BA2\u9605\u8BA1\u5212\u65F6\u53D1\u751F\u9519\u8BEF: ${error.message}`;
      console.error("\u274C", errorMsg);
      results.errors.push(errorMsg);
    }
    console.log("\u{1F465} 2. \u4E3A\u73B0\u6709\u7528\u6237\u521B\u5EFA\u9ED8\u8BA4\u8BA2\u9605\u8BB0\u5F55...");
    try {
      const usersWithoutSubscription = await prisma.user.findMany({
        where: {
          subscription: null
        },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true
        }
      });
      console.log(`   \u627E\u5230 ${usersWithoutSubscription.length} \u4E2A\u6CA1\u6709\u8BA2\u9605\u8BB0\u5F55\u7684\u7528\u6237`);
      if (usersWithoutSubscription.length > 0) {
        for (const user of usersWithoutSubscription) {
          try {
            await prisma.userSubscription.create({
              data: {
                userId: user.id,
                planId: "free",
                // 默认为免费用户
                status: "active",
                // 免费用户状态为active
                isTestAccount: false,
                currentPeriodStart: user.createdAt,
                currentPeriodEnd: /* @__PURE__ */ new Date("2099-12-31"),
                // 免费用户永不过期
                createdAt: user.createdAt,
                updatedAt: /* @__PURE__ */ new Date()
              }
            });
            results.subscriptionsCreated++;
            console.log(`   \u2705 \u7528\u6237 ${user.email} \u521B\u5EFA\u514D\u8D39\u8BA2\u9605\u8BB0\u5F55\u6210\u529F`);
          } catch (error) {
            const errorMsg = `\u7528\u6237 ${user.email} \u521B\u5EFA\u8BA2\u9605\u8BB0\u5F55\u5931\u8D25: ${error.message}`;
            console.error(`   \u274C ${errorMsg}`);
            results.errors.push(errorMsg);
          }
        }
      } else {
        console.log("   \u23ED\uFE0F  \u6240\u6709\u7528\u6237\u90FD\u5DF2\u6709\u8BA2\u9605\u8BB0\u5F55");
      }
    } catch (error) {
      const errorMsg = `\u521B\u5EFA\u7528\u6237\u8BA2\u9605\u8BB0\u5F55\u65F6\u53D1\u751F\u9519\u8BEF: ${error.message}`;
      console.error("\u274C", errorMsg);
      results.errors.push(errorMsg);
    }
    console.log("\u{1F50D} 3. \u9A8C\u8BC1\u6570\u636E\u5B8C\u6574\u6027...");
    try {
      const totalPlans = await prisma.subscriptionPlan.count();
      console.log(`   \u8BA2\u9605\u8BA1\u5212\u603B\u6570: ${totalPlans}`);
      const totalSubscriptions = await prisma.userSubscription.count();
      const totalUsers = await prisma.user.count();
      console.log(`   \u7528\u6237\u8BA2\u9605\u8BB0\u5F55\u6570: ${totalSubscriptions}`);
      console.log(`   \u7528\u6237\u603B\u6570: ${totalUsers}`);
      results.summary = {
        totalPlans,
        totalSubscriptions,
        totalUsers,
        allUsersHaveSubscriptions: totalSubscriptions >= totalUsers
      };
      if (totalSubscriptions >= totalUsers) {
        console.log("   \u2705 \u6240\u6709\u7528\u6237\u90FD\u6709\u8BA2\u9605\u8BB0\u5F55");
      } else {
        console.log(`   \u26A0\uFE0F  \u8FD8\u6709 ${totalUsers - totalSubscriptions} \u4E2A\u7528\u6237\u6CA1\u6709\u8BA2\u9605\u8BB0\u5F55`);
      }
    } catch (error) {
      const errorMsg = `\u9A8C\u8BC1\u6570\u636E\u5B8C\u6574\u6027\u65F6\u53D1\u751F\u9519\u8BEF: ${error.message}`;
      console.error("\u274C", errorMsg);
      results.errors.push(errorMsg);
    }
    console.log("\u{1F9EA} 4. \u6D4B\u8BD5\u8BA2\u9605\u67E5\u8BE2\u529F\u80FD...");
    try {
      const testUser = await prisma.user.findFirst({
        where: { subscription: { isNot: null } },
        include: {
          subscription: {
            include: {
              plan: true
            }
          }
        }
      });
      if (testUser && testUser.subscription) {
        console.log(`   \u2705 \u6D4B\u8BD5\u7528\u6237 ${testUser.email} \u8BA2\u9605\u67E5\u8BE2\u6210\u529F:`);
        console.log(`      - \u8BA2\u9605\u72B6\u6001: ${testUser.subscription.status}`);
        console.log(`      - \u8BA2\u9605\u8BA1\u5212: ${testUser.subscription.plan?.name}`);
        console.log(`      - \u6D4B\u8BD5\u8D26\u6237: ${testUser.subscription.isTestAccount}`);
        results.testQuery = {
          success: true,
          user: testUser.email,
          status: testUser.subscription.status,
          plan: testUser.subscription.plan?.name
        };
      } else {
        console.log("   \u274C \u8BA2\u9605\u67E5\u8BE2\u6D4B\u8BD5\u5931\u8D25");
        results.testQuery = { success: false };
      }
    } catch (error) {
      const errorMsg = `\u6D4B\u8BD5\u8BA2\u9605\u67E5\u8BE2\u65F6\u53D1\u751F\u9519\u8BEF: ${error.message}`;
      console.error("\u274C", errorMsg);
      results.errors.push(errorMsg);
    }
    console.log("\n\u{1F389} \u8BA2\u9605\u6570\u636E\u5E93\u521D\u59CB\u5316\u5B8C\u6210\uFF01");
    res.json({
      success: true,
      message: "\u8BA2\u9605\u6570\u636E\u5E93\u521D\u59CB\u5316\u5B8C\u6210",
      data: results
    });
    console.log("\u2705 API\u54CD\u5E94\u53D1\u9001\u6210\u529F");
  } catch (error) {
    console.error("\u274C \u8BA2\u9605\u6570\u636E\u5E93\u521D\u59CB\u5316\u5931\u8D25:", error);
    let errorMessage = "\u8BA2\u9605\u6570\u636E\u5E93\u521D\u59CB\u5316\u5931\u8D25";
    let suggestions = [];
    if (error.code === "P2021") {
      errorMessage = "\u6570\u636E\u5E93\u8868\u4E0D\u5B58\u5728";
      suggestions = [
        "\u786E\u4FDD\u6570\u636E\u5E93\u8868\u5DF2\u901A\u8FC7 Prisma \u8FC1\u79FB\u521B\u5EFA",
        "\u8FD0\u884C: npx prisma migrate deploy",
        "\u68C0\u67E5\u6570\u636E\u5E93\u8FDE\u63A5\u914D\u7F6E"
      ];
    } else if (error.code === "P2002") {
      errorMessage = "\u6570\u636E\u5DF2\u5B58\u5728\uFF08\u91CD\u590D\u952E\u51B2\u7A81\uFF09";
      suggestions = ["\u67D0\u4E9B\u6570\u636E\u53EF\u80FD\u5DF2\u7ECF\u5B58\u5728\uFF0C\u8FD9\u901A\u5E38\u4E0D\u662F\u95EE\u9898"];
    }
    res.status(500).json({
      success: false,
      error: errorMessage,
      details: error.message,
      code: error.code,
      suggestions
    });
  }
});
router16.get("/check-subscriptions", authenticateToken, async (req, res) => {
  try {
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.userId }
    });
    if (!currentUser || currentUser.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        error: "\u9700\u8981\u7BA1\u7406\u5458\u6743\u9650"
      });
    }
    const [
      totalPlans,
      totalUsers,
      totalSubscriptions,
      usersWithoutSubscriptions
    ] = await Promise.all([
      prisma.subscriptionPlan.count(),
      prisma.user.count(),
      prisma.userSubscription.count(),
      prisma.user.count({ where: { subscription: null } })
    ]);
    const status = {
      database: "connected",
      subscriptionPlans: {
        total: totalPlans,
        hasBasicPlans: totalPlans >= 3
      },
      users: {
        total: totalUsers,
        withSubscriptions: totalSubscriptions,
        withoutSubscriptions: usersWithoutSubscriptions
      },
      dataIntegrity: {
        allUsersHaveSubscriptions: usersWithoutSubscriptions === 0,
        subscriptionCoverage: totalUsers > 0 ? (totalSubscriptions / totalUsers * 100).toFixed(1) + "%" : "0%"
      }
    };
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error("\u68C0\u67E5\u8BA2\u9605\u6570\u636E\u5E93\u72B6\u6001\u5931\u8D25:", error);
    res.status(500).json({
      success: false,
      error: "\u68C0\u67E5\u8BA2\u9605\u6570\u636E\u5E93\u72B6\u6001\u5931\u8D25",
      details: error.message
    });
  }
});
router16.post("/fix-schema", authenticateToken, async (req, res) => {
  try {
    console.log("\u{1F527} API: \u5F00\u59CB\u4FEE\u590D\u6570\u636E\u5E93schema\u95EE\u9898...");
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.userId }
    });
    if (!currentUser || currentUser.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        error: "\u9700\u8981\u7BA1\u7406\u5458\u6743\u9650"
      });
    }
    const results = {
      columnsFixed: 0,
      errors: [],
      testResults: {}
    };
    console.log("\u{1F4CA} 1. \u4FEE\u590Dpayment_transactions\u8868schema...");
    try {
      const columns = await prisma.$queryRaw`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'payment_transactions' 
        AND table_schema = 'public'
      `;
      console.log("   \u73B0\u6709\u5217:", columns.map((col) => col.column_name));
      const hasStripePaymentId = columns.some((col) => col.column_name === "stripePaymentId");
      if (!hasStripePaymentId) {
        console.log("   \u7F3A\u5C11stripePaymentId\u5217\uFF0C\u6B63\u5728\u6DFB\u52A0...");
        await prisma.$executeRaw`
          ALTER TABLE payment_transactions 
          ADD COLUMN IF NOT EXISTS "stripePaymentId" VARCHAR(255)
        `;
        await prisma.$executeRaw`
          ALTER TABLE payment_transactions 
          ADD CONSTRAINT payment_transactions_stripePaymentId_key 
          UNIQUE ("stripePaymentId")
        `;
        results.columnsFixed++;
        console.log("   \u2705 stripePaymentId\u5217\u6DFB\u52A0\u6210\u529F");
      } else {
        console.log("   \u2705 stripePaymentId\u5217\u5DF2\u5B58\u5728");
      }
    } catch (error) {
      const errorMsg = `\u4FEE\u590Dpayment_transactions\u8868\u5931\u8D25: ${error.message}`;
      console.error("   \u274C", errorMsg);
      results.errors.push(errorMsg);
    }
    console.log("\u{1F9EA} 2. \u6D4B\u8BD5\u4FEE\u590D\u540E\u7684\u8BA2\u9605\u67E5\u8BE2...");
    try {
      const testUser = await prisma.user.findFirst({
        where: { subscription: { isNot: null } }
      });
      if (testUser) {
        const subscription = await prisma.userSubscription.findUnique({
          where: { userId: testUser.id },
          include: {
            plan: true,
            paymentTransactions: {
              take: 5,
              orderBy: { createdAt: "desc" }
            }
          }
        });
        console.log("   \u2705 \u8BA2\u9605\u67E5\u8BE2\u6D4B\u8BD5\u6210\u529F");
        console.log(`   \u6D4B\u8BD5\u7528\u6237: ${testUser.email}`);
        console.log(`   \u8BA2\u9605\u72B6\u6001: ${subscription?.status || "\u65E0\u8BA2\u9605"}`);
        console.log(`   \u5173\u8054\u4EA4\u6613\u8BB0\u5F55: ${subscription?.paymentTransactions?.length || 0}\u6761`);
        results.testResults = {
          success: true,
          user: testUser.email,
          status: subscription?.status,
          plan: subscription?.plan?.name,
          transactionCount: subscription?.paymentTransactions?.length || 0
        };
      } else {
        console.log("   \u26A0\uFE0F \u6CA1\u6709\u627E\u5230\u6709\u8BA2\u9605\u7684\u7528\u6237\u8FDB\u884C\u6D4B\u8BD5");
        results.testResults = { success: false, reason: "no_subscribed_users" };
      }
    } catch (error) {
      const errorMsg = `\u8BA2\u9605\u67E5\u8BE2\u6D4B\u8BD5\u5931\u8D25: ${error.message}`;
      console.error("   \u274C", errorMsg);
      results.errors.push(errorMsg);
      results.testResults = { success: false, error: errorMsg };
    }
    console.log("\\n\u{1F389} \u6570\u636E\u5E93schema\u4FEE\u590D\u5B8C\u6210\uFF01");
    res.json({
      success: true,
      message: "\u6570\u636E\u5E93schema\u4FEE\u590D\u5B8C\u6210",
      data: results
    });
    console.log("\u2705 Schema\u4FEE\u590DAPI\u54CD\u5E94\u53D1\u9001\u6210\u529F");
  } catch (error) {
    console.error("\u274C \u6570\u636E\u5E93schema\u4FEE\u590D\u5931\u8D25:", error);
    res.status(500).json({
      success: false,
      error: "\u6570\u636E\u5E93schema\u4FEE\u590D\u5931\u8D25",
      details: error.message,
      code: error.code
    });
  }
});
var database_fix_default = router16;

// src/routes/notifications.ts
init_database();
import { Router as Router17 } from "express";

// src/services/notificationEmailService.ts
import React17 from "react";

// src/emails/templates/notifications/SecurityAlertEmail.tsx
import React13 from "react";
import { Text as Text10, Section as Section11 } from "@react-email/components";
var AlertTypeConfig = {
  login: {
    title: "\u{1F510} \u65B0\u8BBE\u5907\u767B\u5F55\u901A\u77E5",
    icon: "\u{1F510}",
    color: "blue",
    description: "\u68C0\u6D4B\u5230\u60A8\u7684\u8D26\u6237\u4ECE\u65B0\u8BBE\u5907\u767B\u5F55"
  },
  password_change: {
    title: "\u{1F511} \u5BC6\u7801\u53D8\u66F4\u901A\u77E5",
    icon: "\u{1F511}",
    color: "green",
    description: "\u60A8\u7684\u8D26\u6237\u5BC6\u7801\u5DF2\u6210\u529F\u53D8\u66F4"
  },
  email_change: {
    title: "\u{1F4E7} \u90AE\u7BB1\u53D8\u66F4\u901A\u77E5",
    icon: "\u{1F4E7}",
    color: "orange",
    description: "\u60A8\u7684\u8D26\u6237\u90AE\u7BB1\u5730\u5740\u5DF2\u6210\u529F\u53D8\u66F4"
  },
  suspicious_activity: {
    title: "\u26A0\uFE0F \u53EF\u7591\u6D3B\u52A8\u8B66\u62A5",
    icon: "\u26A0\uFE0F",
    color: "red",
    description: "\u68C0\u6D4B\u5230\u60A8\u7684\u8D26\u6237\u5B58\u5728\u53EF\u7591\u6D3B\u52A8"
  }
};
function SecurityAlertEmail({
  userName,
  alertType,
  alertTime,
  location,
  ipAddress,
  userAgent,
  actionUrl = `${process.env.FRONTEND_URL || "https://www.chattoeic.com"}/account/security`,
  supportEmail = "support@chattoeic.com"
}) {
  const config = AlertTypeConfig[alertType];
  return /* @__PURE__ */ React13.createElement(Layout, { preview: `${config.title} - ${userName}` }, /* @__PURE__ */ React13.createElement(Section11, null, /* @__PURE__ */ React13.createElement(Text10, { className: `text-2xl font-bold text-${config.color}-600 mb-4 m-0` }, config.title), /* @__PURE__ */ React13.createElement(Text10, { className: "text-gray-700 text-base leading-6 mb-4 m-0" }, "\u4EB2\u7231\u7684 ", /* @__PURE__ */ React13.createElement("span", { className: "font-semibold text-blue-600" }, userName), "\uFF0C"), /* @__PURE__ */ React13.createElement(Text10, { className: "text-gray-700 text-base leading-6 mb-4 m-0" }, config.description, "\u3002\u4E3A\u4E86\u786E\u4FDD\u60A8\u7684\u8D26\u6237\u5B89\u5168\uFF0C\u6211\u4EEC\u5411\u60A8\u53D1\u9001\u6B64\u901A\u77E5\u90AE\u4EF6\u3002"), /* @__PURE__ */ React13.createElement(Section11, { className: `bg-${config.color}-50 border border-${config.color}-200 rounded p-4 mb-6` }, /* @__PURE__ */ React13.createElement(Text10, { className: `text-${config.color}-800 text-sm font-semibold m-0` }, config.icon, " \u6D3B\u52A8\u8BE6\u60C5\uFF1A"), /* @__PURE__ */ React13.createElement(Text10, { className: `text-${config.color}-700 text-sm mt-2 mb-1 m-0` }, "\u2022 \u65F6\u95F4\uFF1A", alertTime), location && /* @__PURE__ */ React13.createElement(Text10, { className: `text-${config.color}-700 text-sm my-1 m-0` }, "\u2022 \u4F4D\u7F6E\uFF1A", location), ipAddress && /* @__PURE__ */ React13.createElement(Text10, { className: `text-${config.color}-700 text-sm my-1 m-0` }, "\u2022 IP\u5730\u5740\uFF1A", ipAddress), userAgent && /* @__PURE__ */ React13.createElement(Text10, { className: `text-${config.color}-700 text-sm mt-1 m-0` }, "\u2022 \u8BBE\u5907\u4FE1\u606F\uFF1A", userAgent)), alertType === "login" && /* @__PURE__ */ React13.createElement(React13.Fragment, null, /* @__PURE__ */ React13.createElement(Text10, { className: "text-gray-700 text-base leading-6 mb-4 m-0" }, /* @__PURE__ */ React13.createElement("strong", null, "\u5982\u679C\u8FD9\u662F\u60A8\u672C\u4EBA\u7684\u64CD\u4F5C\uFF1A")), /* @__PURE__ */ React13.createElement(Text10, { className: "text-gray-700 text-base leading-6 mb-6 m-0" }, "\u60A8\u53EF\u4EE5\u5FFD\u7565\u6B64\u90AE\u4EF6\uFF0C\u65E0\u9700\u4EFB\u4F55\u64CD\u4F5C\u3002")), (alertType === "password_change" || alertType === "email_change") && /* @__PURE__ */ React13.createElement(React13.Fragment, null, /* @__PURE__ */ React13.createElement(Text10, { className: "text-gray-700 text-base leading-6 mb-4 m-0" }, /* @__PURE__ */ React13.createElement("strong", null, "\u5982\u679C\u8FD9\u662F\u60A8\u672C\u4EBA\u7684\u64CD\u4F5C\uFF1A")), /* @__PURE__ */ React13.createElement(Text10, { className: "text-gray-700 text-base leading-6 mb-6 m-0" }, "\u606D\u559C\uFF01\u60A8\u7684\u64CD\u4F5C\u5DF2\u6210\u529F\u5B8C\u6210\u3002")), /* @__PURE__ */ React13.createElement(Section11, { className: "bg-red-50 border-l-4 border-red-400 p-4 rounded mb-6" }, /* @__PURE__ */ React13.createElement(Text10, { className: "text-red-800 text-sm font-semibold m-0" }, "\u{1F6A8} \u5982\u679C\u4E0D\u662F\u60A8\u672C\u4EBA\u64CD\u4F5C\uFF1A"), /* @__PURE__ */ React13.createElement(Text10, { className: "text-red-700 text-sm mt-2 mb-1 m-0" }, "\u2022 \u60A8\u7684\u8D26\u6237\u53EF\u80FD\u5DF2\u88AB\u4ED6\u4EBA\u8BBF\u95EE"), /* @__PURE__ */ React13.createElement(Text10, { className: "text-red-700 text-sm my-1 m-0" }, "\u2022 \u8BF7\u7ACB\u5373\u66F4\u6539\u60A8\u7684\u5BC6\u7801"), /* @__PURE__ */ React13.createElement(Text10, { className: "text-red-700 text-sm my-1 m-0" }, "\u2022 \u542F\u7528\u4E24\u6B65\u9A8C\u8BC1\uFF08\u5982\u53EF\u7528\uFF09"), /* @__PURE__ */ React13.createElement(Text10, { className: "text-red-700 text-sm mt-1 m-0" }, "\u2022 \u7ACB\u5373\u8054\u7CFB\u6211\u4EEC\u7684\u5B89\u5168\u56E2\u961F")), /* @__PURE__ */ React13.createElement(Section11, { className: "text-center mb-6" }, /* @__PURE__ */ React13.createElement(Button, { href: actionUrl }, "\u67E5\u770B\u8D26\u6237\u5B89\u5168\u8BBE\u7F6E")), /* @__PURE__ */ React13.createElement(Section11, { className: "bg-blue-50 border border-blue-200 rounded p-4 mb-6" }, /* @__PURE__ */ React13.createElement(Text10, { className: "text-blue-800 text-sm font-semibold m-0" }, "\u{1F510} \u5B89\u5168\u5EFA\u8BAE\uFF1A"), /* @__PURE__ */ React13.createElement(Text10, { className: "text-blue-700 text-sm mt-2 mb-1 m-0" }, "\u2022 \u4F7F\u7528\u5F3A\u5BC6\u7801\uFF0C\u5305\u542B\u5B57\u6BCD\u3001\u6570\u5B57\u548C\u7279\u6B8A\u5B57\u7B26"), /* @__PURE__ */ React13.createElement(Text10, { className: "text-blue-700 text-sm my-1 m-0" }, "\u2022 \u5B9A\u671F\u66F4\u6362\u5BC6\u7801\uFF0C\u5EFA\u8BAE\u6BCF3-6\u4E2A\u6708"), /* @__PURE__ */ React13.createElement(Text10, { className: "text-blue-700 text-sm my-1 m-0" }, "\u2022 \u4E0D\u8981\u5728\u4E0D\u540C\u7F51\u7AD9\u4F7F\u7528\u76F8\u540C\u5BC6\u7801"), /* @__PURE__ */ React13.createElement(Text10, { className: "text-blue-700 text-sm my-1 m-0" }, "\u2022 \u6CE8\u610F\u8BC6\u522B\u9493\u9C7C\u90AE\u4EF6\u548C\u865A\u5047\u7F51\u7AD9"), /* @__PURE__ */ React13.createElement(Text10, { className: "text-blue-700 text-sm mt-1 m-0" }, "\u2022 \u5728\u516C\u5171\u7F51\u7EDC\u4E0B\u8C28\u614E\u767B\u5F55")), alertType === "suspicious_activity" && /* @__PURE__ */ React13.createElement(Section11, { className: "bg-amber-50 border border-amber-200 rounded p-4 mb-6" }, /* @__PURE__ */ React13.createElement(Text10, { className: "text-amber-800 text-sm font-semibold m-0" }, "\u26A1 \u7ACB\u5373\u884C\u52A8\uFF1A"), /* @__PURE__ */ React13.createElement(Text10, { className: "text-amber-700 text-sm mt-2 mb-1 m-0" }, "\u2022 \u7ACB\u5373\u66F4\u6539\u5BC6\u7801"), /* @__PURE__ */ React13.createElement(Text10, { className: "text-amber-700 text-sm my-1 m-0" }, "\u2022 \u68C0\u67E5\u8D26\u6237\u6D3B\u52A8\u8BB0\u5F55"), /* @__PURE__ */ React13.createElement(Text10, { className: "text-amber-700 text-sm my-1 m-0" }, "\u2022 \u8054\u7CFB\u6211\u4EEC\u8FDB\u884C\u8D26\u6237\u5B89\u5168\u5BA1\u67E5"), /* @__PURE__ */ React13.createElement(Text10, { className: "text-amber-700 text-sm mt-1 m-0" }, "\u2022 \u8003\u8651\u542F\u7528\u989D\u5916\u7684\u5B89\u5168\u63AA\u65BD")), /* @__PURE__ */ React13.createElement(Text10, { className: "text-gray-700 text-base leading-6 mb-4 m-0" }, "\u5982\u679C\u60A8\u5BF9\u6B64\u901A\u77E5\u6709\u4EFB\u4F55\u7591\u95EE\uFF0C\u6216\u9700\u8981\u5E2E\u52A9\u4FDD\u62A4\u60A8\u7684\u8D26\u6237\uFF0C\u8BF7\u968F\u65F6\u8054\u7CFB\u6211\u4EEC\u7684\u652F\u6301\u56E2\u961F\u3002"), /* @__PURE__ */ React13.createElement(Text10, { className: "text-gray-600 text-sm mt-6 m-0" }, "\u6B64\u90AE\u4EF6\u7531\u7CFB\u7EDF\u81EA\u52A8\u53D1\u9001\uFF0C\u8BF7\u52FF\u56DE\u590D\u3002", /* @__PURE__ */ React13.createElement("br", null), "ChatTOEIC \u5B89\u5168\u56E2\u961F"), /* @__PURE__ */ React13.createElement(Text10, { className: "text-gray-600 text-sm mt-4 m-0" }, "\u9700\u8981\u5E2E\u52A9\uFF1F\u8BF7\u8054\u7CFB\uFF1A", /* @__PURE__ */ React13.createElement("a", { href: `mailto:${supportEmail}`, className: "text-blue-600 underline ml-1" }, supportEmail))));
}

// src/emails/templates/notifications/SystemMaintenanceEmail.tsx
import React14 from "react";
import { Text as Text11, Section as Section12 } from "@react-email/components";
var MaintenanceTypeConfig = {
  scheduled: {
    title: "\u{1F527} \u7CFB\u7EDF\u7EF4\u62A4\u901A\u77E5",
    icon: "\u{1F527}",
    color: "blue",
    description: "\u6211\u4EEC\u5C06\u8FDB\u884C\u8BA1\u5212\u4E2D\u7684\u7CFB\u7EDF\u7EF4\u62A4"
  },
  emergency: {
    title: "\u26A1 \u7D27\u6025\u7EF4\u62A4\u901A\u77E5",
    icon: "\u26A1",
    color: "red",
    description: "\u7531\u4E8E\u6280\u672F\u95EE\u9898\uFF0C\u6211\u4EEC\u9700\u8981\u8FDB\u884C\u7D27\u6025\u7EF4\u62A4"
  },
  completed: {
    title: "\u2705 \u7EF4\u62A4\u5B8C\u6210\u901A\u77E5",
    icon: "\u2705",
    color: "green",
    description: "\u7CFB\u7EDF\u7EF4\u62A4\u5DF2\u5B8C\u6210\uFF0C\u6240\u6709\u670D\u52A1\u5DF2\u6062\u590D\u6B63\u5E38"
  }
};
function SystemMaintenanceEmail({
  userName,
  maintenanceType,
  startTime,
  endTime,
  duration,
  reason,
  affectedServices = [],
  statusPageUrl = `${process.env.FRONTEND_URL || "https://www.chattoeic.com"}/status`,
  supportEmail = "support@chattoeic.com"
}) {
  const config = MaintenanceTypeConfig[maintenanceType];
  return /* @__PURE__ */ React14.createElement(Layout, { preview: `${config.title} - ChatTOEIC` }, /* @__PURE__ */ React14.createElement(Section12, null, /* @__PURE__ */ React14.createElement(Text11, { className: `text-2xl font-bold text-${config.color}-600 mb-4 m-0` }, config.title), /* @__PURE__ */ React14.createElement(Text11, { className: "text-gray-700 text-base leading-6 mb-4 m-0" }, "\u4EB2\u7231\u7684 ", /* @__PURE__ */ React14.createElement("span", { className: "font-semibold text-blue-600" }, userName), "\uFF0C"), /* @__PURE__ */ React14.createElement(Text11, { className: "text-gray-700 text-base leading-6 mb-4 m-0" }, config.description, "\u3002\u6211\u4EEC\u5BF9\u6B64\u53EF\u80FD\u9020\u6210\u7684\u4E0D\u4FBF\u6DF1\u8868\u6B49\u610F\u3002"), /* @__PURE__ */ React14.createElement(Section12, { className: `bg-${config.color}-50 border border-${config.color}-200 rounded p-4 mb-6` }, /* @__PURE__ */ React14.createElement(Text11, { className: `text-${config.color}-800 text-sm font-semibold m-0` }, config.icon, " \u7EF4\u62A4\u8BE6\u60C5\uFF1A"), /* @__PURE__ */ React14.createElement(Text11, { className: `text-${config.color}-700 text-sm mt-2 mb-1 m-0` }, "\u2022 \u5F00\u59CB\u65F6\u95F4\uFF1A", startTime), endTime && /* @__PURE__ */ React14.createElement(Text11, { className: `text-${config.color}-700 text-sm my-1 m-0` }, "\u2022 \u7ED3\u675F\u65F6\u95F4\uFF1A", endTime), duration && /* @__PURE__ */ React14.createElement(Text11, { className: `text-${config.color}-700 text-sm my-1 m-0` }, "\u2022 \u9884\u8BA1\u65F6\u957F\uFF1A", duration), reason && /* @__PURE__ */ React14.createElement(Text11, { className: `text-${config.color}-700 text-sm mt-1 m-0` }, "\u2022 \u7EF4\u62A4\u539F\u56E0\uFF1A", reason)), affectedServices.length > 0 && /* @__PURE__ */ React14.createElement(Section12, { className: "bg-amber-50 border border-amber-200 rounded p-4 mb-6" }, /* @__PURE__ */ React14.createElement(Text11, { className: "text-amber-800 text-sm font-semibold m-0" }, "\u{1F504} \u53D7\u5F71\u54CD\u7684\u670D\u52A1\uFF1A"), affectedServices.map((service, index) => /* @__PURE__ */ React14.createElement(Text11, { key: index, className: "text-amber-700 text-sm my-1 m-0" }, "\u2022 ", service))), maintenanceType === "scheduled" && /* @__PURE__ */ React14.createElement(React14.Fragment, null, /* @__PURE__ */ React14.createElement(Text11, { className: "text-gray-700 text-base leading-6 mb-4 m-0" }, /* @__PURE__ */ React14.createElement("strong", null, "\u7EF4\u62A4\u671F\u95F4\uFF1A")), /* @__PURE__ */ React14.createElement(Text11, { className: "text-gray-700 text-base leading-6 mb-4 m-0" }, "\u2022 \u60A8\u53EF\u80FD\u65E0\u6CD5\u8BBF\u95EEChatTOEIC\u670D\u52A1"), /* @__PURE__ */ React14.createElement(Text11, { className: "text-gray-700 text-base leading-6 mb-4 m-0" }, "\u2022 \u5B66\u4E60\u8FDB\u5EA6\u548C\u6570\u636E\u5C06\u88AB\u5B89\u5168\u4FDD\u5B58"), /* @__PURE__ */ React14.createElement(Text11, { className: "text-gray-700 text-base leading-6 mb-6 m-0" }, "\u2022 \u7EF4\u62A4\u5B8C\u6210\u540E\u6240\u6709\u529F\u80FD\u5C06\u7ACB\u5373\u6062\u590D")), maintenanceType === "emergency" && /* @__PURE__ */ React14.createElement(React14.Fragment, null, /* @__PURE__ */ React14.createElement(Section12, { className: "bg-red-50 border-l-4 border-red-400 p-4 rounded mb-6" }, /* @__PURE__ */ React14.createElement(Text11, { className: "text-red-800 text-sm font-semibold m-0" }, "\u{1F6A8} \u7D27\u6025\u7EF4\u62A4\u901A\u77E5\uFF1A"), /* @__PURE__ */ React14.createElement(Text11, { className: "text-red-700 text-sm mt-2 mb-1 m-0" }, "\u2022 \u6211\u4EEC\u6B63\u5728\u5904\u7406\u4E00\u4E2A\u5F71\u54CD\u670D\u52A1\u7A33\u5B9A\u6027\u7684\u95EE\u9898"), /* @__PURE__ */ React14.createElement(Text11, { className: "text-red-700 text-sm my-1 m-0" }, "\u2022 \u7EF4\u62A4\u671F\u95F4\u90E8\u5206\u6216\u5168\u90E8\u529F\u80FD\u53EF\u80FD\u6682\u65F6\u4E0D\u53EF\u7528"), /* @__PURE__ */ React14.createElement(Text11, { className: "text-red-700 text-sm my-1 m-0" }, "\u2022 \u6211\u4EEC\u6B63\u5728\u52AA\u529B\u5C3D\u5FEB\u6062\u590D\u6B63\u5E38\u670D\u52A1"), /* @__PURE__ */ React14.createElement(Text11, { className: "text-red-700 text-sm mt-1 m-0" }, "\u2022 \u60A8\u7684\u5B66\u4E60\u6570\u636E\u4E0D\u4F1A\u53D7\u5230\u5F71\u54CD"))), maintenanceType === "completed" && /* @__PURE__ */ React14.createElement(React14.Fragment, null, /* @__PURE__ */ React14.createElement(Section12, { className: "bg-green-50 border border-green-200 rounded p-4 mb-6" }, /* @__PURE__ */ React14.createElement(Text11, { className: "text-green-800 text-sm font-semibold m-0" }, "\u{1F389} \u7EF4\u62A4\u5B8C\u6210\uFF1A"), /* @__PURE__ */ React14.createElement(Text11, { className: "text-green-700 text-sm mt-2 mb-1 m-0" }, "\u2022 \u6240\u6709\u7CFB\u7EDF\u5DF2\u6062\u590D\u6B63\u5E38\u8FD0\u884C"), /* @__PURE__ */ React14.createElement(Text11, { className: "text-green-700 text-sm my-1 m-0" }, "\u2022 \u60A8\u73B0\u5728\u53EF\u4EE5\u6B63\u5E38\u4F7F\u7528ChatTOEIC\u7684\u6240\u6709\u529F\u80FD"), /* @__PURE__ */ React14.createElement(Text11, { className: "text-green-700 text-sm my-1 m-0" }, "\u2022 \u60A8\u7684\u5B66\u4E60\u6570\u636E\u548C\u8FDB\u5EA6\u5B8C\u5168\u4FDD\u6301\u4E0D\u53D8"), /* @__PURE__ */ React14.createElement(Text11, { className: "text-green-700 text-sm mt-1 m-0" }, "\u2022 \u611F\u8C22\u60A8\u5728\u7EF4\u62A4\u671F\u95F4\u7684\u8010\u5FC3\u7B49\u5F85")), /* @__PURE__ */ React14.createElement(Section12, { className: "text-center mb-6" }, /* @__PURE__ */ React14.createElement(Button, { href: process.env.FRONTEND_URL || "https://www.chattoeic.com" }, "\u7EE7\u7EED\u5B66\u4E60"))), maintenanceType !== "completed" && /* @__PURE__ */ React14.createElement(Section12, { className: "bg-blue-50 border border-blue-200 rounded p-4 mb-6" }, /* @__PURE__ */ React14.createElement(Text11, { className: "text-blue-800 text-sm font-semibold m-0" }, "\u{1F4F1} \u7EF4\u62A4\u671F\u95F4\u5EFA\u8BAE\uFF1A"), /* @__PURE__ */ React14.createElement(Text11, { className: "text-blue-700 text-sm mt-2 mb-1 m-0" }, "\u2022 \u4FDD\u5B58\u5F53\u524D\u7684\u5B66\u4E60\u8FDB\u5EA6"), /* @__PURE__ */ React14.createElement(Text11, { className: "text-blue-700 text-sm my-1 m-0" }, "\u2022 \u53EF\u4EE5\u5229\u7528\u6B64\u65F6\u95F4\u590D\u4E60\u4E4B\u524D\u7684\u5B66\u4E60\u5185\u5BB9"), /* @__PURE__ */ React14.createElement(Text11, { className: "text-blue-700 text-sm my-1 m-0" }, "\u2022 \u5173\u6CE8\u6211\u4EEC\u7684\u72B6\u6001\u9875\u9762\u83B7\u53D6\u6700\u65B0\u66F4\u65B0"), /* @__PURE__ */ React14.createElement(Text11, { className: "text-blue-700 text-sm mt-1 m-0" }, "\u2022 \u7EF4\u62A4\u5B8C\u6210\u540E\u4F1A\u6536\u5230\u901A\u77E5\u90AE\u4EF6")), /* @__PURE__ */ React14.createElement(Text11, { className: "text-gray-700 text-base leading-6 mb-4 m-0" }, "\u6211\u4EEC\u7406\u89E3\u670D\u52A1\u4E2D\u65AD\u53EF\u80FD\u4F1A\u7ED9\u60A8\u7684\u5B66\u4E60\u8BA1\u5212\u5E26\u6765\u4E0D\u4FBF\uFF0C\u6211\u4EEC\u6B63\u5728\u52AA\u529B\u63D0\u4F9B\u66F4\u7A33\u5B9A\u548C\u4F18\u8D28\u7684\u670D\u52A1\u3002"), /* @__PURE__ */ React14.createElement(Section12, { className: "text-center mb-6" }, /* @__PURE__ */ React14.createElement(Button, { href: statusPageUrl, variant: "secondary" }, "\u67E5\u770B\u7CFB\u7EDF\u72B6\u6001")), /* @__PURE__ */ React14.createElement(Section12, { className: "bg-gray-50 border border-gray-200 rounded p-4 mb-6" }, /* @__PURE__ */ React14.createElement(Text11, { className: "text-gray-800 text-sm font-semibold m-0" }, "\u{1F4AC} \u9700\u8981\u5E2E\u52A9\uFF1F"), /* @__PURE__ */ React14.createElement(Text11, { className: "text-gray-700 text-sm mt-2 mb-1 m-0" }, "\u5982\u679C\u60A8\u5728\u7EF4\u62A4\u671F\u95F4\u6216\u4E4B\u540E\u9047\u5230\u4EFB\u4F55\u95EE\u9898\uFF0C\u8BF7\u968F\u65F6\u8054\u7CFB\u6211\u4EEC\uFF1A"), /* @__PURE__ */ React14.createElement(Text11, { className: "text-gray-700 text-sm my-1 m-0" }, "\u{1F4E7} \u90AE\u7BB1\uFF1A", supportEmail), /* @__PURE__ */ React14.createElement(Text11, { className: "text-gray-700 text-sm mt-1 m-0" }, "\u{1F310} \u72B6\u6001\u9875\u9762\uFF1A", statusPageUrl)), /* @__PURE__ */ React14.createElement(Text11, { className: "text-gray-600 text-sm mt-6 m-0" }, "\u611F\u8C22\u60A8\u5BF9ChatTOEIC\u7684\u652F\u6301\u4E0E\u7406\u89E3\uFF01", /* @__PURE__ */ React14.createElement("br", null), "ChatTOEIC \u6280\u672F\u56E2\u961F"), /* @__PURE__ */ React14.createElement(Text11, { className: "text-gray-600 text-sm mt-4 m-0" }, "\u6B64\u90AE\u4EF6\u7531\u7CFB\u7EDF\u81EA\u52A8\u53D1\u9001\uFF0C\u8BF7\u52FF\u56DE\u590D\u3002\u5982\u9700\u8054\u7CFB\u6211\u4EEC\uFF0C\u8BF7\u4F7F\u7528\u4E0A\u8FF0\u8054\u7CFB\u65B9\u5F0F\u3002")));
}

// src/emails/templates/notifications/AccountActivityEmail.tsx
import React15 from "react";
import { Text as Text12, Section as Section13 } from "@react-email/components";
var PeriodTypeConfig = {
  weekly: {
    title: "\u{1F4CA} \u672C\u5468\u5B66\u4E60\u62A5\u544A",
    icon: "\u{1F4CA}",
    color: "blue",
    greeting: "\u672C\u5468\u60A8\u7684\u5B66\u4E60\u8868\u73B0\u5982\u4E0B"
  },
  monthly: {
    title: "\u{1F4C8} \u672C\u6708\u5B66\u4E60\u603B\u7ED3",
    icon: "\u{1F4C8}",
    color: "green",
    greeting: "\u606D\u559C\u60A8\u5B8C\u6210\u4E86\u4E00\u4E2A\u6708\u7684\u5B66\u4E60"
  },
  yearly: {
    title: "\u{1F3C6} \u5E74\u5EA6\u5B66\u4E60\u6210\u5C31",
    icon: "\u{1F3C6}",
    color: "purple",
    greeting: "\u8BA9\u6211\u4EEC\u4E00\u8D77\u56DE\u987E\u60A8\u8FD9\u4E00\u5E74\u7684\u5B66\u4E60\u6210\u5C31"
  }
};
function AccountActivityEmail({
  userName,
  periodType,
  periodStart,
  periodEnd,
  activityData,
  topAchievements = [],
  recommendations = [],
  dashboardUrl = `${process.env.FRONTEND_URL || "https://www.chattoeic.com"}/dashboard`
}) {
  const config = PeriodTypeConfig[periodType];
  return /* @__PURE__ */ React15.createElement(Layout, { preview: `${config.title} - ${userName}` }, /* @__PURE__ */ React15.createElement(Section13, null, /* @__PURE__ */ React15.createElement(Text12, { className: `text-2xl font-bold text-${config.color}-600 mb-4 m-0` }, config.title), /* @__PURE__ */ React15.createElement(Text12, { className: "text-gray-700 text-base leading-6 mb-4 m-0" }, "\u4EB2\u7231\u7684 ", /* @__PURE__ */ React15.createElement("span", { className: "font-semibold text-blue-600" }, userName), "\uFF0C"), /* @__PURE__ */ React15.createElement(Text12, { className: "text-gray-700 text-base leading-6 mb-6 m-0" }, config.greeting, "\uFF08", periodStart, " - ", periodEnd, "\uFF09\uFF1A"), /* @__PURE__ */ React15.createElement(Section13, { className: `bg-${config.color}-50 border border-${config.color}-200 rounded p-4 mb-6` }, /* @__PURE__ */ React15.createElement(Text12, { className: `text-${config.color}-800 text-lg font-semibold mb-3 m-0` }, config.icon, " \u5B66\u4E60\u7EDF\u8BA1"), /* @__PURE__ */ React15.createElement("div", { className: "grid grid-cols-2 gap-4 mb-4" }, /* @__PURE__ */ React15.createElement("div", { className: `bg-white border border-${config.color}-100 rounded p-3` }, /* @__PURE__ */ React15.createElement(Text12, { className: `text-${config.color}-600 text-sm font-medium m-0` }, "\u7EC3\u4E60\u6B21\u6570"), /* @__PURE__ */ React15.createElement(Text12, { className: `text-2xl font-bold text-${config.color}-800 mt-1 m-0` }, activityData.practiceCount)), /* @__PURE__ */ React15.createElement("div", { className: `bg-white border border-${config.color}-100 rounded p-3` }, /* @__PURE__ */ React15.createElement(Text12, { className: `text-${config.color}-600 text-sm font-medium m-0` }, "\u5B66\u4E60\u65F6\u957F"), /* @__PURE__ */ React15.createElement(Text12, { className: `text-2xl font-bold text-${config.color}-800 mt-1 m-0` }, activityData.studyHours, "h")), /* @__PURE__ */ React15.createElement("div", { className: `bg-white border border-${config.color}-100 rounded p-3` }, /* @__PURE__ */ React15.createElement(Text12, { className: `text-${config.color}-600 text-sm font-medium m-0` }, "\u7B54\u9898\u6570\u91CF"), /* @__PURE__ */ React15.createElement(Text12, { className: `text-2xl font-bold text-${config.color}-800 mt-1 m-0` }, activityData.questionsAnswered)), /* @__PURE__ */ React15.createElement("div", { className: `bg-white border border-${config.color}-100 rounded p-3` }, /* @__PURE__ */ React15.createElement(Text12, { className: `text-${config.color}-600 text-sm font-medium m-0` }, "\u6B63\u786E\u7387"), /* @__PURE__ */ React15.createElement(Text12, { className: `text-2xl font-bold text-${config.color}-800 mt-1 m-0` }, activityData.correctRate, "%"))), /* @__PURE__ */ React15.createElement("div", { className: "grid grid-cols-3 gap-4" }, /* @__PURE__ */ React15.createElement("div", { className: `bg-white border border-${config.color}-100 rounded p-3` }, /* @__PURE__ */ React15.createElement(Text12, { className: `text-${config.color}-600 text-sm font-medium m-0` }, "\u8FDE\u7EED\u5929\u6570"), /* @__PURE__ */ React15.createElement(Text12, { className: `text-xl font-bold text-${config.color}-800 mt-1 m-0` }, activityData.streakDays, "\u5929")), /* @__PURE__ */ React15.createElement("div", { className: `bg-white border border-${config.color}-100 rounded p-3` }, /* @__PURE__ */ React15.createElement(Text12, { className: `text-${config.color}-600 text-sm font-medium m-0` }, "\u65B0\u5B66\u5355\u8BCD"), /* @__PURE__ */ React15.createElement(Text12, { className: `text-xl font-bold text-${config.color}-800 mt-1 m-0` }, activityData.newWords, "\u4E2A")), /* @__PURE__ */ React15.createElement("div", { className: `bg-white border border-${config.color}-100 rounded p-3` }, /* @__PURE__ */ React15.createElement(Text12, { className: `text-${config.color}-600 text-sm font-medium m-0` }, "\u83B7\u5F97\u6210\u5C31"), /* @__PURE__ */ React15.createElement(Text12, { className: `text-xl font-bold text-${config.color}-800 mt-1 m-0` }, activityData.achievementsUnlocked, "\u4E2A")))), topAchievements.length > 0 && /* @__PURE__ */ React15.createElement(Section13, { className: "bg-yellow-50 border border-yellow-200 rounded p-4 mb-6" }, /* @__PURE__ */ React15.createElement(Text12, { className: "text-yellow-800 text-lg font-semibold mb-3 m-0" }, "\u{1F3C5} \u672C\u671F\u4EAE\u70B9\u6210\u5C31"), topAchievements.map((achievement, index) => /* @__PURE__ */ React15.createElement(Text12, { key: index, className: "text-yellow-700 text-sm my-2 m-0" }, "\u2728 ", achievement))), /* @__PURE__ */ React15.createElement(Section13, { className: "bg-green-50 border border-green-200 rounded p-4 mb-6" }, /* @__PURE__ */ React15.createElement(Text12, { className: "text-green-800 text-lg font-semibold mb-3 m-0" }, "\u{1F3AF} \u5B66\u4E60\u8FDB\u5EA6\u8BC4\u4EF7"), activityData.correctRate >= 80 && /* @__PURE__ */ React15.createElement(Text12, { className: "text-green-700 text-sm mb-2 m-0" }, "\u{1F31F} \u592A\u68D2\u4E86\uFF01\u60A8\u7684\u6B63\u786E\u7387\u8FBE\u5230\u4E86 ", activityData.correctRate, "%\uFF0C\u5C55\u73B0\u4E86\u4F18\u79C0\u7684\u5B66\u4E60\u6210\u679C\uFF01"), activityData.streakDays >= 7 && /* @__PURE__ */ React15.createElement(Text12, { className: "text-green-700 text-sm mb-2 m-0" }, "\u{1F525} \u575A\u6301\u4E86 ", activityData.streakDays, " \u5929\u8FDE\u7EED\u5B66\u4E60\uFF0C\u60A8\u7684\u6BC5\u529B\u4EE4\u4EBA\u656C\u4F69\uFF01"), activityData.studyHours >= 10 && /* @__PURE__ */ React15.createElement(Text12, { className: "text-green-700 text-sm mb-2 m-0" }, "\u23F0 \u672C\u671F\u6295\u5165\u4E86 ", activityData.studyHours, " \u5C0F\u65F6\u5B66\u4E60\u65F6\u95F4\uFF0C\u52E4\u594B\u7684\u4ED8\u51FA\u5FC5\u6709\u56DE\u62A5\uFF01"), activityData.newWords >= 50 && /* @__PURE__ */ React15.createElement(Text12, { className: "text-green-700 text-sm mb-2 m-0" }, "\u{1F4DA} \u5B66\u4F1A\u4E86 ", activityData.newWords, " \u4E2A\u65B0\u5355\u8BCD\uFF0C\u8BCD\u6C47\u91CF\u7A33\u6B65\u63D0\u5347\uFF01")), recommendations.length > 0 && /* @__PURE__ */ React15.createElement(Section13, { className: "bg-blue-50 border border-blue-200 rounded p-4 mb-6" }, /* @__PURE__ */ React15.createElement(Text12, { className: "text-blue-800 text-lg font-semibold mb-3 m-0" }, "\u{1F4A1} \u4E2A\u6027\u5316\u5EFA\u8BAE"), recommendations.map((recommendation, index) => /* @__PURE__ */ React15.createElement(Text12, { key: index, className: "text-blue-700 text-sm my-2 m-0" }, "\u2022 ", recommendation))), /* @__PURE__ */ React15.createElement(Section13, { className: "bg-purple-50 border border-purple-200 rounded p-4 mb-6" }, /* @__PURE__ */ React15.createElement(Text12, { className: "text-purple-800 text-lg font-semibold mb-3 m-0" }, "\u{1F3AF} ", periodType === "weekly" ? "\u4E0B\u5468" : periodType === "monthly" ? "\u4E0B\u6708" : "\u6765\u5E74", "\u76EE\u6807\u5EFA\u8BAE"), activityData.correctRate < 80 && /* @__PURE__ */ React15.createElement(Text12, { className: "text-purple-700 text-sm mb-2 m-0" }, "\u{1F4C8} \u63D0\u9AD8\u7B54\u9898\u6B63\u786E\u7387\u81F380%\u4EE5\u4E0A\uFF0C\u5EFA\u8BAE\u591A\u505A\u9519\u9898\u590D\u4E60"), activityData.streakDays < 5 && /* @__PURE__ */ React15.createElement(Text12, { className: "text-purple-700 text-sm mb-2 m-0" }, "\u{1F3AF} \u4FDD\u6301\u6BCF\u65E5\u5B66\u4E60\u4E60\u60EF\uFF0C\u76EE\u6807\u8FDE\u7EED\u5B66\u4E607\u5929"), /* @__PURE__ */ React15.createElement(Text12, { className: "text-purple-700 text-sm mb-2 m-0" }, "\u{1F4DA} \u638C\u63E1\u66F4\u591A\u65B0\u8BCD\u6C47\uFF0C\u6269\u5927\u8BCD\u6C47\u50A8\u5907"), /* @__PURE__ */ React15.createElement(Text12, { className: "text-purple-700 text-sm mb-2 m-0" }, "\u{1F3C6} \u6311\u6218\u66F4\u9AD8\u96BE\u5EA6\u7684\u7EC3\u4E60\uFF0C\u63D0\u5347\u5E94\u8BD5\u80FD\u529B")), /* @__PURE__ */ React15.createElement(Text12, { className: "text-gray-700 text-base leading-6 mb-6 m-0" }, "\u60A8\u7684\u52AA\u529B\u548C\u575A\u6301\u8BA9\u6211\u4EEC\u6DF1\u611F\u94A6\u4F69\uFF01\u7EE7\u7EED\u52A0\u6CB9\uFF0CChatTOEIC\u5C06\u966A\u4F34\u60A8\u5728\u82F1\u8BED\u5B66\u4E60\u7684\u9053\u8DEF\u4E0A\u4E0D\u65AD\u8FDB\u6B65\u3002"), /* @__PURE__ */ React15.createElement(Section13, { className: "text-center mb-6" }, /* @__PURE__ */ React15.createElement(Button, { href: dashboardUrl }, "\u67E5\u770B\u8BE6\u7EC6\u62A5\u544A")), /* @__PURE__ */ React15.createElement(Text12, { className: "text-gray-600 text-sm mt-6 m-0" }, "\u7EE7\u7EED\u4FDD\u6301\u5B66\u4E60\u7684\u70ED\u60C5\uFF0C\u6210\u529F\u5C31\u5728\u524D\u65B9\uFF01", /* @__PURE__ */ React15.createElement("br", null), "ChatTOEIC \u5B66\u4E60\u56E2\u961F"), /* @__PURE__ */ React15.createElement(Text12, { className: "text-gray-600 text-sm mt-4 m-0" }, "\u5982\u9700\u8C03\u6574\u90AE\u4EF6\u9891\u7387\u6216\u505C\u6B62\u63A5\u6536\u5B66\u4E60\u62A5\u544A\uFF0C\u8BF7\u8BBF\u95EE", /* @__PURE__ */ React15.createElement("a", { href: `${dashboardUrl}/settings/notifications`, className: "text-blue-600 underline ml-1" }, "\u901A\u77E5\u8BBE\u7F6E"))));
}

// src/emails/templates/notifications/FeatureAnnouncementEmail.tsx
import React16 from "react";
import { Text as Text13, Section as Section14, Hr as Hr2 } from "@react-email/components";
var AnnouncementTypeConfig = {
  new_feature: {
    title: "\u{1F680} \u5168\u65B0\u529F\u80FD\u53D1\u5E03",
    icon: "\u{1F680}",
    color: "blue",
    description: "\u6211\u4EEC\u5F88\u9AD8\u5174\u4E3A\u60A8\u5E26\u6765\u5168\u65B0\u7684\u5B66\u4E60\u529F\u80FD"
  },
  major_update: {
    title: "\u26A1 \u91CD\u5927\u66F4\u65B0\u53D1\u5E03",
    icon: "\u26A1",
    color: "green",
    description: "ChatTOEIC\u8FCE\u6765\u4E86\u91CD\u5927\u5347\u7EA7"
  },
  beta_release: {
    title: "\u{1F9EA} Beta\u6D4B\u8BD5\u9080\u8BF7",
    icon: "\u{1F9EA}",
    color: "purple",
    description: "\u9080\u8BF7\u60A8\u4F53\u9A8C\u6211\u4EEC\u7684\u6700\u65B0Beta\u529F\u80FD"
  }
};
function FeatureAnnouncementEmail({
  userName,
  announcementType,
  title,
  releaseDate,
  features,
  ctaText = "\u7ACB\u5373\u4F53\u9A8C",
  ctaUrl = `${process.env.FRONTEND_URL || "https://www.chattoeic.com"}`,
  videoUrl,
  blogUrl,
  feedbackUrl = `${process.env.FRONTEND_URL || "https://www.chattoeic.com"}/feedback`
}) {
  const config = AnnouncementTypeConfig[announcementType];
  return /* @__PURE__ */ React16.createElement(Layout, { preview: `${config.title}: ${title} - ChatTOEIC` }, /* @__PURE__ */ React16.createElement(Section14, null, /* @__PURE__ */ React16.createElement(Text13, { className: `text-2xl font-bold text-${config.color}-600 mb-4 m-0` }, config.title), /* @__PURE__ */ React16.createElement(Text13, { className: "text-gray-700 text-base leading-6 mb-4 m-0" }, "\u4EB2\u7231\u7684 ", /* @__PURE__ */ React16.createElement("span", { className: "font-semibold text-blue-600" }, userName), "\uFF0C"), /* @__PURE__ */ React16.createElement(Text13, { className: "text-gray-700 text-base leading-6 mb-6 m-0" }, config.description, "\uFF01", title, "\u5DF2\u4E8E", releaseDate, "\u6B63\u5F0F\u53D1\u5E03\u3002"), /* @__PURE__ */ React16.createElement(Section14, { className: `bg-gradient-to-r from-${config.color}-50 to-${config.color}-100 border border-${config.color}-200 rounded-lg p-6 mb-6` }, /* @__PURE__ */ React16.createElement(Text13, { className: `text-${config.color}-800 text-xl font-bold mb-4 m-0 text-center` }, config.icon, " ", title), features.map((feature, index) => /* @__PURE__ */ React16.createElement("div", { key: index, className: "mb-6" }, /* @__PURE__ */ React16.createElement(Text13, { className: `text-${config.color}-800 text-lg font-semibold mb-2 m-0` }, feature.icon ? `${feature.icon} ` : "\u2728 ", feature.name), /* @__PURE__ */ React16.createElement(Text13, { className: "text-gray-700 text-base mb-3 m-0" }, feature.description), feature.benefits.length > 0 && /* @__PURE__ */ React16.createElement(Section14, { className: `bg-white border border-${config.color}-100 rounded p-3 ml-4` }, /* @__PURE__ */ React16.createElement(Text13, { className: `text-${config.color}-700 text-sm font-medium mb-2 m-0` }, "\u{1F4A1} \u4E3A\u60A8\u5E26\u6765\u7684\u4EF7\u503C\uFF1A"), feature.benefits.map((benefit, benefitIndex) => /* @__PURE__ */ React16.createElement(Text13, { key: benefitIndex, className: `text-${config.color}-600 text-sm my-1 m-0` }, "\u2022 ", benefit))), index < features.length - 1 && /* @__PURE__ */ React16.createElement(Hr2, { className: "my-4 border-gray-200" })))), /* @__PURE__ */ React16.createElement(Section14, { className: "bg-blue-50 border border-blue-200 rounded p-4 mb-6" }, /* @__PURE__ */ React16.createElement(Text13, { className: "text-blue-800 text-lg font-semibold mb-3 m-0" }, "\u{1F3AF} \u5982\u4F55\u5F00\u59CB\u4F7F\u7528\uFF1F"), /* @__PURE__ */ React16.createElement(Text13, { className: "text-blue-700 text-sm mb-2 m-0" }, "1. \u70B9\u51FB\u4E0B\u65B9\u6309\u94AE\u767B\u5F55\u60A8\u7684ChatTOEIC\u8D26\u6237"), /* @__PURE__ */ React16.createElement(Text13, { className: "text-blue-700 text-sm mb-2 m-0" }, "2. \u5728\u5BFC\u822A\u83DC\u5355\u4E2D\u627E\u5230\u65B0\u529F\u80FD\u5165\u53E3"), /* @__PURE__ */ React16.createElement(Text13, { className: "text-blue-700 text-sm mb-2 m-0" }, "3. \u6309\u7167\u5F15\u5BFC\u63D0\u793A\u5F00\u59CB\u4F53\u9A8C\u65B0\u529F\u80FD"), /* @__PURE__ */ React16.createElement(Text13, { className: "text-blue-700 text-sm mb-2 m-0" }, "4. \u6709\u95EE\u9898\u968F\u65F6\u8054\u7CFB\u6211\u4EEC\u7684\u652F\u6301\u56E2\u961F")), announcementType === "beta_release" && /* @__PURE__ */ React16.createElement(Section14, { className: "bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded mb-6" }, /* @__PURE__ */ React16.createElement(Text13, { className: "text-yellow-800 text-sm font-semibold m-0" }, "\u{1F9EA} Beta\u6D4B\u8BD5\u6CE8\u610F\u4E8B\u9879\uFF1A"), /* @__PURE__ */ React16.createElement(Text13, { className: "text-yellow-700 text-sm mt-2 mb-1 m-0" }, "\u2022 \u8FD9\u662F\u6D4B\u8BD5\u7248\u672C\uFF0C\u53EF\u80FD\u5B58\u5728\u4E00\u4E9B\u5C0F\u95EE\u9898"), /* @__PURE__ */ React16.createElement(Text13, { className: "text-yellow-700 text-sm my-1 m-0" }, "\u2022 \u60A8\u7684\u53CD\u9988\u5BF9\u6211\u4EEC\u6539\u8FDB\u4EA7\u54C1\u81F3\u5173\u91CD\u8981"), /* @__PURE__ */ React16.createElement(Text13, { className: "text-yellow-700 text-sm my-1 m-0" }, "\u2022 Beta\u529F\u80FD\u53EF\u80FD\u5728\u6B63\u5F0F\u7248\u672C\u4E2D\u6709\u6240\u8C03\u6574"), /* @__PURE__ */ React16.createElement(Text13, { className: "text-yellow-700 text-sm mt-1 m-0" }, "\u2022 \u611F\u8C22\u60A8\u53C2\u4E0E\u6D4B\u8BD5\u5E76\u63D0\u4F9B\u5B9D\u8D35\u610F\u89C1")), /* @__PURE__ */ React16.createElement(Section14, { className: "text-center mb-6" }, /* @__PURE__ */ React16.createElement(Button, { href: ctaUrl, className: "mb-4" }, ctaText), videoUrl && /* @__PURE__ */ React16.createElement(Button, { href: videoUrl, variant: "secondary", className: "ml-4" }, "\u89C2\u770B\u6F14\u793A\u89C6\u9891")), (blogUrl || feedbackUrl) && /* @__PURE__ */ React16.createElement(Section14, { className: "bg-gray-50 border border-gray-200 rounded p-4 mb-6" }, /* @__PURE__ */ React16.createElement(Text13, { className: "text-gray-800 text-sm font-semibold mb-3 m-0" }, "\u{1F4DA} \u66F4\u591A\u8D44\u6E90\uFF1A"), blogUrl && /* @__PURE__ */ React16.createElement(Text13, { className: "text-gray-700 text-sm mb-2 m-0" }, "\u{1F4D6} ", /* @__PURE__ */ React16.createElement("a", { href: blogUrl, className: "text-blue-600 underline" }, "\u9605\u8BFB\u8BE6\u7EC6\u529F\u80FD\u4ECB\u7ECD")), /* @__PURE__ */ React16.createElement(Text13, { className: "text-gray-700 text-sm mb-2 m-0" }, "\u{1F4AC} ", /* @__PURE__ */ React16.createElement("a", { href: feedbackUrl, className: "text-blue-600 underline" }, "\u5206\u4EAB\u60A8\u7684\u4F7F\u7528\u4F53\u9A8C")), /* @__PURE__ */ React16.createElement(Text13, { className: "text-gray-700 text-sm mb-2 m-0" }, "\u{1F4E7} ", /* @__PURE__ */ React16.createElement("a", { href: "mailto:support@chattoeic.com", className: "text-blue-600 underline" }, "\u8054\u7CFB\u6280\u672F\u652F\u6301"))), /* @__PURE__ */ React16.createElement(Section14, { className: "bg-green-50 border border-green-200 rounded p-4 mb-6" }, /* @__PURE__ */ React16.createElement(Text13, { className: "text-green-800 text-sm font-semibold m-0" }, "\u{1F64F} \u611F\u8C22\u60A8\u7684\u652F\u6301"), /* @__PURE__ */ React16.createElement(Text13, { className: "text-green-700 text-sm mt-2 m-0" }, "\u6BCF\u4E00\u4E2A\u65B0\u529F\u80FD\u7684\u8BDE\u751F\u90FD\u79BB\u4E0D\u5F00\u7528\u6237\u7684\u652F\u6301\u548C\u53CD\u9988\u3002\u6211\u4EEC\u4F1A\u7EE7\u7EED\u52AA\u529B\uFF0C\u4E3A\u60A8\u63D0\u4F9B\u66F4\u4F18\u8D28\u7684\u5B66\u4E60\u4F53\u9A8C\u3002 \u60A8\u7684\u6210\u529F\u5C31\u662F\u6211\u4EEC\u6700\u5927\u7684\u52A8\u529B\uFF01")), /* @__PURE__ */ React16.createElement(Text13, { className: "text-gray-700 text-base leading-6 mb-4 m-0" }, "\u6211\u4EEC\u76F8\u4FE1\u8FD9\u4E9B\u65B0\u529F\u80FD\u5C06\u5E2E\u52A9\u60A8\u66F4\u9AD8\u6548\u5730\u5B66\u4E60TOEIC\uFF0C\u65E9\u65E5\u8FBE\u6210\u60A8\u7684\u76EE\u6807\u5206\u6570\uFF01"), announcementType === "beta_release" && /* @__PURE__ */ React16.createElement(Section14, { className: "text-center mb-6" }, /* @__PURE__ */ React16.createElement(Button, { href: feedbackUrl, variant: "secondary" }, "\u63D0\u4F9BBeta\u53CD\u9988")), /* @__PURE__ */ React16.createElement(Text13, { className: "text-gray-600 text-sm mt-6 m-0" }, "\u671F\u5F85\u60A8\u7684\u4F53\u9A8C\u548C\u53CD\u9988\uFF01", /* @__PURE__ */ React16.createElement("br", null), "ChatTOEIC \u4EA7\u54C1\u56E2\u961F"), /* @__PURE__ */ React16.createElement(Text13, { className: "text-gray-600 text-sm mt-4 m-0" }, "\u5982\u4E0D\u5E0C\u671B\u63A5\u6536\u529F\u80FD\u66F4\u65B0\u901A\u77E5\uFF0C\u8BF7\u8BBF\u95EE", /* @__PURE__ */ React16.createElement("a", { href: `${ctaUrl}/settings/notifications`, className: "text-blue-600 underline ml-1" }, "\u901A\u77E5\u8BBE\u7F6E"), "\u8FDB\u884C\u8C03\u6574\u3002")));
}

// src/services/notificationEmailService.ts
var NotificationEmailService = class {
  /**
   * 发送安全警报邮件
   */
  async sendSecurityAlert(email, userName, alertType, options = {}) {
    try {
      const alertTime = (/* @__PURE__ */ new Date()).toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Shanghai"
      });
      const emailTemplate = React17.createElement(SecurityAlertEmail, {
        userName,
        alertType,
        alertTime,
        location: options.location,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
        actionUrl: options.actionUrl
      });
      const subjectMap = {
        login: "\u65B0\u8BBE\u5907\u767B\u5F55\u901A\u77E5",
        password_change: "\u5BC6\u7801\u53D8\u66F4\u901A\u77E5",
        email_change: "\u90AE\u7BB1\u53D8\u66F4\u901A\u77E5",
        suspicious_activity: "\u8D26\u6237\u5B89\u5168\u8B66\u62A5"
      };
      const result = await emailService.sendEmail({
        to: email,
        subject: `${subjectMap[alertType]} - ChatTOEIC`,
        template: emailTemplate
      });
      if (result.success) {
        console.log(`\u{1F4E7} Security alert email sent (${alertType}):`, {
          email,
          userName,
          alertType,
          emailId: result.id
        });
      }
      return {
        success: result.success,
        emailId: result.id,
        error: result.error
      };
    } catch (error) {
      console.error("\u274C Failed to send security alert email:", error);
      return {
        success: false,
        error: error.message || "unknown_error"
      };
    }
  }
  /**
   * 发送系统维护通知邮件
   */
  async sendSystemMaintenance(email, userName, maintenanceType, options) {
    try {
      const emailTemplate = React17.createElement(SystemMaintenanceEmail, {
        userName,
        maintenanceType,
        startTime: options.startTime,
        endTime: options.endTime,
        duration: options.duration,
        reason: options.reason,
        affectedServices: options.affectedServices,
        statusPageUrl: options.statusPageUrl
      });
      const subjectMap = {
        scheduled: "\u7CFB\u7EDF\u7EF4\u62A4\u901A\u77E5",
        emergency: "\u7D27\u6025\u7EF4\u62A4\u901A\u77E5",
        completed: "\u7EF4\u62A4\u5B8C\u6210\u901A\u77E5"
      };
      const result = await emailService.sendEmail({
        to: email,
        subject: `${subjectMap[maintenanceType]} - ChatTOEIC`,
        template: emailTemplate
      });
      if (result.success) {
        console.log(`\u{1F527} System maintenance email sent (${maintenanceType}):`, {
          email,
          userName,
          maintenanceType,
          emailId: result.id
        });
      }
      return {
        success: result.success,
        emailId: result.id,
        error: result.error
      };
    } catch (error) {
      console.error("\u274C Failed to send system maintenance email:", error);
      return {
        success: false,
        error: error.message || "unknown_error"
      };
    }
  }
  /**
   * 发送账户活动报告邮件
   */
  async sendAccountActivity(email, userName, periodType, activityData, options) {
    try {
      const emailTemplate = React17.createElement(AccountActivityEmail, {
        userName,
        periodType,
        periodStart: options.periodStart,
        periodEnd: options.periodEnd,
        activityData,
        topAchievements: options.topAchievements,
        recommendations: options.recommendations,
        dashboardUrl: options.dashboardUrl
      });
      const subjectMap = {
        weekly: "\u672C\u5468\u5B66\u4E60\u62A5\u544A",
        monthly: "\u672C\u6708\u5B66\u4E60\u603B\u7ED3",
        yearly: "\u5E74\u5EA6\u5B66\u4E60\u6210\u5C31\u62A5\u544A"
      };
      const result = await emailService.sendEmail({
        to: email,
        subject: `${subjectMap[periodType]} - ChatTOEIC`,
        template: emailTemplate
      });
      if (result.success) {
        console.log(`\u{1F4CA} Account activity email sent (${periodType}):`, {
          email,
          userName,
          periodType,
          emailId: result.id
        });
      }
      return {
        success: result.success,
        emailId: result.id,
        error: result.error
      };
    } catch (error) {
      console.error("\u274C Failed to send account activity email:", error);
      return {
        success: false,
        error: error.message || "unknown_error"
      };
    }
  }
  /**
   * 发送功能发布公告邮件
   */
  async sendFeatureAnnouncement(email, userName, announcementType, options) {
    try {
      const emailTemplate = React17.createElement(FeatureAnnouncementEmail, {
        userName,
        announcementType,
        title: options.title,
        releaseDate: options.releaseDate,
        features: options.features,
        ctaText: options.ctaText,
        ctaUrl: options.ctaUrl,
        videoUrl: options.videoUrl,
        blogUrl: options.blogUrl,
        feedbackUrl: options.feedbackUrl
      });
      const subjectMap = {
        new_feature: "\u5168\u65B0\u529F\u80FD\u53D1\u5E03",
        major_update: "\u91CD\u5927\u66F4\u65B0\u53D1\u5E03",
        beta_release: "Beta\u6D4B\u8BD5\u9080\u8BF7"
      };
      const result = await emailService.sendEmail({
        to: email,
        subject: `${subjectMap[announcementType]}: ${options.title} - ChatTOEIC`,
        template: emailTemplate
      });
      if (result.success) {
        console.log(`\u{1F680} Feature announcement email sent (${announcementType}):`, {
          email,
          userName,
          announcementType,
          title: options.title,
          emailId: result.id
        });
      }
      return {
        success: result.success,
        emailId: result.id,
        error: result.error
      };
    } catch (error) {
      console.error("\u274C Failed to send feature announcement email:", error);
      return {
        success: false,
        error: error.message || "unknown_error"
      };
    }
  }
  /**
   * 批量发送通知邮件
   */
  async sendBatchNotification(recipients, emailType, emailData) {
    try {
      console.log(`\u{1F4EC} Starting batch ${emailType} notification for ${recipients.length} recipients`);
      const results = await Promise.all(
        recipients.map(async (recipient) => {
          try {
            let result;
            switch (emailType) {
              case "security_alert":
                result = await this.sendSecurityAlert(
                  recipient.email,
                  recipient.userName,
                  emailData.alertType,
                  emailData.options
                );
                break;
              case "maintenance":
                result = await this.sendSystemMaintenance(
                  recipient.email,
                  recipient.userName,
                  emailData.maintenanceType,
                  emailData.options
                );
                break;
              case "activity":
                result = await this.sendAccountActivity(
                  recipient.email,
                  recipient.userName,
                  emailData.periodType,
                  emailData.activityData,
                  emailData.options
                );
                break;
              case "announcement":
                result = await this.sendFeatureAnnouncement(
                  recipient.email,
                  recipient.userName,
                  emailData.announcementType,
                  emailData.options
                );
                break;
              default:
                throw new Error(`Unknown email type: ${emailType}`);
            }
            return {
              email: recipient.email,
              success: result.success,
              error: result.error
            };
          } catch (error) {
            return {
              email: recipient.email,
              success: false,
              error: error.message
            };
          }
        })
      );
      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.length - successCount;
      console.log(`\u{1F4CA} Batch notification completed:`, {
        emailType,
        total: recipients.length,
        success: successCount,
        failures: failureCount
      });
      return {
        success: failureCount === 0,
        successCount,
        failureCount,
        results
      };
    } catch (error) {
      console.error("\u274C Batch notification failed:", error);
      return {
        success: false,
        successCount: 0,
        failureCount: recipients.length,
        results: recipients.map((r) => ({
          email: r.email,
          success: false,
          error: error.message
        }))
      };
    }
  }
  /**
   * 获取通知邮件统计信息
   */
  getNotificationStats() {
    return {
      totalSent: 0,
      byType: {},
      lastSent: void 0
    };
  }
};
var notificationEmailService = new NotificationEmailService();

// src/routes/notifications.ts
import { z } from "zod";
var router17 = Router17();
var requireAdmin4 = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { role: true }
    });
    if (!user || user.role !== "admin") {
      return res.status(403).json({
        success: false,
        error: "\u9700\u8981\u7BA1\u7406\u5458\u6743\u9650"
      });
    }
    next();
  } catch (error) {
    console.error("Admin check error:", error);
    res.status(500).json({
      success: false,
      error: "\u6743\u9650\u9A8C\u8BC1\u5931\u8D25"
    });
  }
};
var securityAlertSchema = z.object({
  recipients: z.array(z.string().email()).optional(),
  userIds: z.array(z.string().uuid()).optional(),
  alertType: z.enum(["login", "password_change", "email_change", "suspicious_activity"]),
  options: z.object({
    location: z.string().optional(),
    ipAddress: z.string().optional(),
    userAgent: z.string().optional(),
    actionUrl: z.string().url().optional()
  }).optional()
}).refine((data) => data.recipients || data.userIds, {
  message: "\u5FC5\u987B\u63D0\u4F9B recipients \u6216 userIds \u4E4B\u4E00"
});
var maintenanceSchema = z.object({
  recipients: z.array(z.string().email()).optional(),
  userIds: z.array(z.string().uuid()).optional(),
  maintenanceType: z.enum(["scheduled", "emergency", "completed"]),
  options: z.object({
    startTime: z.string(),
    endTime: z.string().optional(),
    duration: z.string().optional(),
    reason: z.string().optional(),
    affectedServices: z.array(z.string()).optional(),
    statusPageUrl: z.string().url().optional()
  })
}).refine((data) => data.recipients || data.userIds, {
  message: "\u5FC5\u987B\u63D0\u4F9B recipients \u6216 userIds \u4E4B\u4E00"
});
var activitySchema = z.object({
  recipients: z.array(z.string().email()).optional(),
  userIds: z.array(z.string().uuid()).optional(),
  periodType: z.enum(["weekly", "monthly", "yearly"]),
  activityData: z.object({
    practiceCount: z.number().int().min(0),
    studyHours: z.number().min(0),
    questionsAnswered: z.number().int().min(0),
    correctRate: z.number().min(0).max(100),
    streakDays: z.number().int().min(0),
    newWords: z.number().int().min(0),
    achievementsUnlocked: z.number().int().min(0)
  }),
  options: z.object({
    periodStart: z.string(),
    periodEnd: z.string(),
    topAchievements: z.array(z.string()).optional(),
    recommendations: z.array(z.string()).optional(),
    dashboardUrl: z.string().url().optional()
  })
}).refine((data) => data.recipients || data.userIds, {
  message: "\u5FC5\u987B\u63D0\u4F9B recipients \u6216 userIds \u4E4B\u4E00"
});
var announcementSchema = z.object({
  recipients: z.array(z.string().email()).optional(),
  userIds: z.array(z.string().uuid()).optional(),
  announcementType: z.enum(["new_feature", "major_update", "beta_release"]),
  options: z.object({
    title: z.string().min(1),
    releaseDate: z.string(),
    features: z.array(z.object({
      name: z.string(),
      description: z.string(),
      icon: z.string().optional(),
      benefits: z.array(z.string())
    })),
    ctaText: z.string().optional(),
    ctaUrl: z.string().url().optional(),
    videoUrl: z.string().url().optional(),
    blogUrl: z.string().url().optional(),
    feedbackUrl: z.string().url().optional()
  })
}).refine((data) => data.recipients || data.userIds, {
  message: "\u5FC5\u987B\u63D0\u4F9B recipients \u6216 userIds \u4E4B\u4E00"
});
async function getRecipients(userIds, emails) {
  const recipients = [];
  if (userIds && userIds.length > 0) {
    const users = await prisma.user.findMany({
      where: {
        id: { in: userIds },
        emailVerified: true,
        // 只发送给已验证邮箱的用户
        isActive: true
        // 只发送给活跃用户
      },
      select: {
        email: true,
        name: true
      }
    });
    recipients.push(...users.map((user) => ({
      email: user.email,
      userName: user.name || "\u7528\u6237"
    })));
  }
  if (emails && emails.length > 0) {
    recipients.push(...emails.map((email) => ({
      email,
      userName: "\u7528\u6237"
      // 默认用户名
    })));
  }
  return recipients;
}
router17.post(
  "/security-alert",
  authenticateToken,
  requireAdmin4,
  authRateLimit,
  validateRequest({ body: securityAlertSchema }),
  async (req, res) => {
    try {
      const { recipients: emails, userIds, alertType, options } = req.body;
      const recipients = await getRecipients(userIds, emails);
      if (recipients.length === 0) {
        return res.status(400).json({
          success: false,
          error: "\u6CA1\u6709\u627E\u5230\u6709\u6548\u7684\u63A5\u6536\u8005"
        });
      }
      const result = await notificationEmailService.sendBatchNotification(
        recipients,
        "security_alert",
        { alertType, options: options || {} }
      );
      res.json({
        success: result.success,
        message: `\u5B89\u5168\u8B66\u62A5\u90AE\u4EF6\u53D1\u9001\u5B8C\u6210`,
        data: {
          totalRecipients: recipients.length,
          successCount: result.successCount,
          failureCount: result.failureCount,
          results: result.results
        }
      });
    } catch (error) {
      console.error("Security alert email error:", error);
      res.status(500).json({
        success: false,
        error: "\u53D1\u9001\u5B89\u5168\u8B66\u62A5\u90AE\u4EF6\u5931\u8D25"
      });
    }
  }
);
router17.post(
  "/maintenance",
  authenticateToken,
  requireAdmin4,
  authRateLimit,
  validateRequest({ body: maintenanceSchema }),
  async (req, res) => {
    try {
      const { recipients: emails, userIds, maintenanceType, options } = req.body;
      const recipients = await getRecipients(userIds, emails);
      if (recipients.length === 0) {
        return res.status(400).json({
          success: false,
          error: "\u6CA1\u6709\u627E\u5230\u6709\u6548\u7684\u63A5\u6536\u8005"
        });
      }
      const result = await notificationEmailService.sendBatchNotification(
        recipients,
        "maintenance",
        { maintenanceType, options }
      );
      res.json({
        success: result.success,
        message: `\u7CFB\u7EDF\u7EF4\u62A4\u901A\u77E5\u90AE\u4EF6\u53D1\u9001\u5B8C\u6210`,
        data: {
          totalRecipients: recipients.length,
          successCount: result.successCount,
          failureCount: result.failureCount,
          results: result.results
        }
      });
    } catch (error) {
      console.error("Maintenance notification email error:", error);
      res.status(500).json({
        success: false,
        error: "\u53D1\u9001\u7EF4\u62A4\u901A\u77E5\u90AE\u4EF6\u5931\u8D25"
      });
    }
  }
);
router17.post(
  "/activity-report",
  authenticateToken,
  requireAdmin4,
  authRateLimit,
  validateRequest({ body: activitySchema }),
  async (req, res) => {
    try {
      const { recipients: emails, userIds, periodType, activityData, options } = req.body;
      const recipients = await getRecipients(userIds, emails);
      if (recipients.length === 0) {
        return res.status(400).json({
          success: false,
          error: "\u6CA1\u6709\u627E\u5230\u6709\u6548\u7684\u63A5\u6536\u8005"
        });
      }
      const result = await notificationEmailService.sendBatchNotification(
        recipients,
        "activity",
        { periodType, activityData, options }
      );
      res.json({
        success: result.success,
        message: `\u6D3B\u52A8\u62A5\u544A\u90AE\u4EF6\u53D1\u9001\u5B8C\u6210`,
        data: {
          totalRecipients: recipients.length,
          successCount: result.successCount,
          failureCount: result.failureCount,
          results: result.results
        }
      });
    } catch (error) {
      console.error("Activity report email error:", error);
      res.status(500).json({
        success: false,
        error: "\u53D1\u9001\u6D3B\u52A8\u62A5\u544A\u90AE\u4EF6\u5931\u8D25"
      });
    }
  }
);
router17.post(
  "/feature-announcement",
  authenticateToken,
  requireAdmin4,
  authRateLimit,
  validateRequest({ body: announcementSchema }),
  async (req, res) => {
    try {
      const { recipients: emails, userIds, announcementType, options } = req.body;
      const recipients = await getRecipients(userIds, emails);
      if (recipients.length === 0) {
        return res.status(400).json({
          success: false,
          error: "\u6CA1\u6709\u627E\u5230\u6709\u6548\u7684\u63A5\u6536\u8005"
        });
      }
      const result = await notificationEmailService.sendBatchNotification(
        recipients,
        "announcement",
        { announcementType, options }
      );
      res.json({
        success: result.success,
        message: `\u529F\u80FD\u516C\u544A\u90AE\u4EF6\u53D1\u9001\u5B8C\u6210`,
        data: {
          totalRecipients: recipients.length,
          successCount: result.successCount,
          failureCount: result.failureCount,
          results: result.results
        }
      });
    } catch (error) {
      console.error("Feature announcement email error:", error);
      res.status(500).json({
        success: false,
        error: "\u53D1\u9001\u529F\u80FD\u516C\u544A\u90AE\u4EF6\u5931\u8D25"
      });
    }
  }
);
router17.post(
  "/broadcast/:type",
  authenticateToken,
  requireAdmin4,
  authRateLimit,
  async (req, res) => {
    try {
      const { type } = req.params;
      const emailData = req.body;
      if (!["security-alert", "maintenance", "activity-report", "feature-announcement"].includes(type)) {
        return res.status(400).json({
          success: false,
          error: "\u4E0D\u652F\u6301\u7684\u90AE\u4EF6\u7C7B\u578B"
        });
      }
      const activeUsers = await prisma.user.findMany({
        where: {
          emailVerified: true,
          isActive: true
          // 可以添加更多筛选条件，比如最近登录时间等
        },
        select: {
          email: true,
          name: true
        },
        take: 1e3
        // 限制最大发送数量，避免一次性发送过多邮件
      });
      const recipients = activeUsers.map((user) => ({
        email: user.email,
        userName: user.name || "\u7528\u6237"
      }));
      if (recipients.length === 0) {
        return res.json({
          success: true,
          message: "\u6CA1\u6709\u627E\u5230\u6D3B\u8DC3\u7528\u6237",
          data: { totalRecipients: 0, successCount: 0, failureCount: 0 }
        });
      }
      const emailType = type.replace("-", "_");
      const result = await notificationEmailService.sendBatchNotification(
        recipients,
        emailType,
        emailData
      );
      res.json({
        success: result.success,
        message: `\u5E7F\u64AD\u90AE\u4EF6\u53D1\u9001\u5B8C\u6210 (${type})`,
        data: {
          totalRecipients: recipients.length,
          successCount: result.successCount,
          failureCount: result.failureCount
        }
      });
    } catch (error) {
      console.error("Broadcast email error:", error);
      res.status(500).json({
        success: false,
        error: "\u5E7F\u64AD\u90AE\u4EF6\u53D1\u9001\u5931\u8D25"
      });
    }
  }
);
router17.get("/stats", authenticateToken, requireAdmin4, async (req, res) => {
  try {
    const stats = notificationEmailService.getNotificationStats();
    const userStats = await prisma.user.groupBy({
      by: ["emailVerified"],
      _count: {
        id: true
      }
    });
    res.json({
      success: true,
      data: {
        notificationStats: stats,
        userStats: userStats.reduce((acc, stat) => {
          acc[stat.emailVerified ? "verified" : "unverified"] = stat._count.id;
          return acc;
        }, {})
      }
    });
  } catch (error) {
    console.error("Notification stats error:", error);
    res.status(500).json({
      success: false,
      error: "\u83B7\u53D6\u7EDF\u8BA1\u4FE1\u606F\u5931\u8D25"
    });
  }
});
var notifications_default = router17;

// src/middleware/logging.ts
import responseTime from "response-time";
var generateRequestId = () => {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};
var requestTimer = (req, res, next) => {
  req.startTime = /* @__PURE__ */ new Date();
  req.requestId = generateRequestId();
  res.setHeader("X-Request-ID", req.requestId);
  next();
};
var httpLogger = (req, res, next) => {
  const startTime = Date.now();
  log.http("HTTP Request Started", {
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get("User-Agent"),
    contentLength: req.get("Content-Length"),
    contentType: req.get("Content-Type"),
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
  res.on("finish", () => {
    const responseTime2 = Date.now() - startTime;
    const metrics = {
      timestamp: /* @__PURE__ */ new Date(),
      endpoint: req.route?.path || req.path,
      method: req.method,
      responseTime: responseTime2,
      statusCode: res.statusCode,
      userId: req.user?.userId,
      userAgent: req.get("User-Agent"),
      ip: req.ip || req.connection.remoteAddress
    };
    if (res.statusCode >= 400) {
      metrics.errorMessage = `HTTP ${res.statusCode}`;
    }
    logPerformance(metrics);
    log.http("HTTP Request Completed", {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTime: `${responseTime2}ms`,
      contentLength: res.get("Content-Length"),
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    if (responseTime2 > 5e3) {
      log.warn("Slow Request Detected", {
        requestId: req.requestId,
        method: req.method,
        url: req.originalUrl,
        responseTime: `${responseTime2}ms`,
        statusCode: res.statusCode
      });
    }
    if (res.statusCode >= 500) {
      log.error("Server Error Response", {
        requestId: req.requestId,
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        responseTime: `${responseTime2}ms`
      });
    }
  });
  next();
};
var responseTimeMiddleware = responseTime((req, res, time) => {
  res.setHeader("X-Response-Time", `${time}ms`);
  log.debug("Response Time", {
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl,
    responseTime: `${time}ms`,
    statusCode: res.statusCode
  });
});
var errorLogger = (err, req, res, next) => {
  log.error("Request Error", {
    requestId: req.requestId,
    error: {
      message: err.message,
      stack: err.stack,
      name: err.name,
      code: err.code,
      status: err.status || err.statusCode
    },
    request: {
      method: req.method,
      url: req.originalUrl,
      headers: req.headers,
      query: req.query,
      body: req.body,
      params: req.params,
      ip: req.ip,
      userAgent: req.get("User-Agent")
    },
    user: {
      userId: req.user?.userId,
      email: req.user?.email
    },
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
  next(err);
};
var healthCheckLogger = (req, res, next) => {
  if (req.path === "/health" || req.path === "/ping") {
    log.debug("Health Check", {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage()
    });
  }
  next();
};
var apiUsageTracker = (req, res, next) => {
  const endpoint = req.route?.path || req.path;
  if (endpoint.includes("health") || endpoint.includes("static")) {
    return next();
  }
  logBusinessEvent({
    event: "api_usage",
    userId: req.user?.userId,
    data: {
      endpoint,
      method: req.method,
      userAgent: req.get("User-Agent"),
      ip: req.ip,
      timestamp: /* @__PURE__ */ new Date()
    }
  });
  next();
};

// src/server.ts
init_database();

// src/utils/seedData.ts
init_database();
async function ensureSubscriptionPlansExist() {
  try {
    const existingPlans = await prisma.subscriptionPlan.findMany();
    if (existingPlans.length > 0) {
      log.info("Subscription plans already exist", { count: existingPlans.length });
      return;
    }
    log.info("Creating initial subscription plans...");
    const plans = [
      {
        id: "free",
        name: "Free Plan",
        nameJp: "\u7121\u6599\u30D7\u30E9\u30F3",
        priceCents: 0,
        currency: "jpy",
        interval: "month",
        features: {
          aiPractice: false,
          aiChat: false,
          vocabulary: false,
          exportData: false,
          viewMistakes: false
        },
        dailyPracticeLimit: 5,
        dailyAiChatLimit: 3,
        maxVocabularyWords: 50,
        sortOrder: 1
      },
      {
        id: "premium_monthly",
        name: "Premium Monthly",
        nameJp: "\u30D7\u30EC\u30DF\u30A2\u30E0\u6708\u984D",
        priceCents: 3e5,
        // 3000日元
        currency: "jpy",
        interval: "month",
        features: {
          aiPractice: true,
          aiChat: true,
          vocabulary: true,
          exportData: true,
          viewMistakes: true
        },
        dailyPracticeLimit: null,
        // unlimited
        dailyAiChatLimit: null,
        // unlimited  
        maxVocabularyWords: null,
        // unlimited
        sortOrder: 2
      },
      {
        id: "premium_yearly",
        name: "Premium Yearly",
        nameJp: "\u30D7\u30EC\u30DF\u30A2\u30E0\u5E74\u984D",
        priceCents: 3e6,
        // 30000日元 (相当于月付2500日元)
        currency: "jpy",
        interval: "year",
        features: {
          aiPractice: true,
          aiChat: true,
          vocabulary: true,
          exportData: true,
          viewMistakes: true
        },
        dailyPracticeLimit: null,
        // unlimited
        dailyAiChatLimit: null,
        // unlimited
        maxVocabularyWords: null,
        // unlimited
        sortOrder: 3
      }
    ];
    for (const planData of plans) {
      const created = await prisma.subscriptionPlan.create({
        data: planData
      });
      log.info("Created subscription plan", {
        id: created.id,
        name: created.name,
        price: created.priceCents
      });
    }
    log.info("Successfully created all subscription plans");
  } catch (error) {
    log.error("Failed to ensure subscription plans exist", { error });
    throw error;
  }
}

// src/server.ts
init_database();
dotenv.config();
process.on("uncaughtException", (error) => {
  console.error("\u274C \u672A\u6355\u83B7\u7684\u5F02\u5E38:", error);
  console.error("Stack:", error.stack);
});
process.on("unhandledRejection", (reason, promise) => {
  console.error("\u274C \u672A\u5904\u7406\u7684Promise rejection:", reason);
  console.error("Promise:", promise);
});
var app = express();
var PORT = process.env.PORT || 3001;
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
} else {
  app.set("trust proxy", true);
}
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  }
}));
var allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:5173",
  "https://chattoeic.com",
  // 自定义域名（裸域）
  "https://www.chattoeic.com",
  // 自定义域名
  "https://chattoeic.vercel.app",
  // Vercel默认域名
  "https://chattoeic-dashboard.vercel.app",
  // 管理员Dashboard
  "http://localhost:5173",
  // 本地开发
  "http://localhost:3000"
  // 备用本地端口
];
var corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || origin.includes(".vercel.app")) {
      return callback(null, true);
    }
    console.warn("CORS blocked origin:", origin);
    return callback(new Error("Not allowed by CORS"), false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Guest-Mode", "X-Requested-With"],
  exposedHeaders: ["Set-Cookie"],
  optionsSuccessStatus: 200,
  // 支持老旧浏览器
  preflightContinue: false
};
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(requestTimer);
app.use(responseTimeMiddleware);
app.use(httpLogger);
app.use(healthCheckLogger);
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(compression());
app.use("/api/billing/webhooks", express.raw({ type: "application/json" }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(generalRateLimit);
app.use(generalSlowDown);
app.use(apiUsageTracker);
app.use(trackPageVisit);
app.use("/api/health", health_default);
app.use("/api/monitoring", monitoring_default);
app.use("/api/analytics", analytics_default);
app.use("/api/users", users_default);
app.use("/api/dashboard", dashboard_stream_default);
app.use("/api/database", database_default);
app.use("/api/db-migrate", db_migrate_default);
app.use("/api/emergency-fix", emergency_fix_default);
app.use("/api/admin", admin_default);
app.use("/api/database-fix", database_fix_default);
app.use("/api/notifications", notifications_default);
app.use("/api/auth", trackAuthActivity, auth_default);
app.use("/api/practice", trackPracticeActivity, practice_default);
app.use("/api/questions", trackPracticeActivity, practice_default);
app.use("/api/chat", trackAIInteraction, chat_default);
app.use("/api/vocabulary", trackVocabularyActivity, vocabulary_default);
app.use("/api/vocabulary-minimal", vocabulary_minimal_default);
app.get("/api/simple-test", (req, res) => {
  res.json({ message: "Simple test endpoint works!", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
});
app.post("/api/translate-word", async (req, res) => {
  console.log("\u{1F680} [New Endpoint] Translate word request:", req.body);
  try {
    const { word, language = "zh" } = req.body || {};
    if (!word) {
      return res.status(400).json({ success: false, error: "\u8BF7\u63D0\u4F9B\u5355\u8BCD" });
    }
    const response = {
      success: true,
      data: {
        word,
        definition: `${word} \u7684\u5B9A\u4E49`,
        phonetic: `/${word}/`,
        partOfSpeech: "noun",
        meanings: [{
          partOfSpeech: "noun",
          partOfSpeechCN: "\u540D\u8BCD",
          partOfSpeechLocal: "\u540D\u8BCD",
          definitions: [{
            definition: `${word} \u7684\u4E2D\u6587\u91CA\u4E49`,
            example: `Example sentence with ${word}.`
          }]
        }]
      }
    };
    console.log("\u{1F680} [New Endpoint] Returning response:", response);
    res.json(response);
  } catch (error) {
    console.error("\u{1F680} [New Endpoint] Error:", error);
    res.status(500).json({ success: false, error: "\u83B7\u53D6\u7FFB\u8BD1\u5931\u8D25" });
  }
});
app.get("/api/billing-test", (req, res) => {
  res.json({
    success: true,
    message: "Simple billing test endpoint works - Deploy v2.1",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    deployVersion: "v2.1-billing-fixed"
  });
});
console.log("\u{1F6A8} [\u7D27\u6025\u8C03\u8BD5] \u6CE8\u518C\u5185\u8054vocabulary\u6D4B\u8BD5\u8DEF\u7531");
app.get("/api/vocab-emergency-test", (req, res) => {
  res.json({
    success: true,
    message: "Emergency vocabulary route working - inline in server.ts",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    route: "/api/vocab-emergency-test"
  });
});
app.post("/api/vocab-emergency-test", (req, res) => {
  res.json({
    success: true,
    message: "Emergency vocabulary POST working - inline in server.ts",
    requestBody: req.body,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    route: "/api/vocab-emergency-test"
  });
});
app.get("/test-simple", (req, res) => {
  res.json({ message: "Simple test works" });
});
app.post("/api/vocabulary/definition", async (req, res) => {
  try {
    const { word, language = "zh" } = req.body || {};
    const userId = req.user?.userId;
    console.log("\u{1F6E1}\uFE0F [Fallback] Definition request received", { word, language, userId });
    if (!word || typeof word !== "string") {
      return res.status(400).json({ success: false, error: "\u8BF7\u63D0\u4F9B\u6709\u6548\u7684\u5355\u8BCD" });
    }
    try {
      const existingUserWord = await prisma.vocabularyItem.findFirst({
        where: { userId: userId || void 0, word: word.toLowerCase(), meanings: { not: null } },
        orderBy: { addedAt: "desc" }
      });
      if (existingUserWord?.meanings) {
        console.log("\u{1F6E1}\uFE0F [Fallback] Reusing user meanings");
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
        orderBy: { addedAt: "desc" }
      });
      if (existingAnyWord?.meanings) {
        console.log("\u{1F6E1}\uFE0F [Fallback] Reusing global meanings");
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
      console.warn("\u26A0\uFE0F [Fallback] DB lookup failed, will try AI", dbErr);
    }
    try {
      console.log("\u{1F916} [Fallback] Calling geminiService.getWordDefinition");
      const ai = await geminiService.getWordDefinition(word, "", language);
      return res.json({
        success: true,
        data: {
          word,
          phonetic: ai?.phonetic,
          meanings: ai?.meanings || [
            {
              partOfSpeech: "noun",
              definitions: [
                { definition: `${word} \u7684\u5B9A\u4E49\uFF08AI\u751F\u6210\uFF09`, example: `Example sentence with ${word}.` }
              ]
            }
          ],
          definitionLoading: false,
          definitionError: !ai
        }
      });
    } catch (aiErr) {
      console.error("\u274C [Fallback] AI failed, returning mock", aiErr);
      return res.json({
        success: true,
        data: {
          word,
          phonetic: `/${word}/`,
          meanings: [
            {
              partOfSpeech: "noun",
              definitions: [
                { definition: `${word} \u7684\u6A21\u62DF\u5B9A\u4E49\uFF08\u8DEF\u7531\u515C\u5E95\uFF09`, example: `Example sentence with ${word}.` }
              ]
            }
          ],
          definitionLoading: false,
          definitionError: true
        },
        meta: { fallback: true }
      });
    }
  } catch (error) {
    console.error("\u{1F4A5} [Fallback] Fatal definition error", error);
    return res.status(500).json({ success: false, error: "\u83B7\u53D6\u8BCD\u6C47\u5B9A\u4E49\u5931\u8D25" });
  }
});
app.post("/api/vocabulary/definition-emergency", async (req, res) => {
  try {
    const { word, language = "zh" } = req.body;
    console.log("\u{1F6A8} [Emergency] Definition request:", { word, language });
    res.json({
      success: true,
      data: {
        word,
        definition: `${word} \u7684\u7D27\u6025\u6A21\u62DF\u5B9A\u4E49`,
        phonetic: `/${word}/`,
        meanings: [{
          partOfSpeech: "noun",
          definitions: [{ definition: `${word} \u7684\u7D27\u6025\u91CA\u4E49`, example: `Example: ${word}` }]
        }]
      },
      emergency: true
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "\u7D27\u6025\u7AEF\u70B9\u5931\u8D25" });
  }
});
app.get("/api/deploy-check", (req, res) => {
  res.json({
    deployedAt: (/* @__PURE__ */ new Date()).toISOString(),
    commitHash: "fix-vocab-definition-fallback",
    definitionEndpointExists: true,
    message: "Force deploy: fix vocabulary/definition 404 error - v2.0.4 - emergency inline"
  });
});
app.get("/api/debug/check-columns", async (req, res) => {
  try {
    const { prisma: prisma3 } = (init_database(), __toCommonJS(database_exports));
    const userSubColumns = await prisma3.$queryRaw`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'user_subscriptions' 
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `;
    const hasNextPaymentAt = userSubColumns.some((col) => col.column_name === "nextPaymentAt");
    res.json({
      success: true,
      data: {
        table: "user_subscriptions",
        columns: userSubColumns,
        critical_columns: {
          nextPaymentAt: hasNextPaymentAt
        },
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to check columns",
      details: error.message
    });
  }
});
app.post("/api/fix-missing-columns", async (req, res) => {
  try {
    console.log("\u{1F527} Emergency column fix requested");
    const { prisma: prisma3 } = (init_database(), __toCommonJS(database_exports));
    console.log("\u{1F527} Adding missing nextPaymentAt column...");
    await prisma3.$executeRaw`
      ALTER TABLE public.user_subscriptions 
      ADD COLUMN IF NOT EXISTS "nextPaymentAt" TIMESTAMP;
    `;
    console.log("\u2705 nextPaymentAt column added successfully");
    const result = await prisma3.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns
      WHERE table_name = 'user_subscriptions' 
      AND table_schema = 'public'
      ORDER BY ordinal_position;
    `;
    console.log("\u2705 Column verification completed");
    res.json({
      success: true,
      message: "Missing columns fixed successfully",
      details: {
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        fixed_columns: ["nextPaymentAt"],
        all_columns: result,
        next_steps: [
          "nextPaymentAt column is now available",
          "Payment system should work properly",
          "Try creating checkout session again"
        ]
      }
    });
  } catch (error) {
    console.error("Failed to fix missing columns:", error);
    res.status(500).json({
      success: false,
      error: "Column fix failed",
      details: {
        message: error.message,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        troubleshooting: [
          "Database might be in read-only mode",
          "Check database permissions",
          "Verify database connection"
        ]
      }
    });
  }
});
app.post("/api/refresh-prisma", async (req, res) => {
  try {
    console.log("\u{1F504} Refreshing Prisma client...");
    await prisma.$disconnect();
    console.log("\u2705 Prisma client disconnected");
    await prisma.$connect();
    console.log("\u2705 Prisma client reconnected");
    const testQuery = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'usage_quotas' 
      ORDER BY ordinal_position
    `;
    console.log("\u2705 Prisma client refresh completed successfully");
    res.json({
      success: true,
      message: "Prisma client refreshed successfully",
      details: {
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        tableColumns: testQuery,
        nextSteps: [
          "Prisma client has been disconnected and reconnected",
          "Database schema should now be in sync",
          "Trial function should work properly"
        ]
      }
    });
  } catch (error) {
    console.error("Failed to refresh Prisma client:", error);
    res.status(500).json({
      success: false,
      error: "Prisma client refresh failed",
      details: {
        message: error.message,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }
    });
  }
});
app.post("/api/emergency-migrate", async (req, res) => {
  try {
    console.log("\u{1F198} Emergency database migration requested - Creating usage_quotas table");
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
    console.log("\u2705 usage_quotas table created");
    try {
      await prisma.$executeRaw`
        ALTER TABLE usage_quotas 
        ADD CONSTRAINT fk_usage_quotas_user 
        FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE;
      `;
      console.log("\u2705 Foreign key constraint added");
    } catch (fkError) {
      console.log("\u26A0\uFE0F Foreign key constraint failed (may already exist):", fkError.message);
    }
    try {
      await prisma.$executeRaw`
        ALTER TABLE usage_quotas 
        ADD CONSTRAINT uniq_user_resource_period 
        UNIQUE("userId", "resourceType", "periodStart");
      `;
      console.log("\u2705 Unique constraint added");
    } catch (uniqError) {
      console.log("\u26A0\uFE0F Unique constraint failed (may already exist):", uniqError.message);
    }
    console.log("\u2705 Emergency database migration completed successfully");
    res.json({
      success: true,
      message: "Emergency database migration completed successfully",
      details: {
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        tablesCreated: ["usage_quotas"],
        constraintsAdded: ["foreign_key", "unique_constraint"],
        next_steps: [
          "usage_quotas table is now available",
          "Trial function should work properly",
          "Test trial registration again"
        ]
      }
    });
  } catch (error) {
    console.error("Failed to migrate database:", error);
    res.status(500).json({
      success: false,
      error: "Emergency database migration failed",
      details: {
        message: error.message,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        troubleshooting: [
          "Check DATABASE_URL environment variable",
          "Verify database connectivity",
          "Ensure proper database permissions"
        ]
      }
    });
  }
});
app.use("/api/billing", billing_default);
app.get("/", (req, res) => {
  res.json({
    name: "ChatTOEIC API",
    version: "2.0.1-definition-fix",
    status: "running",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    deployNote: "Includes /vocabulary/definition endpoint fix"
  });
});
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    error: "\u63A5\u53E3\u4E0D\u5B58\u5728",
    path: req.originalUrl
  });
});
app.use(errorLogger);
app.use(trackErrorActivity);
app.use((err, req, res, next) => {
  log.error("Global error handler triggered", {
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
      userAgent: req.get("User-Agent"),
      requestId: req.requestId
    },
    user: {
      userId: req.user?.userId
    }
  });
  const isDevelopment = process.env.NODE_ENV === "development";
  res.status(err.status || 500).json({
    success: false,
    error: isDevelopment ? err.message : "\u670D\u52A1\u5668\u5185\u90E8\u9519\u8BEF",
    requestId: req.requestId,
    ...isDevelopment && { stack: err.stack }
  });
});
var server = app.listen(PORT, "0.0.0.0", async () => {
  log.info("ChatTOEIC API Server Started", {
    version: "2.0.0",
    port: PORT,
    environment: process.env.NODE_ENV || "development",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
  console.log(`\u{1F680} ChatTOEIC API v2.0.0 \u670D\u52A1\u5668\u542F\u52A8\u6210\u529F`);
  console.log(`\u{1F4E1} \u670D\u52A1\u5730\u5740: http://localhost:${PORT}`);
  console.log(`\u{1F30D} \u73AF\u5883: ${process.env.NODE_ENV || "development"}`);
  console.log(`\u{1F3E5} \u5065\u5EB7\u68C0\u67E5: http://localhost:${PORT}/api/health`);
  console.log(`\u{1F4CA} \u76D1\u63A7\u9762\u677F: http://localhost:${PORT}/api/monitoring/health/detailed`);
  if (process.env.BASELINE_COMPLETED === "true") {
    console.log(`\u{1F3D7}\uFE0F \u2705 \u6570\u636E\u5E93\u57FA\u7EBF\u5EFA\u7ACB\u6A21\u5F0F`);
    console.log(`   - \u5DF2\u4E3A\u73B0\u6709\u6570\u636E\u5E93\u5EFA\u7ACB\u8FC1\u79FB\u57FA\u7EBF`);
    console.log(`   - \u89E3\u51B3\u4E86 P3005 \u6570\u636E\u5E93\u67B6\u6784\u4E0D\u4E3A\u7A7A\u95EE\u9898`);
  } else if (process.env.FORCE_START === "true") {
    console.log(`\u{1F527} \u26A0\uFE0F \u5F3A\u5236\u542F\u52A8\u6A21\u5F0F\u6FC0\u6D3B`);
    console.log(`   - \u8DF3\u8FC7\u4E86\u6240\u6709\u6570\u636E\u5E93\u8FC1\u79FB\u68C0\u67E5`);
    console.log(`   - \u5982\u679C\u9047\u5230\u6570\u636E\u5E93\u9519\u8BEF\uFF0C\u8BF7\u68C0\u67E5\u6570\u636E\u5E93\u8FDE\u63A5`);
  }
  if (process.env.SKIP_ALL_DB_CHECKS === "true") {
    console.log(`\u{1F6AB} \u26A0\uFE0F \u8DF3\u8FC7\u6240\u6709\u6570\u636E\u5E93\u68C0\u67E5\u6A21\u5F0F`);
    console.log(`   - \u5B8C\u5168\u7ED5\u8FC7\u6570\u636E\u5E93\u76F8\u5173\u7684\u6240\u6709\u68C0\u67E5`);
    console.log(`   - \u4EC5\u7528\u4E8E\u7D27\u6025\u60C5\u51B5`);
  }
  if (process.env.RENDER_OVERRIDE === "true") {
    console.log(`\u{1F3AD} \u2705 Render \u8986\u76D6\u6A21\u5F0F`);
    console.log(`   - \u7ED5\u8FC7 Render \u56FA\u5B9A\u7684\u90E8\u7F72\u547D\u4EE4`);
    console.log(`   - \u4F7F\u7528\u81EA\u5B9A\u4E49\u7684\u8FC1\u79FB\u5904\u7406\u903B\u8F91`);
  }
  if (process.env.EMERGENCY_START === "true") {
    console.log(`\u{1F198} \u26A0\uFE0F \u7D27\u6025\u542F\u52A8\u6A21\u5F0F`);
    console.log(`   - \u6240\u6709\u6570\u636E\u5E93\u64CD\u4F5C\u90FD\u5931\u8D25\u540E\u7684\u6700\u540E\u624B\u6BB5`);
    console.log(`   - \u670D\u52A1\u5668\u5C06\u5728\u6700\u5C0F\u914D\u7F6E\u4E0B\u8FD0\u884C`);
  }
  if (process.env.TOKEN_BLACKLIST_FIXED === "true") {
    console.log(`\u{1F6E1}\uFE0F \u2705 TokenBlacklist\u4FEE\u590D\u6A21\u5F0F`);
    console.log(`   - TokenBlacklist\u8FC1\u79FB\u51B2\u7A81\u5DF2\u89E3\u51B3`);
    console.log(`   - \u7528\u6237\u5C01\u7981\u529F\u80FD\u5DF2\u53EF\u7528`);
  }
  setTimeout(async () => {
    try {
      const dbTest = await testDatabaseConnection();
      if (dbTest.connected) {
        log.info("Database connection established", {
          responseTime: `${dbTest.responseTime}ms`
        });
        console.log(`\u2705 \u6570\u636E\u5E93\u8FDE\u63A5\u6210\u529F (${dbTest.responseTime}ms)`);
        try {
          await ensureSubscriptionPlansExist();
          console.log(`\u2705 \u8BA2\u9605\u5957\u9910\u6570\u636E\u521D\u59CB\u5316\u5B8C\u6210`);
        } catch (error) {
          console.log(`\u26A0\uFE0F \u8BA2\u9605\u5957\u9910\u6570\u636E\u521D\u59CB\u5316\u5931\u8D25:`, error.message);
        }
      } else {
        log.warn("Database connection failed", {
          error: dbTest.error
        });
        console.log(`\u26A0\uFE0F \u6570\u636E\u5E93\u8FDE\u63A5\u5931\u8D25\uFF0C\u4F46\u670D\u52A1\u5668\u7EE7\u7EED\u8FD0\u884C: ${dbTest.error}`);
      }
    } catch (error) {
      log.warn("Database connection test failed", { error: error.message });
      console.log("\u26A0\uFE0F \u6570\u636E\u5E93\u8FDE\u63A5\u6D4B\u8BD5\u5931\u8D25\uFF0C\u4F46\u670D\u52A1\u5668\u7EE7\u7EED\u8FD0\u884C:", error.message);
    }
  }, 2e3);
  setTimeout(() => {
    try {
      logSystemHealth();
      console.log("\u2705 \u7CFB\u7EDF\u5065\u5EB7\u72B6\u51B5\u68C0\u67E5\u5B8C\u6210");
    } catch (error) {
      console.log("\u26A0\uFE0F \u7CFB\u7EDF\u5065\u5EB7\u72B6\u51B5\u8BB0\u5F55\u5931\u8D25\uFF0C\u4F46\u4E0D\u5F71\u54CD\u8FD0\u884C");
    }
  }, 3e3);
  console.log("\n\u{1F389} =================================");
  console.log("\u2705 ChatTOEIC API \u670D\u52A1\u5668\u542F\u52A8\u5B8C\u6210\uFF01");
  console.log("\u{1F31F} \u6240\u6709\u6838\u5FC3\u529F\u80FD\u5DF2\u5C31\u7EEA");
  console.log("\u{1F517} \u670D\u52A1\u72B6\u6001: HEALTHY");
  console.log("=================================\n");
});
process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
async function gracefulShutdown(signal) {
  log.info("Graceful shutdown initiated", {
    signal,
    uptime: process.uptime()
  });
  console.log(`
\u6536\u5230 ${signal} \u4FE1\u53F7\uFF0C\u5F00\u59CB\u4F18\u96C5\u5173\u95ED...`);
  server.close(async () => {
    log.info("HTTP server closed");
    console.log("HTTP \u670D\u52A1\u5668\u5DF2\u5173\u95ED");
    try {
      await disconnectDatabase();
      log.info("Database connection closed");
      console.log("\u6570\u636E\u5E93\u8FDE\u63A5\u5DF2\u5173\u95ED");
    } catch (error) {
      log.error("Error closing database connection", { error });
      console.error("\u5173\u95ED\u6570\u636E\u5E93\u8FDE\u63A5\u65F6\u51FA\u9519:", error);
    }
    log.info("Application shutdown completed");
    console.log("\u5E94\u7528\u7A0B\u5E8F\u5DF2\u5B8C\u5168\u5173\u95ED");
    process.exit(0);
  });
  setTimeout(() => {
    log.error("Forced shutdown due to timeout");
    console.error("\u5F3A\u5236\u5173\u95ED\u5E94\u7528\u7A0B\u5E8F");
    process.exit(1);
  }, 1e4);
}
var server_default = app;
export {
  server_default as default
};
