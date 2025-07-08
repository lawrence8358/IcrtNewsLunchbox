import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { VocabularyService } from '../../services/vocabulary.service';
import { NotificationService } from '../../services/notification.service';
import { VocabularyWord, VocabularySource } from '../../models/vocabulary.model';
import { VocabularyLevelUtils } from '../../models/vocabulary-level.constants';

@Component({
  selector: 'app-add-word-dialog',
  imports: [CommonModule, FormsModule],
  templateUrl: './add-word-dialog.component.html',
  styleUrl: './add-word-dialog.component.less'
})
export class AddWordDialogComponent implements OnInit {
  activeModal = inject(NgbActiveModal);

  // 輸入資料
  wordId = '';
  word = '';
  phonetic = '';
  translation = '';
  level = ''; // 改為字串類型，與原始功能一致
  sources: VocabularySource[] = [];

  // 編輯模式
  isEditMode = false;
  originalWord: VocabularyWord | null = null;

  // 表單驗證狀態
  wordError = false;
  translationError = false;
  levelError = false;

  constructor(
    private readonly vocabularyService: VocabularyService,
    private readonly notificationService: NotificationService
  ) { }

  ngOnInit(): void {
    this.initializeDialog();
  }

  /**
   * 初始化對話框
   */
  private async initializeDialog(): Promise<void> {
    if (this.originalWord) {
      // 編輯模式
      this.isEditMode = true;
      this.loadEditData();
    } else {
      // 新增模式
      this.isEditMode = false;
      this.wordId = this.vocabularyService.generateId();
      await this.loadNewWordData();
    }
  }

  /**
   * 載入編輯模式資料
   */
  private loadEditData(): void {
    if (!this.originalWord) return;

    this.wordId = this.originalWord.id;
    this.word = this.originalWord.word;
    this.phonetic = this.originalWord.phonetic ?? '';
    this.translation = this.originalWord.translation ?? '';
    this.level = VocabularyLevelUtils.levelToKey(this.originalWord.level);
    this.sources = [...this.originalWord.sources];
  }

  /**
   * 載入新增模式資料（檢查是否已存在相同單字）
   */
  private async loadNewWordData(): Promise<void> {
    if (!this.word) return;

    // 檢查是否已存在相同單字
    const existingWord = this.vocabularyService.findWordByText(this.word);

    if (existingWord) {
      // 如果已存在，載入現有資料
      this.phonetic = existingWord.phonetic ?? '';
      this.translation = existingWord.translation ?? '';
      this.level = VocabularyLevelUtils.levelToKey(existingWord.level);

      // 複製現有來源並合併新來源
      const existingSources = [...existingWord.sources];
      const newSources = [...this.sources];

      // 合併來源，避免重複
      for (const newSource of newSources) {
        const exists = existingSources.some(s =>
          s.topicId === newSource.topicId && s.title === newSource.title
        );
        if (!exists) {
          existingSources.push(newSource);
        }
      }

      this.sources = existingSources;
    }
  }

  /**
   * 儲存單字
   */
  async saveWord(): Promise<void> {
    if (!this.validateForm()) {
      return;
    }

    try {
      const { finalWordId, finalSources } = await this.prepareSaveData();

      const vocabularyWord: VocabularyWord = {
        id: finalWordId,
        word: this.word.trim(),
        phonetic: this.phonetic.trim() || undefined,
        translation: this.translation.trim(),
        level: VocabularyLevelUtils.keyToLevel(this.level),
        sources: finalSources,
        createdAt: this.originalWord?.createdAt || new Date(),
        updatedAt: new Date()
      };

      await this.vocabularyService.addWord(vocabularyWord);

      // 統一通知訊息格式，包含單字本身
      const message = this.isEditMode
        ? `已更新「${vocabularyWord.word}」`
        : `已將「${vocabularyWord.word}」加入生字簿`;
      this.notificationService.showSuccess(message);

      this.activeModal.close(vocabularyWord);
    } catch (error) {
      if (error instanceof Error && error.message === '使用者取消操作') {
        // 使用者取消操作，不顯示錯誤
        return;
      }
      console.error('儲存單字失敗:', error);
      this.notificationService.showError('儲存失敗');
    }
  }

  /**
   * 準備儲存資料
   */
  private async prepareSaveData(): Promise<{ finalWordId: string; finalSources: VocabularySource[] }> {
    if (this.isEditMode) {
      return await this.handleEditMode();
    } else {
      return this.handleNewMode();
    }
  }

  /**
   * 處理編輯模式邏輯
   */
  private async handleEditMode(): Promise<{ finalWordId: string; finalSources: VocabularySource[] }> {
    // 編輯模式：檢查是否修改了單字文字
    if (this.originalWord && this.word.trim().toLowerCase() !== this.originalWord.word.toLowerCase()) {
      // 單字文字有變更，檢查新文字是否與其他單字重複
      const existingWord = this.vocabularyService.findWordByText(this.word);
      if (existingWord && existingWord.id !== this.originalWord.id) {
        // 與其他現有單字重複，詢問是否合併
        const shouldMerge = confirm(`單字「${this.word}」已存在，是否要將來源合併至現有單字？`);
        if (shouldMerge) {
          // 合併到現有單字
          const finalSources = this.mergeSourcesWithExisting(existingWord);
          // 刪除原始單字
          await this.vocabularyService.deleteWord(this.originalWord.id);
          return { finalWordId: existingWord.id, finalSources };
        } else {
          // 使用者取消
          throw new Error('使用者取消操作');
        }
      }
    }

    // 沒有重複或單字文字沒有變更，使用原有 ID
    return { finalWordId: this.wordId, finalSources: [...this.sources] };
  }

  /**
   * 處理新增模式邏輯
   */
  private handleNewMode(): { finalWordId: string; finalSources: VocabularySource[] } {
    const existingWord = this.vocabularyService.findWordByText(this.word);
    if (existingWord) {
      // 單字已存在，使用現有ID並合併來源
      return {
        finalWordId: existingWord.id,
        finalSources: this.mergeSourcesWithExisting(existingWord)
      };
    }

    // 新單字
    return { finalWordId: this.wordId, finalSources: [...this.sources] };
  }

  /**
   * 與現有單字合併來源
   */
  private mergeSourcesWithExisting(existingWord: VocabularyWord): VocabularySource[] {
    const mergedSources = [...existingWord.sources];

    // 合併新來源，避免重複
    for (const newSource of this.sources) {
      const exists = mergedSources.some(s =>
        s.topicId === newSource.topicId && s.title === newSource.title
      );
      if (!exists) {
        mergedSources.push(newSource);
      }
    }

    return mergedSources;
  }

  /**
   * 取消操作
   */
  cancel(): void {
    this.activeModal.dismiss();
  }

  /**
   * 表單驗證
   */
  private validateForm(): boolean {
    // 重置錯誤狀態
    this.wordError = false;
    this.translationError = false;
    this.levelError = false;

    let isValid = true;
    let firstErrorField: string | null = null;

    // 檢查單字
    if (!this.word.trim()) {
      this.wordError = true;
      isValid = false;
      firstErrorField ??= 'word';
    }


    // 檢查難度等級
    if (!this.level) {
      this.levelError = true;
      isValid = false;
      firstErrorField ??= 'level';
    }

    // 如果有錯誤，滾動到第一個錯誤欄位
    if (!isValid && firstErrorField) {
      this.scrollToField(firstErrorField);
      this.notificationService.showError('請填寫必要欄位');
    }

    return isValid;
  }

  /**
   * 滾動到指定欄位
   */
  private scrollToField(fieldName: string): void {
    setTimeout(() => {
      const element = document.getElementById(fieldName);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.focus();
      }
    }, 100);
  }

  /**
   * 移除來源
   */
  removeSource(index: number): void {
    this.sources.splice(index, 1);
  }

  /**
   * 刪除單字
   */
  async deleteWord(): Promise<void> {
    if (!this.isEditMode || !this.originalWord) {
      return;
    }

    if (confirm(`確定要刪除單字「${this.word}」嗎？`)) {
      try {
        await this.vocabularyService.deleteWord(this.originalWord.id);
        this.notificationService.showSuccess('單字已刪除');
        this.activeModal.close({ deleted: true });
      } catch (error) {
        console.error('刪除單字失敗:', error);
        this.notificationService.showError('刪除失敗');
      }
    }
  }

  /**
   * 設定編輯資料
   */
  setEditData(word: VocabularyWord): void {
    this.originalWord = word;
  }

  /**
   * 設定新增單字的初始資料
   */
  setNewWordData(word: string, source: VocabularySource): void {
    this.word = word;
    this.sources = [source];
    this.isEditMode = false;
    this.originalWord = null;
  }

  /**
   * 取得所有等級選項
   */
  getLevelOptions() {
    return VocabularyLevelUtils.getAllLevels();
  }
}
