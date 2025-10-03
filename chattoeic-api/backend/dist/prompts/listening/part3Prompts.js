import { getDifficultyDescription } from '../index.js';
export const part3QuestionPrompt = (difficulty, count, topic, customPrompt) => {
    return `
作为TOEIC题目生成专家，请生成${count}道听力Part3 简短对话题目。

要求：
- 难度：${getDifficultyDescription(difficulty)}
- 题目类型：LISTENING_PART3
- 返回格式：严格的JSON数组，每个题目包含以下字段：
  {
    "id": "唯一标识符",
    "type": "LISTENING_PART3",
    "difficulty": "${difficulty}",
    "question": "题目内容",
    "options": ["选项A", "选项B", "选项C", "选项D"],
    "correctAnswer": [0、1、2或3 - 确保答案均匀分布在四个选项中],
    "explanation": "详细解释",
    "passage": "对话内容（2-3人之间的对话）"
  }

${topic ? `题目主题：${topic}` : ''}
${customPrompt ? `特殊要求：${customPrompt}` : ''}

Part3 简短对话特殊要求：
- 每个题目基于一段2-3人之间的简短对话
- 对话长度约2-4轮交流
- 问题类型包括：主要话题、细节信息、说话者意图、下一步行动等
- 常见场景：商务会议、客户服务、办公室交流、电话对话等
- 重点训练：听力理解、推理判断、细节把握

对话场景建议：
- 办公室：会议安排、项目讨论、工作分配
- 客户服务：产品咨询、投诉处理、订单确认
- 商务：合同谈判、价格讨论、时间安排
- 日常：餐厅预订、交通咨询、购物询问

问题类型分布：
- 40% 细节信息题（时间、地点、数量等）
- 30% 主旨大意题（对话目的、主要话题）
- 20% 推理判断题（说话者态度、下一步行动）
- 10% 词汇理解题（特定词汇在语境中的含义）

请确保题目符合TOEIC考试标准，答案解释清晰准确。

**重要提醒：请将正确答案随机分布在A、B、C、D四个选项中，避免大部分答案都是同一选项的情况。目标是在A、B、C、D选项中大致均匀分布正确答案。**

**重要：请直接返回JSON数组，不要使用Markdown代码块包装，不要添加任何其他文本。**
  `;
};
