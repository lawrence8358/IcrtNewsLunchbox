import { Component, OnInit, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { firstValueFrom } from 'rxjs';
import { VocabularyService } from '../../services/vocabulary.service';
import { NotificationService } from '../../services/notification.service';
import { VocabularyWord } from '../../models/vocabulary.model';

@Component({
  selector: 'app-json-settings-dialog',
  imports: [CommonModule, FormsModule],
  templateUrl: './json-settings-dialog.component.html',
  styleUrl: './json-settings-dialog.component.less'
})
export class JsonSettingsDialogComponent implements OnInit, OnDestroy {
  activeModal = inject(NgbActiveModal);

  jsonContent = '';
  isLoading = false;
  isSaving = false;
  isValidJson = true;
  jsonError = '';

  // Android 返回按鈕處理
  private readonly boundPopStateHandler = this.handlePopState.bind(this);
  private hasAddedHistoryState = false;

  constructor(
    private readonly vocabularyService: VocabularyService,
    private readonly notificationService: NotificationService
  ) { }

  ngOnInit(): void {
    this.loadCurrentData();

    // 設定 PopState 事件處理
    window.addEventListener('popstate', this.boundPopStateHandler);
    this.hasAddedHistoryState = true;
    history.pushState(null, '');
  }

  ngOnDestroy(): void {
    // 移除 PopState 事件處理
    if (this.hasAddedHistoryState) {
      window.removeEventListener('popstate', this.boundPopStateHandler);
    }
  }

  /**
   * 處理 PopState 事件
   */
  private handlePopState(event: PopStateEvent): void {
    // 只在前進歷史紀錄時關閉對話框
    if (event.state) {
      this.activeModal.dismiss();
    } else {
      // 否則重新推送狀態以防止關閉
      history.pushState(null, '');
    }
  }

  /**
   * 載入目前的生字簿資料
   */
  private async loadCurrentData(): Promise<void> {
    try {
      this.isLoading = true;

      // 確保 VocabularyService 已經初始化並載入資料
      await this.vocabularyService.initialize();

      // 等待資料載入完成
      const currentData = await firstValueFrom(this.vocabularyService.getVocabularyData());

      this.jsonContent = JSON.stringify(currentData, null, 2);
      this.validateJson();
    } catch (error) {
      console.error('載入資料失敗:', error);
      this.notificationService.showError('載入資料失敗');
      this.jsonContent = '[]';
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * JSON 內容變更時驗證
   */
  onJsonChange(): void {
    this.validateJson();
  }

  /**
   * 驗證 JSON 格式
   */
  private validateJson(): void {
    try {
      if (!this.jsonContent.trim()) {
        this.isValidJson = false;
        this.jsonError = 'JSON 內容不能為空';
        return;
      }

      const parsed = JSON.parse(this.jsonContent);

      if (!Array.isArray(parsed)) {
        this.isValidJson = false;
        this.jsonError = 'JSON 必須是陣列格式';
        return;
      }

      // 簡單驗證陣列內容
      for (let i = 0; i < parsed.length; i++) {
        const item = parsed[i];
        if (!item.id || !item.word || item.level === undefined || item.level === null) {
          this.isValidJson = false;
          this.jsonError = `第 ${i + 1} 個項目缺少必要欄位 (id, word, level)`;
          return;
        }

        // 驗證 level 是否為有效數字 (1, 2, 3)
        if (![1, 2, 3].includes(item.level)) {
          this.isValidJson = false;
          this.jsonError = `第 ${i + 1} 個項目的 level 必須是 1, 2, 或 3`;
          return;
        }
      }

      this.isValidJson = true;
      this.jsonError = '';
    } catch (error) {
      this.isValidJson = false;
      this.jsonError = 'JSON 格式錯誤：' + (error as Error).message;
    }
  }

  /**
   * 格式化 JSON
   */
  formatJson(): void {
    try {
      if (this.jsonContent.trim()) {
        const parsed = JSON.parse(this.jsonContent);
        this.jsonContent = JSON.stringify(parsed, null, 2);
        this.validateJson();
      }
    } catch (error) {
      console.error('格式化 JSON 失敗:', error);
      this.notificationService.showError('JSON 格式錯誤，無法格式化');
    }
  }

  /**
   * 壓縮 JSON
   */
  compressJson(): void {
    try {
      if (this.jsonContent.trim()) {
        const parsed = JSON.parse(this.jsonContent);
        this.jsonContent = JSON.stringify(parsed);
        this.validateJson();
      }
    } catch (error) {
      console.error('壓縮 JSON 失敗:', error);
      this.notificationService.showError('JSON 格式錯誤，無法壓縮');
    }
  }

  /**
   * 清空 JSON
   */
  clearJson(): void {
    if (confirm('確定要清空 JSON 內容嗎？')) {
      this.jsonContent = '[]';
      this.validateJson();
    }
  }

  /**
   * 儲存 JSON 資料
   */
  async saveJson(): Promise<void> {
    if (!this.isValidJson) {
      this.notificationService.showError('請修正 JSON 格式錯誤');
      return;
    }

    try {
      this.isSaving = true;

      const vocabularyData: VocabularyWord[] = JSON.parse(this.jsonContent);

      // 清空現有資料並匯入新資料
      await this.vocabularyService.importData({
        vocabulary: vocabularyData,
        version: '1.0',
        exportDate: new Date()
      });

      this.notificationService.showSuccess(`已成功更新 ${vocabularyData.length} 個單字`);
      this.activeModal.close({ updated: true });

    } catch (error) {
      console.error('儲存失敗:', error);
      this.notificationService.showError('儲存失敗');
    } finally {
      this.isSaving = false;
    }
  }

  /**
   * 取消操作
   */
  cancel(): void {
    this.activeModal.dismiss();
  }

  /**
   * 取得 JSON 行數
   */
  getJsonLineCount(): number {
    return this.jsonContent.split('\n').length;
  }

  /**
   * 取得 JSON 字符數
   */
  getJsonCharCount(): number {
    return this.jsonContent.length;
  }
}
