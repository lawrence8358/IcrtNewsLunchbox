export interface ContentItem {
  en: string;
  tw: string;
  time?: string | number;
}

export interface VocabularyItem {
  text: string;
  time?: string | number;
}

export interface Vocabulary {
  preface?: string;
  content: VocabularyItem[];
  postscript?: string;
}

export interface QuizOption {
  value: string;
  text: string;
}

export interface Quiz {
  question: string;
  options: string[];
  answer: string;
  time?: string | number;
}

export interface Topic {
  id: string;
  type: string;
  tag: string[];
  title: string;
  audio?: string;
  content: ContentItem[];
  vocabulary?: Vocabulary;
  quiz?: Quiz[];
  learningStatus?: 'learned' | 'learning' | 'not-started'; // 學習狀態
}

export interface AppSettings {
  lastMonth: string;
  lastSearch: string;
  lastType: string;
  lastTag: string;
  lastLearningStatus?: string; // 學習狀態查詢記憶，設為可選以保持向後相容性
}

export interface VocabularyBookItem {
  id: string;
  topicId: string;
  topicTitle: string;
  topicType: string;
  topicDate: string;
  word: string;
  definition: string;
  example: string;
  level: string;
  addedDate: string;
  reviewCount: number;
  lastReviewDate?: string;
  masteredLevel: number;
  notes?: string;
  sourceType: 'content' | 'vocabulary';
  sourceIndex: number;
}

export interface StorageExportData {
  version: string;
  exportDate: string;
  storageType: 'localstorage' | 'indexeddb';
  vocabulary: VocabularyBookItem[];
}
