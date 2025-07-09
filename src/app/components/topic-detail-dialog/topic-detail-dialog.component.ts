import { Component, Input, OnInit, ElementRef, ViewChild, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Subject } from 'rxjs';
import { Topic } from '../../models/topic.model';
import { NotificationService } from '../../services/notification.service';
import { UtilsService } from '../../services/utils.service';
import { AddWordDialogComponent } from '../add-word-dialog/add-word-dialog.component';
import { VocabularyListComponent } from '../vocabulary-list/vocabulary-list.component';

type SelectionEvent = MouseEvent | TouchEvent;
type SourceType = 'content' | 'vocabulary' | 'quiz';

@Component({
  selector: 'app-topic-detail-dialog',
  imports: [CommonModule, FormsModule, VocabularyListComponent],
  templateUrl: './topic-detail-dialog.component.html',
  styleUrl: './topic-detail-dialog.component.less'
})
export class TopicDetailDialogComponent implements OnInit, OnDestroy {
  @Input() topic!: Topic;
  @ViewChild('audioPlayer') audioElement!: ElementRef<HTMLAudioElement>;

  showTranslations: { [key: number]: boolean } = {};
  showQuizAnswers: { [key: number]: boolean } = {};
  audio: HTMLAudioElement | null = null;
  activeTab: string = 'content'; // 預設顯示內容分頁

  // 使用說明相關
  showDetailedTips = false;

  private readonly destroy$ = new Subject<void>();

  // 右鍵選單相關
  showContextMenu = false;
  contextMenuX = 0;
  contextMenuY = 0;
  selectedText = '';
  selectedSourceType = '';
  selectedSourceIndex = 0;

  // 觸控設備長按相關
  private touchTimer: any = null;
  private isLongPress = false;

  // 綁定的事件處理器引用
  private readonly boundGlobalTouchEnd = this.handleGlobalTouchEnd.bind(this);
  private readonly boundGlobalContextMenu = this.handleGlobalContextMenu.bind(this);
  private readonly boundGlobalTouchStart = this.handleGlobalTouchStart.bind(this);
  private readonly boundGlobalTouchCancel = this.handleGlobalTouchEnd.bind(this);
  private readonly boundGlobalTouchMove = this.handleGlobalTouchEnd.bind(this);
  private readonly boundGlobalDoubleClick = this.handleGlobalDoubleClick.bind(this);

  constructor(
    public readonly activeModal: NgbActiveModal,
    private readonly notificationService: NotificationService,
    private readonly utilsService: UtilsService,
    private readonly modalService: NgbModal
  ) { }

  ngOnInit(): void {
    // 設定音訊元素
    setTimeout(() => {
      if (this.topic?.audio && this.audioElement) {
        this.audioElement.nativeElement.src = this.topic.audio;
        this.audio = this.audioElement.nativeElement;
      }
    });

    // 初始化翻譯顯示狀態（預設隱藏）
    this.initializeTranslationStates();

    // 綁定全域事件
    this.bindGlobalEvents();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();

    // 清理全域事件
    document.removeEventListener('touchend', this.boundGlobalTouchEnd);
    document.removeEventListener('contextmenu', this.boundGlobalContextMenu);
    document.removeEventListener('touchstart', this.boundGlobalTouchStart);
    document.removeEventListener('touchcancel', this.boundGlobalTouchCancel);
    document.removeEventListener('touchmove', this.boundGlobalTouchMove);
    document.removeEventListener('dblclick', this.boundGlobalDoubleClick);
  }

  /**
   * 綁定全域文字選取事件
   */
  private bindGlobalEvents(): void {
    // 清理之前的事件
    document.removeEventListener('touchend', this.boundGlobalTouchEnd);
    document.removeEventListener('contextmenu', this.boundGlobalContextMenu);
    document.removeEventListener('touchstart', this.boundGlobalTouchStart);
    document.removeEventListener('touchcancel', this.boundGlobalTouchCancel);
    document.removeEventListener('touchmove', this.boundGlobalTouchMove);
    document.removeEventListener('dblclick', this.boundGlobalDoubleClick);

    // 綁定新的事件
    document.addEventListener('touchend', this.boundGlobalTouchEnd);
    document.addEventListener('contextmenu', this.boundGlobalContextMenu);
    document.addEventListener('touchstart', this.boundGlobalTouchStart);
    document.addEventListener('touchcancel', this.boundGlobalTouchCancel);
    document.addEventListener('touchmove', this.boundGlobalTouchMove);
    document.addEventListener('dblclick', this.boundGlobalDoubleClick);
  }

  /**
   * 全域 touchend 處理
   */
  private handleGlobalTouchEnd(event: TouchEvent): void {
    if (this.isInModalContent(event.target as Element)) {
      this.handleTextSelection(event);
    }
    this.onTouchEnd();
  }

  /**
   * 全域 touchstart 處理
   */
  private handleGlobalTouchStart(event: TouchEvent): void {
    if (this.isInModalContent(event.target as Element)) {
      const sourceInfo = this.getSourceInfo(event.target as Element);
      if (sourceInfo) {
        this.onTouchStart(event, sourceInfo.type, sourceInfo.index);
      }
    }
  }

  /**
   * 全域 contextmenu 處理
   */
  private handleGlobalContextMenu(event: MouseEvent): void {
    if (this.isInModalContent(event.target as Element)) {
      const sourceInfo = this.getSourceInfo(event.target as Element);
      if (sourceInfo) {
        this.onContextMenu(event, sourceInfo.type, sourceInfo.index);
      }
    }
  }

  /**
   * 全域 dblclick 處理
   */
  private handleGlobalDoubleClick(event: MouseEvent): void {
    if (this.isInModalContent(event.target as Element)) {
      const sourceInfo = this.getSourceInfo(event.target as Element);
      if (sourceInfo) {
        this.onDoubleClick(event, sourceInfo.type, sourceInfo.index);
      }
    }
  }

  /**
   * 檢查是否在 modal 內容區域
   */
  private isInModalContent(element: Element): boolean {
    return element.closest('.modal-body') !== null;
  }

  /**
   * 取得來源資訊
   */
  private getSourceInfo(element: Element): { type: SourceType; index: number } | null {
    // 檢查是否在內容區域
    if (element.closest('[data-source="content"]')) {
      const contentElement = element.closest('[data-content-index]');
      const index = contentElement ? parseInt(contentElement.getAttribute('data-content-index') || '-1') : -1;
      return { type: 'content', index };
    }

    // 檢查是否在生字區域
    if (element.closest('[data-source="vocabulary"]')) {
      const vocabElement = element.closest('[data-vocab-index]');
      const index = vocabElement ? parseInt(vocabElement.getAttribute('data-vocab-index') || '-1') : -1;
      return { type: 'vocabulary', index };
    }

    // 檢查是否在測驗區域
    if (element.closest('[data-source="quiz"]')) {
      const quizElement = element.closest('[data-quiz-index]');
      const index = quizElement ? parseInt(quizElement.getAttribute('data-quiz-index') || '-1') : -1;
      return { type: 'quiz', index };
    }

    return null;
  }

  /**
   * 處理文字選取
   */
  private handleTextSelection(event: SelectionEvent): void {
    setTimeout(() => {
      const selection = window.getSelection();
      if (selection && selection.toString().trim()) {
        const selectedText = selection.toString().trim();

        if (this.containsEnglish(selectedText)) {
          const sourceInfo = this.getSourceInfo(event.target as Element);
          if (sourceInfo) {
            this.selectedText = selectedText;
            this.selectedSourceType = sourceInfo.type;
            this.selectedSourceIndex = sourceInfo.index;

            // 對於觸控設備的長按，直接顯示選單
            if (event.type === 'touchend' && this.isLongPress) {
              event.preventDefault();
              this.showAddToVocabularyMenu(event, selectedText, sourceInfo.type, sourceInfo.index);
              this.isLongPress = false;
            }
          }
        }
      }
    }, 50);
  }

  /**
   * 初始化翻譯狀態
   */
  private initializeTranslationStates(): void {
    if (this.topic?.content) {
      this.topic.content.forEach((_, index) => {
        this.showTranslations[index] = false; // 預設隱藏翻譯
      });
    }

    if (this.topic?.quiz) {
      this.topic.quiz.forEach((_, index) => {
        this.showQuizAnswers[index] = false; // 預設隱藏答案
      });
    }
  }

  /**
   * 切換翻譯顯示
   */
  toggleTranslation(index: number): void {
    this.showTranslations[index] = !this.showTranslations[index];
  }

  /**
   * 切換測驗答案顯示
   */
  toggleQuizAnswer(index: number): void {
    this.showQuizAnswers[index] = !this.showQuizAnswers[index];
  }

  /**
   * 跳到指定時間
   */
  jumpToTime(timeString?: string | number): void {
    if (!timeString) return;
    if (!this.audio) return;

    const seconds = this.utilsService.parseTimeToSeconds(timeString);
    if (seconds !== null) {
      this.audio.currentTime = seconds;
      this.audio.play().catch(error => {
        console.error('音訊播放失敗:', error);
        this.notificationService.showError('音訊播放失敗');
      });
    }
  }

  /**
   * 播放/暫停音訊
   */
  toggleAudio(): void {
    if (!this.audio) return;

    if (this.audio.paused) {
      this.audio.play().catch(error => {
        console.error('音訊播放失敗:', error);
        this.notificationService.showError('音訊播放失敗');
      });
    } else {
      this.audio.pause();
    }
  }

  /**
   * 暫停音訊播放
   */
  pauseAudio(): void {
    if (this.audio && !this.audio.paused) {
      this.audio.pause();
    }
  }

  /**
   * 檢查音訊是否正在播放
   */
  isAudioPlaying(): boolean {
    return this.audio ? !this.audio.paused : false;
  }

  /**
   * 格式化日期
   */
  formatDate(topicId: string): string {
    return this.utilsService.formatDateFromId(topicId);
  }

  /**
   * 關閉對話框
   */
  close(): void {
    // 停止音訊播放
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }

    // 清理事件監聽器
    document.removeEventListener('touchend', this.boundGlobalTouchEnd);
    document.removeEventListener('contextmenu', this.boundGlobalContextMenu);
    document.removeEventListener('touchstart', this.boundGlobalTouchStart);
    document.removeEventListener('touchcancel', this.boundGlobalTouchCancel);
    document.removeEventListener('touchmove', this.boundGlobalTouchMove);
    document.removeEventListener('dblclick', this.boundGlobalDoubleClick);

    // 清理計時器
    if (this.touchTimer) {
      clearTimeout(this.touchTimer);
    }

    this.activeModal.dismiss();
  }

  /**
   * 檢查是否有時間資訊
   */
  hasTime(item: any): boolean {
    return item.time !== null && item.time !== undefined;
  }

  /**
   * 檢查是否有翻譯
   */
  hasTranslation(item: any): boolean {
    return item.tw && item.tw.trim() !== '';
  }

  /**
   * 格式化生字文字 (將 \n 轉換為 <br>)
   */
  formatVocabularyText(text: string): string {
    if (!text) return '';
    return text.replace(/\n/g, '<br>');
  }

  /**
   * 設定當前分頁
   */
  setActiveTab(tab: string): void {
    this.activeTab = tab;
  }

  /**
   * 切換使用說明顯示
   */
  toggleUsageTips(): void {
    this.showDetailedTips = !this.showDetailedTips;
  }

  /**
   * 處理文字選取加入生字簿 (mouseup/touchend)
   */
  onTextSelection(event: SelectionEvent, sourceType: SourceType, sourceIndex: number): void {
    // 延遲檢查選取狀態，確保選取已完成
    setTimeout(() => {
      const selection = window.getSelection();
      if (selection && selection.toString().trim()) {
        const selectedText = selection.toString().trim();

        // 檢查是否包含英文字母
        if (this.containsEnglish(selectedText)) {
          this.selectedText = selectedText;
          this.selectedSourceType = sourceType;
          this.selectedSourceIndex = sourceIndex;

          // 對於觸控設備的長按，直接顯示選單
          if (event.type === 'touchend' && this.isLongPress) {
            event.preventDefault();
            this.showAddToVocabularyMenu(event as TouchEvent, selectedText, sourceType, sourceIndex);
            this.isLongPress = false;
          }
        }
      }
    }, 50);
  }

  /**
   * 處理觸控開始
   */
  private onTouchStart(event: TouchEvent, sourceType: SourceType, sourceIndex: number): void {
    this.isLongPress = false;
    // 清除之前的計時器
    if (this.touchTimer) {
      clearTimeout(this.touchTimer);
    }

    // 設定長按計時器 (800ms)
    this.touchTimer = setTimeout(() => {
      this.isLongPress = true;
      const selection = window.getSelection();
      if (selection && selection.toString().trim()) {
        const selectedText = selection.toString().trim();
        if (this.containsEnglish(selectedText)) {
          // 長按觸發振動反饋 (如果支援)
          if (navigator.vibrate) {
            navigator.vibrate(50);
          }
          this.showAddToVocabularyMenu(event, selectedText, sourceType, sourceIndex);
        }
      }
    }, 800);
  }

  /**
   * 處理觸控結束/取消/移動
   */
  private onTouchEnd(): void {
    if (this.touchTimer) {
      clearTimeout(this.touchTimer);
      this.touchTimer = null;
    }
  }

  /**
   * 處理右鍵選單
   */
  onContextMenu(event: MouseEvent, sourceType: SourceType, sourceIndex: number): void {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      const selectedText = selection.toString().trim();

      // 檢查是否包含英文字母
      if (this.containsEnglish(selectedText)) {
        event.preventDefault();
        this.showAddToVocabularyMenu(event, selectedText, sourceType, sourceIndex);
      } else {
        console.log('No English text found');
      }
    } else {
      event.preventDefault();
    }
  }

  /**
   * 處理雙擊選單
   */
  onDoubleClick(event: MouseEvent, sourceType: SourceType, sourceIndex: number): void {
    event.preventDefault();
    event.stopPropagation();

    // 先隱藏任何現有的選單
    this.hideContextMenu();

    // 選擇當前點擊位置的單字
    this.selectWordAtPosition(event);

    // 檢查選取的文字
    setTimeout(() => {
      const selection = window.getSelection();
      if (selection && selection.toString().trim()) {
        const selectedText = selection.toString().trim();

        // 檢查是否包含英文字母
        if (this.containsEnglish(selectedText)) {
          this.showAddToVocabularyMenu(event, selectedText, sourceType, sourceIndex);
        }
      }
    }, 50);
  }

  /**
   * 在指定位置選擇單字
   */
  private selectWordAtPosition(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target) return;

    // 使用 document.caretRangeFromPoint 來獲取更精確的位置
    let range: Range | null = null;

    if (document.caretRangeFromPoint) {
      range = document.caretRangeFromPoint(event.clientX, event.clientY);
    } else if ((document as any).caretPositionFromPoint) {
      // Firefox 支援
      const caretPos = (document as any).caretPositionFromPoint(event.clientX, event.clientY);
      if (caretPos) {
        range = document.createRange();
        range.setStart(caretPos.offsetNode, caretPos.offset);
        range.collapse(true);
      }
    }

    if (!range) {
      // 降級處理：使用原始方法
      this.selectWordAtPositionFallback(event);
      return;
    }

    const textNode = range.startContainer;
    if (textNode.nodeType !== Node.TEXT_NODE) return;

    const text = textNode.textContent;
    if (!text) return;

    const offset = range.startOffset;

    // 找到單字邊界
    const wordBoundary = this.findWordBoundary(text, offset);

    if (wordBoundary.start < wordBoundary.end) {
      const selection = window.getSelection();
      if (selection) {
        const newRange = document.createRange();
        newRange.setStart(textNode, wordBoundary.start);
        newRange.setEnd(textNode, wordBoundary.end);

        selection.removeAllRanges();
        selection.addRange(newRange);
      }
    }
  }

  /**
   * 降級版本的選字方法
   */
  private selectWordAtPositionFallback(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target || !target.textContent) return;

    const range = document.createRange();
    const selection = window.getSelection();

    if (!selection) return;

    // 獲取點擊位置
    const textNode = target.firstChild;
    if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return;

    const text = textNode.textContent;
    if (!text) return;

    const rect = target.getBoundingClientRect();
    const x = event.clientX - rect.left;

    // 估算點擊的字符位置
    const charWidth = rect.width / text.length;
    const charIndex = Math.min(Math.floor(x / charWidth), text.length - 1);

    // 找到單字邊界
    const wordBoundary = this.findWordBoundary(text, charIndex);

    if (wordBoundary.start < wordBoundary.end) {
      range.setStart(textNode, wordBoundary.start);
      range.setEnd(textNode, wordBoundary.end);

      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  /**
   * 找到單字邊界
   */
  private findWordBoundary(text: string, position: number): { start: number; end: number } {
    // 單字字符的正則表達式
    const wordChar = /[a-zA-Z'-]/;

    let start = position;
    let end = position;

    // 向前找到單字開始
    while (start > 0 && wordChar.test(text[start - 1])) {
      start--;
    }

    // 向後找到單字結束
    while (end < text.length && wordChar.test(text[end])) {
      end++;
    }

    return { start, end };
  }

  /**
   * 檢查文字是否包含英文字母
   */
  private containsEnglish(text: string): boolean {
    const cleanText = text.replace(/[^\w\s'-]/g, '').trim();
    return /[a-zA-Z]/.test(cleanText);
  }

  /**
   * 顯示加入生字簿選單
   */
  private showAddToVocabularyMenu(event: SelectionEvent, selectedText: string, sourceType: string, sourceIndex: number): void {
    event.preventDefault();

    // 清理選取的文字
    const cleanedText = selectedText.replace(/[^\w\s'-]/g, '').trim();

    // 儲存選取資訊
    this.selectedText = cleanedText;
    this.selectedSourceType = sourceType;
    this.selectedSourceIndex = sourceIndex;

    // 計算選單位置
    let clientX: number, clientY: number;

    if (event.type === 'touchstart' || event.type === 'touchend') {
      const touchEvent = event as TouchEvent;
      const touch = touchEvent.touches[0] || touchEvent.changedTouches[0];
      clientX = touch.clientX;
      clientY = touch.clientY;
    } else {
      const mouseEvent = event as MouseEvent;
      clientX = mouseEvent.clientX;
      clientY = mouseEvent.clientY;
    }

    // 嘗試從選取範圍取得位置
    const rect = this.getSelectionRect();
    this.contextMenuX = rect ? rect.left : clientX;
    this.contextMenuY = rect ? rect.bottom + 5 : clientY;

    // 調整選單位置，避免超出視窗邊界
    this.adjustMenuPosition();

    // 顯示選單
    this.showContextMenu = true;

    // 10秒後自動隱藏選單（延長時間避免誤觸）
    setTimeout(() => {
      if (this.showContextMenu) {
        this.hideContextMenu();
      }
    }, 10000);
  }

  /**
   * 隱藏右鍵選單
   */
  hideContextMenu(): void {
    this.showContextMenu = false;
    // 不再自動清除選取範圍，保持選中狀態
    // this.selectedText = '';  // 保留選取的文字資訊
    // setTimeout(() => {
    //   window.getSelection()?.removeAllRanges();
    // }, 100);
  }

  /**
   * 隱藏選單並清除選取狀態（用於背景點擊）
   */
  hideContextMenuAndClearSelection(): void {
    this.showContextMenu = false;
    this.clearSelection();
  }

  /**
   * 確認加入生字簿
   */
  confirmAddToVocabulary(): void {
    if (!this.selectedText) {
      return;
    }

    // 保存選取的文字和資訊，避免在隱藏選單時丟失
    const savedText = this.selectedText;
    const savedSourceType = this.selectedSourceType;
    const savedSourceIndex = this.selectedSourceIndex;

    // 立即隱藏選單，但保持選取狀態
    this.showContextMenu = false;

    // 使用保存的資訊開啟對話框
    setTimeout(() => {
      this.selectedText = savedText;
      this.selectedSourceType = savedSourceType;
      this.selectedSourceIndex = savedSourceIndex;
      this.showAddWordDialog();
    }, 50);
  }

  /**
   * 顯示加入單字對話框
   */
  private showAddWordDialog(): void {
    // 不立即清除選取範圍，保持選中狀態
    // window.getSelection()?.removeAllRanges();

    const modalRef = this.modalService.open(AddWordDialogComponent, {
      backdrop: 'static',
      scrollable: true,
      fullscreen: true
    });

    // 設定對話框的資料
    const dialogComponent = modalRef.componentInstance;

    // 使用新的方法設定初始資料
    const sourceInfo = {
      title: this.topic.title,
      topicId: this.topic.id,
      section: `${this.selectedSourceType} #${this.selectedSourceIndex}`
    };

    dialogComponent.setNewWordData(this.selectedText, sourceInfo);

    // 處理對話框結果
    modalRef.result.then(
      (result) => {
        if (result) {
          console.log('單字已儲存');
          // 通知訊息已由 add-word-dialog 處理，這裡不需要重複顯示
        }
        // 無論儲存或取消，都清除選取狀態
        this.clearSelection();
      },
      (dismissed) => {
        console.log('對話框已取消');
        // 取消時也清除選取狀態
        this.clearSelection();
      }
    );
  }

  /**
   * 取得選取範圍的位置
   */
  private getSelectionRect(): DOMRect | null {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      return range.getBoundingClientRect();
    }
    return null;
  }

  /**
   * 調整選單位置，避免超出視窗邊界
   */
  private adjustMenuPosition(): void {
    const menuWidth = 150;
    const menuHeight = 50;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    // 調整 X 座標
    if (this.contextMenuX + menuWidth > windowWidth) {
      this.contextMenuX = windowWidth - menuWidth - 10;
    }
    if (this.contextMenuX < 0) {
      this.contextMenuX = 10;
    }

    // 調整 Y 座標
    if (this.contextMenuY + menuHeight > windowHeight) {
      this.contextMenuY = this.contextMenuY - menuHeight - 10;
    }
    if (this.contextMenuY < 0) {
      this.contextMenuY = 10;
    }
  }

  /**
   * 清除選取狀態
   */
  private clearSelection(): void {
    this.selectedText = '';
    this.selectedSourceType = '';
    this.selectedSourceIndex = 0;

    // 延遲清除選取範圍，避免干擾其他操作
    setTimeout(() => {
      window.getSelection()?.removeAllRanges();
    }, 100);
  }
}
