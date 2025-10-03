export const buildWordDefinitionPrompt = (word: string, context?: string): string => {
  return `
作为英语词汇专家，请为以下单词提供详细的词汇信息，特别适合TOEIC学习者：

单词：${word}
${context ? `出现语境：${context}` : ''}

请以JSON格式返回，包含以下信息：
{
  "word": "${word}",
  "phonetic": "英式音标",
  "meanings": [
    {
      "partOfSpeech": "英文词性（如noun、verb、adjective等）",
      "partOfSpeechCN": "中文词性（如名词、动词、形容词等）",
      "partOfSpeechLocal": "中文词性",
      "definitions": [
        {
          "definition": "详细的中文释义",
          "example": "英文例句（最好与TOEIC相关）"
        }
      ]
    }
  ]
}

要求：
- 释义必须准确、通俗易懂
- 例句要实用，最好与商务、职场相关
- 如果单词有多个词性，请提供主要的2-3个

**重要：请直接返回JSON格式，不要使用Markdown代码块包装。**
  `;
};

export const buildVocabularyReviewPrompt = (words: string[], difficulty: string): string => {
  return `
作为TOEIC词汇教练，请为以下词汇设计复习计划：

词汇列表：${words.join(', ')}
学习难度：${difficulty}

请提供：
1. 词汇分组建议（按主题或难度）
2. 记忆策略（词根词缀、联想记忆等）
3. 复习时间安排
4. 练习方式建议
5. 掌握程度测试方法

要求：
- 计划要科学合理
- 方法要多样化
- 考虑遗忘曲线规律
- 用中文表达，控制在300字以内
  `;
};

export const buildWordUsagePrompt = (word: string, partOfSpeech: string): string => {
  return `
作为英语用法专家，请详细说明单词"${word}"作为${partOfSpeech}的用法：

请提供：
1. 基本用法规则
2. 常见搭配和短语
3. 在TOEIC中的考查重点
4. 3-5个实用例句（商务环境）
5. 使用时的注意事项

要求：
- 用法说明要准确详细
- 例句要地道实用
- 重点突出TOEIC相关性
- 用中文解释，控制在250字以内
  `;
};

export const buildSynonymAnalysisPrompt = (words: string[]): string => {
  return `
作为词汇辨析专家，请分析以下近义词的区别：

近义词组：${words.join(', ')}

请提供：
1. 每个词的核心含义
2. 使用场合的区别
3. 语域和正式程度对比
4. 在TOEIC中的常见考法
5. 记忆区分的技巧

要求：
- 对比要精准到位
- 举例要具体生动
- 用中文表达，逻辑清晰
- 控制在300字以内
  `;
};