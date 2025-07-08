/**
 * 生字難度等級常數和轉換工具
 */

export interface VocabularyLevelInfo {
  id: number;
  key: string;
  label: string;
  badgeClass: string;
  cssClass: string;
}

/**
 * 生字難度等級定義
 */
export const VOCABULARY_LEVELS: Record<number, VocabularyLevelInfo> = {
  1: {
    id: 1,
    key: 'unknown',
    label: '不熟',
    badgeClass: 'bg-danger',
    cssClass: 'unknown'
  },
  2: {
    id: 2,
    key: 'fair',
    label: '尚可',
    badgeClass: 'bg-warning',
    cssClass: 'fair'
  },
  3: {
    id: 3,
    key: 'known',
    label: '記住了',
    badgeClass: 'bg-success',
    cssClass: 'known'
  }
};

/**
 * 根據 key 查找等級資訊的對照表
 */
export const VOCABULARY_LEVELS_BY_KEY: Record<string, VocabularyLevelInfo> = {
  'unknown': VOCABULARY_LEVELS[1],
  'fair': VOCABULARY_LEVELS[2],
  'known': VOCABULARY_LEVELS[3]
};

/**
 * 生字難度等級工具類
 */
export class VocabularyLevelUtils {
  /**
   * 將數字等級轉換為字串 key
   */
  static levelToKey(level: number): string {
    return VOCABULARY_LEVELS[level]?.key || 'unknown';
  }

  /**
   * 將字串 key 轉換為數字等級
   */
  static keyToLevel(key: string): number {
    return VOCABULARY_LEVELS_BY_KEY[key]?.id || 1;
  }

  /**
   * 將數字等級轉換為顯示標籤
   */
  static levelToLabel(level: number): string {
    return VOCABULARY_LEVELS[level]?.label || '不熟';
  }

  /**
   * 將字串 key 轉換為顯示標籤
   */
  static keyToLabel(key: string): string {
    return VOCABULARY_LEVELS_BY_KEY[key]?.label || '不熟';
  }

  /**
   * 取得等級的 CSS 類別
   */
  static getLevelClass(level: number): string {
    return VOCABULARY_LEVELS[level]?.cssClass || 'unknown';
  }

  /**
   * 取得等級的徽章 CSS 類別
   */
  static getLevelBadgeClass(level: number): string {
    return VOCABULARY_LEVELS[level]?.badgeClass || 'bg-danger';
  }

  /**
   * 取得所有等級選項（用於下拉選單）
   */
  static getAllLevels(): VocabularyLevelInfo[] {
    return Object.values(VOCABULARY_LEVELS);
  }

  /**
   * 檢查等級是否有效
   */
  static isValidLevel(level: number): boolean {
    return level >= 1 && level <= 3;
  }

  /**
   * 檢查等級 key 是否有效
   */
  static isValidKey(key: string): boolean {
    return key in VOCABULARY_LEVELS_BY_KEY;
  }
}
