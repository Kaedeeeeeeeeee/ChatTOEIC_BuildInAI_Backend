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
import { authEmailService } from '../services/authEmailService.js';

const router = Router();

// 基础测试端点
router.get('/test', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Auth route is working - RAILWAY DEPLOYMENT TEST v2.0.2',
    timestamp: new Date().toISOString(),
    deployment_check: 'RAILWAY-OAUTH-FIX-ACTIVE'
  });
});

// OAuth调试端点
router.get('/oauth-debug', (req: Request, res: Response) => {
  try {
    const backendUrl = process.env.BACKEND_URL || process.env.RAILWAY_STATIC_URL || 'https://chattoeicbuildinaibackend-production.up.railway.app';
    const redirectUri = `${backendUrl}/api/auth/google/callback`;

    const googleClient = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    const scopes = [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email'
    ];

    const authUrl = googleClient.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: 'security_token',
      redirect_uri: redirectUri
    });

    res.json({
      success: true,
      debug_info: {
        backend_url: backendUrl,
        redirect_uri: redirectUri,
        google_client_id: process.env.GOOGLE_CLIENT_ID ? `${process.env.GOOGLE_CLIENT_ID.substring(0, 10)}...` : 'NOT_SET',
        google_client_secret: process.env.GOOGLE_CLIENT_SECRET ? 'SET' : 'NOT_SET',
        environment_vars: {
          BACKEND_URL: process.env.BACKEND_URL || 'NOT_SET',
          RAILWAY_STATIC_URL: process.env.RAILWAY_STATIC_URL || 'NOT_SET',
          NODE_ENV: process.env.NODE_ENV || 'NOT_SET'
        },
        generated_auth_url: authUrl,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'OAuth调试失败',
      details: error instanceof Error ? error.message : String(error)
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
    const { email, password, name } = req.body;

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

    // 创建用户，但设置为未验证状态
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        emailVerified: false, // 默认未验证
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
        emailVerified: true,
        createdAt: true
      }
    });

    // 发送验证邮件
    const emailResult = await authEmailService.sendRegistrationVerificationEmail(email, name);
    
    if (emailResult.success) {
      console.log('📧 Verification email sent to:', email);
      
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
        message: '注册成功！请查收验证邮件并完成邮箱验证'
      });
    } else {
      // 如果邮件发送失败，删除已创建的用户或标记为需要重新验证
      console.error('Failed to send verification email:', emailResult.error);
      
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
        message: '注册成功，但验证邮件发送失败。请稍后重新请求验证邮件',
        warning: '验证邮件发送失败'
      });
    }
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

    // 动态获取后端URL，优先使用环境变量
    const backendUrl = process.env.BACKEND_URL || process.env.RAILWAY_STATIC_URL || 'https://chattoeicbuildinaibackend-production.up.railway.app';
    const redirectUri = `${backendUrl}/api/auth/google/callback`;

    console.log('🔧 OAuth配置信息:');
    console.log('- BACKEND_URL:', process.env.BACKEND_URL);
    console.log('- RAILWAY_STATIC_URL:', process.env.RAILWAY_STATIC_URL);
    console.log('- 最终redirect_uri:', redirectUri);

    const authUrl = googleClient.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: 'security_token',
      redirect_uri: redirectUri
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
    // 使用相同的动态URL配置
    const backendUrl = process.env.BACKEND_URL || process.env.RAILWAY_STATIC_URL || 'https://chattoeicbuildinaibackend-production.up.railway.app';
    const redirectUri = `${backendUrl}/api/auth/google/callback`;

    console.log('使用的redirect_uri:', redirectUri);
    console.log('GOOGLE_CLIENT_SECRET存在:', !!process.env.GOOGLE_CLIENT_SECRET);

    const { tokens: googleTokens } = await googleClient.getToken({
      code: code as string,
      redirect_uri: redirectUri
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

    // 重定向到前端OAuth回调页面，并携带令牌信息
    console.log('=== OAuth回调调试信息 ===');
    console.log('Environment FRONTEND_URL:', process.env.FRONTEND_URL);
    console.log('Using frontend URL:', frontendUrl);
    console.log('所有环境变量:', Object.keys(process.env).filter(key => key.includes('FRONTEND')));

    const redirectUrl = `${frontendUrl}/auth/callback?access_token=${encodeURIComponent(accessToken)}&refresh_token=${encodeURIComponent(refreshToken)}&user_id=${encodeURIComponent(user.id)}`;
    console.log('🔗 重定向到:', redirectUrl);
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

// 邮箱验证端点
router.post('/verify-email', authRateLimit, async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        error: '邮箱和验证码不能为空'
      });
    }

    // 验证验证码
    const verificationResult = await authEmailService.verifyEmailCode(email, code);
    
    if (!verificationResult.success) {
      let errorMessage = '验证失败';
      
      switch (verificationResult.error) {
        case 'verification_code_not_found':
          errorMessage = '验证码不存在或已过期';
          break;
        case 'verification_code_expired':
          errorMessage = '验证码已过期，请重新获取';
          break;
        case 'invalid_verification_code':
          errorMessage = `验证码错误${verificationResult.remainingAttempts ? `，还可尝试${verificationResult.remainingAttempts}次` : ''}`;
          break;
        case 'too_many_attempts':
          errorMessage = '验证次数过多，请重新获取验证码';
          break;
      }

      return res.status(400).json({
        success: false,
        error: errorMessage,
        remainingAttempts: verificationResult.remainingAttempts
      });
    }

    // 验证成功，更新用户邮箱验证状态
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

    // 发送欢迎邮件
    try {
      await authEmailService.sendWelcomeEmail(email, user.name || '用户');
    } catch (emailError) {
      console.error('Welcome email send error:', emailError);
      // 欢迎邮件发送失败不影响验证成功
    }

    // 生成登录令牌
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
      message: '邮箱验证成功！欢迎加入ChatTOEIC！'
    });

  } catch (error: any) {
    console.error('Email verification error:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: '用户不存在'
      });
    }

    res.status(500).json({
      success: false,
      error: '验证失败，请稍后重试'
    });
  }
});

// 重新发送验证邮件
router.post('/resend-verification', authRateLimit, async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: '邮箱地址不能为空'
      });
    }

    // 检查用户是否存在且未验证
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
        error: '用户不存在'
      });
    }

    if (user.emailVerified) {
      return res.status(400).json({
        success: false,
        error: '邮箱已经验证过了'
      });
    }

    // 重新发送验证邮件
    const emailResult = await authEmailService.resendVerificationEmail(email, user.name || '用户');

    if (emailResult.success) {
      res.json({
        success: true,
        message: '验证邮件已重新发送，请查收邮箱'
      });
    } else {
      let errorMessage = '发送失败，请稍后重试';
      
      if (emailResult.error === 'verification_code_still_valid') {
        errorMessage = '验证码仍然有效，请检查邮箱或稍后再试';
      }

      res.status(400).json({
        success: false,
        error: errorMessage
      });
    }

  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({
      success: false,
      error: '发送失败，请稍后重试'
    });
  }
});

// 检查验证码状态
router.get('/verification-status', authRateLimit, async (req: Request, res: Response) => {
  try {
    const { email } = req.query;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        error: '邮箱地址不能为空'
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
    console.error('Verification status check error:', error);
    res.status(500).json({
      success: false,
      error: '查询失败，请稍后重试'
    });
  }
});

// 请求密码重置
router.post('/request-password-reset', authRateLimit, async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: '邮箱地址不能为空'
      });
    }

    // 检查用户是否存在
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true
      }
    });

    // 为安全起见，即使用户不存在也返回成功消息
    if (!user) {
      // 防止邮箱枚举攻击，延迟响应
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return res.json({
        success: true,
        message: '如果该邮箱已注册，重置链接已发送'
      });
    }

    // 检查邮箱是否已验证
    if (!user.emailVerified) {
      return res.status(400).json({
        success: false,
        error: '请先验证您的邮箱地址'
      });
    }

    // 获取请求信息
    const userAgent = req.get('User-Agent');
    const ipAddress = req.ip || req.connection.remoteAddress;

    // 检查是否有太多活跃的重置请求
    const resetStatus = authEmailService.checkPasswordResetRequest(email);
    if (resetStatus.hasActive && resetStatus.count >= 3) {
      return res.status(429).json({
        success: false,
        error: '重置请求过于频繁，请稍后再试'
      });
    }

    // 发送密码重置邮件
    const emailResult = await authEmailService.sendPasswordResetEmail(
      email,
      user.name || '用户',
      user.id,
      userAgent,
      ipAddress
    );

    if (emailResult.success) {
      res.json({
        success: true,
        message: '重置链接已发送到您的邮箱'
      });
    } else {
      let errorMessage = '发送失败，请稍后重试';
      
      if (emailResult.error === 'too_many_reset_requests') {
        errorMessage = '重置请求过于频繁，请稍后再试';
      }

      res.status(400).json({
        success: false,
        error: errorMessage
      });
    }

  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({
      success: false,
      error: '服务器错误，请稍后重试'
    });
  }
});

// 验证重置令牌
router.post('/verify-reset-token', authRateLimit, async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: '重置令牌不能为空'
      });
    }

    // 验证令牌
    const verificationResult = await authEmailService.verifyPasswordResetToken(token);

    if (verificationResult.success) {
      // 获取用户信息（不包含敏感信息）
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
          userName: user?.name || '用户'
        }
      });
    } else {
      let errorMessage = '重置链接无效或已过期';
      
      switch (verificationResult.error) {
        case 'token_not_found':
        case 'token_expired':
          errorMessage = '重置链接已过期，请重新申请';
          break;
        case 'token_already_used':
          errorMessage = '此重置链接已被使用';
          break;
        case 'invalid_token':
        case 'invalid_token_format':
          errorMessage = '重置链接无效';
          break;
      }

      res.status(400).json({
        success: false,
        error: errorMessage
      });
    }

  } catch (error) {
    console.error('Reset token verification error:', error);
    res.status(500).json({
      success: false,
      error: '验证失败，请稍后重试'
    });
  }
});

// 重置密码
router.post('/reset-password', authRateLimit, async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        error: '重置令牌和新密码不能为空'
      });
    }

    // 密码强度验证
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: '密码至少需要8位字符'
      });
    }

    // 验证重置令牌
    const verificationResult = await authEmailService.verifyPasswordResetToken(token);

    if (!verificationResult.success) {
      let errorMessage = '重置链接无效或已过期';
      
      switch (verificationResult.error) {
        case 'token_not_found':
        case 'token_expired':
          errorMessage = '重置链接已过期，请重新申请';
          break;
        case 'token_already_used':
          errorMessage = '此重置链接已被使用';
          break;
        case 'invalid_token':
        case 'invalid_token_format':
          errorMessage = '重置链接无效';
          break;
      }

      return res.status(400).json({
        success: false,
        error: errorMessage
      });
    }

    // 加密新密码
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // 更新用户密码
    const updatedUser = await prisma.user.update({
      where: { email: verificationResult.email },
      data: { password: hashedPassword },
      select: {
        id: true,
        email: true,
        name: true
      }
    });

    // 获取请求信息
    const userAgent = req.get('User-Agent');
    const ipAddress = req.ip || req.connection.remoteAddress;

    // 发送密码重置成功确认邮件
    try {
      await authEmailService.sendPasswordResetSuccessEmail(
        token,
        updatedUser.email,
        updatedUser.name || '用户',
        userAgent,
        ipAddress
      );
    } catch (emailError) {
      console.error('Password reset success email error:', emailError);
      // 不影响主要的重置流程
    }

    res.json({
      success: true,
      message: '密码重置成功！您现在可以使用新密码登录了'
    });

  } catch (error: any) {
    console.error('Password reset error:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: '用户不存在'
      });
    }

    res.status(500).json({
      success: false,
      error: '密码重置失败，请稍后重试'
    });
  }
});

// 检查重置请求状态
router.get('/password-reset-status', authRateLimit, async (req: Request, res: Response) => {
  try {
    const { email } = req.query;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        error: '邮箱地址不能为空'
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
    console.error('Password reset status check error:', error);
    res.status(500).json({
      success: false,
      error: '查询失败，请稍后重试'
    });
  }
});

// =================== 邮箱变更相关端点 ===================

// 请求邮箱变更
router.post('/request-email-change', authenticateToken, authRateLimit, async (req: Request, res: Response) => {
  try {
    const { newEmail } = req.body;
    const userId = req.user!.userId;

    if (!newEmail) {
      return res.status(400).json({
        success: false,
        error: '新邮箱地址不能为空'
      });
    }

    // 获取当前用户信息
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
        error: '用户不存在'
      });
    }

    if (!currentUser.emailVerified) {
      return res.status(400).json({
        success: false,
        error: '请先验证您当前的邮箱地址'
      });
    }

    // 检查新邮箱是否已被其他用户使用
    const existingUser = await prisma.user.findUnique({
      where: { email: newEmail },
      select: { id: true }
    });

    if (existingUser && existingUser.id !== userId) {
      return res.status(400).json({
        success: false,
        error: '该邮箱地址已被其他用户使用'
      });
    }

    // 检查是否与当前邮箱相同
    if (currentUser.email === newEmail) {
      return res.status(400).json({
        success: false,
        error: '新邮箱不能与当前邮箱相同'
      });
    }

    // 检查邮箱是否正在被其他用户请求变更
    const isBeingUsed = authEmailService.isEmailBeingUsed(newEmail, userId);
    if (isBeingUsed) {
      return res.status(400).json({
        success: false,
        error: '该邮箱地址正在被其他用户申请使用'
      });
    }

    // 获取请求信息
    const userAgent = req.get('User-Agent');
    const ipAddress = req.ip || req.connection.remoteAddress;

    // 发送确认邮件到新邮箱
    const emailResult = await authEmailService.sendEmailChangeConfirmationEmail(
      userId,
      currentUser.email,
      newEmail,
      currentUser.name || '用户',
      userAgent,
      ipAddress
    );

    if (emailResult.success) {
      // 异步发送通知邮件到旧邮箱（不阻塞响应）
      authEmailService.sendEmailChangeNotificationEmail(
        currentUser.email,
        newEmail,
        currentUser.name || '用户',
        userAgent,
        ipAddress
      ).catch(error => {
        console.error('Failed to send email change notification:', error);
      });

      res.json({
        success: true,
        message: '确认邮件已发送到新邮箱，请查收并确认变更'
      });
    } else {
      let errorMessage = '发送失败，请稍后重试';
      
      switch (emailResult.error) {
        case 'invalid_email_format':
          errorMessage = '邮箱格式不正确';
          break;
        case 'same_email':
          errorMessage = '新邮箱不能与当前邮箱相同';
          break;
        case 'too_many_requests':
          errorMessage = '请求过于频繁，请稍后再试';
          break;
        case 'request_too_frequent':
          errorMessage = '请等待5分钟后再试';
          break;
      }

      res.status(400).json({
        success: false,
        error: errorMessage
      });
    }

  } catch (error) {
    console.error('Email change request error:', error);
    res.status(500).json({
      success: false,
      error: '服务器错误，请稍后重试'
    });
  }
});

// 验证邮箱变更
router.post('/verify-email-change', authenticateToken, authRateLimit, async (req: Request, res: Response) => {
  try {
    const { newEmail, code } = req.body;
    const userId = req.user!.userId;

    if (!newEmail || !code) {
      return res.status(400).json({
        success: false,
        error: '新邮箱和验证码不能为空'
      });
    }

    // 获取当前用户信息
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
        error: '用户不存在'
      });
    }

    // 验证验证码
    const verificationResult = await authEmailService.verifyEmailChangeCode(
      userId,
      newEmail,
      code
    );

    if (!verificationResult.success) {
      let errorMessage = '验证失败';
      
      switch (verificationResult.error) {
        case 'request_not_found':
          errorMessage = '变更请求不存在或已过期';
          break;
        case 'request_expired':
          errorMessage = '验证码已过期，请重新申请';
          break;
        case 'invalid_verification_code':
          errorMessage = '验证码错误';
          break;
        case 'already_verified':
          errorMessage = '该请求已被验证';
          break;
        case 'request_cancelled':
          errorMessage = '变更请求已被取消';
          break;
      }

      return res.status(400).json({
        success: false,
        error: errorMessage
      });
    }

    // 验证成功，更新用户邮箱
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { 
        email: newEmail,
        emailVerified: true // 确保新邮箱是验证状态
      },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
        updatedAt: true
      }
    });

    // 获取请求信息
    const userAgent = req.get('User-Agent');
    const ipAddress = req.ip || req.connection.remoteAddress;

    // 异步发送成功通知邮件（不阻塞响应）
    authEmailService.sendEmailChangeSuccessEmail(
      verificationResult.oldEmail!,
      newEmail,
      currentUser.name || '用户',
      userAgent,
      ipAddress
    ).catch(error => {
      console.error('Failed to send email change success notification:', error);
    });

    // 生成新的访问令牌（邮箱更新了需要新token）
    const tokens = generateTokens({
      userId: updatedUser.id,
      email: updatedUser.email,
      role: req.user!.role
    });

    res.json({
      success: true,
      data: {
        user: updatedUser,
        ...tokens
      },
      message: '邮箱变更成功！请使用新邮箱登录'
    });

  } catch (error: any) {
    console.error('Email change verification error:', error);
    
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        error: '该邮箱地址已被使用'
      });
    }

    res.status(500).json({
      success: false,
      error: '验证失败，请稍后重试'
    });
  }
});

// 取消邮箱变更请求
router.post('/cancel-email-change', authenticateToken, authRateLimit, async (req: Request, res: Response) => {
  try {
    const { newEmail } = req.body;
    const userId = req.user!.userId;

    // 取消邮箱变更请求
    const cancelResult = await authEmailService.cancelEmailChangeRequest(userId, newEmail);

    if (cancelResult.success && cancelResult.cancelledCount > 0) {
      res.json({
        success: true,
        message: `已取消 ${cancelResult.cancelledCount} 个邮箱变更请求`,
        data: {
          cancelledCount: cancelResult.cancelledCount
        }
      });
    } else {
      res.json({
        success: true,
        message: '没有找到可取消的变更请求',
        data: {
          cancelledCount: 0
        }
      });
    }

  } catch (error) {
    console.error('Cancel email change error:', error);
    res.status(500).json({
      success: false,
      error: '取消失败，请稍后重试'
    });
  }
});

// 获取邮箱变更请求状态
router.get('/email-change-status', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    // 获取用户的邮箱变更请求状态
    const status = authEmailService.getUserEmailChangeStatus(userId);

    res.json({
      success: true,
      data: {
        activeRequests: status.active.map(request => ({
          newEmail: request.newEmail,
          createdAt: request.createdAt,
          expiresAt: request.expiresAt
        })),
        totalRequests: status.total
      }
    });

  } catch (error) {
    console.error('Email change status error:', error);
    res.status(500).json({
      success: false,
      error: '获取状态失败，请稍后重试'
    });
  }
});

export default router;