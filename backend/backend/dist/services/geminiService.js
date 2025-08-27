import { GoogleGenerativeAI } from '@google/generative-ai';
class GeminiService {
    genAI;
    model;
    constructor() {
        if (!process.env.GEMINI_API_KEY) {
            console.warn('Warning: GEMINI_API_KEY not set. AI features will be disabled.');
            return;
        }
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    }
    async generateQuestions(request) {
        if (!this.model) {
            throw new Error('AI服务不可用，请联系管理员配置GEMINI_API_KEY');
        }
        try {
            const prompt = this.buildQuestionPrompt(request);
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            // 解析AI生成的JSON响应
            const questions = JSON.parse(text);
            // 验证和格式化题目
            return this.validateAndFormatQuestions(questions, request);
        }
        catch (error) {
            console.error('Gemini question generation failed:', error);
            throw new Error('题目生成失败，请稍后重试');
        }
    }
    async chatResponse(message, context) {
        try {
            const prompt = this.buildChatPrompt(message, context);
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        }
        catch (error) {
            console.error('Gemini chat response failed:', error);
            throw new Error('AI聊天服务暂时不可用，请稍后重试');
        }
    }
    async explainAnswer(question, userAnswer, correctAnswer) {
        try {
            const prompt = `
作为TOEIC英语学习助手，请详细解释以下题目的答案：

题目：${question}
学生答案：${userAnswer}
正确答案：${correctAnswer}

请提供：
1. 为什么正确答案是对的
2. 学生答案错在哪里（如果错误）
3. 相关的语法或词汇知识点
4. 学习建议

请用中文回答，语气友好且具有启发性。
      `;
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        }
        catch (error) {
            console.error('Gemini answer explanation failed:', error);
            throw new Error('答案解释生成失败，请稍后重试');
        }
    }
    buildQuestionPrompt(request) {
        const { type, difficulty, count, topic, customPrompt } = request;
        let prompt = `
作为TOEIC题目生成专家，请生成${count}道${this.getTypeDescription(type)}题目。

要求：
- 难度：${this.getDifficultyDescription(difficulty)}
- 题目类型：${type}
- 返回格式：严格的JSON数组，每个题目包含以下字段：
  {
    "id": "唯一标识符",
    "type": "${type}",
    "difficulty": "${difficulty}",
    "question": "题目内容",
    "options": ["选项A", "选项B", "选项C", "选项D"], // 如果适用
    "correctAnswer": "正确答案",
    "explanation": "详细解释",
    "passage": "阅读文章内容" // 仅阅读题需要
  }

${topic ? `题目主题：${topic}` : ''}
${customPrompt ? `特殊要求：${customPrompt}` : ''}

请确保题目符合TOEIC考试标准，答案解释清晰准确。只返回JSON数组，不要其他内容。
    `;
        return prompt;
    }
    buildChatPrompt(message, context) {
        let prompt = `
你是ChatTOEIC的AI学习助手，专门帮助用户学习TOEIC英语。

用户消息：${message}

${context ? `上下文信息：${JSON.stringify(context)}` : ''}

请以友好、专业的语气回答用户问题。如果是关于TOEIC学习的问题，请提供详细的解答和学习建议。
请用中文回答。
    `;
        return prompt;
    }
    getTypeDescription(type) {
        const descriptions = {
            'LISTENING_PART1': '听力Part1 图片描述题',
            'LISTENING_PART2': '听力Part2 应答问题',
            'LISTENING_PART3': '听力Part3 简短对话',
            'LISTENING_PART4': '听力Part4 简短独白',
            'READING_PART5': '阅读Part5 句子填空',
            'READING_PART6': '阅读Part6 段落填空',
            'READING_PART7': '阅读Part7 阅读理解'
        };
        return descriptions[type] || type;
    }
    getDifficultyDescription(difficulty) {
        const descriptions = {
            'BEGINNER': '初级（400-600分水平）',
            'INTERMEDIATE': '中级（600-800分水平）',
            'ADVANCED': '高级（800-900分水平）'
        };
        return descriptions[difficulty] || difficulty;
    }
    validateAndFormatQuestions(questions, request) {
        if (!Array.isArray(questions)) {
            throw new Error('Invalid questions format');
        }
        return questions.map((q, index) => ({
            id: q.id || `q_${Date.now()}_${index}`,
            type: q.type || request.type,
            difficulty: q.difficulty || request.difficulty,
            question: q.question || '',
            options: q.options || [],
            correctAnswer: q.correctAnswer || '',
            explanation: q.explanation || '',
            passage: q.passage,
            audioUrl: q.audioUrl,
            imageUrl: q.imageUrl
        }));
    }
}
export const geminiService = new GeminiService();
