/**
 * 邮箱变更通知邮件模板 - 发送到旧邮箱
 */

import React from 'react';
import { Text, Section } from '@react-email/components';
import { Layout, Button } from '../../components';

interface EmailChangeNotificationEmailProps {
  userName: string;
  oldEmail: string;
  newEmail: string;
  changeTime: string;
  userAgent?: string;
  ipAddress?: string;
  cancelUrl?: string;
}

export default function EmailChangeNotificationEmail({ 
  userName, 
  oldEmail,
  newEmail,
  changeTime,
  userAgent,
  ipAddress,
  cancelUrl = `${process.env.FRONTEND_URL || 'https://www.chattoeic.com'}/cancel-email-change`
}: EmailChangeNotificationEmailProps) {
  return (
    <Layout preview={`邮箱变更通知 - ${userName}`}>
      <Section>
        <Text className="text-2xl font-bold text-orange-600 mb-4 m-0">
          🔔 邮箱变更通知
        </Text>
        
        <Text className="text-gray-700 text-base leading-6 mb-4 m-0">
          亲爱的 <span className="font-semibold text-blue-600">{userName}</span>，
        </Text>
        
        <Text className="text-gray-700 text-base leading-6 mb-4 m-0">
          我们检测到有人正在尝试将您的ChatTOEIC账号邮箱从 
          <span className="font-mono bg-gray-100 px-2 py-1 rounded mx-1">{oldEmail}</span>
          更改为 
          <span className="font-mono bg-orange-100 px-2 py-1 rounded mx-1 text-orange-700">{newEmail}</span>
        </Text>
        
        <Section className="bg-orange-50 border border-orange-200 rounded p-4 mb-6">
          <Text className="text-orange-800 text-sm font-semibold m-0">
            📍 操作详情：
          </Text>
          <Text className="text-orange-700 text-sm mt-2 mb-1 m-0">
            • 操作时间：{changeTime}
          </Text>
          {ipAddress && (
            <Text className="text-orange-700 text-sm my-1 m-0">
              • 操作IP：{ipAddress}
            </Text>
          )}
          {userAgent && (
            <Text className="text-orange-700 text-sm mt-1 m-0">
              • 设备信息：{userAgent}
            </Text>
          )}
        </Section>
        
        <Text className="text-gray-700 text-base leading-6 mb-4 m-0">
          <strong>如果这是您本人操作：</strong>
        </Text>
        <Text className="text-gray-700 text-base leading-6 mb-6 m-0">
          请前往新邮箱 {newEmail} 查收确认邮件，并按照邮件中的指示完成邮箱变更。
        </Text>
        
        <Section className="bg-red-50 border-l-4 border-red-400 p-4 rounded mb-6">
          <Text className="text-red-800 text-sm font-semibold m-0">
            🚨 如果不是您本人操作：
          </Text>
          <Text className="text-red-700 text-sm mt-2 mb-1 m-0">
            • 您的账户可能存在安全风险
          </Text>
          <Text className="text-red-700 text-sm my-1 m-0">
            • 请立即点击下方按钮取消此次变更
          </Text>
          <Text className="text-red-700 text-sm my-1 m-0">
            • 建议立即更改您的密码
          </Text>
          <Text className="text-red-700 text-sm mt-1 m-0">
            • 联系我们进行安全检查
          </Text>
        </Section>
        
        <Section className="text-center mb-6">
          <Button href={cancelUrl} variant="secondary">
            取消邮箱变更
          </Button>
        </Section>
        
        <Section className="bg-blue-50 border border-blue-200 rounded p-4 mb-6">
          <Text className="text-blue-800 text-sm font-semibold m-0">
            🔐 安全建议：
          </Text>
          <Text className="text-blue-700 text-sm mt-2 mb-1 m-0">
            • 定期更换密码，确保密码强度
          </Text>
          <Text className="text-blue-700 text-sm my-1 m-0">
            • 不要在不安全的网络环境下登录
          </Text>
          <Text className="text-blue-700 text-sm my-1 m-0">
            • 开启双重验证保护（即将推出）
          </Text>
          <Text className="text-blue-700 text-sm mt-1 m-0">
            • 及时关注账户安全通知
          </Text>
        </Section>
        
        <Text className="text-gray-700 text-base leading-6 mb-4 m-0">
          如果您有任何疑问或需要帮助，请随时联系我们的支持团队。
        </Text>
        
        <Text className="text-gray-600 text-sm mt-6 m-0">
          邮箱变更请求将在15分钟后自动过期。如需取消，请及时点击上方按钮。
        </Text>
        
        <Text className="text-gray-600 text-sm mt-4 m-0">
          ChatTOEIC 安全团队<br />
          <a href="mailto:support@chattoeic.com" className="text-blue-600 underline">
            support@chattoeic.com
          </a>
        </Text>
      </Section>
    </Layout>
  );
}