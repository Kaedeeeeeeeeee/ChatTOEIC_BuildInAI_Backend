/**
 * 邮箱变更成功确认邮件模板 - 发送到新邮箱
 */

import React from 'react';
import { Text, Section } from '@react-email/components';
import { Layout, Button } from '../../components';

interface EmailChangeSuccessEmailProps {
  userName: string;
  oldEmail: string;
  newEmail: string;
  changeTime: string;
  loginUrl?: string;
  userAgent?: string;
  ipAddress?: string;
}

export default function EmailChangeSuccessEmail({ 
  userName, 
  oldEmail,
  newEmail,
  changeTime,
  loginUrl = `${process.env.FRONTEND_URL || 'https://www.chattoeic.com'}/login`,
  userAgent,
  ipAddress
}: EmailChangeSuccessEmailProps) {
  return (
    <Layout preview={`邮箱变更成功 - ${userName}`}>
      <Section>
        <Text className="text-2xl font-bold text-green-600 mb-4 m-0">
          ✅ 邮箱变更成功
        </Text>
        
        <Text className="text-gray-700 text-base leading-6 mb-4 m-0">
          亲爱的 <span className="font-semibold text-blue-600">{userName}</span>，
        </Text>
        
        <Text className="text-gray-700 text-base leading-6 mb-4 m-0">
          恭喜！您的ChatTOEIC账号邮箱地址已成功从 
          <span className="font-mono bg-gray-100 px-2 py-1 rounded mx-1">{oldEmail}</span>
          更改为 
          <span className="font-mono bg-green-100 px-2 py-1 rounded mx-1 text-green-700">{newEmail}</span>
        </Text>
        
        <Section className="bg-green-50 border border-green-200 rounded p-4 mb-6">
          <Text className="text-green-800 text-sm font-semibold m-0">
            🎉 变更详情：
          </Text>
          <Text className="text-green-700 text-sm mt-2 mb-1 m-0">
            • 变更时间：{changeTime}
          </Text>
          <Text className="text-green-700 text-sm my-1 m-0">
            • 新邮箱：{newEmail}
          </Text>
          <Text className="text-green-700 text-sm my-1 m-0">
            • 旧邮箱：{oldEmail}（已失效）
          </Text>
          {ipAddress && (
            <Text className="text-green-700 text-sm my-1 m-0">
              • 操作IP：{ipAddress}
            </Text>
          )}
          {userAgent && (
            <Text className="text-green-700 text-sm mt-1 m-0">
              • 设备信息：{userAgent}
            </Text>
          )}
        </Section>
        
        <Text className="text-gray-700 text-base leading-6 mb-6 m-0">
          从现在开始，您需要使用新邮箱地址 <strong>{newEmail}</strong> 来登录您的ChatTOEIC账号。
        </Text>
        
        <Section className="text-center mb-6">
          <Button href={loginUrl}>
            立即登录
          </Button>
        </Section>
        
        <Section className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded mb-6">
          <Text className="text-blue-800 text-sm font-semibold m-0">
            📝 重要变更：
          </Text>
          <Text className="text-blue-700 text-sm mt-2 mb-1 m-0">
            • 登录邮箱：现在使用 {newEmail}
          </Text>
          <Text className="text-blue-700 text-sm my-1 m-0">
            • 邮件通知：将发送到新邮箱地址
          </Text>
          <Text className="text-blue-700 text-sm my-1 m-0">
            • 账户恢复：使用新邮箱进行密码重置
          </Text>
          <Text className="text-blue-700 text-sm mt-1 m-0">
            • 旧邮箱：{oldEmail} 不再与此账号关联
          </Text>
        </Section>
        
        <Section className="bg-amber-50 border border-amber-200 rounded p-4 mb-6">
          <Text className="text-amber-800 text-sm font-semibold m-0">
            🔐 安全提醒：
          </Text>
          <Text className="text-amber-700 text-sm mt-2 mb-1 m-0">
            • 请确保新邮箱账号的安全性
          </Text>
          <Text className="text-amber-700 text-sm my-1 m-0">
            • 定期检查账户活动记录
          </Text>
          <Text className="text-amber-700 text-sm my-1 m-0">
            • 如发现异常活动，立即联系我们
          </Text>
          <Text className="text-amber-700 text-sm mt-1 m-0">
            • 建议使用强密码保护邮箱账号
          </Text>
        </Section>
        
        <Section className="bg-red-50 border border-red-200 rounded p-4 mb-6">
          <Text className="text-red-800 text-sm font-semibold m-0">
            ⚠️ 如果不是您本人操作：
          </Text>
          <Text className="text-red-700 text-sm mt-2 mb-1 m-0">
            • 立即联系我们：support@chattoeic.com
          </Text>
          <Text className="text-red-700 text-sm my-1 m-0">
            • 我们将协助您恢复账户安全
          </Text>
          <Text className="text-red-700 text-sm mt-1 m-0">
            • 建议立即更改密码并启用额外安全措施
          </Text>
        </Section>
        
        <Text className="text-gray-700 text-base leading-6 mb-4 m-0">
          感谢您继续使用ChatTOEIC！如果您在使用过程中遇到任何问题，我们随时为您提供帮助。
        </Text>
        
        <Text className="text-gray-600 text-sm mt-6 m-0">
          祝您学习愉快！<br />
          ChatTOEIC 团队
        </Text>
        
        <Text className="text-gray-600 text-sm mt-4 m-0">
          有任何问题，请联系我们：
          <a href="mailto:support@chattoeic.com" className="text-blue-600 underline ml-1">
            support@chattoeic.com
          </a>
        </Text>
      </Section>
    </Layout>
  );
}