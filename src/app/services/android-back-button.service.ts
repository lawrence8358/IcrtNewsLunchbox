import { Injectable } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Injectable({
  providedIn: 'root'
})
export class AndroidBackButtonService {

  /**
   * 設置 Android 返回按鈕處理
   * @param activeModal - NgBootstrap Modal 實例
   * @param confirmCallback - 可選的確認回調函數，返回 true 表示允許關閉
   * @returns 清理函數
   */
  setupBackButtonHandler(
    activeModal: NgbActiveModal,
    confirmCallback?: () => boolean
  ): () => void {
    // 推入一層歷史記錄來攔截返回按鈕
    window.history.pushState({ modalOpen: true }, '', '');

    // 處理 popstate 事件
    const handlePopState = (event: PopStateEvent) => {
      // 立即推入新的歷史記錄以防止瀏覽器返回
      window.history.pushState({ modalOpen: true }, '', '');

      // 如果有確認回調，先詢問
      if (confirmCallback) {
        const shouldClose = confirmCallback();
        if (shouldClose) {
          cleanup();
          activeModal.dismiss();
        }
      } else {
        // 沒有確認回調，直接關閉
        cleanup();
        activeModal.dismiss();
      }
    };

    // 註冊事件監聽器
    window.addEventListener('popstate', handlePopState);

    // 清理函數
    const cleanup = () => {
      window.removeEventListener('popstate', handlePopState);
    };

    return cleanup;
  }
}
