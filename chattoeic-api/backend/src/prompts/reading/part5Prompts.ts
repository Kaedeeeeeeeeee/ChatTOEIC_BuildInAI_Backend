import { getDifficultyDescription } from '../index.js';

export const part5QuestionPrompt = (difficulty: string, count: number, topic?: string, customPrompt?: string): string => {
  return `
作为TOEIC题目生成专家，请生成${count}道阅读Part5 句子填空题目。

要求：
- 难度：${getDifficultyDescription(difficulty)}
- 题目类型：READING_PART5
- 返回格式：严格的JSON数组，每个题目包含以下字段：
  {
    "id": "唯一标识符",
    "type": "READING_PART5",
    "difficulty": "${difficulty}",
    "question": "题目内容（包含一个空格_____）",
    "options": ["选项A", "选项B", "选项C", "选项D"],
    "correctAnswer": [0、1、2或3 - 确保答案均匀分布在四个选项中],
    "explanation": "详细解释"
  }

${topic ? `题目主题：${topic}` : ''}
${customPrompt ? `特殊要求：${customPrompt}` : ''}

Part5 句子填空特殊要求：
- 每个题目是一个包含空格的完整句子
- 重点考查语法、词汇、语法结构
- 常见考点：动词时态、词性辨析、介词搭配、连词使用等

语法考点分布：
- 25% 动词时态和语态（现在时、过去时、完成时、被动语态）
- 20% 词性辨析（名词、动词、形容词、副词的正确形式）
- 15% 介词和介词短语（时间、地点、方式介词）
- 15% 连词和从句（并列连词、从属连词、关系代词）
- 10% 代词和限定词（人称代词、指示代词、量词）
- 10% 比较级和最高级
- 5% 其他语法点（虚拟语气、倒装等）

商务词汇重点：
- 会议和沟通：meeting, conference, presentation, negotiation
- 财务和会计：budget, revenue, profit, expense, investment
- 人力资源：recruitment, training, performance, promotion
- 市场营销：campaign, strategy, customer, market share
- 运营管理：production, efficiency, quality, deadline

句子结构建议：
- 商务邮件句式
- 会议讨论表达
- 报告和分析语言
- 政策和程序描述

干扰选项设计：
- 词性相近但用法不同的词
- 发音相似但意思不同的词
- 时态形式相近但语境不符的动词
- 搭配相似但语义不符的介词

请确保题目符合TOEIC考试标准，答案解释清晰准确。

**重要提醒：请将正确答案随机分布在A、B、C、D四个选项中，避免大部分答案都是同一选项的情况。目标是在A、B、C、D选项中大致均匀分布正确答案。**

**重要：请直接返回JSON数组，不要使用Markdown代码块包装，不要添加任何其他文本。**
  `;
};

