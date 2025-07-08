import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ContextMenuPosition } from '../models/vocabulary.model';

@Injectable({
  providedIn: 'root'
})
export class WordSelectionService {
  private selectedText$ = new BehaviorSubject<string>('');
  private selectedRange: Range | null = null;
  private isContextMenuVisible$ = new BehaviorSubject<boolean>(false);
  private contextMenuPosition$ = new BehaviorSubject<ContextMenuPosition>({ x: 0, y: 0 });

  /**
   * 取得選取的文字
   */
  getSelectedText(): Observable<string> {
    return this.selectedText$.asObservable();
  }

  /**
   * 取得選取的文字值
   */
  getSelectedTextValue(): string {
    return this.selectedText$.value;
  }

  /**
   * 取得右鍵選單顯示狀態
   */
  getContextMenuVisible(): Observable<boolean> {
    return this.isContextMenuVisible$.asObservable();
  }

  /**
   * 取得右鍵選單位置
   */
  getContextMenuPosition(): Observable<ContextMenuPosition> {
    return this.contextMenuPosition$.asObservable();
  }

  /**
   * 處理文字選取
   */
  handleTextSelection(event: Event): void {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      this.clearSelection();
      return;
    }

    const range = selection.getRangeAt(0);
    const selectedText = selection.toString().trim();

    if (this.isValidWord(selectedText)) {
      this.selectedText$.next(selectedText);
      this.selectedRange = range.cloneRange();

      // 如果是右鍵點擊，顯示右鍵選單
      if (event.type === 'contextmenu') {
        this.showContextMenu(event as MouseEvent);
      }
    } else {
      this.clearSelection();
    }
  }

  /**
   * 顯示右鍵選單
   */
  showContextMenu(event: MouseEvent): void {
    event.preventDefault();

    const position = this.getEventCoordinates(event);
    const adjustedPosition = this.adjustMenuPosition(position);

    this.contextMenuPosition$.next(adjustedPosition);
    this.isContextMenuVisible$.next(true);
  }

  /**
   * 隱藏右鍵選單
   */
  hideContextMenu(): void {
    this.isContextMenuVisible$.next(false);
  }

  /**
   * 清除選取
   */
  clearSelection(): void {
    this.selectedText$.next('');
    this.selectedRange = null;
    this.hideContextMenu();
  }

  /**
   * 驗證是否為有效單字
   */
  private isValidWord(text: string): boolean {
    if (!text || text.length < 2) return false;

    // 只允許英文字母和常見符號
    const validPattern = /^[a-zA-Z]([a-zA-Z\-']*[a-zA-Z])?$/;
    return validPattern.test(text);
  }

  /**
   * 獲取事件座標
   */
  private getEventCoordinates(event: MouseEvent): ContextMenuPosition {
    return {
      x: event.pageX,
      y: event.pageY
    };
  }

  /**
   * 調整選單位置，避免超出視窗邊界
   */
  private adjustMenuPosition(coords: ContextMenuPosition): ContextMenuPosition {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

    const menuWidth = 150;
    const menuHeight = 50;

    let { x, y } = coords;

    // 調整 x 座標
    if (x + menuWidth > scrollLeft + windowWidth) {
      x = scrollLeft + windowWidth - menuWidth - 10;
    }
    if (x < scrollLeft) {
      x = scrollLeft + 10;
    }

    // 調整 y 座標
    if (y + menuHeight > scrollTop + windowHeight) {
      y = y - menuHeight - 10;
    }
    if (y < scrollTop) {
      y = scrollTop + 10;
    }

    return { x, y };
  }

  /**
   * 綁定文字選取事件
   */
  bindWordSelectionEvents(element: HTMLElement): void {
    // 滑鼠選取事件
    element.addEventListener('mouseup', (event) => {
      this.handleTextSelection(event);
    });

    // 右鍵選單事件
    element.addEventListener('contextmenu', (event) => {
      this.handleTextSelection(event);
    });

    // 觸控選取事件
    element.addEventListener('touchend', (event) => {
      this.handleTextSelection(event);
    });

    // 點擊其他地方隱藏選單
    document.addEventListener('click', (event) => {
      if (!element.contains(event.target as Node)) {
        this.clearSelection();
      }
    });
  }

  /**
   * 移除文字選取事件
   */
  unbindWordSelectionEvents(element: HTMLElement): void {
    element.removeEventListener('mouseup', (event) => {
      this.handleTextSelection(event);
    });

    element.removeEventListener('contextmenu', (event) => {
      this.handleTextSelection(event);
    });

    element.removeEventListener('touchend', (event) => {
      this.handleTextSelection(event);
    });
  }
}
