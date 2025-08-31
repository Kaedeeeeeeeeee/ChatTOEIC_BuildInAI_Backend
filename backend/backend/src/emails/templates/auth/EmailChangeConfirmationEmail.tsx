/**
 * 邮箱变更确认邮件模板 - 发送到新邮箱
 */

import React from 'react';
import { Text, Section } from '@react-email/components';
import { Layout, VerificationCode, Button } from '../../components';

interface EmailChangeConfirmationEmailProps {
  userName: string;
  oldEmail: string;
  newEmail: string;
  verificationCode: string;
  confirmUrl?: string;
  expiresInMinutes?: number;
}

export default function EmailChangeConfirmationEmail({ 
  userName, 
  oldEmail,
  newEmail,
  verificationCode,
  confirmUrl = `${process.env.FRONTEND_URL || 'https://www.chattoeic.com'}/confirm-email-change?code=${verificationCode}&newEmail=${encodeURIComponent(newEmail)}`,
  expiresInMinutes = 15
}: EmailChangeConfirmationEmailProps) {
  return (
    <Layout preview={`确认您的新邮箱地址 - ${userName}`}>
      <Section>
        <Text className="text-2xl font-bold text-blue-600 mb-4 m-0">
          📧 确认您的新邮箱地址
        </Text>
        
        <Text className="text-gray-700 text-base leading-6 mb-4 m-0">
          亲爱的 <span className="font-semibold text-blue-600">{userName}</span>，
        </Text>
        
        <Text className="text-gray-700 text-base leading-6 mb-4 m-0">
          您正在将ChatTOEIC账号的邮箱地址从 <span className="font-mono bg-gray-100 px-2 py-1 rounded">{oldEmail}</span> 
          更改为 <span className="font-mono bg-blue-100 px-2 py-1 rounded text-blue-700">{newEmail}</span>
        </Text>
        
        <Text className="text-gray-700 text-base leading-6 mb-4 m-0">
          请使用以下验证码来确认这个新邮箱地址属于您：
        </Text>
        
        <VerificationCode code={verificationCode} expiresInMinutes={expiresInMinutes} />
        
        <Text className="text-gray-700 text-base leading-6 mb-6 m-0">
          您也可以点击下方按钮直接完成验证：
        </Text>
        
        <Section className="text-center mb-6">
          <Button href={confirmUrl}>
            确认邮箱变更
          </Button>
        </Section>
        
        <Section className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded mb-6">
          <Text className="text-amber-800 text-sm font-semibold m-0">
            ⚠️ 重要提醒：
          </Text>
          <Text className="text-amber-700 text-sm mt-2 mb-1 m-0">
            • 确认后，您将使用新邮箱 {newEmail} 登录
          </Text>
          <Text className="text-amber-700 text-sm my-1 m-0">
            • 旧邮箱 {oldEmail} 将不再能用于登录
          </Text>
          <Text className="text-amber-700 text-sm my-1 m-0">
            • 所有邮件通知将发送到新邮箱
          </Text>
          <Text className="text-amber-700 text-sm mt-1 m-0">
            • 此操作完成后无法撤销
          </Text>
        </Section>
        
        <Section className="bg-blue-50 border border-blue-200 rounded p-4 mb-6">
          <Text className="text-blue-800 text-sm font-semibold m-0">
            🔐 安全提示：
          </Text>
          <Text className="text-blue-700 text-sm mt-2 mb-1 m-0">
            • 验证码将在 {expiresInMinutes} 分钟后失效
          </Text>
          <Text className="text-blue-700 text-sm my-1 m-0">
            • 请不要将验证码分享给他人
          </Text>
          <Text className="text-blue-700 text-sm my-1 m-0">
            • 如果不是您本人操作，请立即联系我们
          </Text>
          <Text className="text-blue-700 text-sm mt-1 m-0">
            • 建议使用安全的邮箱地址
          </Text>
        </Section>
        
        <Text className="text-gray-600 text-sm mt-6 m-0">
          如果您没有申请更改邮箱地址，请忽略此邮件。您的账户信息不会被更改。
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