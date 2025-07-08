import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { VocabularyWord, VocabularyFilter, VocabularyExportData, StorageStatus } from '../models/vocabulary.model';
import { VocabularyLevelUtils } from '../models/vocabulary-level.constants';

@Injectable({
  providedIn: 'root'
})
export class VocabularyService {
  private readonly DB_NAME = 'VocabularyBookDB';
  private readonly DB_VERSION = 1;
  private readonly STORE_NAME = 'vocabulary';
  private readonly STORAGE_TYPE_KEY = 'vocabulary_storage_type';
  private readonly LOCALSTORAGE_KEY = 'vocabulary_book';

  private readonly vocabularyData$ = new BehaviorSubject<VocabularyWord[]>([]);
  private readonly filteredData$ = new BehaviorSubject<VocabularyWord[]>([]);
  private useIndexedDB = false;
  private db: IDBDatabase | null = null;

  constructor() {
    this.initializeStorageType();
    // 使用 setTimeout 避免在 constructor 中執行異步操作
    setTimeout(() => {
      this.loadVocabularyData().catch(error => {
        console.error('載入資料失敗:', error);
      });
    }, 0);
  }

  /**
   * 取得vocabulary資料流
   */
  getVocabularyData(): Observable<VocabularyWord[]> {
    return this.vocabularyData$.asObservable();
  }

  /**
   * 取得過濾後的vocabulary資料流
   */
  getFilteredData(): Observable<VocabularyWord[]> {
    return this.filteredData$.asObservable();
  }

  /**
   * 初始化儲存類型 - 預設使用 IndexedDB，不支援時才用 LocalStorage
   */
  private initializeStorageType(): void {
    const savedType = localStorage.getItem(this.STORAGE_TYPE_KEY);
    const supportsIndexedDB = this.isIndexedDBSupported();

    // 預設使用 IndexedDB（如果支援的話）
    if (!savedType) {
      this.useIndexedDB = supportsIndexedDB;
      localStorage.setItem(this.STORAGE_TYPE_KEY, this.useIndexedDB ? 'indexeddb' : 'localstorage');
    } else {
      // 使用已儲存的設定，但確保瀏覽器支援
      this.useIndexedDB = savedType === 'indexeddb' && supportsIndexedDB;
    }
  }

  /**
   * 檢查 IndexedDB 是否支援
   */
  private isIndexedDBSupported(): boolean {
    return typeof window !== 'undefined' && 'indexedDB' in window;
  }

  /**
   * 初始化 IndexedDB
   */
  async initIndexedDB(): Promise<boolean> {
    if (!this.useIndexedDB || !this.isIndexedDBSupported()) {
      return false;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => {
        console.error('IndexedDB 開啟失敗');
        reject(new Error('IndexedDB 開啟失敗'));
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve(true);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
          store.createIndex('word', 'word', { unique: false });
          store.createIndex('level', 'level', { unique: false });
        }
      };
    });
  }

  /**
   * 載入vocabulary資料
   */
  async loadVocabularyData(): Promise<void> {
    try {
      if (this.useIndexedDB) {
        await this.initIndexedDB();
      }

      let data = await this.loadData();
      data = this.sortVocabularyData(data);

      this.vocabularyData$.next(data);
      this.filteredData$.next(data);
    } catch (error) {
      console.error('載入vocabulary資料失敗:', error);
    }
  }

  /**
   * 排序生字資料：先按難度等級（1=不熟在最上面，3=記住了在最下面），再按單字字母順序
   */
  private sortVocabularyData(data: VocabularyWord[]): VocabularyWord[] {
    return data.sort((a, b) => {
      // 首先按等級排序 (1->3)
      if (a.level !== b.level) {
        return a.level - b.level;
      }
      // 等級相同時，按單字字母順序排序
      return a.word.toLowerCase().localeCompare(b.word.toLowerCase());
    });
  }

  /**
   * 載入資料
   */
  private async loadData(): Promise<VocabularyWord[]> {
    if (this.useIndexedDB && this.db) {
      return this.loadFromIndexedDB();
    } else {
      return this.loadFromLocalStorage();
    }
  }

  /**
   * 儲存資料
   */
  async saveData(data: VocabularyWord[]): Promise<void> {
    const sortedData = this.sortVocabularyData([...data]);

    if (this.useIndexedDB && this.db) {
      await this.saveToIndexedDB(sortedData);
    } else {
      this.saveToLocalStorage(sortedData);
    }
    this.vocabularyData$.next(sortedData);
    this.applyFilter({}); // 重新應用過濾器
  }

  /**
   * 從 IndexedDB 載入資料
   */
  private loadFromIndexedDB(): Promise<VocabularyWord[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('IndexedDB 未初始化'));
        return;
      }

      const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(new Error('從 IndexedDB 載入資料失敗'));
      };
    });
  }

  /**
   * 從 LocalStorage 載入資料
   */
  private loadFromLocalStorage(): VocabularyWord[] {
    try {
      const data = localStorage.getItem(this.LOCALSTORAGE_KEY);
      if (!data) return [];

      return JSON.parse(data);
    } catch (error) {
      console.error('從 LocalStorage 載入資料失敗:', error);
      return [];
    }
  }

  /**
   * 儲存資料到 IndexedDB
   */
  private async saveToIndexedDB(data: VocabularyWord[]): Promise<void> {
    if (!this.db) {
      throw new Error('IndexedDB 未初始化');
    }

    const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
    const store = transaction.objectStore(this.STORE_NAME);

    // 先清空現有資料
    await new Promise<void>((resolve, reject) => {
      const clearRequest = store.clear();
      clearRequest.onsuccess = () => resolve();
      clearRequest.onerror = () => reject(new Error('清空資料失敗'));
    });

    // 新增所有資料
    for (const item of data) {
      await new Promise<void>((resolve, reject) => {
        const addRequest = store.add(item);
        addRequest.onsuccess = () => resolve();
        addRequest.onerror = () => reject(new Error('新增資料失敗'));
      });
    }
  }

  /**
   * 儲存資料到 LocalStorage
   */
  private saveToLocalStorage(data: VocabularyWord[]): void {
    try {
      localStorage.setItem(this.LOCALSTORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('儲存資料到 LocalStorage 失敗:', error);
    }
  }

  /**
   * 新增或更新單字
   */
  async addWord(word: VocabularyWord): Promise<void> {
    const currentData = [...this.vocabularyData$.value];

    // 首先嘗試根據 ID 查找（優先用於編輯模式）
    let existingIndex = currentData.findIndex(item => item.id === word.id);

    if (existingIndex >= 0) {
      // 根據 ID 找到現有單字，直接更新
      currentData[existingIndex] = {
        ...word,
        createdAt: currentData[existingIndex].createdAt, // 保留原建立時間
        updatedAt: new Date() // 更新修改時間
      };
    } else {
      // ID 沒找到，檢查是否有相同單字文字（用於新增模式的重複檢查）
      existingIndex = currentData.findIndex(item =>
        item.word.toLowerCase() === word.word.toLowerCase()
      );

      if (existingIndex >= 0) {
        // 找到相同單字文字，覆蓋現有單字但保留原 ID 和 createdAt
        const existingWord = currentData[existingIndex];
        currentData[existingIndex] = {
          ...word,
          id: existingWord.id, // 保留原 ID
          createdAt: existingWord.createdAt, // 保留原建立時間
          updatedAt: new Date() // 更新修改時間
        };
      } else {
        // 完全新的單字
        if (!word.id) {
          word.id = this.generateId();
        }
        if (!word.createdAt) {
          word.createdAt = new Date();
        }
        word.updatedAt = new Date();
        currentData.push(word);
      }
    }

    await this.saveData(currentData);
  }

  /**
   * 刪除單字
   */
  async deleteWord(wordId: string): Promise<void> {
    const currentData = this.vocabularyData$.value;
    const updatedData = currentData.filter(item => item.id !== wordId);
    await this.saveData(updatedData);
  }

  /**
   * 應用過濾器
   */
  applyFilter(filter: VocabularyFilter): void {
    let filtered = this.vocabularyData$.value;

    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      filtered = filtered.filter(item =>
        item.word.toLowerCase().includes(searchLower) ||
        item.translation.toLowerCase().includes(searchLower)
      );
    }

    if (filter.level !== undefined) {
      filtered = filtered.filter(item => item.level === filter.level);
    }

    // 套用排序
    filtered = this.sortVocabularyData(filtered);

    this.filteredData$.next(filtered);
  }

  /**
   * 獲取儲存狀態
   */
  getStorageStatus(): StorageStatus {
    return {
      current: this.useIndexedDB ? 'IndexedDB' : 'LocalStorage',
      useIndexedDB: this.useIndexedDB,
      supported: {
        localStorage: typeof Storage !== 'undefined',
        indexedDB: this.isIndexedDBSupported()
      }
    };
  }

  /**
   * 切換儲存引擎 - 包含清除舊資料邏輯
   */
  async switchStorageEngine(useIndexedDB: boolean): Promise<boolean> {
    try {
      if (this.useIndexedDB === useIndexedDB) {
        return true; // 沒有變化
      }

      // 先確保記憶體中的資料已儲存到當前儲存源
      const memoryData = this.vocabularyData$.value;
      if (memoryData.length > 0) {
        await this.saveData(memoryData);
        console.log(`先將記憶體中的 ${memoryData.length} 個單字儲存到當前儲存源`);
      }

      // 重新從當前儲存源載入最新資料
      const currentData = await this.loadData();
      console.log(`切換儲存引擎前載入了 ${currentData.length} 個單字`);

      const oldUseIndexedDB = this.useIndexedDB;

      // 更新儲存類型
      this.useIndexedDB = useIndexedDB;
      localStorage.setItem(this.STORAGE_TYPE_KEY, useIndexedDB ? 'indexeddb' : 'localstorage');

      // 如果要切換到 IndexedDB，先初始化
      if (useIndexedDB) {
        await this.initIndexedDB();
      }

      // 儲存資料到新的儲存引擎
      await this.saveData(currentData);
      console.log(`已將 ${currentData.length} 個單字儲存到${useIndexedDB ? 'IndexedDB' : 'LocalStorage'}`);

      // 清除舊引擎的資料
      if (oldUseIndexedDB && !useIndexedDB) {
        // 從 IndexedDB 切換到 LocalStorage，清空 IndexedDB
        await this.clearIndexedDB();
      } else if (!oldUseIndexedDB && useIndexedDB) {
        // 從 LocalStorage 切換到 IndexedDB，清空 LocalStorage
        this.clearLocalStorage();
      }

      // 重新載入資料以確保同步
      await this.loadVocabularyData();

      return true;
    } catch (error) {
      console.error('切換儲存引擎失敗:', error);
      return false;
    }
  }

  /**
   * 清空 IndexedDB 資料
   */
  private async clearIndexedDB(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        console.log('已清空 IndexedDB 資料');
        resolve();
      };

      request.onerror = () => {
        console.warn('清空 IndexedDB 失敗');
        resolve(); // 即使失敗也繼續
      };
    });
  }

  /**
   * 清空 LocalStorage 資料
   */
  private clearLocalStorage(): void {
    try {
      localStorage.removeItem(this.LOCALSTORAGE_KEY);
      console.log('已清空 LocalStorage 資料');
    } catch (error) {
      console.warn('清空 LocalStorage 失敗:', error);
    }
  }

  /**
   * 匯出資料
   */
  async exportData(): Promise<VocabularyExportData> {
    const data = this.vocabularyData$.value;
    return {
      vocabulary: data,
      version: '2.0',
      exportDate: new Date()
    };
  }

  /**
   * 匯入資料
   */
  async importData(importedData: VocabularyExportData): Promise<void> {
    if (!importedData.vocabulary || !Array.isArray(importedData.vocabulary)) {
      throw new Error('無效的匯入資料格式');
    }

    await this.saveData(importedData.vocabulary);
  }

  /**
   * 取得難度等級文字
   */
  getLevelText(level: number): string {
    return VocabularyLevelUtils.levelToLabel(level);
  }

  /**
   * 產生唯一ID
   */
  generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  /**
   * 取得所有單字資料
   */
  getAllWords(): VocabularyWord[] {
    return this.vocabularyData$.value;
  }

  /**
   * 根據單字文字查找已存在的單字
   */
  findWordByText(wordText: string): VocabularyWord | undefined {
    const allWords = this.getAllWords();
    return allWords.find(w => w.word.toLowerCase() === wordText.toLowerCase());
  }

  /**
   * 公開方法：手動初始化服務（用於確保資料載入）
   */
  async initialize(): Promise<void> {
    if (this.vocabularyData$.value.length === 0) {
      await this.loadVocabularyData();
    }
  }

  /**
   * 取得目前的儲存類型
   */
  getStorageType(): 'localStorage' | 'indexedDB' {
    return this.useIndexedDB ? 'indexedDB' : 'localStorage';
  }
}
