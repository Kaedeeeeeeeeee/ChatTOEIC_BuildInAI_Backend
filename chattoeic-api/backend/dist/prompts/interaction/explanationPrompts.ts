export const buildAnswerExplanationPrompt = (question: string, userAnswer: string, correctAnswer: string): string => {
  return `
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
};

export const buildGrammarExplanationPrompt = (grammarPoint: string, example?: string): string => {
  return `
作为TOEIC语法专家，请详细解释以下语法点：

语法点：${grammarPoint}
${example ? `例句：${example}` : ''}

请提供：
1. 语法规则的清晰解释
2. 在TOEIC考试中的常见考查方式
3. 2-3个实用例句
4. 易错点提醒
5. 记忆技巧或学习建议

要求：
- 用中文解释，术语准确
- 例句应与商务环境相关
- 解释要循序渐进，由简到难
- 控制在300字以内
  `;
};

export const buildErrorAnalysisPrompt = (questionType: string, commonErrors: string[]): string => {
  return `
作为TOEIC学习分析师，请分析${questionType}题型的常见错误：

常见错误类型：${commonErrors.join(', ')}

请提供：
1. 每种错误的具体表现
2. 错误产生的根本原因
3. 避免错误的具体策略
4. 针对性的练习建议

要求：
- 分析要深入到位
- 建议要具体可操作
- 用中文表达，通俗易懂
- 控制在250字以内
  `;
};

export const buildQuestionTypeAnalysisPrompt = (questionType: string, difficulty: string): string => {
  return `
作为TOEIC题型专家，请分析${questionType}题型在${difficulty}难度下的特点：

请提供：
1. 该题型的核心考查点
2. ${difficulty}难度的具体表现
3. 解题策略和技巧
4. 时间分配建议
5. 提升方法

要求：
- 分析要专业准确
- 策略要实用有效
- 用中文表达，结构清晰
- 控制在300字以内
  `;
};