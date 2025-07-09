import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, firstValueFrom, takeUntil } from 'rxjs';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { VocabularyWord } from '../../models/vocabulary.model';
import { VocabularyService } from '../../services/vocabulary.service';
import { NotificationService } from '../../services/notification.service';
import { AddWordDialogComponent } from '../../components/add-word-dialog/add-word-dialog.component';
import { StorageSettingsDialogComponent } from '../../components/storage-settings-dialog/storage-settings-dialog.component';
import { JsonSettingsDialogComponent } from '../../components/json-settings-dialog/json-settings-dialog.component';
import { TopicDetailDialogComponent } from '../../components/topic-detail-dialog/topic-detail-dialog.component';
import { VocabularyListComponent } from '../../components/vocabulary-list/vocabulary-list.component';
import { DataService } from '../../services/data.service';
import { SettingConfig } from '../../config/setting.config';

@Component({
  selector: 'app-vocabulary-book',
  imports: [CommonModule, FormsModule, VocabularyListComponent],
  templateUrl: './vocabulary-book.component.html',
  styleUrl: './vocabulary-book.component.less'
})
export class VocabularyBookComponent implements OnInit, OnDestroy {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  isDebug = true;

  // 篩選相關屬性
  vocabularyData: VocabularyWord[] = [];
  filteredVocabulary: VocabularyWord[] = [];
  searchText = '';
  selectedLevel: number | null = null;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly vocabularyService: VocabularyService,
    private readonly notificationService: NotificationService,
    private readonly modalService: NgbModal,
    private readonly router: Router,
    private readonly dataService: DataService
  ) { }

  ngOnInit(): void {
    // 載入生字簿資料
    this.loadVocabularyData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * 載入生字簿資料
   */
  private async loadVocabularyData(): Promise<void> {
    try {
      this.vocabularyService.getVocabularyData()
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (data) => {
            this.vocabularyData = data;
            this.applyFilter();
          },
          error: (error) => {
            console.error('載入生字簿資料失敗:', error);
            this.notificationService.showError('載入生字簿資料失敗');
          }
        });
    } catch (error) {
      console.error('載入生字簿資料失敗:', error);
      this.notificationService.showError('載入生字簿資料失敗');
    }
  }

  /**
   * 難度篩選變更
   */
  onLevelChange(): void {
    this.applyFilter();
  }

  /**
   * 搜尋變更
   */
  onSearchChange(): void {
    this.applyFilter();
  }

  /**
   * 套用篩選
   */
  private applyFilter(): void {
    let filtered = [...this.vocabularyData];

    // 難度篩選
    if (this.selectedLevel !== null) {
      filtered = filtered.filter(word => word.level === this.selectedLevel);
    }

    // 搜尋篩選
    if (this.searchText.trim()) {
      const searchText = this.searchText.toLowerCase();
      filtered = filtered.filter(word =>
        word.word.toLowerCase().includes(searchText) ||
        word.translation.toLowerCase().includes(searchText) ||
        word.phonetic?.toLowerCase().includes(searchText)
      );
    }

    this.filteredVocabulary = filtered;
  }

  /**
   * 處理開啟主題事件（供 vocabulary-list 元件使用）
   */
  handleOpenTopic = (topicId: string): void => {
    this.openTopic(topicId);
  };

  /**
   * 開啟主題
   */
  async openTopic(topicId: string): Promise<void> {
    try {
      // 根據 topicId 找到對應的主題資料
      // 先載入所有月份的資料來尋找主題
      const monthsList = SettingConfig.months;
      let targetTopic = null;

      // 在所有月份中搜尋主題
      for (const month of monthsList || []) {
        const monthData = await firstValueFrom(this.dataService.loadMonthData(month));
        const topic = monthData?.find((item: any) => item.id === topicId);
        if (topic) {
          targetTopic = topic;
          break;
        }
      }

      if (targetTopic) {
        // 開啟主題詳情對話框
        const modalRef = this.modalService.open(TopicDetailDialogComponent, {
          // size: 'xl',
          backdrop: 'static',
          scrollable: true,
          fullscreen: true
          // windowClass: 'full-modal-dialog'
        });

        // 設定主題資料
        modalRef.componentInstance.topic = targetTopic;

        // 處理對話框結果
        modalRef.result.then(
          (result) => { },
          (dismissed) => { }
        );
      } else {
        this.notificationService.showError('找不到指定的主題');
      }
    } catch (error) {
      console.error('開啟主題失敗:', error);
      this.notificationService.showError('開啟主題失敗');
    }
  }

  /**
   * 匯出生字簿
   */
  async exportVocabulary(): Promise<void> {
    try {
      const data = await this.vocabularyService.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `vocabulary_${new Date().toISOString().split('T')[0]}.json`;
      a.click();

      URL.revokeObjectURL(url);
      this.notificationService.showSuccess('生字簿已匯出');
    } catch (error) {
      console.error('匯出失敗:', error);
      this.notificationService.showError('匯出失敗');
    }
  }

  /**
   * 匯入生字簿
   */
  importVocabulary(): void {
    this.fileInput.nativeElement.click();
  }

  /**
   * 新增單字
   */
  addNewWord(): void {
    const modalRef = this.modalService.open(AddWordDialogComponent, {
      backdrop: 'static',
      scrollable: true,
      fullscreen: true
    });

    // 處理對話框結果
    modalRef.result.then(
      (result) => {
      },
      (dismissed) => { }
    );
  }

  /**
   * 貼上 JSON 資料
   */
  async pasteJsonData(): Promise<void> {
    const modalRef = this.modalService.open(JsonSettingsDialogComponent, {
      backdrop: 'static',
      scrollable: true,
      fullscreen: true
    });

    // 處理對話框結果
    modalRef.result.then(
      (result) => {
        if (result?.updated) {
          // 生字簿已更新，會自動重新載入資料
          // 因為我們訂閱了 vocabularyService.getVocabularyData()
        }
      },
      (dismissed) => {
        // 使用者取消操作
      }
    );
  }

  /**
   * 檔案選擇處理
   */
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      this.processImportFile(file);
    }
  }

  /**
   * 處理匯入檔案
   */
  private async processImportFile(file: File): Promise<void> {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      await this.vocabularyService.importData(data);
      this.notificationService.showSuccess('生字簿已匯入');
    } catch (error) {
      console.error('匯入失敗:', error);
      this.notificationService.showError('匯入失敗：檔案格式不正確');
    }
  }

  /**
   * 顯示儲存設定
   */
  showStorageSettings(): void {
    const modalRef = this.modalService.open(StorageSettingsDialogComponent, {
      size: 'xl',
      backdrop: 'static',
      scrollable: true,
      windowClass: 'full-modal-dialog'
    });

    // 處理對話框結果
    modalRef.result.then(
      (result) => {
        if (result) {
          // 儲存設定已更新
        }
      },
      (dismissed) => {
        // 使用者取消操作
      }
    );
  }
}
