/**
 * Stripe支付系统API端点设计文档
 * 这是设计文档，不是实际代码文件
 */

// ===============================
// 1. 订阅套餐管理 API
// ===============================

/**
 * GET /api/billing/plans
 * 获取所有可用的订阅套餐
 * 访问权限：公开
 */
interface GetPlansResponse {
  success: boolean;
  data: {
    plans: Array<{
      id: string;
      name: string;
      nameJp: string;
      priceCents: number;
      currency: string;
      interval: string;
      features: {
        aiPractice: boolean;
        aiChat: boolean;
        exportData: boolean;
        dailyPracticeLimit: number | null;
        dailyAiChatLimit: number | null;
      };
      isPopular?: boolean; // 推荐标记
    }>;
  };
}

// ===============================
// 2. 用户订阅状态 API
// ===============================

/**
 * GET /api/user/subscription
 * 获取当前用户的订阅状态
 * 访问权限：需要认证
 */
interface GetUserSubscriptionResponse {
  success: boolean;
  data: {
    subscription: {
      id: string;
      status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid';
      plan: {
        name: string;
        priceCents: number;
        interval: string;
        features: object;
      };
      trialEnd?: string; // ISO日期字符串
      currentPeriodEnd?: string;
      cancelAtPeriodEnd: boolean;
    } | null;
    usage: {
      dailyPractice: { used: number; limit: number | null };
      dailyAiChat: { used: number; limit: number | null };
      vocabularyWords: { used: number; limit: number | null };
    };
    permissions: {
      canUsePractice: boolean;
      canUseAiChat: boolean;
      canExportData: boolean;
      trialAvailable: boolean; // 是否还可以开始试用
    };
  };
}

/**
 * POST /api/user/subscription/start-trial
 * 开始免费试用
 * 访问权限：需要认证
 */
interface StartTrialRequest {
  planId: string; // Premium套餐的ID
}

interface StartTrialResponse {
  success: boolean;
  data: {
    subscription: {
      id: string;
      status: 'trialing';
      trialEnd: string; // 3天后的日期
    };
  };
  message: string;
}

// ===============================
// 3. Stripe支付流程 API
// ===============================

/**
 * POST /api/billing/create-checkout-session
 * 创建Stripe结账会话
 * 访问权限：需要认证
 */
interface CreateCheckoutSessionRequest {
  planId: string;
  returnUrl: string; // 支付成功后的返回URL
  cancelUrl: string; // 支付取消后的返回URL
}

interface CreateCheckoutSessionResponse {
  success: boolean;
  data: {
    sessionId: string;
    sessionUrl: string; // Stripe结账页面URL
  };
}

/**
 * POST /api/billing/create-portal-session  
 * 创建Stripe客户门户会话（用于管理订阅）
 * 访问权限：需要认证，需要已有订阅
 */
interface CreatePortalSessionRequest {
  returnUrl: string; // 返回应用的URL
}

interface CreatePortalSessionResponse {
  success: boolean;
  data: {
    portalUrl: string; // Stripe客户门户URL
  };
}

/**
 * POST /api/billing/webhooks
 * Stripe Webhook端点
 * 访问权限：Stripe签名验证
 * 
 * 处理的事件类型：
 * - checkout.session.completed: 支付成功
 * - invoice.payment_succeeded: 续费成功
 * - invoice.payment_failed: 支付失败
 * - customer.subscription.updated: 订阅状态更新
 * - customer.subscription.deleted: 订阅取消
 */
interface StripeWebhookPayload {
  id: string;
  type: string;
  data: {
    object: any; // Stripe对象，根据类型不同而变化
  };
}

// ===============================
// 4. 订阅管理 API
// ===============================

/**
 * POST /api/user/subscription/cancel
 * 取消订阅（在当前周期结束时）
 * 访问权限：需要认证，需要活跃订阅
 */
interface CancelSubscriptionResponse {
  success: boolean;
  data: {
    subscription: {
      id: string;
      status: string;
      cancelAtPeriodEnd: true;
      currentPeriodEnd: string;
    };
  };
  message: string;
}

/**
 * POST /api/user/subscription/reactivate
 * 重新激活已取消的订阅
 * 访问权限：需要认证
 */
interface ReactivateSubscriptionResponse {
  success: boolean;
  data: {
    subscription: {
      id: string;
      status: string;
      cancelAtPeriodEnd: false;
    };
  };
  message: string;
}

// ===============================
// 5. 使用配额管理 API
// ===============================

/**
 * POST /api/user/usage/track
 * 跟踪资源使用（内部API，由其他服务调用）
 * 访问权限：内部服务认证
 */
interface TrackUsageRequest {
  userId: string;
  resourceType: 'daily_practice' | 'daily_ai_chat' | 'vocabulary_words';
  amount?: number; // 默认为1
}

/**
 * GET /api/user/usage/check/:resourceType
 * 检查用户是否可以使用某个资源
 * 访问权限：需要认证
 */
interface CheckUsageResponse {
  success: boolean;
  data: {
    canUse: boolean;
    used: number;
    limit: number | null;
    remaining: number | null;
    resetAt?: string; // 配额重置时间
  };
}

// ===============================
// 6. 支付历史 API
// ===============================

/**
 * GET /api/user/billing-history
 * 获取用户的付款历史
 * 访问权限：需要认证
 */
interface BillingHistoryResponse {
  success: boolean;
  data: {
    transactions: Array<{
      id: string;
      amount: number;
      currency: string;
      status: string;
      description: string;
      createdAt: string;
      receiptUrl?: string; // Stripe收据URL
    }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
    };
  };
}

// ===============================
// 7. 权限检查中间件
// ===============================

/**
 * 用于保护需要付费功能的API端点
 * 在practice.ts和chat.ts等路由中使用
 */
interface PermissionCheckMiddleware {
  // 检查是否可以使用练习功能
  requirePracticeAccess: (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
  
  // 检查是否可以使用AI对话功能  
  requireAiChatAccess: (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
  
  // 检查是否可以导出数据
  requireExportAccess: (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
}

// ===============================
// 8. 错误响应类型
// ===============================

interface BillingErrorResponse {
  success: false;
  error: string;
  errorCode?: 
    | 'SUBSCRIPTION_REQUIRED'
    | 'TRIAL_ALREADY_USED'
    | 'USAGE_LIMIT_EXCEEDED'
    | 'PAYMENT_FAILED'
    | 'INVALID_PLAN'
    | 'STRIPE_ERROR';
  data?: {
    upgradeUrl?: string; // 升级链接
    trialAvailable?: boolean;
    usageInfo?: object;
  };
}

export type {
  GetPlansResponse,
  GetUserSubscriptionResponse,
  StartTrialRequest,
  StartTrialResponse,
  CreateCheckoutSessionRequest,
  CreateCheckoutSessionResponse,
  CreatePortalSessionRequest,
  CreatePortalSessionResponse,
  CancelSubscriptionResponse,
  ReactivateSubscriptionResponse,
  TrackUsageRequest,
  CheckUsageResponse,
  BillingHistoryResponse,
  BillingErrorResponse,
  PermissionCheckMiddleware
};