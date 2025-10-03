// 导入所有提示词函数
import { part1QuestionPrompt } from './listening/part1Prompts.js';
import { part2QuestionPrompt } from './listening/part2Prompts.js';
import { part3QuestionPrompt } from './listening/part3Prompts.js';
import { part4QuestionPrompt } from './listening/part4Prompts.js';
import { part5QuestionPrompt } from './reading/part5Prompts.js';
import { part6QuestionPrompt } from './reading/part6Prompts.js';
import { part7QuestionPrompt } from './reading/part7Prompts.js';
// 听力部分提示词
export { part1QuestionPrompt } from './listening/part1Prompts.js';
export { part2QuestionPrompt } from './listening/part2Prompts.js';
export { part3QuestionPrompt } from './listening/part3Prompts.js';
export { part4QuestionPrompt } from './listening/part4Prompts.js';
// 阅读部分提示词
export { part5QuestionPrompt } from './reading/part5Prompts.js';
export { part6QuestionPrompt } from './reading/part6Prompts.js';
export { part7QuestionPrompt } from './reading/part7Prompts.js';
// 交互功能提示词
export { buildChatPrompt, generalChatPrompt, encouragementPrompt } from './interaction/chatPrompts.js';
export { buildAnswerExplanationPrompt, buildGrammarExplanationPrompt, buildErrorAnalysisPrompt, buildQuestionTypeAnalysisPrompt } from './interaction/explanationPrompts.js';
export { buildWordDefinitionPrompt, buildVocabularyReviewPrompt, buildWordUsagePrompt, buildSynonymAnalysisPrompt } from './interaction/vocabularyPrompts.js';
// 提示词映射函数，用于根据题目类型选择对应的提示词函数
export const getQuestionPromptFunction = (questionType) => {
    const promptMap = {
        'LISTENING_PART1': part1QuestionPrompt,
        'LISTENING_PART2': part2QuestionPrompt,
        'LISTENING_PART3': part3QuestionPrompt,
        'LISTENING_PART4': part4QuestionPrompt,
        'READING_PART5': part5QuestionPrompt,
        'READING_PART6': part6QuestionPrompt,
        'READING_PART7': part7QuestionPrompt,
    };
    return promptMap[questionType] || part5QuestionPrompt; // 默认使用Part5
};
// 重新导出工具函数
export { getDifficultyDescription, getTypeDescription } from './utils.js';
