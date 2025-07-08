import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface NotificationMessage {
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
  id?: string;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly messages$ = new BehaviorSubject<NotificationMessage[]>([]);
  private messageId = 0;

  /**
   * 取得通知訊息流
   */
  getMessages(): Observable<NotificationMessage[]> {
    return this.messages$.asObservable();
  }

  /**
   * 顯示成功訊息
   */
  showSuccess(message: string, duration = 3000): void {
    this.addMessage({
      type: 'success',
      message,
      duration
    });
  }

  /**
   * 顯示錯誤訊息
   */
  showError(message: string, duration = 5000): void {
    this.addMessage({
      type: 'error',
      message,
      duration
    });
  }

  /**
   * 顯示資訊訊息
   */
  showInfo(message: string, duration = 3000): void {
    this.addMessage({
      type: 'info',
      message,
      duration
    });
  }

  /**
   * 顯示警告訊息
   */
  showWarning(message: string, duration = 4000): void {
    this.addMessage({
      type: 'warning',
      message,
      duration
    });
  }

  /**
   * 移除訊息
   */
  removeMessage(id: string): void {
    const currentMessages = this.messages$.value;
    const updatedMessages = currentMessages.filter(msg => msg.id !== id);
    this.messages$.next(updatedMessages);
  }

  /**
   * 清除所有訊息
   */
  clearAll(): void {
    this.messages$.next([]);
  }

  /**
   * 新增訊息
   */
  private addMessage(message: NotificationMessage): void {
    const id = `msg_${++this.messageId}`;
    const newMessage: NotificationMessage = { ...message, id };

    const currentMessages = this.messages$.value;
    this.messages$.next([...currentMessages, newMessage]);

    // 自動移除訊息
    if (message.duration && message.duration > 0) {
      setTimeout(() => {
        this.removeMessage(id);
      }, message.duration);
    }
  }
}
