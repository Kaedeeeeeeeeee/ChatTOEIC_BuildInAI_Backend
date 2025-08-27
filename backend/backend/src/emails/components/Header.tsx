/**
 * 邮件头部组件 - ChatTOEIC品牌标识
 */

import React from 'react';
import { Section, Text, Link } from '@react-email/components';

export function Header() {
  return (
    <Section className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6 rounded-t-lg">
      <Link 
        href="https://www.chattoeic.com"
        className="text-white text-2xl font-bold tracking-wide no-underline"
      >
        📚 ChatTOEIC
      </Link>
      <Text className="text-blue-100 text-sm mt-1 m-0">
        AI驱动的智能TOEIC学习平台
      </Text>
    </Section>
  );
}