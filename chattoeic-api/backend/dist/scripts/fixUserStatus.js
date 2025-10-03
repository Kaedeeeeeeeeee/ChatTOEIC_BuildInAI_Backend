/**
 * 修复用户状态显示问题
 * 将所有现有用户的emailVerified设为true，让Dashboard正常显示
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function fixUserStatus() {
    console.log('🚀 开始修复用户状态显示问题...');
    try {
        // 获取所有用户
        const allUsers = await prisma.user.findMany({
            select: { id: true, email: true, emailVerified: true }
        });
        console.log(`📊 找到 ${allUsers.length} 个用户`);
        // 统计需要修复的用户数量
        const usersNeedFix = allUsers.filter(user => !user.emailVerified);
        console.log(`⚠️  需要修复的用户: ${usersNeedFix.length} 个`);
        if (usersNeedFix.length === 0) {
            console.log('✅ 所有用户状态已正常，无需修复');
            return;
        }
        // 批量更新所有用户的emailVerified为true
        const updateResult = await prisma.user.updateMany({
            where: {
                emailVerified: false
            },
            data: {
                emailVerified: true
            }
        });
        console.log(`✅ 修复完成！更新了 ${updateResult.count} 个用户的状态`);
        // 验证修复结果
        const fixedUsers = await prisma.user.findMany({
            where: {
                emailVerified: false
            },
            select: { id: true, email: true }
        });
        if (fixedUsers.length === 0) {
            console.log('🎉 所有用户状态修复成功！');
        }
        else {
            console.warn(`⚠️  仍有 ${fixedUsers.length} 个用户状态异常`);
        }
    }
    catch (error) {
        console.error('❌ 修复用户状态失败:', error);
        throw error;
    }
    finally {
        await prisma.$disconnect();
    }
}
// 直接执行修复
if (require.main === module) {
    fixUserStatus()
        .then(() => {
        console.log('🏁 脚本执行完成');
        process.exit(0);
    })
        .catch((error) => {
        console.error('💥 脚本执行失败:', error);
        process.exit(1);
    });
}
export { fixUserStatus };
