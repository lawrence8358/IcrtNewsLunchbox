import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { NotificationService, NotificationMessage } from './services/notification.service';
import { SettingConfig } from './config/setting.config';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, RouterModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.less'
})
export class AppComponent implements OnInit, OnDestroy, AfterViewInit {
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

  ngAfterViewInit(): void {
    // 檢查初始化狀態並移除 loading 畫面
    this.checkInitializationAndRemoveLoading();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * 檢查初始化狀態並移除 loading 畫面
   */
  private checkInitializationAndRemoveLoading(): void {
    // 確保 DOM 已完全載入
    setTimeout(() => {
      if (SettingConfig.isInitialized) {
        this.removeLoadingScreen();
      } else {
        // 如果還沒初始化，稍後再檢查
        setTimeout(() => this.checkInitializationAndRemoveLoading(), 100);
      }
    }, 100);
  }

  /**
   * 移除 loading 畫面
   */
  private removeLoadingScreen(): void {
    const loadingElement = document.getElementById('app-loading');
    if (loadingElement) {
      // 添加淡出動畫
      loadingElement.classList.add('fade-out');

      // 動畫完成後移除元素
      setTimeout(() => {
        loadingElement.remove();
      }, 500);
    }
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
