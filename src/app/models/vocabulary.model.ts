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
