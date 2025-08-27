/**
 * 邮箱验证邮件模板
 */

import React from 'react';
import { Text, Section } from '@react-email/components';
import { Layout, VerificationCode, Button } from '../../components';

interface VerificationEmailProps {
  userName: string;
  verificationCode: string;
  verificationUrl?: string;
}

export default function VerificationEmail({ 
  userName, 
  verificationCode,
  verificationUrl = `https://www.chattoeic.com/verify?code=${verificationCode}`
}: VerificationEmailProps) {
  return (
    <Layout preview={`验证您的ChatTOEIC账号 - 验证码：${verificationCode}`}>
      <Section>
        <Text className="text-2xl font-bold text-gray-800 mb-4 m-0">
          🎉 欢迎加入ChatTOEIC！
        </Text>
        
        <Text className="text-gray-700 text-base leading-6 mb-4 m-0">
          亲爱的 <span className="font-semibold text-blue-600">{userName}</span>，
        </Text>
        
        <Text className="text-gray-700 text-base leading-6 mb-4 m-0">
          感谢您注册ChatTOEIC！为了确保您的账户安全，请使用以下验证码完成邮箱验证：
        </Text>
        
        <VerificationCode code={verificationCode} expiresInMinutes={10} />
        
        <Text className="text-gray-700 text-base leading-6 mb-6 m-0">
          您也可以点击下方按钮直接完成验证：
        </Text>
        
        <Section className="text-center mb-6">
          <Button href={verificationUrl}>
            立即验证账号
          </Button>
        </Section>
        
        <Section className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
          <Text className="text-blue-800 text-sm m-0">
            <strong>温馨提示：</strong>
            验证完成后，您将可以：
          </Text>
          <Text className="text-blue-700 text-sm mt-2 mb-1 ml-4 m-0">
            • 🧠 享受AI驱动的个性化TOEIC练习
          </Text>
          <Text className="text-blue-700 text-sm my-1 ml-4 m-0">
            • 📊 获得详细的学习分析和进步报告
          </Text>
          <Text className="text-blue-700 text-sm my-1 ml-4 m-0">
            • 📚 构建专属的智能词汇库
          </Text>
          <Text className="text-blue-700 text-sm mt-1 ml-4 m-0">
            • 🎯 制定科学的学习计划
          </Text>
        </Section>
        
        <Text className="text-gray-600 text-sm mt-6 m-0">
          如果您没有注册ChatTOEIC账号，请忽略此邮件。
        </Text>
      </Section>
    </Layout>
  );
}