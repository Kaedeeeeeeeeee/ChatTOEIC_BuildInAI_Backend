/**
 * Stripe支付服务封装
 * 提供订阅管理、支付处理、Webhook处理等功能
 */
import Stripe from 'stripe';
import { prisma } from '../utils/database.js';
import { log } from '../utils/logger.js';
// Stripe客户端实例（延迟初始化）
let stripe = null;
// 获取Stripe实例（延迟初始化）
function getStripe() {
    if (!stripe) {
        if (!process.env.STRIPE_SECRET_KEY) {
            console.error('STRIPE_SECRET_KEY environment variable is not set');
            throw new Error('Stripe configuration missing: STRIPE_SECRET_KEY is required');
        }
        stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
            apiVersion: '2023-10-16',
        });
        console.log('Stripe client initialized successfully');
    }
    return stripe;
}
// 安全的用户订阅查询，避免查询不存在的列
const safeUserSubscriptionSelect = {
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
    updatedAt: true,
};
export class StripeService {
    /**
     * 创建结账会话
     */
    static async createCheckoutSession({ userId, planId, successUrl, cancelUrl, paymentMethods = ['card', 'alipay'], }) {
        try {
            // 获取用户信息
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { id: true, email: true, name: true }
            });
            if (!user) {
                throw new Error('User not found');
            }
            // 获取订阅套餐信息
            let plan = await prisma.subscriptionPlan.findUnique({
                where: { id: planId }
            });
            // 如果数据库中没有套餐，使用fallback数据
            if (!plan) {
                const fallbackPlans = {
                    'premium_monthly': {
                        id: 'premium_monthly',
                        name: 'Premium Monthly',
                        priceCents: 300000, // 3000日元
                        currency: 'jpy',
                        stripePriceId: process.env.STRIPE_PRICE_MONTHLY || 'price_1Qq4lDByBlkJ5QNQz5s1bDnn'
                    },
                    'premium_yearly': {
                        id: 'premium_yearly',
                        name: 'Premium Yearly',
                        priceCents: 3000000, // 30000日元
                        currency: 'jpy',
                        stripePriceId: process.env.STRIPE_PRICE_YEARLY || 'price_1Qq4m9ByBlkJ5QNQqjLXW3qG'
                    }
                };
                plan = fallbackPlans[planId];
                if (!plan) {
                    throw new Error(`Plan ${planId} not found`);
                }
                console.log(`⚠️ Using fallback plan data for ${planId}`);
            }
            if (!plan.stripePriceId) {
                throw new Error(`Plan ${planId} missing Stripe price ID`);
            }
            // 🔧 修复：Alipay不支持订阅模式，只允许信用卡支付
            const supportedPaymentMethods = ['card']; // 订阅模式只支持信用卡
            console.log(`⚠️ Subscription mode only supports card payments, ignoring other methods`);
            // 检查用户是否已有订阅（包括试用和付费状态）
            const existingSubscription = await prisma.userSubscription.findUnique({
                where: { userId },
                select: safeUserSubscriptionSelect,
            });
            // 阻止重复的活跃付费订阅
            if (existingSubscription && existingSubscription.status === 'active') {
                throw new Error('User already has an active subscription');
            }
            // 允许试用用户升级到付费版，但记录当前状态用于后续处理
            const isUpgradingFromTrial = existingSubscription && existingSubscription.status === 'trialing';
            log.info('Creating checkout session', {
                userId,
                planId,
                isUpgradingFromTrial,
                existingStatus: existingSubscription?.status || 'none'
            });
            // 创建或获取Stripe客户
            let stripeCustomerId = existingSubscription?.stripeCustomerId;
            if (!stripeCustomerId) {
                const customer = await getStripe().customers.create({
                    email: user.email,
                    name: user.name || undefined,
                    metadata: {
                        userId: user.id,
                    },
                });
                stripeCustomerId = customer.id;
            }
            // 创建结账会话
            const session = await getStripe().checkout.sessions.create({
                customer: stripeCustomerId,
                payment_method_types: supportedPaymentMethods, // 订阅模式只支持信用卡
                line_items: [
                    {
                        price: plan.stripePriceId,
                        quantity: 1,
                    },
                ],
                mode: 'subscription',
                success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: cancelUrl,
                metadata: {
                    userId: user.id,
                    planId: plan.id,
                },
                // 重要：绝不通过Stripe给予试用期！试用只能从ChatTOEIC前端获得
                subscription_data: {
                    // 完全移除 trial_period_days，所有付费都从第一天开始计费
                    metadata: {
                        userId: user.id,
                        planId: plan.id,
                        upgradeFromTrial: isUpgradingFromTrial ? 'true' : 'false',
                        source: 'chattoeic_frontend', // 标识来源
                    },
                },
            });
            // 保存会话信息到数据库
            await prisma.userSubscription.upsert({
                where: { userId },
                create: {
                    userId,
                    planId,
                    stripeCustomerId,
                    stripeSessionId: session.id,
                    status: 'pending',
                },
                update: {
                    planId,
                    stripeCustomerId,
                    stripeSessionId: session.id,
                    status: 'pending',
                },
            });
            log.info('Stripe checkout session created', {
                userId,
                sessionId: session.id,
                planId,
            });
            return {
                sessionId: session.id,
                sessionUrl: session.url,
            };
        }
        catch (error) {
            log.error('Failed to create checkout session', { error, userId, planId });
            throw error;
        }
    }
    /**
     * 创建客户门户会话
     */
    static async createPortalSession({ userId, returnUrl, }) {
        try {
            const subscription = await prisma.userSubscription.findUnique({
                where: { userId },
                select: safeUserSubscriptionSelect,
            });
            if (!subscription?.stripeCustomerId) {
                throw new Error('No subscription found for user');
            }
            const session = await getStripe().billingPortal.sessions.create({
                customer: subscription.stripeCustomerId,
                return_url: returnUrl,
                // 如果有默认配置，Stripe会自动使用，不需要明确指定configuration
            });
            log.info('Stripe portal session created', {
                userId,
                sessionId: session.id,
            });
            return {
                url: session.url,
            };
        }
        catch (error) {
            log.error('Failed to create portal session', { error, userId });
            throw error;
        }
    }
    /**
     * 创建一次性支付会话（支付宝等）
     */
    static async createOneTimePaymentSession({ userId, planId, successUrl, cancelUrl, paymentMethods = ['alipay'], }) {
        try {
            // 获取用户信息
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { id: true, email: true, name: true }
            });
            if (!user) {
                throw new Error('User not found');
            }
            // 解析planId，提取基础套餐ID和期间信息
            let basePlanId = planId;
            let paymentPeriod = 'month'; // 默认月付
            // 检查是否包含期间标识符
            if (planId.includes('_month_onetime')) {
                basePlanId = planId.replace('_month_onetime', '');
                paymentPeriod = 'month';
            }
            else if (planId.includes('_year_onetime')) {
                basePlanId = planId.replace('_year_onetime', '');
                paymentPeriod = 'year';
            }
            console.log(`💡 Parsed planId: ${planId} -> basePlanId: ${basePlanId}, period: ${paymentPeriod}`);
            // 获取订阅套餐信息
            let plan = await prisma.subscriptionPlan.findUnique({
                where: { id: basePlanId }
            });
            // 如果数据库中没有套餐，使用fallback数据
            if (!plan) {
                const fallbackPlans = {
                    'premium_monthly': {
                        id: 'premium_monthly',
                        name: 'Premium Monthly',
                        priceCents: 300000, // 基础月价格
                        currency: 'jpy'
                    },
                    'premium_yearly': {
                        id: 'premium_yearly',
                        name: 'Premium Yearly',
                        priceCents: 3000000, // 基础年价格
                        currency: 'jpy'
                    }
                };
                plan = fallbackPlans[basePlanId];
                if (!plan) {
                    throw new Error(`Plan ${basePlanId} not found`);
                }
                console.log(`⚠️ Using fallback plan data for one-time payment ${basePlanId}`);
            }
            // 创建或获取Stripe客户
            let stripeCustomerId = user.stripeCustomerId;
            if (!stripeCustomerId) {
                const customer = await getStripe().customers.create({
                    email: user.email || undefined,
                    name: user.name || undefined,
                    metadata: {
                        userId: user.id,
                    },
                });
                stripeCustomerId = customer.id;
            }
            // 根据期间计算一次性支付价格
            let oneTimePrice;
            let servicePeriodMonths;
            if (paymentPeriod === 'year') {
                // 年付：直接使用年付套餐价格，不做修改（保持与原套餐价格一致）
                oneTimePrice = plan.priceCents;
                servicePeriodMonths = 12;
            }
            else {
                // 月付：直接使用月付套餐价格
                oneTimePrice = plan.priceCents;
                servicePeriodMonths = 1;
            }
            console.log(`💰 Payment calculation: basePlan=${plan.priceCents}, period=${paymentPeriod}, finalPrice=${oneTimePrice}, serviceMonths=${servicePeriodMonths}`);
            console.log(`💰 Creating one-time payment session for ${planId} (${basePlanId} ${paymentPeriod}), price: ${oneTimePrice} ${plan.currency}, service: ${servicePeriodMonths} months`);
            // 创建结账会话 - 一次性支付模式
            const session = await getStripe().checkout.sessions.create({
                customer: stripeCustomerId,
                payment_method_types: paymentMethods, // 支持支付宝等
                mode: 'payment', // 一次性支付模式，支持支付宝
                line_items: [
                    {
                        price_data: {
                            currency: plan.currency,
                            product_data: {
                                name: `${plan.name} - ${servicePeriodMonths}个月服务`,
                                description: `ChatTOEIC ${plan.name} 一次性支付，享受${servicePeriodMonths}个月完整服务${paymentPeriod === 'year' ? '（年付优惠）' : ''}`,
                            },
                            unit_amount: Math.round(oneTimePrice / 100), // JPY不使用最小货币单位，需要除以100
                        },
                        quantity: 1,
                    },
                ],
                success_url: successUrl + '?session_id={CHECKOUT_SESSION_ID}&mode=one_time',
                cancel_url: cancelUrl + '?mode=one_time',
                metadata: {
                    userId: userId,
                    planId: planId,
                    basePlanId: basePlanId,
                    paymentMode: 'one_time',
                    paymentPeriod: paymentPeriod,
                    serviceMonths: servicePeriodMonths.toString(),
                },
                expires_at: Math.floor(Date.now() / 1000) + (30 * 60), // 30分钟过期
            });
            console.log(`✅ One-time payment session created: ${session.id}`);
            const result = {
                sessionId: session.id,
                sessionUrl: session.url || '',
                publicKey: process.env.STRIPE_PUBLISHABLE_KEY
            };
            return result;
        }
        catch (error) {
            log.error('Failed to create one-time payment session', { error, userId, planId });
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
                    name: true, // 使用name而不是username字段
                    // 暂时不查询trialUsed字段，直到数据库同步
                },
            });
            if (!user) {
                throw new Error('User not found');
            }
            // 暂时注释掉试用检查，直到数据库字段同步
            // if (user.trialUsed) {
            //   throw new Error('User has already used their free trial');
            // }
            // 首先尝试从数据库获取套餐
            let plan;
            try {
                plan = await prisma.subscriptionPlan.findUnique({
                    where: { id: planId },
                });
            }
            catch (dbError) {
                log.warn('Failed to query subscription plan from database', { planId, dbError });
            }
            // 如果数据库中没有找到，使用硬编码的试用套餐数据
            if (!plan) {
                log.info('Using hardcoded plan data for trial', { planId });
                if (planId === 'trial' || planId === 'trial_plan') {
                    plan = {
                        id: 'trial',
                        name: 'Free Trial',
                        nameJp: '無料トライアル',
                        priceCents: 0,
                        currency: 'jpy',
                        interval: 'trial',
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
                }
                else if (planId === 'free' || planId === 'free_plan') {
                    plan = {
                        id: 'free',
                        name: 'Free Plan',
                        nameJp: '無料プラン',
                        priceCents: 0,
                        currency: 'jpy',
                        interval: 'month',
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
                }
                else {
                    throw new Error('Plan not found');
                }
            }
            // 检查是否已有活跃订阅
            const existingSubscription = await prisma.userSubscription.findUnique({
                where: { userId },
                select: safeUserSubscriptionSelect,
            });
            // 🚨 关键修复：严格的试用检查逻辑
            if (existingSubscription) {
                // 如果已有活跃付费订阅，禁止试用
                if (existingSubscription.status === 'active') {
                    throw new Error('您已经是付费用户，无需试用');
                }
                // 如果已有试用订阅（未过期），禁止重复试用
                if (existingSubscription.status === 'trialing') {
                    const now = new Date();
                    if (existingSubscription.trialEnd && existingSubscription.trialEnd > now) {
                        throw new Error('您已经在试用期内，无法重复申请');
                    }
                }
                // 如果试用已过期或取消，禁止重新试用  
                if (existingSubscription.trialEnd) {
                    throw new Error('每个用户只能使用一次免费试用');
                }
            }
            const now = new Date();
            const trialEnd = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3天后
            // 创建试用订阅记录
            const subscription = await prisma.userSubscription.upsert({
                where: { userId },
                create: {
                    userId,
                    planId,
                    status: 'trialing',
                    trialStart: now,
                    trialEnd,
                    currentPeriodStart: now,
                    currentPeriodEnd: trialEnd,
                },
                update: {
                    planId,
                    status: 'trialing',
                    trialStart: now,
                    trialEnd,
                    currentPeriodStart: now,
                    currentPeriodEnd: trialEnd,
                },
            });
            // 暂时注释掉标记用户已使用试用，直到数据库字段同步
            // await prisma.user.update({
            //   where: { id: userId },
            //   data: {
            //     trialUsed: true,
            //     trialStartedAt: now,
            //   },
            // });
            // 初始化使用配额
            await this.initializeUsageQuotas(userId, plan);
            log.info('Free trial started', {
                userId,
                subscriptionId: subscription.id,
                trialEnd,
            });
            return subscription;
        }
        catch (error) {
            log.error('Failed to start trial', { error, userId, planId });
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
                select: safeUserSubscriptionSelect,
            });
            if (!subscription) {
                throw new Error('No subscription found');
            }
            if (subscription.stripeSubscriptionId) {
                // 取消Stripe订阅（在当前周期结束时）
                await getStripe().subscriptions.update(subscription.stripeSubscriptionId, {
                    cancel_at_period_end: true,
                });
            }
            // 更新数据库记录
            const updatedSubscription = await prisma.userSubscription.update({
                where: { userId },
                data: {
                    cancelAtPeriodEnd: true,
                    canceledAt: new Date(),
                },
            });
            log.info('Subscription canceled', {
                userId,
                subscriptionId: subscription.id,
            });
            return updatedSubscription;
        }
        catch (error) {
            log.error('Failed to cancel subscription', { error, userId });
            throw error;
        }
    }
    /**
     * 处理Webhook事件
     */
    static async handleWebhook(event) {
        try {
            log.info('Processing Stripe webhook', {
                eventType: event.type,
                eventId: event.id,
            });
            switch (event.type) {
                case 'checkout.session.completed':
                    await this.handleCheckoutCompleted(event.data.object);
                    break;
                case 'invoice.payment_succeeded':
                    await this.handlePaymentSucceeded(event.data.object);
                    break;
                case 'invoice.payment_failed':
                    await this.handlePaymentFailed(event.data.object);
                    break;
                case 'customer.subscription.updated':
                    await this.handleSubscriptionUpdated(event.data.object);
                    break;
                case 'customer.subscription.deleted':
                    await this.handleSubscriptionDeleted(event.data.object);
                    break;
                default:
                    log.info('Unhandled webhook event type', { eventType: event.type });
            }
        }
        catch (error) {
            log.error('Failed to handle webhook', { error, eventType: event.type });
            throw error;
        }
    }
    /**
     * 处理结账完成事件
     */
    static async handleCheckoutCompleted(session) {
        const userId = session.metadata?.userId;
        if (!userId) {
            log.error('Missing userId in session metadata', { sessionId: session.id });
            throw new Error('Missing userId in session metadata');
        }
        log.info('Processing checkout completion', { userId, sessionId: session.id });
        const subscription = await prisma.userSubscription.findUnique({
            where: { userId },
            select: safeUserSubscriptionSelect,
        });
        if (!subscription) {
            log.error('Subscription not found for checkout completion', { userId, sessionId: session.id });
            throw new Error('Subscription not found');
        }
        const stripeSubscription = await getStripe().subscriptions.retrieve(session.subscription);
        log.info('Retrieved Stripe subscription', {
            userId,
            stripeSubscriptionId: stripeSubscription.id,
            status: stripeSubscription.status
        });
        // 🔧 关键修复：从 session metadata 获取正确的 planId
        const targetPlanId = session.metadata?.planId;
        if (!targetPlanId) {
            log.error('Missing planId in session metadata', { sessionId: session.id });
            throw new Error('Missing planId in session metadata');
        }
        // 重要：所有通过Stripe的付费都直接设为active，绝不设置为trialing
        // 试用只能通过ChatTOEIC前端获得，Stripe付费立即生效
        await prisma.userSubscription.update({
            where: { userId },
            data: {
                planId: targetPlanId, // 🔧 更新为正确的付费套餐ID
                stripeSubscriptionId: stripeSubscription.id,
                status: 'active', // 强制设为active，忽略Stripe的trialing状态
                currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
                currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
                // 保留原有的试用信息（如果用户之前有过试用）
                // 但不会基于Stripe信息创建新的试用
                trialStart: subscription.trialStart, // 保持原值
                trialEnd: subscription.trialEnd, // 保持原值
            },
        });
        log.info('Subscription status updated successfully', {
            userId,
            stripeStatus: stripeSubscription.status,
            finalStatus: 'active', // 强制为active
            planId: targetPlanId, // 记录更新的套餐ID
            message: 'All Stripe payments start immediately - no trials through Stripe'
        });
        // 尝试记录支付交易，如果表不存在则记录警告
        try {
            await prisma.paymentTransaction.create({
                data: {
                    userId,
                    stripeSessionId: session.id,
                    amount: session.amount_total || 0,
                    currency: session.currency || 'jpy',
                    status: 'succeeded',
                    subscriptionId: subscription.id,
                },
            });
            log.info('Payment transaction recorded successfully', { userId, sessionId: session.id });
        }
        catch (transactionError) {
            log.warn('Failed to record payment transaction (table may not exist)', {
                userId,
                sessionId: session.id,
                error: transactionError instanceof Error ? transactionError.message : String(transactionError)
            });
        }
        log.info('Checkout completed and subscription activated', { userId, sessionId: session.id });
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
                    status: 'active',
                    lastPaymentAt: new Date(),
                    currentPeriodStart: new Date(subscription.current_period_start * 1000),
                    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
                },
            });
            log.info('Payment succeeded and subscription updated', { userId, invoiceId: invoice.id });
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
                    status: 'past_due',
                },
            });
            log.warn('Payment failed for subscription', { userId, invoiceId: invoice.id });
        }
    }
    /**
     * 处理订阅更新事件
     */
    static async handleSubscriptionUpdated(subscription) {
        const userId = subscription.metadata?.userId;
        if (!userId) {
            log.warn('Subscription updated webhook missing userId metadata', { subscriptionId: subscription.id });
            return;
        }
        try {
            // 先检查订阅是否存在
            const existingSubscription = await prisma.userSubscription.findUnique({
                where: { userId },
            });
            if (!existingSubscription) {
                log.warn('Subscription not found for user during update', { userId, subscriptionId: subscription.id });
                return;
            }
            await prisma.userSubscription.update({
                where: { userId },
                data: {
                    status: subscription.status,
                    currentPeriodStart: new Date(subscription.current_period_start * 1000),
                    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
                    cancelAtPeriodEnd: subscription.cancel_at_period_end,
                    updatedAt: new Date(),
                },
            });
            log.info('Subscription updated', {
                userId,
                subscriptionId: subscription.id,
                status: subscription.status,
                cancelAtPeriodEnd: subscription.cancel_at_period_end
            });
        }
        catch (error) {
            log.error('Failed to update subscription', {
                error,
                userId,
                subscriptionId: subscription.id
            });
            throw error;
        }
    }
    /**
     * 处理订阅删除事件
     */
    static async handleSubscriptionDeleted(subscription) {
        const userId = subscription.metadata?.userId;
        if (!userId) {
            log.warn('Subscription deleted webhook missing userId metadata', { subscriptionId: subscription.id });
            return;
        }
        try {
            // 先检查订阅是否存在
            const existingSubscription = await prisma.userSubscription.findUnique({
                where: { userId },
            });
            if (!existingSubscription) {
                log.warn('Subscription not found for user during deletion', { userId, subscriptionId: subscription.id });
                return;
            }
            await prisma.userSubscription.update({
                where: { userId },
                data: {
                    status: 'canceled',
                    canceledAt: new Date(),
                    updatedAt: new Date(),
                },
            });
            log.info('Subscription deleted', { userId, subscriptionId: subscription.id });
        }
        catch (error) {
            log.error('Failed to delete subscription', {
                error,
                userId,
                subscriptionId: subscription.id
            });
            throw error;
        }
    }
    /**
     * 初始化用户使用配额
     */
    static async initializeUsageQuotas(userId, plan) {
        const now = new Date();
        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59, 999);
        const quotas = [];
        // 每日练习配额
        if (plan.dailyPracticeLimit !== null) {
            quotas.push({
                userId,
                resourceType: 'daily_practice',
                usedCount: 0,
                limitCount: plan.dailyPracticeLimit,
                periodStart: now,
                periodEnd: endOfDay,
            });
        }
        // 每日AI对话配额  
        if (plan.dailyAiChatLimit !== null) {
            quotas.push({
                userId,
                resourceType: 'daily_ai_chat',
                usedCount: 0,
                limitCount: plan.dailyAiChatLimit,
                periodStart: now,
                periodEnd: endOfDay,
            });
        }
        // 词汇本配额
        if (plan.maxVocabularyWords !== null) {
            quotas.push({
                userId,
                resourceType: 'vocabulary_words',
                usedCount: 0,
                limitCount: plan.maxVocabularyWords,
                periodStart: now,
                periodEnd: new Date('2099-12-31'), // 词汇本配额不按日重置
            });
        }
        // 尝试创建配额记录，如果表不存在则记录警告但不失败
        if (quotas.length > 0) {
            try {
                await prisma.usageQuota.createMany({
                    data: quotas,
                    skipDuplicates: true,
                });
                log.info('Usage quotas initialized successfully', { userId, quotaCount: quotas.length });
            }
            catch (error) {
                log.warn('Failed to initialize usage quotas (table may not exist)', {
                    userId,
                    error: error instanceof Error ? error.message : String(error),
                    quotas: quotas.map(q => ({ resourceType: q.resourceType, limitCount: q.limitCount }))
                });
                // 不抛出错误，让试用继续进行
            }
        }
    }
}
export default StripeService;
