/**
 * 题目类型到分类映射工具
 * 处理不同题目类型与TOEIC Part分类之间的映射关系
 */

export type QuestionType = 
  | 'LISTENING_PART1' | 'LISTENING_PART2' | 'LISTENING_PART3' | 'LISTENING_PART4'
  | 'READING_PART5' | 'READING_PART6' | 'READING_PART7'
  | 'listening' | 'reading';

export type TOEICCategory = 
  | 'Part 1 - 照片描述' | 'Part 2 - 应答问题' | 'Part 3 - 简短对话' | 'Part 4 - 简短独白'
  | 'Part 5 - 语法填空' | 'Part 6 - 段落填空' | 'Part 7 - 阅读理解';

/**
 * 题目类型到分类的映射表
 */
const TYPE_TO_CATEGORY_MAP: Record<string, TOEICCategory> = {
  // 听力题目类型
  'LISTENING_PART1': 'Part 1 - 照片描述',
  'LISTENING_PART2': 'Part 2 - 应答问题', 
  'LISTENING_PART3': 'Part 3 - 简短对话',
  'LISTENING_PART4': 'Part 4 - 简短独白',
  'listening': 'Part 1 - 照片描述', // 通用听力默认为Part 1
  
  // 阅读题目类型
  'READING_PART5': 'Part 5 - 语法填空',
  'READING_PART6': 'Part 6 - 段落填空',
  'READING_PART7': 'Part 7 - 阅读理解',
  'reading': 'Part 5 - 语法填空', // 通用阅读默认为Part 5
};

/**
 * 分类到题目类型的反向映射表
 */
const CATEGORY_TO_TYPE_MAP: Record<TOEICCategory, QuestionType> = {
  'Part 1 - 照片描述': 'LISTENING_PART1',
  'Part 2 - 应答问题': 'LISTENING_PART2',
  'Part 3 - 简短对话': 'LISTENING_PART3',
  'Part 4 - 简短独白': 'LISTENING_PART4',
  'Part 5 - 语法填空': 'READING_PART5',
  'Part 6 - 段落填空': 'READING_PART6',
  'Part 7 - 阅读理解': 'READING_PART7',
};

/**
 * 根据题目类型获取对应的TOEIC分类
 */
export function getCategory(type: string): TOEICCategory {
  const normalizedType = type?.toLowerCase();
  
  // 直接映射
  if (TYPE_TO_CATEGORY_MAP[type]) {
    return TYPE_TO_CATEGORY_MAP[type];
  }
  
  // 模糊匹配
  if (normalizedType?.includes('listening')) {
    if (normalizedType.includes('part1') || normalizedType.includes('1')) {
      return 'Part 1 - 照片描述';
    } else if (normalizedType.includes('part2') || normalizedType.includes('2')) {
      return 'Part 2 - 应答问题';
    } else if (normalizedType.includes('part3') || normalizedType.includes('3')) {
      return 'Part 3 - 简短对话';
    } else if (normalizedType.includes('part4') || normalizedType.includes('4')) {
      return 'Part 4 - 简短独白';
    }
    return 'Part 1 - 照片描述'; // 听力默认
  }
  
  if (normalizedType?.includes('reading')) {
    if (normalizedType.includes('part5') || normalizedType.includes('5')) {
      return 'Part 5 - 语法填空';
    } else if (normalizedType.includes('part6') || normalizedType.includes('6')) {
      return 'Part 6 - 段落填空';
    } else if (normalizedType.includes('part7') || normalizedType.includes('7')) {
      return 'Part 7 - 阅读理解';
    }
    return 'Part 5 - 语法填空'; // 阅读默认
  }
  
  // 默认回退到Part 5
  return 'Part 5 - 语法填空';
}

/**
 * 根据分类获取对应的题目类型
 */
export function getType(category: string): QuestionType {
  const normalizedCategory = category as TOEICCategory;
  
  if (CATEGORY_TO_TYPE_MAP[normalizedCategory]) {
    return CATEGORY_TO_TYPE_MAP[normalizedCategory];
  }
  
  // 模糊匹配
  if (category?.includes('Part 1') || category?.includes('照片描述')) {
    return 'LISTENING_PART1';
  } else if (category?.includes('Part 2') || category?.includes('应答问题')) {
    return 'LISTENING_PART2';
  } else if (category?.includes('Part 3') || category?.includes('简短对话')) {
    return 'LISTENING_PART3';
  } else if (category?.includes('Part 4') || category?.includes('简短独白')) {
    return 'LISTENING_PART4';
  } else if (category?.includes('Part 5') || category?.includes('语法填空')) {
    return 'READING_PART5';
  } else if (category?.includes('Part 6') || category?.includes('段落填空')) {
    return 'READING_PART6';
  } else if (category?.includes('Part 7') || category?.includes('阅读理解')) {
    return 'READING_PART7';
  }
  
  // 默认回退
  return 'READING_PART5';
}

/**
 * 验证分类是否有效
 */
export function isValidCategory(category: string): boolean {
  return Object.values(TYPE_TO_CATEGORY_MAP).includes(category as TOEICCategory);
}

/**
 * 验证题目类型是否有效
 */
export function isValidType(type: string): boolean {
  return Object.keys(TYPE_TO_CATEGORY_MAP).includes(type);
}

/**
 * 获取所有支持的分类列表
 */
export function getAllCategories(): TOEICCategory[] {
  return Object.values(TYPE_TO_CATEGORY_MAP).filter((value, index, self) => 
    self.indexOf(value) === index
  );
}

/**
 * 获取所有支持的题目类型列表
 */
export function getAllTypes(): QuestionType[] {
  return Object.keys(TYPE_TO_CATEGORY_MAP) as QuestionType[];
}

/**
 * 修复错误的分类
 * 将"未分类"或其他无效分类转换为正确的分类
 */
export function fixCategory(category: string, type?: string): TOEICCategory {
  // 如果分类有效，直接返回
  if (isValidCategory(category)) {
    return category as TOEICCategory;
  }
  
  // 如果分类无效或为"未分类"，根据类型推断
  if (type) {
    return getCategory(type);
  }
  
  // 默认回退
  return 'Part 5 - 语法填空';
}

/**
 * 批量修复题目分类
 */
export function fixQuestionCategories(questions: Array<{ category?: string; type?: string; questionType?: string }>): Array<{ category: TOEICCategory }> {
  return questions.map(q => ({
    ...q,
    category: fixCategory(
      q.category || '未分类',
      q.type || q.questionType
    )
  }));
}