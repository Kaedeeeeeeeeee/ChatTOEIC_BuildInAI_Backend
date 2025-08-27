/**
 * 用户行为分析日志系统
 * 专门收集和记录用户学习行为数据，为数据分析提供支持
 */

import { logBusinessEvent, log } from './logger.js';
import { PrismaClient } from '@prisma/client';

// 用户行为事件类型
export type UserAnalyticsEvent = 
  | 'user_registered'
  | 'user_login' 
  | 'user_logout'
  | 'practice_started'
  | 'practice_completed'
  | 'practice_abandoned' 
  | 'question_answered'
  | 'ai_chat_initiated'
  | 'ai_chat_message_sent'
  | 'vocabulary_word_added'
  | 'vocabulary_reviewed'
  | 'page_visited'
  | 'feature_used'
  | 'error_encountered';

// 用户行为数据结构
export interface UserBehaviorData {
  userId?: string;
  sessionId?: string;
  event: UserAnalyticsEvent;
  timestamp: Date;
  data?: {
    // 练习相关
    practiceType?: string;
    questionType?: string;
    difficulty?: string | number;
    score?: number;
    timeSpent?: number;
    questionsCount?: number;
    correctAnswers?: number;
    
    // AI交互相关
    chatContext?: string;
    messageLength?: number;
    aiResponseTime?: number;
    
    // 词汇相关
    wordCount?: number;
    reviewAccuracy?: number;
    
    // 页面/功能相关
    pagePath?: string;
    featureName?: string;
    referrer?: string;
    
    // 技术相关
    userAgent?: string;
    ip?: string;
    deviceType?: string;
    browserType?: string;
    
    // 错误相关
    errorType?: string;
    errorMessage?: string;
    
    // 其他自定义数据
    [key: string]: any;
  };
  metadata?: {
    platform?: string;
    version?: string;
    environment?: string;
    experimentGroup?: string;
  };
}

// 学习进度跟踪数据
export interface LearningProgressData {
  userId: string;
  date: string; // YYYY-MM-DD
  metrics: {
    practiceSessionsCount: number;
    totalTimeSpent: number; // 分钟
    questionsAnswered: number;
    correctAnswers: number;
    averageScore: number;
    improvementRate: number; // 相比昨天的提升百分比
    streakDays: number; // 连续学习天数
    
    // 分类统计
    listeningScore: number;
    readingScore: number;
    vocabularyWordsAdded: number;
    vocabularyWordsReviewed: number;
    aiInteractions: number;
    
    // 学习质量指标
    focusScore: number; // 基于时间分布的专注度评分
    retentionRate: number; // 知识保留率
    challengeLevel: number; // 当前挑战难度
  };
}

// 用户画像数据
export interface UserProfileData {
  userId: string;
  profile: {
    // 基础信息
    registrationDate: Date;
    lastActiveDate: Date;
    totalLoginDays: number;
    averageSessionDuration: number;
    
    // 学习特征
    preferredStudyTime: string; // 'morning', 'afternoon', 'evening', 'night'
    studyPatternType: string; // 'consistent', 'intensive', 'casual', 'irregular'
    learningGoalLevel: string; // 'beginner', 'intermediate', 'advanced'
    currentTOEICLevel: number; // 估算的TOEIC分数
    
    // 行为特征
    mostUsedFeatures: string[];
    preferredQuestionTypes: string[];
    averageQuestionsPerSession: number;
    completionRate: number; // 练习完成率
    
    // 参与度
    engagementScore: number; // 0-100
    retentionRisk: string; // 'low', 'medium', 'high'
    lifecycleStage: string; // 'new', 'active', 'declining', 'churned'
  };
}

class AnalyticsLogger {
  private prisma: PrismaClient;
  private eventQueue: UserBehaviorData[] = [];
  private batchSize = 100;
  private flushInterval = 30000; // 30秒

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    
    // 定期批量处理事件队列
    setInterval(() => {
      this.flushEventQueue();
    }, this.flushInterval);
    
    // 应用关闭时清空队列
    process.on('SIGTERM', () => this.flushEventQueue());
    process.on('SIGINT', () => this.flushEventQueue());
  }

  /**
   * 记录用户行为事件
   */
  logUserBehavior(data: UserBehaviorData): void {
    try {
      // 添加时间戳
      if (!data.timestamp) {
        data.timestamp = new Date();
      }

      // 添加到队列
      this.eventQueue.push(data);

      // 记录到Winston日志
      logBusinessEvent({
        event: 'user_behavior',
        userId: data.userId,
        sessionId: data.sessionId,
        data: {
          behaviorEvent: data.event,
          eventData: data.data,
          metadata: data.metadata
        }
      });

      // 如果队列满了，立即处理
      if (this.eventQueue.length >= this.batchSize) {
        this.flushEventQueue();
      }

      // 记录关键事件到主日志
      if (this.isKeyEvent(data.event)) {
        log.info('Key user behavior event', {
          userId: data.userId,
          event: data.event,
          data: data.data
        });
      }
    } catch (error) {
      log.error('Failed to log user behavior', { error, data });
    }
  }

  /**
   * 批量处理事件队列
   */
  private async flushEventQueue(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const events = this.eventQueue.splice(0, this.batchSize);
    
    try {
      // 这里可以批量写入数据库或外部分析服务
      // 目前先记录到日志文件
      log.info('Analytics batch processed', {
        eventCount: events.length,
        events: events.map(e => ({
          userId: e.userId,
          event: e.event,
          timestamp: e.timestamp
        }))
      });

      // TODO: 实现数据库批量写入
      // await this.batchInsertToDatabase(events);
      
    } catch (error) {
      log.error('Failed to flush analytics event queue', { 
        error, 
        eventCount: events.length 
      });
      
      // 失败的事件重新加入队列
      this.eventQueue.unshift(...events);
    }
  }

  /**
   * 生成学习进度报告
   */
  async generateLearningProgress(userId: string, date: string): Promise<LearningProgressData | null> {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      // 获取当天练习记录
      const practiceRecords = await this.prisma.practiceRecord.findMany({
        where: {
          userId,
          completedAt: {
            gte: startOfDay,
            lte: endOfDay
          }
        }
      });

      if (practiceRecords.length === 0) {
        return null;
      }

      // 计算基础指标
      const totalTimeSpent = practiceRecords.reduce((sum, record) => sum + (record.totalTime || 0), 0) / 60; // 转换为分钟
      const questionsAnswered = practiceRecords.reduce((sum, record) => sum + record.questionsCount, 0);
      const correctAnswers = practiceRecords.reduce((sum, record) => sum + record.correctAnswers, 0);
      const averageScore = practiceRecords.reduce((sum, record) => sum + (record.score || 0), 0) / practiceRecords.length;

      // 获取昨天的数据进行对比
      const yesterday = new Date(date);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayProgress = await this.generateLearningProgress(userId, yesterday.toISOString().split('T')[0]);
      
      const improvementRate = yesterdayProgress 
        ? ((averageScore - yesterdayProgress.metrics.averageScore) / yesterdayProgress.metrics.averageScore) * 100
        : 0;

      // 计算连续学习天数
      const streakDays = await this.calculateLearningStreak(userId, date);

      const progressData: LearningProgressData = {
        userId,
        date,
        metrics: {
          practiceSessionsCount: practiceRecords.length,
          totalTimeSpent,
          questionsAnswered,
          correctAnswers,
          averageScore,
          improvementRate,
          streakDays,
          
          // 分类统计（简化实现）
          listeningScore: averageScore, // TODO: 分别计算听力和阅读
          readingScore: averageScore,
          vocabularyWordsAdded: 0, // TODO: 从词汇记录计算
          vocabularyWordsReviewed: 0,
          aiInteractions: 0, // TODO: 从聊天记录计算
          
          // 学习质量指标（简化实现）
          focusScore: Math.min(100, totalTimeSpent * 10), // 基于学习时间
          retentionRate: (correctAnswers / questionsAnswered) * 100,
          challengeLevel: this.calculateChallengeLevel(averageScore)
        }
      };

      // 记录进度分析事件
      this.logUserBehavior({
        userId,
        event: 'feature_used',
        timestamp: new Date(),
        data: {
          featureName: 'learning_progress_analysis',
          date,
          metrics: progressData.metrics
        }
      });

      return progressData;
    } catch (error) {
      log.error('Failed to generate learning progress', { error, userId, date });
      return null;
    }
  }

  /**
   * 生成用户画像
   */
  async generateUserProfile(userId: string): Promise<UserProfileData | null> {
    try {
      // 获取用户基础信息
      const user = await this.prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        return null;
      }

      // 获取用户所有练习记录
      const practiceRecords = await this.prisma.practiceRecord.findMany({
        where: { userId },
        orderBy: { completedAt: 'asc' }
      });

      if (practiceRecords.length === 0) {
        return null;
      }

      // 计算用户画像指标
      const totalSessionDuration = practiceRecords.reduce((sum, record) => sum + (record.totalTime || 0), 0);
      const averageSessionDuration = totalSessionDuration / practiceRecords.length / 60; // 分钟

      const totalQuestions = practiceRecords.reduce((sum, record) => sum + record.questionsCount, 0);
      const totalCorrect = practiceRecords.reduce((sum, record) => sum + record.correctAnswers, 0);
      const averageScore = practiceRecords.reduce((sum, record) => sum + (record.score || 0), 0) / practiceRecords.length;

      const profileData: UserProfileData = {
        userId,
        profile: {
          registrationDate: user.createdAt,
          lastActiveDate: user.lastLoginAt || user.createdAt,
          totalLoginDays: await this.calculateTotalLoginDays(userId),
          averageSessionDuration,
          
          preferredStudyTime: this.analyzePreferredStudyTime(practiceRecords),
          studyPatternType: this.analyzeStudyPattern(practiceRecords),
          learningGoalLevel: this.determineLearningLevel(averageScore),
          currentTOEICLevel: Math.round(averageScore),
          
          mostUsedFeatures: await this.analyzeMostUsedFeatures(userId),
          preferredQuestionTypes: this.analyzePreferredQuestionTypes(practiceRecords),
          averageQuestionsPerSession: totalQuestions / practiceRecords.length,
          completionRate: 100, // TODO: 计算实际完成率
          
          engagementScore: this.calculateEngagementScore(practiceRecords),
          retentionRisk: this.assessRetentionRisk(practiceRecords),
          lifecycleStage: this.determineLifecycleStage(user, practiceRecords)
        }
      };

      // 记录用户画像生成事件
      this.logUserBehavior({
        userId,
        event: 'feature_used',
        timestamp: new Date(),
        data: {
          featureName: 'user_profile_analysis',
          profileData: profileData.profile
        }
      });

      return profileData;
    } catch (error) {
      log.error('Failed to generate user profile', { error, userId });
      return null;
    }
  }

  /**
   * 辅助方法
   */
  private isKeyEvent(event: UserAnalyticsEvent): boolean {
    const keyEvents = ['user_registered', 'practice_completed', 'ai_chat_initiated', 'error_encountered'];
    return keyEvents.includes(event);
  }

  private async calculateLearningStreak(userId: string, endDate: string): Promise<number> {
    // TODO: 实现连续学习天数计算
    return 1;
  }

  private calculateChallengeLevel(score: number): number {
    if (score < 400) return 1;
    if (score < 600) return 2;
    if (score < 800) return 3;
    return 4;
  }

  private async calculateTotalLoginDays(userId: string): Promise<number> {
    // TODO: 从登录记录计算
    return 1;
  }

  private analyzePreferredStudyTime(records: any[]): string {
    // TODO: 分析学习时间偏好
    return 'evening';
  }

  private analyzeStudyPattern(records: any[]): string {
    // TODO: 分析学习模式
    return 'casual';
  }

  private determineLearningLevel(score: number): string {
    if (score < 500) return 'beginner';
    if (score < 750) return 'intermediate';
    return 'advanced';
  }

  private async analyzeMostUsedFeatures(userId: string): Promise<string[]> {
    // TODO: 从行为日志分析最常用功能
    return ['practice', 'ai_chat'];
  }

  private analyzePreferredQuestionTypes(records: any[]): string[] {
    // TODO: 分析偏好的题目类型
    return ['reading', 'listening'];
  }

  private calculateEngagementScore(records: any[]): number {
    // TODO: 计算参与度评分
    return 75;
  }

  private assessRetentionRisk(records: any[]): string {
    // TODO: 评估流失风险
    return 'low';
  }

  private determineLifecycleStage(user: any, records: any[]): string {
    // TODO: 确定生命周期阶段
    return 'active';
  }
}

export { AnalyticsLogger };