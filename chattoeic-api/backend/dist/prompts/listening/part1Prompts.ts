import { getDifficultyDescription } from '../utils.js';

export const part1QuestionPrompt = (difficulty: string, count: number, topic?: string, customPrompt?: string): string => {
  return `
作为TOEIC题目生成专家，请生成${count}道听力Part1 图片描述题目。

要求：
- 难度：${getDifficultyDescription(difficulty)}
- 题目类型：LISTENING_PART1
- 返回格式：严格的JSON数组，每个题目包含以下字段：
  {
    "id": "唯一标识符",
    "type": "LISTENING_PART1",
    "difficulty": "${difficulty}",
    "question": "题目内容",
    "options": ["选项A", "选项B", "选项C", "选项D"],
    "correctAnswer": [0、1、2或3 - 确保答案均匀分布在四个选项中],
    "explanation": "详细解释",
    "imageUrl": "图片描述或占位符"
  }

${topic ? `题目主题：${topic}` : ''}
${customPrompt ? `特殊要求：${customPrompt}` : ''}

Part1 图片描述题特殊要求：
- 题目应该描述一张图片的场景
- 四个选项都应该是对图片内容的描述
- 正确选项准确描述图片主要内容
- 错误选项应该包含相似但不准确的描述
- 重点训练：现在进行时、现在完成时、被动语态的识别
- 常见场景：办公室、街道、餐厅、公园、交通工具等

请确保题目符合TOEIC考试标准，答案解释清晰准确。

**重要提醒：请将正确答案随机分布在A、B、C、D四个选项中，避免大部分答案都是同一选项的情况。目标是在A、B、C、D选项中大致均匀分布正确答案。**

**重要：请直接返回JSON数组，不要使用Markdown代码块包装，不要添加任何其他文本。**
  `;
};

