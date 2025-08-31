/**
 * 功能发布公告邮件模板
 */

import React from 'react';
import { Text, Section, Hr } from '@react-email/components';
import { Layout, Button } from '../../components';

interface Feature {
  name: string;
  description: string;
  icon?: string;
  benefits: string[];
}

interface FeatureAnnouncementEmailProps {
  userName: string;
  announcementType: 'new_feature' | 'major_update' | 'beta_release';
  title: string;
  releaseDate: string;
  features: Feature[];
  ctaText?: string;
  ctaUrl?: string;
  videoUrl?: string;
  blogUrl?: string;
  feedbackUrl?: string;
}

const AnnouncementTypeConfig = {
  new_feature: {
    title: '🚀 全新功能发布',
    icon: '🚀',
    color: 'blue',
    description: '我们很高兴为您带来全新的学习功能'
  },
  major_update: {
    title: '⚡ 重大更新发布',
    icon: '⚡',
    color: 'green',
    description: 'ChatTOEIC迎来了重大升级'
  },
  beta_release: {
    title: '🧪 Beta测试邀请',
    icon: '🧪',
    color: 'purple',
    description: '邀请您体验我们的最新Beta功能'
  }
};

export default function FeatureAnnouncementEmail({
  userName,
  announcementType,
  title,
  releaseDate,
  features,
  ctaText = '立即体验',
  ctaUrl = `${process.env.FRONTEND_URL || 'https://www.chattoeic.com'}`,
  videoUrl,
  blogUrl,
  feedbackUrl = `${process.env.FRONTEND_URL || 'https://www.chattoeic.com'}/feedback`
}: FeatureAnnouncementEmailProps) {
  const config = AnnouncementTypeConfig[announcementType];
  
  return (
    <Layout preview={`${config.title}: ${title} - ChatTOEIC`}>
      <Section>
        <Text className={`text-2xl font-bold text-${config.color}-600 mb-4 m-0`}>
          {config.title}
        </Text>
        
        <Text className="text-gray-700 text-base leading-6 mb-4 m-0">
          亲爱的 <span className="font-semibold text-blue-600">{userName}</span>，
        </Text>
        
        <Text className="text-gray-700 text-base leading-6 mb-6 m-0">
          {config.description}！{title}已于{releaseDate}正式发布。
        </Text>
        
        {/* 主要功能展示 */}
        <Section className={`bg-gradient-to-r from-${config.color}-50 to-${config.color}-100 border border-${config.color}-200 rounded-lg p-6 mb-6`}>
          <Text className={`text-${config.color}-800 text-xl font-bold mb-4 m-0 text-center`}>
            {config.icon} {title}
          </Text>
          
          {features.map((feature, index) => (
            <div key={index} className="mb-6">
              <Text className={`text-${config.color}-800 text-lg font-semibold mb-2 m-0`}>
                {feature.icon ? `${feature.icon} ` : '✨ '}{feature.name}
              </Text>
              <Text className="text-gray-700 text-base mb-3 m-0">
                {feature.description}
              </Text>
              
              {feature.benefits.length > 0 && (
                <Section className={`bg-white border border-${config.color}-100 rounded p-3 ml-4`}>
                  <Text className={`text-${config.color}-700 text-sm font-medium mb-2 m-0`}>
                    💡 为您带来的价值：
                  </Text>
                  {feature.benefits.map((benefit, benefitIndex) => (
                    <Text key={benefitIndex} className={`text-${config.color}-600 text-sm my-1 m-0`}>
                      • {benefit}
                    </Text>
                  ))}
                </Section>
              )}
              
              {index < features.length - 1 && <Hr className="my-4 border-gray-200" />}
            </div>
          ))}
        </Section>
        
        {/* 如何使用 */}
        <Section className="bg-blue-50 border border-blue-200 rounded p-4 mb-6">
          <Text className="text-blue-800 text-lg font-semibold mb-3 m-0">
            🎯 如何开始使用？
          </Text>
          <Text className="text-blue-700 text-sm mb-2 m-0">
            1. 点击下方按钮登录您的ChatTOEIC账户
          </Text>
          <Text className="text-blue-700 text-sm mb-2 m-0">
            2. 在导航菜单中找到新功能入口
          </Text>
          <Text className="text-blue-700 text-sm mb-2 m-0">
            3. 按照引导提示开始体验新功能
          </Text>
          <Text className="text-blue-700 text-sm mb-2 m-0">
            4. 有问题随时联系我们的支持团队
          </Text>
        </Section>
        
        {/* Beta版本特殊提示 */}
        {announcementType === 'beta_release' && (
          <Section className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded mb-6">
            <Text className="text-yellow-800 text-sm font-semibold m-0">
              🧪 Beta测试注意事项：
            </Text>
            <Text className="text-yellow-700 text-sm mt-2 mb-1 m-0">
              • 这是测试版本，可能存在一些小问题
            </Text>
            <Text className="text-yellow-700 text-sm my-1 m-0">
              • 您的反馈对我们改进产品至关重要
            </Text>
            <Text className="text-yellow-700 text-sm my-1 m-0">
              • Beta功能可能在正式版本中有所调整
            </Text>
            <Text className="text-yellow-700 text-sm mt-1 m-0">
              • 感谢您参与测试并提供宝贵意见
            </Text>
          </Section>
        )}
        
        {/* 行动召唤 */}
        <Section className="text-center mb-6">
          <Button href={ctaUrl} className="mb-4">
            {ctaText}
          </Button>
          
          {videoUrl && (
            <Button href={videoUrl} variant="secondary" className="ml-4">
              观看演示视频
            </Button>
          )}
        </Section>
        
        {/* 额外资源 */}
        {(blogUrl || feedbackUrl) && (
          <Section className="bg-gray-50 border border-gray-200 rounded p-4 mb-6">
            <Text className="text-gray-800 text-sm font-semibold mb-3 m-0">
              📚 更多资源：
            </Text>
            
            {blogUrl && (
              <Text className="text-gray-700 text-sm mb-2 m-0">
                📖 <a href={blogUrl} className="text-blue-600 underline">
                  阅读详细功能介绍
                </a>
              </Text>
            )}
            
            <Text className="text-gray-700 text-sm mb-2 m-0">
              💬 <a href={feedbackUrl} className="text-blue-600 underline">
                分享您的使用体验
              </a>
            </Text>
            
            <Text className="text-gray-700 text-sm mb-2 m-0">
              📧 <a href="mailto:support@chattoeic.com" className="text-blue-600 underline">
                联系技术支持
              </a>
            </Text>
          </Section>
        )}
        
        {/* 感谢与鼓励 */}
        <Section className="bg-green-50 border border-green-200 rounded p-4 mb-6">
          <Text className="text-green-800 text-sm font-semibold m-0">
            🙏 感谢您的支持
          </Text>
          <Text className="text-green-700 text-sm mt-2 m-0">
            每一个新功能的诞生都离不开用户的支持和反馈。我们会继续努力，为您提供更优质的学习体验。
            您的成功就是我们最大的动力！
          </Text>
        </Section>
        
        <Text className="text-gray-700 text-base leading-6 mb-4 m-0">
          我们相信这些新功能将帮助您更高效地学习TOEIC，早日达成您的目标分数！
        </Text>
        
        {announcementType === 'beta_release' && (
          <Section className="text-center mb-6">
            <Button href={feedbackUrl} variant="secondary">
              提供Beta反馈
            </Button>
          </Section>
        )}
        
        <Text className="text-gray-600 text-sm mt-6 m-0">
          期待您的体验和反馈！<br />
          ChatTOEIC 产品团队
        </Text>
        
        <Text className="text-gray-600 text-sm mt-4 m-0">
          如不希望接收功能更新通知，请访问
          <a href={`${ctaUrl}/settings/notifications`} className="text-blue-600 underline ml-1">
            通知设置
          </a>
          进行调整。
        </Text>
      </Section>
    </Layout>
  );
}