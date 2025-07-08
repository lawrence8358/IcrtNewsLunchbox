import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { NotificationService, NotificationMessage } from './services/notification.service';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, RouterModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.less'
})
export class AppComponent implements OnInit, OnDestroy {
  notifications: NotificationMessage[] = [];
  private readonly destroy$ = new Subject<void>();

  constructor(private readonly notificationService: NotificationService) { }

  ngOnInit(): void {
    // 訂閱通知訊息
    this.notificationService.getMessages()
      .pipe(takeUntil(this.destroy$))
      .subscribe(messages => {
        this.notifications = messages;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * 移除通知
   */
  removeNotification(id: string): void {
    this.notificationService.removeMessage(id);
  }

  /**
   * 取得通知圖示
   */
  getNotificationIcon(type: string): string {
    switch (type) {
      case 'success': return 'fas fa-check-circle';
      case 'error': return 'fas fa-exclamation-circle';
      case 'warning': return 'fas fa-exclamation-triangle';
      case 'info': return 'fas fa-info-circle';
      default: return 'fas fa-info-circle';
    }
  }
}
