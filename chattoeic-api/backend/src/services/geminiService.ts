import { GoogleGenerativeAI } from '@google/generative-ai';
import { QuestionGenerationRequest, GeneratedQuestion } from '../types/index.js';
import { getCategory, fixCategory } from '../utils/categoryMapping.js';
import {
  getQuestionPromptFunction,
  buildChatPrompt,
  buildAnswerExplanationPrompt,
  buildWordDefinitionPrompt
} from '../prompts/index.js';

class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    console.log('🔍 Checking GEMINI_API_KEY...');
    console.log('API Key present:', !!apiKey);
    console.log('API Key length:', apiKey?.length || 0);
    console.log('Available env vars:', Object.keys(process.env).filter(k => k.includes('GEMINI')));
    
    if (!apiKey) {
      console.error('❌ GEMINI_API_KEY not found in environment variables');
      return;
    }
    
    console.log('✅ GEMINI_API_KEY found, initializing Gemini service...');
    try {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      console.log('✅ Gemini service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Gemini service:', error);
    }
  }

  async generateQuestions(request: QuestionGenerationRequest): Promise<GeneratedQuestion[]> {
    console.log('🎯 Generating questions with request:', request);

    if (!this.model) {
      console.error('❌ Model not initialized');
      throw new Error('AI服务不可用，请联系管理员配置GEMINI_API_KEY');
    }

    try {
      // 获取对应的提示词函数
      const promptFunction = getQuestionPromptFunction(request.type);

      // 构建提示词文件路径用于日志显示
      const promptPath = request.type.includes('LISTENING')
        ? `src/prompts/listening/${request.type.toLowerCase()}Prompts.ts`
        : `src/prompts/reading/${request.type.toLowerCase()}Prompts.ts`;

      console.log(`📝 使用提示词模块: ${request.type} (文件: ${promptPath})`);

      // 生成完整提示词
      const prompt = promptFunction(request.difficulty, request.count, request.topic, request.customPrompt);
      console.log(`📋 提示词生成完成 - 类型:${request.type}, 难度:${request.difficulty}, 题目数:${request.count}`);
      console.log('📝 Generated prompt length:', prompt.length);
      
      console.log('🚀 Calling Gemini API...');
      const result = await this.model.generateContent(prompt);
      console.log('✅ Gemini API call successful');
      
      const response = await result.response;
      const text = response.text();
      console.log('📄 Response text length:', text.length);
      console.log('📄 Response preview:', text.substring(0, 200));
      
      // 清理AI响应，移除Markdown代码块标记和其他格式
      let cleanedText = text.trim();
      
      // 移除各种Markdown代码块格式
      cleanedText = cleanedText.replace(/^```json\s*/g, '').replace(/\s*```$/g, '');
      cleanedText = cleanedText.replace(/^```\s*/g, '').replace(/\s*```$/g, '');
      
      // 移除可能的前缀文本，直接找到JSON数组开始
      const jsonStart = cleanedText.indexOf('[');
      const jsonEnd = cleanedText.lastIndexOf(']');
      
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        cleanedText = cleanedText.substring(jsonStart, jsonEnd + 1);
      }
      
      console.log('🧹 Cleaned text preview:', cleanedText.substring(0, 200));
      console.log('🧹 Cleaned text ends with:', cleanedText.substring(cleanedText.length - 50));
      
      // 解析清理后的JSON响应
      const questions = JSON.parse(cleanedText);
      console.log('✅ JSON parsed successfully, questions count:', questions.length);
      
      // 验证和格式化题目
      const validatedQuestions = this.validateAndFormatQuestions(questions, request);
      console.log('✅ Questions validated successfully');

      // 添加调试信息到响应中
      const promptPath = request.type.includes('LISTENING')
        ? `src/prompts/listening/${request.type.toLowerCase()}Prompts.ts`
        : `src/prompts/reading/${request.type.toLowerCase()}Prompts.ts`;

      // 在每个题目中添加调试信息（前端可见）
      const questionsWithDebugInfo = validatedQuestions.map(q => ({
        ...q,
        _debug: {
          promptModule: request.type,
          promptFile: promptPath,
          generatedAt: new Date().toISOString(),
          isNewPromptSystem: true // 明确标记使用了新的提示词系统
        }
      }));

      console.log('🎉 ===== 新提示词系统验证 =====');
      console.log(`✨ 已使用模块化提示词系统`);
      console.log(`📄 提示词文件: ${promptPath}`);
      console.log(`🏷️  题目类型: ${request.type}`);
      console.log(`📊 生成题目数: ${questionsWithDebugInfo.length}`);
      console.log('=====================================');

      return questionsWithDebugInfo;
    } catch (error: any) {
      console.error('❌ Gemini question generation failed:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        status: error.status,
        stack: error.stack,
        name: error.name,
        cause: error.cause
      });
      
      // 更详细的错误信息
      if (error.message?.includes('API_KEY') || error.message?.includes('Invalid API key')) {
        throw new Error('AI服务配置错误：API密钥无效');
      } else if (error.message?.includes('quota') || error.message?.includes('QUOTA_EXCEEDED')) {
        throw new Error('AI服务使用额度已用完，请稍后重试');
      } else if (error.message?.includes('network') || error.code === 'ENOTFOUND' || error.code === 'ECONNRESET') {
        throw new Error('网络连接失败，请稍后重试');
      } else if (error instanceof SyntaxError) {
        throw new Error('AI返回的数据格式错误，请稍后重试');
      } else {
        throw new Error(`题目生成失败: ${error.message}`);
      }
    }
  }

  async chatResponse(message: string, context?: any): Promise<string> {
    try {
      const prompt = buildChatPrompt(message, context);
      const result = await this.model.generateContent(prompt);
      const response = await result.response;

      return response.text();
    } catch (error) {
      console.error('Gemini chat response failed:', error);
      throw new Error('AI聊天服务暂时不可用，请稍后重试');
    }
  }

  async explainAnswer(question: string, userAnswer: string, correctAnswer: string): Promise<string> {
    try {
      const prompt = buildAnswerExplanationPrompt(question, userAnswer, correctAnswer);

      const result = await this.model.generateContent(prompt);
      const response = await result.response;

      return response.text();
    } catch (error) {
      console.error('Gemini answer explanation failed:', error);
      throw new Error('答案解释生成失败，请稍后重试');
    }
  }

  async getWordDefinition(word: string, context?: string): Promise<any> {
    try {
      const prompt = buildWordDefinitionPrompt(word, context);

      console.log(`🔍 Getting definition for word: ${word}`);
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      let text = response.text().trim();

      // 清理响应，移除可能的Markdown标记
      text = text.replace(/^```json\s*/g, '').replace(/\s*```$/g, '');
      text = text.replace(/^```\s*/g, '').replace(/\s*```$/g, '');

      console.log(`✅ Definition response for ${word}:`, text.substring(0, 200));

      const wordData = JSON.parse(text);
      return wordData;
    } catch (error) {
      console.error('Gemini word definition failed:', error);
      throw new Error('获取单词释义失败，请稍后重试');
    }
  }


  private validateAndFormatQuestions(questions: any[], request: QuestionGenerationRequest): GeneratedQuestion[] {
    if (!Array.isArray(questions)) {
      throw new Error('Invalid questions format');
    }

    return questions.map((q, index) => {
      // 将字符串形式的正确答案转换为数字索引
      let correctAnswerIndex = 0;
      if (typeof q.correctAnswer === 'string') {
        // 如果是 A, B, C, D 格式，转换为 0, 1, 2, 3
        const answerMap: Record<string, number> = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
        correctAnswerIndex = answerMap[q.correctAnswer.toUpperCase()] ?? 0;
      } else if (typeof q.correctAnswer === 'number') {
        correctAnswerIndex = q.correctAnswer;
      }

      // 确保分类正确设置
      const questionType = q.type || request.type;
      let category = q.category;
      
      if (!category || category === '未分类' || category === 'undefined') {
        // 根据题目类型推断分类
        category = getCategory(questionType);
        console.log(`🔧 Auto-assigned category for question ${index}: ${category} (type: ${questionType})`);
      } else {
        // 验证并修复现有分类
        category = fixCategory(category, questionType);
      }

      return {
        id: q.id || `q_${Date.now()}_${index}`,
        type: questionType,
        category: category,
        difficulty: q.difficulty || request.difficulty,
        question: q.question || '',
        options: q.options || [],
        correctAnswer: correctAnswerIndex,
        explanation: q.explanation || '',
        passage: q.passage,
        audioUrl: q.audioUrl,
        imageUrl: q.imageUrl
      };
    });
  }
}

export const geminiService = new GeminiService();