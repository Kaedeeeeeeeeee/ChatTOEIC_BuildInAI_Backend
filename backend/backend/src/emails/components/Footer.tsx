/**
 * 邮件页脚组件 - 统一的联系方式和退订链接
 */

import React from 'react';
import { Section, Text, Link, Hr } from '@react-email/components';

export function Footer() {
  return (
    <Section className="px-8 py-6 bg-gray-50 rounded-b-lg">
      <Hr className="border-gray-200 my-4" />
      
      <Text className="text-gray-600 text-sm text-center m-0">
        这封邮件来自 <Link href="https://www.chattoeic.com" className="text-blue-600 no-underline">ChatTOEIC</Link>
      </Text>
      
      <Text className="text-gray-500 text-xs text-center mt-3 m-0">
        如果您不想再收到此类邮件，可以{' '}
        <Link href="{{unsubscribeUrl}}" className="text-gray-500 underline">
          取消订阅
        </Link>
        {' '}或联系我们：
        <Link href="mailto:support@chattoeic.com" className="text-gray-500 underline ml-1">
          support@chattoeic.com
        </Link>
      </Text>
      
      <Text className="text-gray-400 text-xs text-center mt-2 m-0">
        © 2024 ChatTOEIC. All rights reserved.
      </Text>
    </Section>
  );
}