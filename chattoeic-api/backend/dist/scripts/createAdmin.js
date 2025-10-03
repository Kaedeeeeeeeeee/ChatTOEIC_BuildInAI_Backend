#!/usr/bin/env node
/**
 * 管理员账户创建脚本
 * 用于创建具有ADMIN权限的管理员账户
 */
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import readline from 'readline/promises';
const prisma = new PrismaClient();
// 创建命令行输入接口
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
async function createAdminUser() {
    try {
        console.log('🔐 ChatTOEIC 管理员账户创建工具');
        console.log('=====================================\n');
        // 获取管理员信息
        const email = await rl.question('请输入管理员邮箱: ');
        const name = await rl.question('请输入管理员姓名: ');
        const password = await rl.question('请输入管理员密码 (最少8位): ');
        // 验证输入
        if (!email || !email.includes('@')) {
            throw new Error('请输入有效的邮箱地址');
        }
        if (!name || name.trim().length < 2) {
            throw new Error('姓名至少需要2个字符');
        }
        if (!password || password.length < 8) {
            throw new Error('密码至少需要8个字符');
        }
        // 检查邮箱是否已存在
        const existingUser = await prisma.user.findUnique({
            where: { email }
        });
        if (existingUser) {
            // 如果用户已存在，询问是否要升级为管理员
            if (existingUser.role === 'ADMIN') {
                console.log('⚠️  该用户已经是管理员');
                return;
            }
            const upgrade = await rl.question('该邮箱已存在，是否要将其升级为管理员? (y/N): ');
            if (upgrade.toLowerCase() === 'y' || upgrade.toLowerCase() === 'yes') {
                // 升级为管理员
                const updatedUser = await prisma.user.update({
                    where: { email },
                    data: {
                        role: 'ADMIN',
                        name: name // 更新姓名
                    },
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        role: true,
                        createdAt: true
                    }
                });
                console.log('\n✅ 用户已成功升级为管理员!');
                console.log('管理员信息:');
                console.log(`- ID: ${updatedUser.id}`);
                console.log(`- 邮箱: ${updatedUser.email}`);
                console.log(`- 姓名: ${updatedUser.name}`);
                console.log(`- 角色: ${updatedUser.role}`);
                console.log(`- 创建时间: ${updatedUser.createdAt}`);
            }
            else {
                console.log('操作已取消');
            }
            return;
        }
        // 加密密码
        console.log('\n🔄 正在创建管理员账户...');
        const hashedPassword = await bcrypt.hash(password, 12);
        // 创建管理员用户
        const adminUser = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                role: 'ADMIN',
                emailVerified: true, // 管理员账户直接验证
                settings: {
                    preferredLanguage: 'zh',
                    theme: 'light',
                    notifications: true
                }
            },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                createdAt: true
            }
        });
        console.log('\n✅ 管理员账户创建成功!');
        console.log('=====================================');
        console.log('管理员信息:');
        console.log(`- ID: ${adminUser.id}`);
        console.log(`- 邮箱: ${adminUser.email}`);
        console.log(`- 姓名: ${adminUser.name}`);
        console.log(`- 角色: ${adminUser.role}`);
        console.log(`- 创建时间: ${adminUser.createdAt}`);
        console.log('\n🎯 您现在可以使用此账户登录管理员Dashboard:');
        console.log(`   邮箱: ${adminUser.email}`);
        console.log(`   密码: [您设置的密码]`);
        console.log('\n🔗 管理员Dashboard地址:');
        console.log('   开发环境: http://localhost:5173');
        console.log('   生产环境: [您的Vercel部署地址]');
    }
    catch (error) {
        console.error('\n❌ 创建管理员失败:', error.message);
        process.exit(1);
    }
    finally {
        await prisma.$disconnect();
        rl.close();
    }
}
// 处理用户中断
process.on('SIGINT', async () => {
    console.log('\n\n操作已取消');
    await prisma.$disconnect();
    rl.close();
    process.exit(0);
});
// 主程序入口
async function main() {
    try {
        // 测试数据库连接
        await prisma.$connect();
        console.log('✅ 数据库连接成功\n');
        await createAdminUser();
    }
    catch (error) {
        console.error('❌ 数据库连接失败:', error.message);
        console.log('\n请检查:');
        console.log('1. DATABASE_URL 环境变量是否正确设置');
        console.log('2. 数据库服务是否正在运行');
        console.log('3. 网络连接是否正常');
        process.exit(1);
    }
}
// 如果直接运行此脚本
if (require.main === module) {
    main();
}
export { createAdminUser };
