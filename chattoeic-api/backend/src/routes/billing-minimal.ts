/**
 * 最小化billing路由 - 用于测试路由加载问题
 */

import { Router, Request, Response } from 'express';

const router = Router();

/**
 * GET /api/billing-minimal/health  
 * 最简单的健康检查
 */
router.get('/health', async (req: Request, res: Response) => {
  res.json({
    success: true,
    service: 'billing-minimal',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    message: 'Minimal billing service is working'
  });
});

/**
 * GET /api/billing-minimal/plans
 * 最简单的套餐返回
 */
router.get('/plans', async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      plans: [
        {
          id: 'test_plan',
          name: 'Test Plan',
          priceCents: 0,
          currency: 'jpy',
          interval: 'month',
          features: {
            aiPractice: true,
            aiChat: true,
            vocabulary: false,
            exportData: false,
            viewMistakes: false
          }
        }
      ]
    }
  });
});

export default router;