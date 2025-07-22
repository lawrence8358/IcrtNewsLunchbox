import { Component, OnInit, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { VocabularyService } from '../../services/vocabulary.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-storage-settings-dialog',
  imports: [CommonModule, FormsModule],
  templateUrl: './storage-settings-dialog.component.html',
  styleUrl: './storage-settings-dialog.component.less'
})
export class StorageSettingsDialogComponent implements OnInit, OnDestroy {
  activeModal = inject(NgbActiveModal);

  currentStorageType: 'localStorage' | 'indexedDB' = 'localStorage';
  isIndexedDBSupported = false;
  isSaving = false; // 加入載入狀態

  // Android 返回按鈕處理
  private readonly boundPopStateHandler = this.handlePopState.bind(this);
  private hasAddedHistoryState = false;

  constructor(
    private readonly vocabularyService: VocabularyService,
    private readonly notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.checkIndexedDBSupport();
    this.currentStorageType = this.vocabularyService.getStorageType();
    this.addHistoryState();
    window.addEventListener('popstate', this.boundPopStateHandler);
  }

  ngOnDestroy(): void {
    window.removeEventListener('popstate', this.boundPopStateHandler);
  }

  /**
   * 檢查 IndexedDB 支援
   */
  private checkIndexedDBSupport(): void {
    this.isIndexedDBSupported = 'indexedDB' in window;
  }

  /**
   * 儲存設定
   */
  async saveSettings(): Promise<void> {
    this.isSaving = true;
    try {
      const newUseIndexedDB = this.currentStorageType === 'indexedDB';
      const success = await this.vocabularyService.switchStorageEngine(newUseIndexedDB);

      if (success) {
        this.notificationService.showSuccess('儲存設定已更新，資料已遷移');
        this.activeModal.close(true);
      } else {
        this.notificationService.showError('儲存設定失敗');
      }
    } catch (error) {
      console.error('儲存設定失敗:', error);
      this.notificationService.showError('儲存設定失敗: ' + (error as Error).message);
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
   * 切換儲存類型
   */
  onStorageTypeChange(): void {
    if (this.currentStorageType === 'indexedDB' && !this.isIndexedDBSupported) {
      this.notificationService.showWarning('此瀏覽器不支援 IndexedDB，將使用 LocalStorage');
      this.currentStorageType = 'localStorage';
    }
  }

  /**
   * 處理 Android 返回按鈕
   */
  private handlePopState(event: PopStateEvent): void {
    if (this.hasAddedHistoryState) {
      this.activeModal.dismiss();
    }
  }

  /**
   * 添加歷史狀態
   */
  private addHistoryState(): void {
    history.pushState(null, '', window.location.href);
    this.hasAddedHistoryState = true;
  }
}
