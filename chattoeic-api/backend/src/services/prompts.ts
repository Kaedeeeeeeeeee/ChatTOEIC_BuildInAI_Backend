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

  // 🎯 关键修复：count是文章数量，每篇文章应该生成2-4道题
  // 单篇文章：生成2-4题（根据难度调整）
  // 双篇文章：生成5题
  // 三篇文章：生成5题
  const passageCount = count; // 文章数量
  const questionsPerPassage = passageCount === 1 ? 3 : 5; // 单篇3题，多篇5题
  const totalQuestions = questionsPerPassage; // Part 7总是返回固定数量的题目

  return `你是专业的TOEIC Part 7阅读理解出题专家。请严格按照TOEIC官方格式生成阅读理解题。

**🚨 TOEIC Part 7 官方标准 🚨**

**Part 7 格式要求：**
- 单篇文章（Single Passage）：每篇文章配 2-4 道题目
- 双篇文章（Double Passage）：两篇相关文章配 5 道题目
- 三篇文章（Triple Passage）：三篇相关文章配 5 道题目

**本次出题要求：**
- 文章数量：**${passageCount}篇** 商务文档
- 题目总数：必须生成**${totalQuestions}道**题（不是${passageCount}道！）
- 难度级别：${targetScore}分水平
- 重要：所有${totalQuestions}道题目必须基于**同一篇文档**，passage字段内容完全相同
- 警告：即使count=${passageCount}，也必须返回${totalQuestions}个题目对象！

**EXACT JSON FORMAT（参考Part 6嵌套结构）：**
[
  {
    "id": "part7_doc1",
    "type": "READING_PART7",
    "difficulty": "${difficulty}",
    "category": "Part 7 - 阅读理解",
    "passage": "To: All Staff\\nFrom: Human Resources Department\\nDate: March 15, 2024\\nSubject: New Employee Benefits Program\\n\\nWe are pleased to announce the implementation of our enhanced employee benefits program, effective April 1, 2024. All full-time employees will receive comprehensive medical, dental, and vision insurance at no additional cost. Part-time employees working more than 20 hours per week will also qualify for basic medical coverage.\\n\\nKey Benefits Include:\\n- Zero-deductible health insurance\\n- Dental coverage with orthodontic benefits\\n- Vision care with annual eye exams\\n- $50,000 life insurance policy\\n\\nTo learn more about these benefits, please attend one of our information sessions on March 22nd at 2:00 PM or March 25th at 10:00 AM in Conference Room A. You can also visit our HR portal at hr.company.com for detailed benefit summaries.\\n\\nIf you have any questions, please contact the HR department at extension 5500.\\n\\nBest regards,\\nSarah Johnson\\nHuman Resources Director",
    "questions": [
      {
        "questionNumber": 1,
        "question": "What is the main purpose of this email?",
        "options": [
          "To announce a new employee benefits program",
          "To schedule a mandatory meeting",
          "To recruit new employees",
          "To reduce company healthcare costs"
        ],
        "correctAnswer": 0,
        "explanation": "邮件开头明确说明'We are pleased to announce the implementation of our enhanced employee benefits program'，主要目的是宣布新的员工福利计划。"
      },
      {
        "questionNumber": 2,
        "question": "Who is eligible for basic medical coverage?",
        "options": [
          "All employees regardless of status",
          "Only full-time employees",
          "Part-time employees working over 20 hours weekly",
          "Only management staff"
        ],
        "correctAnswer": 2,
        "explanation": "邮件中明确指出'Part-time employees working more than 20 hours per week will also qualify for basic medical coverage'，兼职员工每周工作超过20小时即可获得基本医疗保险。"
      },
      {
        "questionNumber": 3,
        "question": "When can employees attend an information session?",
        "options": [
          "March 15 at 2:00 PM",
          "March 22 at 2:00 PM or March 25 at 10:00 AM",
          "April 1 at any time",
          "Only by appointment"
        ],
        "correctAnswer": 1,
        "explanation": "邮件中提到'please attend one of our information sessions on March 22nd at 2:00 PM or March 25th at 10:00 AM'，提供了两个具体的时间选项。"
      }
    ]
  }
]

**题型分布要求（总共${totalQuestions}道题）：**
1. **主旨题（1题）**：文章目的、主要话题（What is the main purpose...）
2. **细节题（${Math.max(1, Math.floor(totalQuestions * 0.5))}题）**：具体信息如日期、时间、价格、资格条件、地点等（When/Where/Who/What...）
3. **推理题（${Math.max(1, Math.floor(totalQuestions * 0.3))}题）**：根据文章内容推断（What can be inferred...）
4. **词汇题（可选）**：语境中的词义理解（The word "X" is closest in meaning to...）

**文档类型选择（随机选一种）：**
- 📧 商务邮件（To/From/Subject/Date格式，最常见）
- 📢 公司公告/通知（Announcement/Notice格式）
- 📝 备忘录（MEMO格式）
- 📰 新闻文章/公司新闻稿
- 📄 招聘广告（Job Posting）
- 📊 产品/服务广告
- 📅 会议议程/日程安排

**文档长度要求：**
- 单篇文档：150-250词
- 包含足够的细节信息支撑所有题目
- 格式规范，符合真实商务场景

**关键要求（参考Part 6格式）：**
1. ✅ 返回格式：**嵌套结构**，与Part 6类似
   - 顶层数组包含${passageCount}个文档对象
   - 每个文档对象包含passage字段 + questions数组
   - questions数组包含${totalQuestions}个子题目对象
2. ✅ 文档对象结构：{ id, type, difficulty, category, passage, questions: [...] }
3. ✅ 子题目结构：{ questionNumber, question, options, correctAnswer, explanation }
4. ✅ 题目必须涵盖文档的不同部分（开头、中间、结尾）
5. ✅ 难度递增：第1题最简单（主旨题），后续题目逐渐增加难度
6. ✅ 选项不要包含A)、B)等前缀，纯文本内容
7. ✅ 正确答案随机分布在0、1、2、3（对应A、B、C、D）
8. ✅ 直接返回JSON数组，不要Markdown代码块包装
9. ❌ 不要生成单句填空题（那是Part 5）
10. ❌ 不要生成段落填空题（那是Part 6）
11. ⚠️ 即使count=${passageCount}，questions数组长度必须是${totalQuestions}！

现在请生成：
- ${passageCount}个文档对象（顶层数组长度 = ${passageCount}）
- 每个文档包含${totalQuestions}道阅读理解题（questions数组长度 = ${totalQuestions}）`;
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
