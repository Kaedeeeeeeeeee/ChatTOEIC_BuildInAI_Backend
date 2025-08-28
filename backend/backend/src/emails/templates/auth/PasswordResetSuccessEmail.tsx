/**
 * 密码重置成功确认邮件模板
 */

import React from 'react';
import { Text, Section } from '@react-email/components';
import { Layout, Button } from '../../components';

interface PasswordResetSuccessEmailProps {
  userName: string;
  resetTime: string;
  loginUrl?: string;
  userAgent?: string;
  ipAddress?: string;
}

export default function PasswordResetSuccessEmail({ 
  userName, 
  resetTime,
  loginUrl = `${process.env.FRONTEND_URL || 'https://www.chattoeic.com'}/login`,
  userAgent,
  ipAddress
}: PasswordResetSuccessEmailProps) {
  return (
    <Layout preview={`密码重置成功 - ${userName}`}>
      <Section>
        <Text className="text-2xl font-bold text-green-600 mb-4 m-0">
          ✅ 密码重置成功
        </Text>
        
        <Text className="text-gray-700 text-base leading-6 mb-4 m-0">
          亲爱的 <span className="font-semibold text-blue-600">{userName}</span>，
        </Text>
        
        <Text className="text-gray-700 text-base leading-6 mb-4 m-0">
          您的ChatTOEIC账号密码已成功重置。现在您可以使用新密码登录账户了。
        </Text>
        
        <Section className="bg-green-50 border border-green-200 rounded p-4 mb-6">
          <Text className="text-green-800 text-sm font-semibold m-0">
            🎉 重置详情：
          </Text>
          <Text className="text-green-700 text-sm mt-2 mb-1 m-0">
            • 重置时间：{resetTime}
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
        
        <Section className="text-center my-8">
          <Button href={loginUrl}>
            立即登录
          </Button>
        </Section>
        
        <Section className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded mb-6">
          <Text className="text-blue-800 text-sm font-semibold m-0">
            🔐 账户安全提醒：
          </Text>
          <Text className="text-blue-700 text-sm mt-2 mb-1 m-0">
            • 请妥善保管您的新密码
          </Text>
          <Text className="text-blue-700 text-sm my-1 m-0">
            • 不要与他人分享登录信息
          </Text>
          <Text className="text-blue-700 text-sm my-1 m-0">
            • 定期检查账户活动记录
          </Text>
          <Text className="text-blue-700 text-sm mt-1 m-0">
            • 如发现异常活动，请立即联系我们
          </Text>
        </Section>
        
        <Section className="bg-red-50 border border-red-200 rounded p-4 mb-6">
          <Text className="text-red-800 text-sm font-semibold m-0">
            ⚠️ 如果不是您本人操作：
          </Text>
          <Text className="text-red-700 text-sm mt-2 mb-1 m-0">
            • 请立即联系我们：support@chattoeic.com
          </Text>
          <Text className="text-red-700 text-sm my-1 m-0">
            • 我们将协助您保护账户安全
          </Text>
          <Text className="text-red-700 text-sm mt-1 m-0">
            • 建议启用双重验证保护
          </Text>
        </Section>
        
        <Text className="text-gray-700 text-base leading-6 mb-4 m-0">
          感谢您继续使用ChatTOEIC！祝您学习愉快！
        </Text>
        
        <Text className="text-gray-600 text-sm mt-6 m-0">
          有任何问题，请随时联系我们：
          <a href="mailto:support@chattoeic.com" className="text-blue-600 underline ml-1">
            support@chattoeic.com
          </a>
        </Text>
      </Section>
    </Layout>
  );
}