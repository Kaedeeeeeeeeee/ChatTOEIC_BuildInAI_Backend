import { getDifficultyDescription } from '../utils.js';
export const part2QuestionPrompt = (difficulty, count, topic, customPrompt) => {
    return `
作为TOEIC题目生成专家，请生成${count}道听力Part2 应答问题题目。

要求：
- 难度：${getDifficultyDescription(difficulty)}
- 题目类型：LISTENING_PART2
- 返回格式：严格的JSON数组，每个题目包含以下字段：
  {
    "id": "唯一标识符",
    "type": "LISTENING_PART2",
    "difficulty": "${difficulty}",
    "question": "题目内容（问句或陈述句）",
    "options": ["选项A", "选项B", "选项C"],
    "correctAnswer": [0、1或2 - 确保答案均匀分布在三个选项中],
    "explanation": "详细解释"
  }

${topic ? `题目主题：${topic}` : ''}
${customPrompt ? `特殊要求：${customPrompt}` : ''}

Part2 应答问题特殊要求：
- 题目是一个问句或陈述句
- 只有三个选项（A、B、C）
- 正确选项应该是对题目最合适的回应
- 错误选项可能在语法上正确但逻辑上不合适
- 重点训练：疑问词识别(What/Where/When/Who/Why/How)、合适的回应方式
- 常见情况：邀请回应、信息询问、建议请求、时间安排等

疑问词回应策略：
- What questions → 具体信息回答
- Where questions → 地点信息回答
- When questions → 时间信息回答
- Who questions → 人物信息回答
- Why questions → 原因解释回答
- How questions → 方式方法回答

请确保题目符合TOEIC考试标准，答案解释清晰准确。

**重要提醒：请将正确答案随机分布在A、B、C三个选项中，避免大部分答案都是同一选项的情况。**

**重要：请直接返回JSON数组，不要使用Markdown代码块包装，不要添加任何其他文本。**
  `;
};
