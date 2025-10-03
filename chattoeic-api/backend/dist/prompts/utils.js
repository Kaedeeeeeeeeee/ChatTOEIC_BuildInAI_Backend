// 提示词工具函数
export const getDifficultyDescription = (difficulty) => {
    const descriptions = {
        'UNDER_500': '入门级（500分未满）',
        'LEVEL_500_600': '初级（500-600分水平）',
        'LEVEL_600_700': '中级（600-700分水平）',
        'LEVEL_700_800': '中高级（700-800分水平）',
        'OVER_800': '高级（800分以上水平）',
        // 向后兼容旧的难度级别
        'BEGINNER': '初级（500-600分水平）',
        'INTERMEDIATE': '中级（600-700分水平）',
        'ADVANCED': '高级（800分以上水平）'
    };
    return descriptions[difficulty] || difficulty;
};
export const getTypeDescription = (type) => {
    const descriptions = {
        'LISTENING_PART1': '听力Part1 图片描述题',
        'LISTENING_PART2': '听力Part2 应答问题',
        'LISTENING_PART3': '听力Part3 简短对话',
        'LISTENING_PART4': '听力Part4 简短独白',
        'READING_PART5': '阅读Part5 句子填空',
        'READING_PART6': '阅读Part6 段落填空',
        'READING_PART7': '阅读Part7 阅读理解'
    };
    return descriptions[type] || type;
};
