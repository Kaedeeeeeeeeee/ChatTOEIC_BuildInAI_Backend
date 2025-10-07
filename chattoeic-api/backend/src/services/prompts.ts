/**
 * 🎯 TOEIC题目生成提示词库
 * 为每个Part提供专业、详细的提示词模板
 * 确保生成的题目符合TOEIC官方标准
 */

interface QuestionGenerationRequest {
  type: string;
  difficulty: string;
  count: number;
  topic?: string;
  customPrompt?: string;
}

/**
 * Part 5 - 单句语法填空题
 */
export const buildPart5Prompt = (request: QuestionGenerationRequest): string => {
  const { difficulty, count } = request;

  // 将后端难度格式转换为TOEIC分数范围
  const difficultyToScore = (level: string): string => {
    switch (level.toUpperCase()) {
      case 'BEGINNER': return '400-600';
      case 'INTERMEDIATE': return '600-800';
      case 'ADVANCED': return '800-900';
      default: return '600-800';
    }
  };

  const targetScore = difficultyToScore(difficulty);

  return `你是专业的TOEIC Part 5出题专家。请严格按照JSON格式要求生成${count}道${targetScore}分难度的单句语法填空题。

**🚨 CRITICAL: Part 5 是单句语法填空，不是段落阅读！🚨**

Part 5 特征：
- ✅ 每道题是一个独立的句子，包含一个空格(_____）
- ✅ 测试语法、词汇、词性等知识点
- ❌ 不是阅读理解，不需要段落文章
- ❌ 不是Part 6的段落填空

**EXACT JSON FORMAT（完全按此格式）：**
[
  {
    "id": "part5_1",
    "type": "READING_PART5",
    "difficulty": "${difficulty}",
    "question": "The company _____ a new policy regarding remote work next month.",
    "options": ["will implement", "implemented", "implementing", "implementation"],
    "correctAnswer": 0,
    "explanation": "此题考查将来时态，'next month'表明将来时间，所以选择'will implement'",
    "category": "Part 5 - 语法填空"
  }
]

**题目要求：**
- 商务英语场景：会议、项目、销售、人事、财务等职场情境
- 语法点分布：
  * 动词时态和语态（30%）
  * 词性辨析（名词/动词/形容词/副词）（25%）
  * 介词和连词（20%）
  * 代词和冠词（15%）
  * 其他语法点（10%）
- 句子长度：10-18个单词
- 难度：${targetScore}分水平

**禁止事项：**
- ❌ 不要生成段落或多句文章
- ❌ 不要生成Part 6风格的邮件/通知
- ❌ 不要在question字段包含多个句子
- ❌ 不要使用passage字段

**重要提醒：**
1. 每道题必须是单独的一句话
2. 选项不要包含A)、B)等前缀
3. 正确答案随机分布在0、1、2、3（对应A、B、C、D）
4. 直接返回JSON数组，不要Markdown代码块包装

现在生成${count}道标准Part 5单句语法填空题：`;
};

/**
 * Part 6 - 段落填空题
 */
export const buildPart6Prompt = (request: QuestionGenerationRequest): string => {
  const { difficulty, count } = request;

  const difficultyToScore = (level: string): string => {
    switch (level.toUpperCase()) {
      case 'BEGINNER': return '400-600';
      case 'INTERMEDIATE': return '600-800';
      case 'ADVANCED': return '800-900';
      default: return '600-800';
    }
  };

  const targetScore = difficultyToScore(difficulty);

  return `你是专业的TOEIC Part 6出题专家。请生成${count}篇商务文档，每篇包含4个空格的段落填空题。

**Part 6 特征：**
- 生成${count}个文档对象
- 每个文档包含passage字段（带4个空格的完整文章）
- 每个文档包含questions数组（4个子题目）
- 文章长度：150-200词
- 空格分布：前3个是语法/词汇题，第4个是句子插入题

**EXACT JSON FORMAT：**
[
  {
    "id": "part6_1",
    "type": "READING_PART6",
    "difficulty": "${difficulty}",
    "passage": "To: All Staff\\nFrom: Marketing Department\\nSubject: New Product Launch\\n\\nDear Team,\\n\\nWe are excited to announce [BLANK1] our new product line. The marketing campaign will begin next month and [BLANK2] include digital advertising. We need all departments to [BLANK3] during this period. [BLANK4]\\n\\nBest regards,\\nMarketing Team",
    "questions": [
      {
        "questionNumber": 1,
        "question": "Choose the best option for blank [BLANK1]",
        "options": ["the launch of", "to launch", "launching", "launched"],
        "correctAnswer": 0,
        "explanation": "考查名词短语，'announce'后接名词对象"
      },
      {
        "questionNumber": 2,
        "question": "Choose the best option for blank [BLANK2]",
        "options": ["it", "they", "we", "this"],
        "correctAnswer": 0,
        "explanation": "指代单数名词'campaign'，用'it'"
      },
      {
        "questionNumber": 3,
        "question": "Choose the best option for blank [BLANK3]",
        "options": ["cooperate", "cooperating", "to cooperate", "cooperation"],
        "correctAnswer": 0,
        "explanation": "'need to'后接动词原形"
      },
      {
        "questionNumber": 4,
        "question": "Choose the best sentence for blank [BLANK4]",
        "options": [
          "Please submit your reports by Friday.",
          "The product will be available next year.",
          "Training has been completed successfully.",
          "We appreciate your past contributions."
        ],
        "correctAnswer": 0,
        "explanation": "句子插入题，要求提交报告的句子承上启下"
      }
    ]
  }
]

**文档类型：**
- 商务邮件（To/From/Subject格式）
- 公司备忘录（MEMO格式）
- 公司通知/公告
- 产品广告

**重要提示：**
1. passage字段使用[BLANK1], [BLANK2], [BLANK3], [BLANK4]标记空格
2. questions数组包含4个题目对象
3. 前3题是语法/词汇填空，第4题是句子插入
4. 直接返回JSON数组，不要Markdown包装

现在生成${count}篇Part 6文档：`;
};

/**
 * Part 7 - 阅读理解题
 */
export const buildPart7Prompt = (request: QuestionGenerationRequest): string => {
  const { difficulty, count } = request;

  const difficultyToScore = (level: string): string => {
    switch (level.toUpperCase()) {
      case 'BEGINNER': return '400-600';
      case 'INTERMEDIATE': return '600-800';
      case 'ADVANCED': return '800-900';
      default: return '600-800';
    }
  };

  const targetScore = difficultyToScore(difficulty);

  // 根据题目数量确定文档结构
  const getDocumentStructure = (questionCount: number) => {
    if (questionCount <= 4) {
      return "single passage (one complete business document)";
    } else if (questionCount <= 10) {
      return "double passage (two related business documents)";
    } else {
      return "triple passage (three related business documents)";
    }
  };

  const documentStructure = getDocumentStructure(count);

  return `你是专业的TOEIC Part 7阅读理解出题专家。请生成${count}道${targetScore}分难度的阅读理解题。

**出题要求：**
- 文档结构：${documentStructure}
- 题目总数：${count}题
- 难度级别：${targetScore}分水平

**EXACT JSON FORMAT：**
{
  "passages": [
    {
      "type": "email/advertisement/memo/notice",
      "title": "文档标题",
      "content": "完整文档内容，包含适当格式"
    }
  ],
  "questions": [
    {
      "question": "What is the main purpose of this email?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "详细解释为什么这个答案正确",
      "type": "main_idea",
      "category": "Part 7 - 阅读理解",
      "difficulty": "${difficulty}"
    }
  ]
}

**题型分布：**
- 细节题（40%）：日期、价格、地点等具体信息
- 主旨题（20%）：文章目的、主要话题
- 推理题（30%）：隐含意思、逻辑结论
- 词汇题（10%）：语境中的词汇理解

**文档类型选择：**
- 商务邮件（To/From/Subject/Date格式）
- 广告（产品/服务推广）
- 备忘录（内部沟通）
- 通知/公告
- 新闻文章
- 日程表/议程

**重要提示：**
1. 返回单个JSON对象（不是数组）
2. passages数组包含完整文档
3. questions数组包含所有题目
4. 正确答案随机分布在A、B、C、D
5. 直接返回JSON，不要Markdown包装

现在生成Part 7阅读理解题组：`;
};

/**
 * 根据题目类型选择合适的提示词
 */
export const buildQuestionPrompt = (request: QuestionGenerationRequest): string => {
  const { type } = request;

  switch (type) {
    case 'READING_PART5':
      return buildPart5Prompt(request);
    case 'READING_PART6':
      return buildPart6Prompt(request);
    case 'READING_PART7':
      return buildPart7Prompt(request);
    default:
      // 其他Part的通用提示词（听力等）
      return buildGenericPrompt(request);
  }
};

/**
 * 通用提示词（用于其他Part或未定义的类型）
 */
const buildGenericPrompt = (request: QuestionGenerationRequest): string => {
  const { type, difficulty, count } = request;

  return `作为TOEIC题目生成专家，请生成${count}道${type}题目。

要求：
- 难度：${difficulty}
- 题目类型：${type}
- 返回格式：严格的JSON数组
- 每个题目包含question、options、correctAnswer、explanation字段

返回JSON数组，不要Markdown包装。`;
};

export default {
  buildPart5Prompt,
  buildPart6Prompt,
  buildPart7Prompt,
  buildQuestionPrompt
};
