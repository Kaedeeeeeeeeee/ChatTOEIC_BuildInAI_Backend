import { Router } from 'express';
const router = Router();
// 紧急权限修复端点 - 临时解决方案
router.post('/fix-permissions', (req, res) => {
    try {
        // 返回修复后的权限配置
        const fixedPermissions = {
            aiPractice: true,
            aiChat: true,
            vocabulary: true,
            exportData: true,
            viewMistakes: true
        };
        res.json({
            success: true,
            message: '紧急权限修复成功',
            permissions: fixedPermissions,
            timestamp: new Date().toISOString(),
            version: '2.2.0-EMERGENCY-FIX',
            note: 'This is a temporary fix while Railway deployment is being resolved'
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Emergency permission fix failed',
            timestamp: new Date().toISOString()
        });
    }
});
// 强制版本检查端点
router.get('/version-force-check', (req, res) => {
    res.json({
        success: true,
        currentVersion: '2.2.0-FINAL-CLEAN-NEW-PROMPTS',
        deploymentStatus: 'FORCED_UPDATE',
        subscriptionFix: 'ALL_AI_FEATURES_ENABLED',
        timestamp: new Date().toISOString(),
        railwayStatus: 'BYPASSED_VIA_EMERGENCY_ENDPOINT'
    });
});
export default router;
