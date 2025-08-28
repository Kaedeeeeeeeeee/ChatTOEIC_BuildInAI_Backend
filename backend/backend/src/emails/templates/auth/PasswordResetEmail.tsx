/**
 * 密码重置邮件模板
 */

import React from 'react';
import { Text, Section } from '@react-email/components';
import { Layout, Button } from '../../components';

interface PasswordResetEmailProps {
  userName: string;
  resetToken: string;
  resetUrl?: string;
  expiresInHours?: number;
}

export default function PasswordResetEmail({ 
  userName, 
  resetToken,
  resetUrl = `${process.env.FRONTEND_URL || 'https://www.chattoeic.com'}/reset-password?token=${resetToken}`,
  expiresInHours = 1
}: PasswordResetEmailProps) {
  return (
    <Layout preview={`重置您的ChatTOEIC密码 - ${userName}`}>
      <Section>
        <Text className="text-2xl font-bold text-gray-800 mb-4 m-0">
          🔐 重置您的密码
        </Text>
        
        <Text className="text-gray-700 text-base leading-6 mb-4 m-0">
          亲爱的 <span className="font-semibold text-blue-600">{userName}</span>，
        </Text>
        
        <Text className="text-gray-700 text-base leading-6 mb-4 m-0">
          我们收到了您重置ChatTOEIC账号密码的请求。请点击下方按钮来设置新密码：
        </Text>
        
        <Section className="text-center my-8">
          <Button href={resetUrl}>
            重置密码
          </Button>
        </Section>
        
        <Text className="text-gray-700 text-base leading-6 mb-4 m-0">
          如果按钮无法点击，请复制以下链接到浏览器地址栏：
        </Text>
        
        <Section className="bg-gray-100 border border-gray-200 rounded p-3 mb-6">
          <Text className="text-sm text-gray-600 break-all m-0 font-mono">
            {resetUrl}
          </Text>
        </Section>
        
        <Section className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded mb-6">
          <Text className="text-yellow-800 text-sm font-semibold m-0">
            ⚠️ 重要安全提醒：
          </Text>
          <Text className="text-yellow-700 text-sm mt-2 mb-1 m-0">
            • 此重置链接将在 {expiresInHours} 小时后失效
          </Text>
          <Text className="text-yellow-700 text-sm my-1 m-0">
            • 使用后链接将立即失效
          </Text>
          <Text className="text-yellow-700 text-sm my-1 m-0">
            • 请不要将此链接分享给他人
          </Text>
          <Text className="text-yellow-700 text-sm mt-1 m-0">
            • 如果不是您本人操作，请立即联系我们
          </Text>
        </Section>
        
        <Section className="bg-blue-50 border border-blue-200 rounded p-4 mb-6">
          <Text className="text-blue-800 text-sm font-semibold m-0">
            💡 密码安全建议：
          </Text>
          <Text className="text-blue-700 text-sm mt-2 mb-1 m-0">
            • 使用至少8位字符，包含字母、数字和特殊符号
          </Text>
          <Text className="text-blue-700 text-sm my-1 m-0">
            • 不要使用与其他网站相同的密码
          </Text>
          <Text className="text-blue-700 text-sm mt-1 m-0">
            • 定期更换密码，保护账户安全
          </Text>
        </Section>
        
        <Text className="text-gray-600 text-sm mt-6 m-0">
          如果您没有申请密码重置，请忽略此邮件。您的密码不会被更改。
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