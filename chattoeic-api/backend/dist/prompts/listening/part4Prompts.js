import { getDifficultyDescription } from '../index.js';
export const part4QuestionPrompt = (difficulty, count, topic, customPrompt) => {
    return `
作为TOEIC题目生成专家，请生成${count}道听力Part4 简短独白题目。

要求：
- 难度：${getDifficultyDescription(difficulty)}
- 题目类型：LISTENING_PART4
- 返回格式：严格的JSON数组，每个题目包含以下字段：
  {
    "id": "唯一标识符",
    "type": "LISTENING_PART4",
    "difficulty": "${difficulty}",
    "question": "题目内容",
    "options": ["选项A", "选项B", "选项C", "选项D"],
    "correctAnswer": [0、1、2或3 - 确保答案均匀分布在四个选项中],
    "explanation": "详细解释",
    "passage": "独白内容（一个人的连续讲话）"
  }

${topic ? `题目主题：${topic}` : ''}
${customPrompt ? `特殊要求：${customPrompt}` : ''}

Part4 简短独白特殊要求：
- 每个题目基于一段独白（一个人连续讲话）
- 独白长度约30-60秒的内容
- 问题类型包括：主要目的、具体细节、说话者身份、听众对象等
- 常见独白类型：广告、公告、留言、介绍、指示等
- 重点训练：长篇听力理解、关键信息提取、逻辑推理

独白类型建议：
- 广告：产品宣传、服务介绍、促销活动
- 公告：会议通知、政策变更、重要消息
- 留言：电话留言、语音邮件、录音指示
- 介绍：公司介绍、人员介绍、流程说明
- 指示：操作指南、安全须知、使用说明

问题类型分布：
- 35% 主要目的题（独白的主要目标、说话者意图）
- 35% 细节信息题（时间、地点、价格、数量等）
- 20% 推理判断题（说话者身份、听众对象、后续行动）
- 10% 词汇理解题（专业术语、习语表达）

独白结构指导：
- 开头：明确主题和目的
- 中间：提供具体细节和信息
- 结尾：总结或行动号召

请确保题目符合TOEIC考试标准，答案解释清晰准确。

**重要提醒：请将正确答案随机分布在A、B、C、D四个选项中，避免大部分答案都是同一选项的情况。目标是在A、B、C、D选项中大致均匀分布正确答案。**

**重要：请直接返回JSON数组，不要使用Markdown代码块包装，不要添加任何其他文本。**
  `;
};
