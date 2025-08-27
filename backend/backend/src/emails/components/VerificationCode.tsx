/**
 * 验证码展示组件
 */

import React from 'react';
import { Section, Text } from '@react-email/components';

interface VerificationCodeProps {
  code: string;
  expiresInMinutes?: number;
}

export function VerificationCode({ code, expiresInMinutes = 10 }: VerificationCodeProps) {
  return (
    <Section className="text-center py-8">
      <Text className="text-gray-700 text-lg mb-4 m-0">
        您的验证码是：
      </Text>
      
      <Section className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg py-6 px-4 inline-block">
        <Text className="text-4xl font-mono font-bold text-blue-600 tracking-widest m-0">
          {code}
        </Text>
      </Section>
      
      <Text className="text-gray-500 text-sm mt-4 m-0">
        验证码有效期为 {expiresInMinutes} 分钟，请及时使用
      </Text>
      
      <Text className="text-gray-400 text-xs mt-2 m-0">
        如果不是您本人操作，请忽略此邮件
      </Text>
    </Section>
  );
}