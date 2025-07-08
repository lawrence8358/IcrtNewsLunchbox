import { Component, Input, OnInit, OnDestroy, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Subject, takeUntil } from 'rxjs';
import { VocabularyWord } from '../../models/vocabulary.model';
import { VocabularyService } from '../../services/vocabulary.service';
import { NotificationService } from '../../services/notification.service';
import { AddWordDialogComponent } from '../add-word-dialog/add-word-dialog.component';
import { VocabularyLevelUtils } from '../../models/vocabulary-level.constants';

@Component({
  selector: 'app-vocabulary-list',
  imports: [CommonModule, FormsModule],
  templateUrl: './vocabulary-list.component.html',
  styleUrl: './vocabulary-list.component.less'
})
export class VocabularyListComponent implements OnInit, OnDestroy, OnChanges {
  @Input() topicId?: string; // 如果提供 topicId，只顯示該文章相關的生字
  @Input() showActions = true; // 是否顯示操作按鈕（匯出、匯入等）
  @Input() containerClass = ''; // 自定義容器樣式類別
  @Input() openTopic?: (topicId: string) => void; // 開啟主題詳情的回調函數
  @Input() externalVocabularyData?: VocabularyWord[]; // 外部傳入的生字資料（用於主頁面）
  @Input() externalFilteredVocabulary?: VocabularyWord[]; // 外部傳入的已篩選生字資料（用於主頁面）

  vocabularyData: VocabularyWord[] = [];
  filteredVocabulary: VocabularyWord[] = [];
  isLoading = false;
  showWordTranslation: { [word: string]: boolean } = {}; // 每個單字的翻譯顯示狀態

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly vocabularyService: VocabularyService,
    private readonly notificationService: NotificationService,
    private readonly modalService: NgbModal
  ) { }

  ngOnInit(): void {
    // 如果有外部傳入的資料，使用外部資料，否則自己載入
    if (this.externalVocabularyData && this.externalFilteredVocabulary) {
      // 使用外部傳入的資料（主要用於主頁面）
      this.vocabularyData = this.externalVocabularyData;
      this.filteredVocabulary = this.externalFilteredVocabulary;
    } else {
      // 自己載入資料（主要用於對話框）
      this.loadVocabularyData();
    }
  }

  ngOnChanges(): void {
    // 當外部資料變更時更新本地資料
    if (this.externalVocabularyData && this.externalFilteredVocabulary) {
      this.vocabularyData = this.externalVocabularyData;
      this.filteredVocabulary = this.externalFilteredVocabulary;
    }
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
      this.isLoading = true;

      this.vocabularyService.getVocabularyData()
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (data) => {
            if (this.topicId) {
              // 只顯示與指定文章相關的生字
              this.vocabularyData = data.filter(word =>
                word.sources && word.sources.some(source => source.topicId === this.topicId)
              );
            } else {
              // 顯示所有生字
              this.vocabularyData = data;
            }
            this.filteredVocabulary = [...this.vocabularyData];
            this.isLoading = false;
          },
          error: (error) => {
            console.error('載入生字簿資料失敗:', error);
            this.notificationService.showError('載入生字簿資料失敗');
            this.isLoading = false;
          }
        });
    } catch (error) {
      console.error('載入生字簿資料失敗:', error);
      this.notificationService.showError('載入生字簿資料失敗');
      this.isLoading = false;
    }
  }

  /**
   * 切換特定單字的翻譯顯示
   */
  toggleWordTranslation(word: string): void {
    this.showWordTranslation[word] = !this.showWordTranslation[word];
  }

  /**
   * 發音功能（參考 vocabulary-book.js 的改良版本）
   */
  pronounceWord(word: string): void {
    if (!('speechSynthesis' in window)) {
      this.notificationService.showWarning('此瀏覽器不支援語音合成功能');
      return;
    }

    // 停止當前播放
    speechSynthesis.cancel();

    // 等待語音引擎載入完成
    const speak = () => {
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = 'en-US';
      utterance.rate = 0.8;
      utterance.volume = 1.0;

      // 嘗試使用英文語音
      const voices = speechSynthesis.getVoices();
      const englishVoice = voices.find(voice =>
        voice.lang.startsWith('en') &&
        (voice.name.includes('English') || voice.name.includes('US') || voice.name.includes('UK'))
      );

      if (englishVoice) {
        utterance.voice = englishVoice;
      }

      // 錯誤處理
      utterance.onerror = (event) => {
        console.error('語音合成錯誤:', event);
        this.notificationService.showWarning('語音播放失敗，請稍後再試');
      };

      speechSynthesis.speak(utterance);
    };

    // 如果語音清單未載入，等待載入完成
    if (speechSynthesis.getVoices().length === 0) {
      speechSynthesis.onvoiceschanged = () => {
        speechSynthesis.onvoiceschanged = null; // 清除事件監聽器
        speak();
      };
    } else {
      speak();
    }
  }

  /**
   * 編輯單字
   */
  editWord(word: VocabularyWord): void {
    const modalRef = this.modalService.open(AddWordDialogComponent, {
      size: 'xl',
      backdrop: 'static',
      scrollable: true,
      windowClass: 'full-modal-dialog'
    });

    // 設定編輯資料
    modalRef.componentInstance.setEditData(word);

    // 處理對話框結果
    modalRef.result.then(
      (result) => { },
      (dismissed) => { }
    );
  }

  /**
   * 取得難度文字
   */
  getLevelText(level: number): string {
    return this.vocabularyService.getLevelText(level);
  }

  /**
   * 取得難度等級 CSS 類別
   */
  getLevelClass(level: number): string {
    return VocabularyLevelUtils.getLevelClass(level);
  }

  /**
   * 格式化翻譯文字，將換行符轉換為 <br> 標籤
   */
  formatTranslation(translation: string): string {
    if (!translation) translation = '&nbsp;';

    return translation.replace(/\n/g, '<br>');
  }
}
