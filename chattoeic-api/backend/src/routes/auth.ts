import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../utils/database.js';
import { validateRequest, schemas } from '../middleware/validation.js';
import { authRateLimit, oauthRateLimit } from '../middleware/rateLimiting.js';
import { authenticateToken } from '../middleware/auth.js';
import { AuthTokens, JWTPayload } from '../types/index.js';
import { notifyDashboardUpdate } from './dashboard-stream.js';
import { emailService } from '../services/emailService.js';
import { verificationCodeService } from '../services/verificationCodeService.js';

const router = Router();

// 基础测试端点
router.get('/test', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Auth route is working',
    timestamp: new Date().toISOString(),
    version: 'v2.0-with-email-verification',
    commitId: '437fbb6'
  });
});

// 测试邮件验证端点（不依赖数据库）
router.get('/test-email-endpoints', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: '邮件验证端点已部署',
    endpoints: [
      'POST /api/auth/send-verification-code',
      'POST /api/auth/verify-email-code', 
      'POST /api/auth/reset-password'
    ],
    timestamp: new Date().toISOString()
  });
});

// SMTP配置测试端点
router.get('/debug/smtp-config', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      smtp_host: process.env.SMTP_HOST || 'not_configured',
      smtp_port: process.env.SMTP_PORT || 'not_configured', 
      smtp_user: process.env.SMTP_USER ? (process.env.SMTP_USER.substring(0, 3) + '***' + process.env.SMTP_USER.slice(-3)) : 'not_configured',
      smtp_pass: process.env.SMTP_PASS ? '***configured***' : 'not_configured',
      smtp_pass_length: process.env.SMTP_PASS ? process.env.SMTP_PASS.length : 0
    }
  });
});

// 手动创建验证码表（临时使用）
router.post('/create-verification-table', async (req: Request, res: Response) => {
  try {
    // 创建验证码表
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "verification_codes" (
        "id" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "code" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "expiresAt" TIMESTAMP(3) NOT NULL,
        "attempts" INTEGER NOT NULL DEFAULT 0,
        "maxAttempts" INTEGER NOT NULL DEFAULT 5,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "verification_codes_pkey" PRIMARY KEY ("id")
      )
    `;
    
    // 创建索引
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "verification_codes_email_type_idx" ON "verification_codes"("email", "type")`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "verification_codes_expiresAt_idx" ON "verification_codes"("expiresAt")`;
    
    res.json({
      success: true,
      message: '验证码表创建成功'
    });
  } catch (error) {
    console.error('Create verification table error:', error);
    res.status(500).json({
      success: false,
      error: '创建表失败: ' + error.message
    });
  }
});

// 重置管理员密码端点 (临时使用)
router.post('/debug/reset-admin-password', async (req: Request, res: Response) => {
  try {
    const newPassword = 'admin123'; // 简单密码用于测试
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    const updatedUser = await prisma.user.update({
      where: { email: 'admin@chattoeic.com' },
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
        newPassword: newPassword,
        message: 'Admin password reset successfully'
      }
    });
  } catch (error) {
    console.error('Admin password reset error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 密码测试端点
router.post('/debug/password-test', async (req: Request, res: Response) => {
  try {
    const { password } = req.body;
    
    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin@chattoeic.com' },
      select: {
        id: true,
        email: true,
        password: true
      }
    });

    if (!adminUser || !adminUser.password) {
      return res.json({
        success: false,
        error: 'Admin user not found or no password'
      });
    }

    // 测试密码
    const validPassword = await bcrypt.compare(password, adminUser.password);
    
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
    console.error('Password test error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 调试端点 - 检查管理员账户
router.get('/debug/admin', async (req: Request, res: Response) => {
  try {
    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin@chattoeic.com' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        password: true // 临时包含密码字段检查
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
    console.error('Debug endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 用户注册 - 应用认证速率限制
router.post('/register', authRateLimit, validateRequest({ body: schemas.userRegister }), async (req: Request, res: Response) => {
  try {
    const { email, password, name, verificationCode } = req.body;

    // 如果提供了验证码，则验证它
    if (verificationCode) {
      const isValidCode = await verificationCodeService.verifyCode(email, verificationCode, 'register');
      if (!isValidCode) {
        return res.status(400).json({
          success: false,
          error: '验证码无效或已过期'
        });
      }
    }

    // 检查用户是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: '该邮箱已被注册'
      });
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 12);

    // 创建用户
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        settings: {
          preferredLanguage: 'zh',
          theme: 'light',
          notifications: true
        } as any
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true
      }
    });

    // 生成令牌
    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role
    });

    res.status(201).json({
      success: true,
      data: {
        user,
        ...tokens
      },
      message: '注册成功'
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: '注册失败，请稍后重试'
    });
  }
});

// 用户登录
router.post('/login', authRateLimit, validateRequest({ body: schemas.userLogin }), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    console.log('Login attempt for:', email);
    console.log('Environment check:', {
      hasJwtSecret: !!process.env.JWT_SECRET,
      hasJwtRefreshSecret: !!process.env.JWT_REFRESH_SECRET,
      databaseConnected: !!prisma
    });

    // 查找用户
    const user = await prisma.user.findUnique({
      where: { email }
    });

    console.log('User found:', user ? { id: user.id, email: user.email, role: user.role, hasPassword: !!user.password } : null);

    if (!user || !user.password) {
      return res.status(401).json({
        success: false,
        error: '邮箱或密码错误'
      });
    }

    // 验证密码
    const validPassword = await bcrypt.compare(password, user.password);
    console.log('Password validation:', validPassword);
    
    if (!validPassword) {
      return res.status(401).json({
        success: false,
        error: '邮箱或密码错误'
      });
    }

    // 检查环境变量
    if (!process.env.JWT_SECRET) {
      console.error('Missing JWT_SECRET');
      return res.status(500).json({
        success: false,
        error: '服务器配置错误'
      });
    }

    // 更新用户最后登录时间 - 增强版本
    const loginTime = new Date();
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
      
      console.log('✅ 用户登录时间更新成功:', {
        userId: user.id,
        email: user.email,
        loginTime: loginTime.toISOString(),
        updateResult: !!updateResult
      });
      
      loginUpdateSuccess = true;
      
    } catch (updateError) {
      console.error('❌ 登录时间更新失败:', {
        userId: user.id,
        email: user.email,
        error: updateError.message,
        stack: updateError.stack
      });
      
      // 尝试替代方案：单独更新字段
      try {
        await prisma.$executeRaw`UPDATE "User" SET "lastLoginAt" = ${loginTime} WHERE id = ${user.id}`;
        console.log('✅ 使用原始SQL更新成功');
        loginUpdateSuccess = true;
      } catch (rawError) {
        console.error('❌ 原始SQL更新也失败:', rawError.message);
      }
    }
    
    // 验证更新结果
    try {
      const verifyUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, email: true, lastLoginAt: true, isActive: true }
      });
      
      console.log('🔍 登录后用户状态验证:', {
        userId: verifyUser?.id,
        email: verifyUser?.email,
        lastLoginAt: verifyUser?.lastLoginAt,
        isActive: verifyUser?.isActive,
        loginUpdateSuccess
      });
      
    } catch (verifyError) {
      console.error('❌ 用户状态验证失败:', verifyError.message);
    }

    console.log('User last login time updated');

    // 生成令牌
    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role
    });

    console.log('Tokens generated successfully');
    
    // 通知Dashboard更新（异步，不阻塞响应）
    if (loginUpdateSuccess) {
      notifyDashboardUpdate('user_login', {
        userId: user.id,
        email: user.email,
        loginTime: loginTime.toISOString()
      }).catch(error => {
        console.error('❌ Dashboard更新通知失败:', error);
      });
    }

    // 获取更新后的用户信息（包含最新的lastLoginAt）
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
      message: '登录成功'
    });
  } catch (error) {
    console.error('Login error details:', error);
    res.status(500).json({
      success: false,
      error: '登录失败，请稍后重试',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 刷新令牌
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        error: '刷新令牌是必需的'
      });
    }

    // 验证刷新令牌
    const refreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET!;
    const decoded = jwt.verify(refreshToken, refreshSecret) as JWTPayload;
    
    // 查找用户确保仍然存在
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: '用户不存在'
      });
    }

    // 生成新的令牌
    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role
    });

    res.json({
      success: true,
      data: tokens,
      message: '令牌刷新成功'
    });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        error: '刷新令牌已过期，请重新登录'
      });
    }
    
    console.error('Token refresh error:', error);
    res.status(401).json({
      success: false,
      error: '令牌刷新失败'
    });
  }
});

// 获取当前用户信息
router.get('/me', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
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
        error: '用户不存在'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Get user info error:', error);
    res.status(500).json({
      success: false,
      error: '获取用户信息失败'
    });
  }
});

// 更新用户信息
router.put('/me', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { name, avatar, settings } = req.body;
    
    const updatedUser = await prisma.user.update({
      where: { id: req.user!.userId },
      data: {
        ...(name && { name }),
        ...(avatar && { avatar }),
        ...(settings && { settings })
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
      message: '用户信息更新成功'
    });
  } catch (error) {
    console.error('Update user info error:', error);
    res.status(500).json({
      success: false,
      error: '更新用户信息失败'
    });
  }
});

// 退出登录
router.post('/logout', authenticateToken, async (req: Request, res: Response) => {
  // 在实际应用中，这里可以将令牌加入黑名单
  // 目前只是返回成功响应
  res.json({
    success: true,
    message: '退出登录成功'
  });
});

// 生成JWT令牌的辅助函数
function generateTokens(payload: Omit<JWTPayload, 'iat' | 'exp'>): AuthTokens {
  const accessToken = jwt.sign(
    payload,
    process.env.JWT_SECRET!,
    { expiresIn: '24h' } // 增加访问令牌有效期
  );

  // 如果没有刷新密钥，使用相同的密钥但不同的有效期
  const refreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET!;
  const refreshToken = jwt.sign(
    payload,
    refreshSecret,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
}

// Google OAuth配置
const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);

// Google OAuth登录启动
router.get('/google', oauthRateLimit, (req: Request, res: Response) => {
  try {
    const scopes = [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email'
    ];

    const authUrl = googleClient.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: 'security_token',
      redirect_uri: `https://chattoeic-api.onrender.com/api/auth/google/callback`
    });

    res.redirect(authUrl);
  } catch (error) {
    console.error('Google OAuth启动错误:', error);
    res.status(500).json({
      success: false,
      error: 'OAuth配置错误'
    });
  }
});

// Google OAuth回调处理
router.get('/google/callback', oauthRateLimit, async (req: Request, res: Response) => {
  try {
    const { code, state, error } = req.query;

    console.log('=== OAuth回调开始 ===');
    console.log('查询参数:', { code: !!code, state, error });
    const frontendUrl = process.env.FRONTEND_URL || 'https://www.chattoeic.com';
    console.log('初始前端URL:', frontendUrl);
    
    if (error) {
      return res.redirect(`${frontendUrl}/?error=${error}`);
    }

    if (!code) {
      return res.redirect(`${frontendUrl}/?error=no_code`);
    }

    // 使用授权码获取令牌
    console.log('准备交换授权码获取token...');
    console.log('使用的redirect_uri:', 'https://chattoeic-api.onrender.com/api/auth/google/callback');
    console.log('GOOGLE_CLIENT_SECRET存在:', !!process.env.GOOGLE_CLIENT_SECRET);
    
    const { tokens: googleTokens } = await googleClient.getToken({
      code: code as string,
      redirect_uri: `https://chattoeic-api.onrender.com/api/auth/google/callback`
    });
    
    console.log('成功获取Google tokens');
    googleClient.setCredentials(googleTokens);

    // 获取用户信息
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${googleTokens.access_token}`
      }
    });

    if (!userInfoResponse.ok) {
      throw new Error('获取用户信息失败');
    }

    const googleUser = await userInfoResponse.json();

    // 查找或创建用户（仅选择基本字段，避免Stripe相关字段错误）
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
      // 创建新用户
      user = await prisma.user.create({
        data: {
          email: googleUser.email,
          name: googleUser.name,
          googleId: googleUser.id,
          avatar: googleUser.picture,
          lastLoginAt: new Date(), // 新用户创建时设置登录时间
          emailVerified: true, // Google用户默认邮箱已验证
          settings: {
            preferredLanguage: 'zh',
            theme: 'light',
            notifications: true
          } as any
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
      // 关联Google账户
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: googleUser.id,
          avatar: googleUser.picture || user.avatar,
          lastLoginAt: new Date(), // 更新登录时间
          emailVerified: true // 确保验证状态
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
      // 已存在的Google用户，更新登录时间
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date(),
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

    // 生成JWT令牌
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      name: user.name || ''
    };

    const accessToken = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '24h' });
    const refreshToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' });

    const tokens: AuthTokens = {
      accessToken,
      refreshToken
    };

    // 通知Dashboard更新（异步，不阻塞响应）
    const loginTime = new Date();
    notifyDashboardUpdate('google_oauth_login', {
      userId: user.id,
      email: user.email,
      loginTime: loginTime.toISOString(),
      loginMethod: 'google_oauth'
    }).catch(error => {
      console.error('❌ Google OAuth Dashboard更新通知失败:', error);
    });

    console.log('✅ Google OAuth登录成功，用户信息已更新:', {
      userId: user.id,
      email: user.email,
      loginTime: loginTime.toISOString(),
      isNewUser: !user.googleId
    });

    // 重定向到前端主页，并携带令牌信息
    console.log('=== OAuth回调调试信息 ===');
    console.log('Environment FRONTEND_URL:', process.env.FRONTEND_URL);
    console.log('Using frontend URL:', frontendUrl);
    console.log('所有环境变量:', Object.keys(process.env).filter(key => key.includes('FRONTEND')));
    
    const redirectUrl = `${frontendUrl}/?token=${encodeURIComponent(accessToken)}&refresh=${encodeURIComponent(refreshToken)}&oauth_success=true`;
    res.redirect(redirectUrl);

  } catch (error: any) {
    console.error('=== Google OAuth回调详细错误信息 ===');
    console.error('错误类型:', error.constructor.name);
    console.error('错误消息:', error.message);
    console.error('错误堆栈:', error.stack);
    
    // 如果是Google API错误，打印更多详情
    if (error.response) {
      console.error('HTTP响应状态:', error.response.status);
      console.error('HTTP响应数据:', error.response.data);
    }
    
    // 检查是否是特定的Google OAuth错误
    let errorType = 'oauth_failed';
    if (error.message?.includes('invalid_client')) {
      errorType = 'invalid_client';
      console.error('❌ Google Client配置错误 - 检查GOOGLE_CLIENT_ID和GOOGLE_CLIENT_SECRET');
    } else if (error.message?.includes('redirect_uri_mismatch')) {
      errorType = 'redirect_uri_mismatch';
      console.error('❌ 回调URL不匹配 - 检查Google Console中的授权重定向URI');
    } else if (error.message?.includes('access_denied')) {
      errorType = 'access_denied';
      console.error('❌ 用户拒绝授权');
    }
    
    const frontendUrl = process.env.FRONTEND_URL || 'https://www.chattoeic.com';
    res.redirect(`${frontendUrl}/?error=${errorType}&details=${encodeURIComponent(error.message)}`);
  }
});

// 发送验证码端点
router.post('/send-verification-code', authRateLimit, async (req: Request, res: Response) => {
  try {
    const { email, type = 'register' } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: '邮箱是必需的'
      });
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: '邮箱格式不正确'
      });
    }

    // 验证类型参数
    if (!['register', 'reset'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: '验证码类型不正确'
      });
    }

    // 尝试创建表（如果不存在）
    try {
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "verification_codes" (
          "id" TEXT NOT NULL,
          "email" TEXT NOT NULL,
          "code" TEXT NOT NULL,
          "type" TEXT NOT NULL,
          "expiresAt" TIMESTAMP(3) NOT NULL,
          "attempts" INTEGER NOT NULL DEFAULT 0,
          "maxAttempts" INTEGER NOT NULL DEFAULT 5,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "verification_codes_pkey" PRIMARY KEY ("id")
        )
      `;
      
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "verification_codes_email_type_idx" ON "verification_codes"("email", "type")`;
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "verification_codes_expiresAt_idx" ON "verification_codes"("expiresAt")`;
    } catch (createTableError) {
      console.warn('Table creation attempted (may already exist):', createTableError.message);
    }

    // 检查发送频率限制
    const canSend = await verificationCodeService.canSendCode(email, type);
    if (!canSend.canSend) {
      return res.status(429).json({
        success: false,
        error: `请等待 ${canSend.remainingTime} 秒后再重新发送`
      });
    }

    // 生成并发送验证码
    const code = await verificationCodeService.createVerificationCode(email, type);
    await emailService.sendVerificationCode(email, code, type);

    res.json({
      success: true,
      message: '验证码已发送，请查收邮件'
    });
  } catch (error) {
    console.error('Send verification code error:', error);
    res.status(500).json({
      success: false,
      error: '发送验证码失败，请稍后重试',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 验证邮箱验证码端点
router.post('/verify-email-code', authRateLimit, async (req: Request, res: Response) => {
  try {
    const { email, code, type = 'register' } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        error: '邮箱和验证码都是必需的'
      });
    }

    // 验证验证码
    const isValid = await verificationCodeService.verifyCode(email, code, type);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: '验证码无效或已过期',
        verified: false
      });
    }

    res.json({
      success: true,
      message: '验证码验证成功',
      verified: true
    });
  } catch (error) {
    console.error('Verify email code error:', error);
    res.status(500).json({
      success: false,
      error: '验证码验证失败，请稍后重试'
    });
  }
});

// 重置密码端点
router.post('/reset-password', authRateLimit, async (req: Request, res: Response) => {
  try {
    const { email, code, newPassword } = req.body;
    
    log.info('Reset password attempt', { 
      email, 
      hasCode: !!code, 
      hasPassword: !!newPassword,
      bodyKeys: Object.keys(req.body)
    });

    if (!email || !code || !newPassword) {
      log.warn('Reset password missing required fields', { 
        email: !!email, 
        code: !!code, 
        newPassword: !!newPassword 
      });
      return res.status(400).json({
        success: false,
        error: '邮箱、验证码和新密码都是必需的'
      });
    }

    // 密码强度验证
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: '密码长度至少8个字符'
      });
    }

    // 验证验证码
    const isValid = await verificationCodeService.verifyCode(email, code, 'reset');
    if (!isValid) {
      log.warn('Reset password invalid verification code', { 
        email, 
        code: code.substr(0, 2) + '***', // 只记录前两位验证码用于调试
      });
      return res.status(400).json({
        success: false,
        error: '验证码无效或已过期'
      });
    }

    // 查找用户
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: '用户不存在'
      });
    }

    // 加密新密码
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // 更新用户密码
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    });

    res.json({
      success: true,
      message: '密码重置成功，请使用新密码登录'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      error: '密码重置失败，请稍后重试'
    });
  }
});

export default router;