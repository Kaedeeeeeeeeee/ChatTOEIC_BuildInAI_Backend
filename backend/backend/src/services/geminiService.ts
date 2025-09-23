import { GoogleGenerativeAI } from '@google/generative-ai';
import { QuestionGenerationRequest, GeneratedQuestion } from '../types/index.js';
import { getCategory, fixCategory } from '../utils/categoryMapping.js';

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
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
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
      const prompt = this.buildQuestionPrompt(request);
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
      
      return validatedQuestions;
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
      const prompt = this.buildChatPrompt(message, context);
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
    } catch (error) {
      console.error('Gemini answer explanation failed:', error);
      throw new Error('答案解释生成失败，请稍后重试');
    }
  }

  async getWordDefinition(word: string, context?: string, language?: string): Promise<any> {
    try {
      const prompt = `
作为多语言英语词汇专家，请为以下单词提供中文、日文、英文的完整词汇信息，特别适合TOEIC学习者：

单词：${word}
${context ? `上下文：${context}` : ''}

请以JSON格式返回，包含以下信息：
{
  "word": "${word}",
  "phonetic": "英式音标 /ˈeksɑːmpl/",
  "meanings": [
    {
      "partOfSpeech": "英文词性（如noun、verb、adjective等）",
      "definitions": {
        "zh": [
          {
            "definition": "详细的中文释义1",
            "example": "英文例句1（最好与TOEIC/商务相关）"
          },
          {
            "definition": "详细的中文释义2（如果有多个含义）",
            "example": "英文例句2（最好与TOEIC/商务相关）"
          }
        ],
        "ja": [
          {
            "definition": "詳しい日本語の意味1",
            "example": "英文例句1（TOEICやビジネスに関連したもの）"
          },
          {
            "definition": "詳しい日本語の意味2（複数の意味がある場合）",
            "example": "英文例句2（TOEICやビジネスに関連したもの）"
          }
        ],
        "en": [
          {
            "definition": "Detailed English definition 1",
            "example": "English example sentence 1 (preferably TOEIC/business related)"
          },
          {
            "definition": "Detailed English definition 2 (if multiple meanings exist)",
            "example": "English example sentence 2 (preferably TOEIC/business related)"
          }
        ]
      },
      "partOfSpeechLocal": {
        "zh": "中文词性（如名词、动词、形容词等）",
        "ja": "日本語の品詞（名詞、動詞、形容詞など）",
        "en": "English part of speech (noun, verb, adjective, etc.)"
      }
    }
  ],
  "commonality": "常用性级别（common/uncommon/rare）",
  "jlpt": ["N1", "N2", "N3", "N4", "N5"] // 如果适用，日语能力考试级别
}

要求：
- 每个词性在每种语言中提供1-2个主要释义，每个释义配一个相应的例句
- 释义必须准确、通俗易懂
- 例句要实用，最好与商务、职场、日常交流相关
- 如果单词有多个词性，请提供主要的2-3个词性
- 优先提供TOEIC考试中常见的词义和用法
- 中文释义使用简体中文
- 日文释义使用标准日语表达（包含汉字、平假名、片假名）
- 英文释义使用清晰简洁的英语解释
- 如果单词在日语中有对应的JLPT级别，请提供相关信息

**重要：请直接返回JSON格式，不要使用Markdown代码块包装。**
      `;

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

  private buildQuestionPrompt(request: QuestionGenerationRequest): string {
    const { type, difficulty, count, topic, customPrompt } = request;

    // Part 6特殊处理：使用文档+题目格式
    if (type === 'READING_PART6' || type?.includes('part6') || type?.includes('Part 6')) {
      return this.buildPart6Prompt(request);
    }

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
    "correctAnswer": [0、1、2或3 - 确保答案均匀分布在四个选项中], // 正确答案索引：0=A, 1=B, 2=C, 3=D
    "explanation": "详细解释",
    "passage": "阅读文章内容" // 仅阅读题需要
  }

${topic ? `题目主题：${topic}` : ''}
${customPrompt ? `特殊要求：${customPrompt}` : ''}

请确保题目符合TOEIC考试标准，答案解释清晰准确。

**重要提醒：请将正确答案随机分布在A、B、C、D四个选项中，避免大部分答案都是同一选项的情况。目标是在A、B、C、D选项中大致均匀分布正确答案。**

**重要：请直接返回JSON数组，不要使用Markdown代码块包装，不要添加任何其他文本。**
    `;

    return prompt;
  }

  private buildPart6Prompt(request: QuestionGenerationRequest): string {
    const { difficulty, count } = request;

    // 将难度等级转换为TOEIC分数范围
    const difficultyToScore = (level: string | number): string => {
      const levelNum = typeof level === 'string' ? parseInt(level) : level;
      switch (levelNum) {
        case 1: return '500';
        case 2: return '500-600';
        case 3: return '600-700';
        case 4: return '700-800';
        case 5: return '800';
        default: return '600-700';
      }
    };

    const targetScore = difficultyToScore(difficulty);

    // Part 6特殊逻辑：count表示文章数量，每篇文章4题
    const articleCount = count;

    return `🚨🚨🚨 CRITICAL FORMAT ENFORCEMENT 🚨🚨🚨

你是专业的TOEIC Part 6出题专家。

**⚠️⚠️⚠️ 绝对禁止返回旧格式！必须严格按照新格式！⚠️⚠️⚠️**

请严格按照JSON格式要求生成${articleCount}篇商务文档，每篇文档包含4道${targetScore}分难度的文本完成题。

**🔥 MANDATORY: 必须使用document+questions数组格式！🔥**

**❌ 禁止格式：{"question": "阅读下面...", "options": [...]}**
**✅ 必须格式：{"document": "完整文档内容", "questions": [4个题目对象]}**

Part 6特征：
- 生成${articleCount}个文档对象，每个包含document字段和questions数组
- **document字段：包含带4个_____空白的完整商务文档**
- **questions数组：包含4个题目对象，对应4个空白**
- 前3个空白是语法/词汇填空题，第4个空白是完整句子插入题
- 真实商务场景和语境

**文档类型建议（每篇可选择不同类型）：**
- 商业邮件（To/From/Subject/Date格式）
- 公司备忘录（MEMO TO/FROM/DATE/RE格式）
- 公司通知/公告
- 产品广告/推广

**EXACT JSON FORMAT（完全按此格式）：**
[
  {
    "question": "Part 6阅读文档练习",
    "document": "To: All Staff\\nFrom: Marketing Department\\nSubject: New Product Launch\\nDate: March 15, 2024\\n\\nDear Team,\\n\\nWe are excited to announce the launch of our new product line. _____ extensive market research, we believe this product will significantly boost our sales.\\n\\nThe marketing campaign will begin next month. _____ will include digital advertising, social media promotion, and traditional print media.\\n\\nWe need all departments to _____ closely during this critical period. Your cooperation is essential for success.\\n\\n_____ Please submit your departmental reports by Friday.\\n\\nBest regards,\\nMarketing Team",
    "questions": [
      {
        "blankNumber": 1,
        "question": "Choose the best option for blank 1.",
        "options": ["A) After", "B) Before", "C) During", "D) Despite"],
        "correctAnswer": 0,
        "explanation": "用中文解释：'After extensive market research'表示在广泛的市场调研之后，符合逻辑顺序"
      },
      {
        "blankNumber": 2,
        "question": "Choose the best option for blank 2.",
        "options": ["A) It", "B) They", "C) We", "D) This"],
        "correctAnswer": 0,
        "explanation": "用中文解释：指代'The marketing campaign'，用单数代词'It'"
      },
      {
        "blankNumber": 3,
        "question": "Choose the best option for blank 3.",
        "options": ["A) work", "B) working", "C) worked", "D) to work"],
        "correctAnswer": 3,
        "explanation": "用中文解释：need sb to do sth，需要某人做某事，应该用'to work'"
      },
      {
        "blankNumber": 4,
        "question": "Choose the best sentence for blank 4.",
        "options": ["A) The deadline is non-negotiable.", "B) We appreciate your patience during this transition.", "C) Training sessions will be held next week.", "D) Please contact HR for any questions."],
        "correctAnswer": 0,
        "explanation": "用中文解释：强调提交报告的最后期限不可协商，与前文的urgency呼应"
      }
    ],
    "category": "Part 6 - 短文填空",
    "difficulty": "${difficulty}"
  }
]

🚨🚨🚨 FINAL WARNING: CRITICAL FORMAT REQUIREMENTS 🚨🚨🚨

**⚠️ 违反格式要求将导致生成失败！⚠️**

🔥🔥🔥 ABSOLUTE REQUIREMENTS: 🔥🔥🔥
1. **ONLY返回JSON数组，包含${articleCount}个文档对象，不要任何其他文字**
2. **🔥 每个对象必须有document字段和questions字段，不要用question字段！🔥**
3. **document字段：包含带4个_____空白的完整商务文档（不要描述语）**
4. **questions字段：包含4个题目对象的数组**
5. **每个题目包含blankNumber、question、options、correctAnswer、explanation**

**❌❌❌ 绝对禁止的错误格式：**
{"question": "阅读下面的...", "options": [...]}

**✅✅✅ 唯一正确的格式：**
{"document": "To: Staff...", "questions": [...]}

**🚫 如果返回错误格式，整个生成过程将失败！🚫**

🔥 现在立即按照示例格式生成，document字段+4个题目对象的questions数组！🔥`;
  }

  private buildChatPrompt(message: string, context?: any): string {
    let prompt = `
你是TOEIC题目分析助手。请直接分析问题，简洁回答。

用户问题：${message}

${context ? `题目信息：${JSON.stringify(context)}` : ''}

要求：
- 直接分析问题，不要客套话
- 专注解释正确答案的原因和错误选项的问题
- 回答控制在200字以内
- 用中文回答
    `;

    return prompt;
  }

  private getTypeDescription(type: string): string {
    const descriptions: Record<string, string> = {
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

  private getDifficultyDescription(difficulty: string): string {
    const descriptions: Record<string, string> = {
      'BEGINNER': '初级（400-600分水平）',
      'INTERMEDIATE': '中级（600-800分水平）',
      'ADVANCED': '高级（800-900分水平）'
    };
    return descriptions[difficulty] || difficulty;
  }

  private validateAndFormatQuestions(questions: any[], request: QuestionGenerationRequest): GeneratedQuestion[] {
    if (!Array.isArray(questions)) {
      throw new Error('Invalid questions format');
    }

    // Part 6特殊处理：检测并展开文档+题目格式
    if (request.type === 'READING_PART6' || request.type?.includes('part6') || request.type?.includes('Part 6')) {
      return this.expandPart6Questions(questions, request);
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

  private expandPart6Questions(documents: any[], request: QuestionGenerationRequest): GeneratedQuestion[] {
    console.log('🔍 [Part 6解析] 发现新格式文档，展开为独立题目');
    const expandedQuestions: GeneratedQuestion[] = [];

    documents.forEach((docItem: any, docIndex: number) => {
      if (docItem.document && docItem.questions && Array.isArray(docItem.questions)) {
        // 第一题包含完整文档
        const firstQuestion = docItem.questions[0];
        expandedQuestions.push({
          id: `q_${Date.now()}_${docIndex}_0`,
          type: request.type || 'READING_PART6',
          category: docItem.category || 'Part 6 - 短文填空',
          difficulty: docItem.difficulty || request.difficulty,
          question: docItem.document, // 完整文档作为题目内容
          options: firstQuestion?.options || [],
          correctAnswer: firstQuestion?.correctAnswer || 0,
          explanation: firstQuestion?.explanation || '',
          passage: docItem.document
        });

        // 后续题目不包含文档，只有题目内容
        docItem.questions.slice(1).forEach((subQuestion: any, subIndex: number) => {
          expandedQuestions.push({
            id: `q_${Date.now()}_${docIndex}_${subIndex + 1}`,
            type: request.type || 'READING_PART6',
            category: docItem.category || 'Part 6 - 短文填空',
            difficulty: docItem.difficulty || request.difficulty,
            question: subQuestion.question || `Choose the best option for blank ${subQuestion.blankNumber || subIndex + 2}.`,
            options: subQuestion.options || [],
            correctAnswer: subQuestion.correctAnswer || 0,
            explanation: subQuestion.explanation || ''
          });
        });
      } else {
        // 后备处理：如果格式不符合预期，按普通题目处理
        console.warn(`⚠️ [Part 6解析] 文档 ${docIndex} 格式不正确，使用默认处理`);
        expandedQuestions.push({
          id: `q_${Date.now()}_${docIndex}`,
          type: request.type || 'READING_PART6',
          category: 'Part 6 - 短文填空',
          difficulty: request.difficulty,
          question: docItem.question || '题目内容缺失',
          options: docItem.options || [],
          correctAnswer: docItem.correctAnswer || 0,
          explanation: docItem.explanation || ''
        });
      }
    });

    console.log('🔍 [Part 6解析] 展开后的题目数量:', expandedQuestions.length);
    return expandedQuestions;
  }
}

export const geminiService = new GeminiService();