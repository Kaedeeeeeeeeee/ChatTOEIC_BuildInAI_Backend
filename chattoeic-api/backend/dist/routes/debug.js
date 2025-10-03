import { Router } from 'express';
const router = Router();
// 专门用于验证部署的调试路由
router.get('/deployment-test', (req, res) => {
    res.json({
        success: true,
        message: '🎉 NEW PROMPT SYSTEM IS ACTIVE!',
        deploymentStatus: 'SUCCESS',
        version: '2.2.0-FINAL-CLEAN-NEW-PROMPTS',
        timestamp: new Date().toISOString(),
        commit: 'Latest with modular prompts',
        features: {
            modularPrompts: true,
            debugSystem: true,
            fiveLevelDifficulty: true
        },
        promptSystemFiles: [
            'src/prompts/reading/part5Prompts.ts',
            'src/prompts/reading/part6Prompts.ts',
            'src/prompts/reading/part7Prompts.ts',
            'src/prompts/listening/part1Prompts.ts',
            'src/prompts/index.ts'
        ]
    });
});
export default router;
