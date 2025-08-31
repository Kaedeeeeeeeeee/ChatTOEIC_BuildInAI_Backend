/**
 * 安全警报邮件模板
 */

import React from 'react';
import { Text, Section } from '@react-email/components';
import { Layout, Button } from '../../components';

interface SecurityAlertEmailProps {
  userName: string;
  alertType: 'login' | 'password_change' | 'email_change' | 'suspicious_activity';
  alertTime: string;
  location?: string;
  ipAddress?: string;
  userAgent?: string;
  actionUrl?: string;
  supportEmail?: string;
}

const AlertTypeConfig = {
  login: {
    title: '🔐 新设备登录通知',
    icon: '🔐',
    color: 'blue',
    description: '检测到您的账户从新设备登录'
  },
  password_change: {
    title: '🔑 密码变更通知',
    icon: '🔑',
    color: 'green',
    description: '您的账户密码已成功变更'
  },
  email_change: {
    title: '📧 邮箱变更通知',
    icon: '📧',
    color: 'orange',
    description: '您的账户邮箱地址已成功变更'
  },
  suspicious_activity: {
    title: '⚠️ 可疑活动警报',
    icon: '⚠️',
    color: 'red',
    description: '检测到您的账户存在可疑活动'
  }
};

export default function SecurityAlertEmail({
  userName,
  alertType,
  alertTime,
  location,
  ipAddress,
  userAgent,
  actionUrl = `${process.env.FRONTEND_URL || 'https://www.chattoeic.com'}/account/security`,
  supportEmail = 'support@chattoeic.com'
}: SecurityAlertEmailProps) {
  const config = AlertTypeConfig[alertType];
  
  return (
    <Layout preview={`${config.title} - ${userName}`}>
      <Section>
        <Text className={`text-2xl font-bold text-${config.color}-600 mb-4 m-0`}>
          {config.title}
        </Text>
        
        <Text className="text-gray-700 text-base leading-6 mb-4 m-0">
          亲爱的 <span className="font-semibold text-blue-600">{userName}</span>，
        </Text>
        
        <Text className="text-gray-700 text-base leading-6 mb-4 m-0">
          {config.description}。为了确保您的账户安全，我们向您发送此通知邮件。
        </Text>
        
        <Section className={`bg-${config.color}-50 border border-${config.color}-200 rounded p-4 mb-6`}>
          <Text className={`text-${config.color}-800 text-sm font-semibold m-0`}>
            {config.icon} 活动详情：
          </Text>
          <Text className={`text-${config.color}-700 text-sm mt-2 mb-1 m-0`}>
            • 时间：{alertTime}
          </Text>
          {location && (
            <Text className={`text-${config.color}-700 text-sm my-1 m-0`}>
              • 位置：{location}
            </Text>
          )}
          {ipAddress && (
            <Text className={`text-${config.color}-700 text-sm my-1 m-0`}>
              • IP地址：{ipAddress}
            </Text>
          )}
          {userAgent && (
            <Text className={`text-${config.color}-700 text-sm mt-1 m-0`}>
              • 设备信息：{userAgent}
            </Text>
          )}
        </Section>
        
        {alertType === 'login' && (
          <>
            <Text className="text-gray-700 text-base leading-6 mb-4 m-0">
              <strong>如果这是您本人的操作：</strong>
            </Text>
            <Text className="text-gray-700 text-base leading-6 mb-6 m-0">
              您可以忽略此邮件，无需任何操作。
            </Text>
          </>
        )}
        
        {(alertType === 'password_change' || alertType === 'email_change') && (
          <>
            <Text className="text-gray-700 text-base leading-6 mb-4 m-0">
              <strong>如果这是您本人的操作：</strong>
            </Text>
            <Text className="text-gray-700 text-base leading-6 mb-6 m-0">
              恭喜！您的操作已成功完成。
            </Text>
          </>
        )}
        
        <Section className="bg-red-50 border-l-4 border-red-400 p-4 rounded mb-6">
          <Text className="text-red-800 text-sm font-semibold m-0">
            🚨 如果不是您本人操作：
          </Text>
          <Text className="text-red-700 text-sm mt-2 mb-1 m-0">
            • 您的账户可能已被他人访问
          </Text>
          <Text className="text-red-700 text-sm my-1 m-0">
            • 请立即更改您的密码
          </Text>
          <Text className="text-red-700 text-sm my-1 m-0">
            • 启用两步验证（如可用）
          </Text>
          <Text className="text-red-700 text-sm mt-1 m-0">
            • 立即联系我们的安全团队
          </Text>
        </Section>
        
        <Section className="text-center mb-6">
          <Button href={actionUrl}>
            查看账户安全设置
          </Button>
        </Section>
        
        <Section className="bg-blue-50 border border-blue-200 rounded p-4 mb-6">
          <Text className="text-blue-800 text-sm font-semibold m-0">
            🔐 安全建议：
          </Text>
          <Text className="text-blue-700 text-sm mt-2 mb-1 m-0">
            • 使用强密码，包含字母、数字和特殊字符
          </Text>
          <Text className="text-blue-700 text-sm my-1 m-0">
            • 定期更换密码，建议每3-6个月
          </Text>
          <Text className="text-blue-700 text-sm my-1 m-0">
            • 不要在不同网站使用相同密码
          </Text>
          <Text className="text-blue-700 text-sm my-1 m-0">
            • 注意识别钓鱼邮件和虚假网站
          </Text>
          <Text className="text-blue-700 text-sm mt-1 m-0">
            • 在公共网络下谨慎登录
          </Text>
        </Section>
        
        {alertType === 'suspicious_activity' && (
          <Section className="bg-amber-50 border border-amber-200 rounded p-4 mb-6">
            <Text className="text-amber-800 text-sm font-semibold m-0">
              ⚡ 立即行动：
            </Text>
            <Text className="text-amber-700 text-sm mt-2 mb-1 m-0">
              • 立即更改密码
            </Text>
            <Text className="text-amber-700 text-sm my-1 m-0">
              • 检查账户活动记录
            </Text>
            <Text className="text-amber-700 text-sm my-1 m-0">
              • 联系我们进行账户安全审查
            </Text>
            <Text className="text-amber-700 text-sm mt-1 m-0">
              • 考虑启用额外的安全措施
            </Text>
          </Section>
        )}
        
        <Text className="text-gray-700 text-base leading-6 mb-4 m-0">
          如果您对此通知有任何疑问，或需要帮助保护您的账户，请随时联系我们的支持团队。
        </Text>
        
        <Text className="text-gray-600 text-sm mt-6 m-0">
          此邮件由系统自动发送，请勿回复。<br />
          ChatTOEIC 安全团队
        </Text>
        
        <Text className="text-gray-600 text-sm mt-4 m-0">
          需要帮助？请联系：
          <a href={`mailto:${supportEmail}`} className="text-blue-600 underline ml-1">
            {supportEmail}
          </a>
        </Text>
      </Section>
    </Layout>
  );
}