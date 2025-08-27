export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
}
export interface PaginationParams {
    page?: number;
    limit?: number;
}
export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
}
export interface JWTPayload {
    userId: string;
    email: string;
    role: string;
    iat?: number;
    exp?: number;
}
export interface QuestionGenerationRequest {
    type: 'LISTENING_PART1' | 'LISTENING_PART2' | 'LISTENING_PART3' | 'LISTENING_PART4' | 'READING_PART5' | 'READING_PART6' | 'READING_PART7';
    difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
    count: number;
    topic?: string;
    customPrompt?: string;
}
export interface GeneratedQuestion {
    id: string;
    type: string;
    difficulty: string;
    question: string;
    options?: string[];
    correctAnswer: string;
    explanation: string;
    audioUrl?: string;
    imageUrl?: string;
    passage?: string;
}
export interface PracticeSubmission {
    sessionId: string;
    questions: Array<{
        questionId: string;
        userAnswer: string;
        timeSpent: number;
    }>;
}
export interface ChatRequest {
    message: string;
    sessionId?: string;
    context?: {
        questionId?: string;
        practiceSessionId?: string;
    };
}
export interface VocabularyRequest {
    word: string;
    context?: string;
}
export interface HealthStatus {
    status: 'healthy' | 'unhealthy';
    timestamp: string;
    uptime: number;
    version: string;
}
export interface DetailedHealthStatus extends HealthStatus {
    database: {
        connected: boolean;
        responseTime?: number;
    };
    memory: {
        used: number;
        free: number;
        total: number;
    };
    services: {
        gemini: {
            available: boolean;
            rateLimit?: {
                remaining: number;
                resetTime: string;
            };
        };
    };
}
