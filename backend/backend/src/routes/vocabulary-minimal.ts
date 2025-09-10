import { Router, Request, Response } from 'express';

const router = Router();

// 最简单的测试端点
console.log('🔧 [最简路由] 注册 GET /vocabulary-minimal/test 端点');
router.get('/test', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Minimal vocabulary router working',
    timestamp: new Date().toISOString(),
    route: '/vocabulary-minimal/test'
  });
});

console.log('🔧 [最简路由] 注册 POST /vocabulary-minimal/test 端点');
router.post('/test', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Minimal vocabulary POST working',
    requestBody: req.body,
    timestamp: new Date().toISOString(),
    route: '/vocabulary-minimal/test'
  });
});

export default router;