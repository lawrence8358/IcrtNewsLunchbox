export interface VocabularySource {
  title: string;
  topicId: string;
  section?: string;
}

export interface VocabularyWord {
  id: string;
  word: string;
  phonetic?: string;
  translation: string;
  partOfSpeech?: string;
  level: number; // 改回數字類型: 1=不熟, 2=尚可, 3=記住了
  sources: VocabularySource[];
  createdAt: Date;
  updatedAt: Date;
}

export interface VocabularyFilter {
  level?: number; // 改回數字類型
  search?: string;
}

export interface VocabularyExportData {
  vocabulary: VocabularyWord[];
  version: string;
  exportDate: Date;
}

export interface StorageExportData {
  version: string;
  exportDate: string;
  storageType: 'localStorage' | 'indexedDB';
  vocabulary: VocabularyWord[];
}

export interface StorageStatus {
  current: string;
  useIndexedDB: boolean;
  supported: {
    localStorage: boolean;
    indexedDB: boolean;
  };
}

export interface ContextMenuPosition {
  x: number;
  y: number;
}

// 測驗相關模型
export interface QuizSettings {
  selectedLevels: number[]; // 選中的熟悉程度
  questionCount: number; // 題目數量
}

export interface QuizQuestion {
  id: string;
  word: VocabularyWord;
  userAnswer: string;
  isCorrect: boolean;
  originalLevel: number;
  newLevel?: number; // 用戶可能修改的新熟悉程度
}

export interface QuizResult {
  totalQuestions: number;
  correctAnswers: number;
  score: number; // 百分比
  questions: QuizQuestion[];
  completedAt: Date;
  duration: number; // 測驗時間（毫秒）
  settings: QuizSettings;
}

// 測驗狀態
export enum QuizState {
  SETUP = 'setup',
  IN_PROGRESS = 'in-progress',
  COMPLETED = 'completed'
}
