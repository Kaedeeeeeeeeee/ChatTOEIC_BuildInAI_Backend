import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../middleware/subscriptionAuth.js';
import StripeService from '../services/stripeService.js';
import { log } from '../utils/logger.js';

const router = Router();

// 调试试用功能
router.post('/trial', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    console.log('🔍 Debug trial start for user:', userId);

    // 尝试开始试用，捕获详细错误
    const subscription = await StripeService.startTrial(userId, 'premium_monthly');

    console.log('✅ Trial started successfully:', subscription);

    res.json({
      success: true,
      message: '试用开始成功',
      data: { subscription }
    });

  } catch (error) {
    console.error('❌ Trial debug error:', {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error,
      userId: req.user?.userId
    });

    res.status(400).json({
      success: false,
      message: '试用开始失败',
      error: error instanceof Error ? error.message : String(error),
      details: error instanceof Error ? {
        name: error.name,
        stack: error.stack?.split('\n').slice(0, 5) // 只返回前5行堆栈
      } : null
    });
  }
});

export default router;