/**
 * 系统维护通知邮件模板
 */

import React from 'react';
import { Text, Section } from '@react-email/components';
import { Layout, Button } from '../../components';

interface SystemMaintenanceEmailProps {
  userName: string;
  maintenanceType: 'scheduled' | 'emergency' | 'completed';
  startTime: string;
  endTime?: string;
  duration?: string;
  reason?: string;
  affectedServices?: string[];
  statusPageUrl?: string;
  supportEmail?: string;
}

const MaintenanceTypeConfig = {
  scheduled: {
    title: '🔧 系统维护通知',
    icon: '🔧',
    color: 'blue',
    description: '我们将进行计划中的系统维护'
  },
  emergency: {
    title: '⚡ 紧急维护通知',
    icon: '⚡',
    color: 'red',
    description: '由于技术问题，我们需要进行紧急维护'
  },
  completed: {
    title: '✅ 维护完成通知',
    icon: '✅',
    color: 'green',
    description: '系统维护已完成，所有服务已恢复正常'
  }
};

export default function SystemMaintenanceEmail({
  userName,
  maintenanceType,
  startTime,
  endTime,
  duration,
  reason,
  affectedServices = [],
  statusPageUrl = `${process.env.FRONTEND_URL || 'https://www.chattoeic.com'}/status`,
  supportEmail = 'support@chattoeic.com'
}: SystemMaintenanceEmailProps) {
  const config = MaintenanceTypeConfig[maintenanceType];
  
  return (
    <Layout preview={`${config.title} - ChatTOEIC`}>
      <Section>
        <Text className={`text-2xl font-bold text-${config.color}-600 mb-4 m-0`}>
          {config.title}
        </Text>
        
        <Text className="text-gray-700 text-base leading-6 mb-4 m-0">
          亲爱的 <span className="font-semibold text-blue-600">{userName}</span>，
        </Text>
        
        <Text className="text-gray-700 text-base leading-6 mb-4 m-0">
          {config.description}。我们对此可能造成的不便深表歉意。
        </Text>
        
        <Section className={`bg-${config.color}-50 border border-${config.color}-200 rounded p-4 mb-6`}>
          <Text className={`text-${config.color}-800 text-sm font-semibold m-0`}>
            {config.icon} 维护详情：
          </Text>
          <Text className={`text-${config.color}-700 text-sm mt-2 mb-1 m-0`}>
            • 开始时间：{startTime}
          </Text>
          {endTime && (
            <Text className={`text-${config.color}-700 text-sm my-1 m-0`}>
              • 结束时间：{endTime}
            </Text>
          )}
          {duration && (
            <Text className={`text-${config.color}-700 text-sm my-1 m-0`}>
              • 预计时长：{duration}
            </Text>
          )}
          {reason && (
            <Text className={`text-${config.color}-700 text-sm mt-1 m-0`}>
              • 维护原因：{reason}
            </Text>
          )}
        </Section>
        
        {affectedServices.length > 0 && (
          <Section className="bg-amber-50 border border-amber-200 rounded p-4 mb-6">
            <Text className="text-amber-800 text-sm font-semibold m-0">
              🔄 受影响的服务：
            </Text>
            {affectedServices.map((service, index) => (
              <Text key={index} className="text-amber-700 text-sm my-1 m-0">
                • {service}
              </Text>
            ))}
          </Section>
        )}
        
        {maintenanceType === 'scheduled' && (
          <>
            <Text className="text-gray-700 text-base leading-6 mb-4 m-0">
              <strong>维护期间：</strong>
            </Text>
            <Text className="text-gray-700 text-base leading-6 mb-4 m-0">
              • 您可能无法访问ChatTOEIC服务
            </Text>
            <Text className="text-gray-700 text-base leading-6 mb-4 m-0">
              • 学习进度和数据将被安全保存
            </Text>
            <Text className="text-gray-700 text-base leading-6 mb-6 m-0">
              • 维护完成后所有功能将立即恢复
            </Text>
          </>
        )}
        
        {maintenanceType === 'emergency' && (
          <>
            <Section className="bg-red-50 border-l-4 border-red-400 p-4 rounded mb-6">
              <Text className="text-red-800 text-sm font-semibold m-0">
                🚨 紧急维护通知：
              </Text>
              <Text className="text-red-700 text-sm mt-2 mb-1 m-0">
                • 我们正在处理一个影响服务稳定性的问题
              </Text>
              <Text className="text-red-700 text-sm my-1 m-0">
                • 维护期间部分或全部功能可能暂时不可用
              </Text>
              <Text className="text-red-700 text-sm my-1 m-0">
                • 我们正在努力尽快恢复正常服务
              </Text>
              <Text className="text-red-700 text-sm mt-1 m-0">
                • 您的学习数据不会受到影响
              </Text>
            </Section>
          </>
        )}
        
        {maintenanceType === 'completed' && (
          <>
            <Section className="bg-green-50 border border-green-200 rounded p-4 mb-6">
              <Text className="text-green-800 text-sm font-semibold m-0">
                🎉 维护完成：
              </Text>
              <Text className="text-green-700 text-sm mt-2 mb-1 m-0">
                • 所有系统已恢复正常运行
              </Text>
              <Text className="text-green-700 text-sm my-1 m-0">
                • 您现在可以正常使用ChatTOEIC的所有功能
              </Text>
              <Text className="text-green-700 text-sm my-1 m-0">
                • 您的学习数据和进度完全保持不变
              </Text>
              <Text className="text-green-700 text-sm mt-1 m-0">
                • 感谢您在维护期间的耐心等待
              </Text>
            </Section>
            
            <Section className="text-center mb-6">
              <Button href={process.env.FRONTEND_URL || 'https://www.chattoeic.com'}>
                继续学习
              </Button>
            </Section>
          </>
        )}
        
        {maintenanceType !== 'completed' && (
          <Section className="bg-blue-50 border border-blue-200 rounded p-4 mb-6">
            <Text className="text-blue-800 text-sm font-semibold m-0">
              📱 维护期间建议：
            </Text>
            <Text className="text-blue-700 text-sm mt-2 mb-1 m-0">
              • 保存当前的学习进度
            </Text>
            <Text className="text-blue-700 text-sm my-1 m-0">
              • 可以利用此时间复习之前的学习内容
            </Text>
            <Text className="text-blue-700 text-sm my-1 m-0">
              • 关注我们的状态页面获取最新更新
            </Text>
            <Text className="text-blue-700 text-sm mt-1 m-0">
              • 维护完成后会收到通知邮件
            </Text>
          </Section>
        )}
        
        <Text className="text-gray-700 text-base leading-6 mb-4 m-0">
          我们理解服务中断可能会给您的学习计划带来不便，我们正在努力提供更稳定和优质的服务。
        </Text>
        
        <Section className="text-center mb-6">
          <Button href={statusPageUrl} variant="secondary">
            查看系统状态
          </Button>
        </Section>
        
        <Section className="bg-gray-50 border border-gray-200 rounded p-4 mb-6">
          <Text className="text-gray-800 text-sm font-semibold m-0">
            💬 需要帮助？
          </Text>
          <Text className="text-gray-700 text-sm mt-2 mb-1 m-0">
            如果您在维护期间或之后遇到任何问题，请随时联系我们：
          </Text>
          <Text className="text-gray-700 text-sm my-1 m-0">
            📧 邮箱：{supportEmail}
          </Text>
          <Text className="text-gray-700 text-sm mt-1 m-0">
            🌐 状态页面：{statusPageUrl}
          </Text>
        </Section>
        
        <Text className="text-gray-600 text-sm mt-6 m-0">
          感谢您对ChatTOEIC的支持与理解！<br />
          ChatTOEIC 技术团队
        </Text>
        
        <Text className="text-gray-600 text-sm mt-4 m-0">
          此邮件由系统自动发送，请勿回复。如需联系我们，请使用上述联系方式。
        </Text>
      </Section>
    </Layout>
  );
}