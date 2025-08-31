/**
 * 账户活动摘要邮件模板
 */

import React from 'react';
import { Text, Section } from '@react-email/components';
import { Layout, Button } from '../../components';

export interface ActivityData {
  practiceCount: number;
  studyHours: number;
  questionsAnswered: number;
  correctRate: number;
  streakDays: number;
  newWords: number;
  achievementsUnlocked: number;
}

interface AccountActivityEmailProps {
  userName: string;
  periodType: 'weekly' | 'monthly' | 'yearly';
  periodStart: string;
  periodEnd: string;
  activityData: ActivityData;
  topAchievements?: string[];
  recommendations?: string[];
  dashboardUrl?: string;
}

const PeriodTypeConfig = {
  weekly: {
    title: '📊 本周学习报告',
    icon: '📊',
    color: 'blue',
    greeting: '本周您的学习表现如下'
  },
  monthly: {
    title: '📈 本月学习总结',
    icon: '📈',
    color: 'green',
    greeting: '恭喜您完成了一个月的学习'
  },
  yearly: {
    title: '🏆 年度学习成就',
    icon: '🏆',
    color: 'purple',
    greeting: '让我们一起回顾您这一年的学习成就'
  }
};

export default function AccountActivityEmail({
  userName,
  periodType,
  periodStart,
  periodEnd,
  activityData,
  topAchievements = [],
  recommendations = [],
  dashboardUrl = `${process.env.FRONTEND_URL || 'https://www.chattoeic.com'}/dashboard`
}: AccountActivityEmailProps) {
  const config = PeriodTypeConfig[periodType];
  
  return (
    <Layout preview={`${config.title} - ${userName}`}>
      <Section>
        <Text className={`text-2xl font-bold text-${config.color}-600 mb-4 m-0`}>
          {config.title}
        </Text>
        
        <Text className="text-gray-700 text-base leading-6 mb-4 m-0">
          亲爱的 <span className="font-semibold text-blue-600">{userName}</span>，
        </Text>
        
        <Text className="text-gray-700 text-base leading-6 mb-6 m-0">
          {config.greeting}（{periodStart} - {periodEnd}）：
        </Text>
        
        {/* 学习统计 */}
        <Section className={`bg-${config.color}-50 border border-${config.color}-200 rounded p-4 mb-6`}>
          <Text className={`text-${config.color}-800 text-lg font-semibold mb-3 m-0`}>
            {config.icon} 学习统计
          </Text>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className={`bg-white border border-${config.color}-100 rounded p-3`}>
              <Text className={`text-${config.color}-600 text-sm font-medium m-0`}>练习次数</Text>
              <Text className={`text-2xl font-bold text-${config.color}-800 mt-1 m-0`}>
                {activityData.practiceCount}
              </Text>
            </div>
            
            <div className={`bg-white border border-${config.color}-100 rounded p-3`}>
              <Text className={`text-${config.color}-600 text-sm font-medium m-0`}>学习时长</Text>
              <Text className={`text-2xl font-bold text-${config.color}-800 mt-1 m-0`}>
                {activityData.studyHours}h
              </Text>
            </div>
            
            <div className={`bg-white border border-${config.color}-100 rounded p-3`}>
              <Text className={`text-${config.color}-600 text-sm font-medium m-0`}>答题数量</Text>
              <Text className={`text-2xl font-bold text-${config.color}-800 mt-1 m-0`}>
                {activityData.questionsAnswered}
              </Text>
            </div>
            
            <div className={`bg-white border border-${config.color}-100 rounded p-3`}>
              <Text className={`text-${config.color}-600 text-sm font-medium m-0`}>正确率</Text>
              <Text className={`text-2xl font-bold text-${config.color}-800 mt-1 m-0`}>
                {activityData.correctRate}%
              </Text>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className={`bg-white border border-${config.color}-100 rounded p-3`}>
              <Text className={`text-${config.color}-600 text-sm font-medium m-0`}>连续天数</Text>
              <Text className={`text-xl font-bold text-${config.color}-800 mt-1 m-0`}>
                {activityData.streakDays}天
              </Text>
            </div>
            
            <div className={`bg-white border border-${config.color}-100 rounded p-3`}>
              <Text className={`text-${config.color}-600 text-sm font-medium m-0`}>新学单词</Text>
              <Text className={`text-xl font-bold text-${config.color}-800 mt-1 m-0`}>
                {activityData.newWords}个
              </Text>
            </div>
            
            <div className={`bg-white border border-${config.color}-100 rounded p-3`}>
              <Text className={`text-${config.color}-600 text-sm font-medium m-0`}>获得成就</Text>
              <Text className={`text-xl font-bold text-${config.color}-800 mt-1 m-0`}>
                {activityData.achievementsUnlocked}个
              </Text>
            </div>
          </div>
        </Section>
        
        {/* 成就亮点 */}
        {topAchievements.length > 0 && (
          <Section className="bg-yellow-50 border border-yellow-200 rounded p-4 mb-6">
            <Text className="text-yellow-800 text-lg font-semibold mb-3 m-0">
              🏅 本期亮点成就
            </Text>
            {topAchievements.map((achievement, index) => (
              <Text key={index} className="text-yellow-700 text-sm my-2 m-0">
                ✨ {achievement}
              </Text>
            ))}
          </Section>
        )}
        
        {/* 学习激励 */}
        <Section className="bg-green-50 border border-green-200 rounded p-4 mb-6">
          <Text className="text-green-800 text-lg font-semibold mb-3 m-0">
            🎯 学习进度评价
          </Text>
          
          {activityData.correctRate >= 80 && (
            <Text className="text-green-700 text-sm mb-2 m-0">
              🌟 太棒了！您的正确率达到了 {activityData.correctRate}%，展现了优秀的学习成果！
            </Text>
          )}
          
          {activityData.streakDays >= 7 && (
            <Text className="text-green-700 text-sm mb-2 m-0">
              🔥 坚持了 {activityData.streakDays} 天连续学习，您的毅力令人敬佩！
            </Text>
          )}
          
          {activityData.studyHours >= 10 && (
            <Text className="text-green-700 text-sm mb-2 m-0">
              ⏰ 本期投入了 {activityData.studyHours} 小时学习时间，勤奋的付出必有回报！
            </Text>
          )}
          
          {activityData.newWords >= 50 && (
            <Text className="text-green-700 text-sm mb-2 m-0">
              📚 学会了 {activityData.newWords} 个新单词，词汇量稳步提升！
            </Text>
          )}
        </Section>
        
        {/* 个性化建议 */}
        {recommendations.length > 0 && (
          <Section className="bg-blue-50 border border-blue-200 rounded p-4 mb-6">
            <Text className="text-blue-800 text-lg font-semibold mb-3 m-0">
              💡 个性化建议
            </Text>
            {recommendations.map((recommendation, index) => (
              <Text key={index} className="text-blue-700 text-sm my-2 m-0">
                • {recommendation}
              </Text>
            ))}
          </Section>
        )}
        
        {/* 下期目标 */}
        <Section className="bg-purple-50 border border-purple-200 rounded p-4 mb-6">
          <Text className="text-purple-800 text-lg font-semibold mb-3 m-0">
            🎯 {periodType === 'weekly' ? '下周' : periodType === 'monthly' ? '下月' : '来年'}目标建议
          </Text>
          
          {activityData.correctRate < 80 && (
            <Text className="text-purple-700 text-sm mb-2 m-0">
              📈 提高答题正确率至80%以上，建议多做错题复习
            </Text>
          )}
          
          {activityData.streakDays < 5 && (
            <Text className="text-purple-700 text-sm mb-2 m-0">
              🎯 保持每日学习习惯，目标连续学习7天
            </Text>
          )}
          
          <Text className="text-purple-700 text-sm mb-2 m-0">
            📚 掌握更多新词汇，扩大词汇储备
          </Text>
          
          <Text className="text-purple-700 text-sm mb-2 m-0">
            🏆 挑战更高难度的练习，提升应试能力
          </Text>
        </Section>
        
        <Text className="text-gray-700 text-base leading-6 mb-6 m-0">
          您的努力和坚持让我们深感钦佩！继续加油，ChatTOEIC将陪伴您在英语学习的道路上不断进步。
        </Text>
        
        <Section className="text-center mb-6">
          <Button href={dashboardUrl}>
            查看详细报告
          </Button>
        </Section>
        
        <Text className="text-gray-600 text-sm mt-6 m-0">
          继续保持学习的热情，成功就在前方！<br />
          ChatTOEIC 学习团队
        </Text>
        
        <Text className="text-gray-600 text-sm mt-4 m-0">
          如需调整邮件频率或停止接收学习报告，请访问
          <a href={`${dashboardUrl}/settings/notifications`} className="text-blue-600 underline ml-1">
            通知设置
          </a>
        </Text>
      </Section>
    </Layout>
  );
}