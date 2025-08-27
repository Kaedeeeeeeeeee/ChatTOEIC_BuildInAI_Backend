import { QuestionGenerationRequest, GeneratedQuestion } from '../types/index.js';
declare class GeminiService {
    private genAI;
    private model;
    constructor();
    generateQuestions(request: QuestionGenerationRequest): Promise<GeneratedQuestion[]>;
    chatResponse(message: string, context?: any): Promise<string>;
    explainAnswer(question: string, userAnswer: string, correctAnswer: string): Promise<string>;
    private buildQuestionPrompt;
    private buildChatPrompt;
    private getTypeDescription;
    private getDifficultyDescription;
    private validateAndFormatQuestions;
}
export declare const geminiService: GeminiService;
export {};
