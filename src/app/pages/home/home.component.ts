import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subject, takeUntil, firstValueFrom } from 'rxjs';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { DataService } from '../../services/data.service';
import { FilterService } from '../../services/filter.service';
import { NotificationService } from '../../services/notification.service';
import { UtilsService } from '../../services/utils.service';
import { Topic, AppSettings } from '../../models/topic.model';
import { TopicDetailDialogComponent } from '../../components/topic-detail-dialog/topic-detail-dialog.component';
import { SettingConfig } from '../../config/setting.config';

@Component({
  selector: 'app-home',
  imports: [CommonModule, FormsModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.less'
})
export class HomeComponent implements OnInit, OnDestroy {

  // 資料
  monthsData: string[] = [];
  tagsData: string[] = [];
  currentData: Topic[] = [];
  filteredData: Topic[] = [];
  currentTopic: Topic | null = null;

  // 表單控制項
  selectedMonth = '';
  searchText = '';
  selectedType = '';
  selectedTag = '';

  // 狀態
  isLoading = false;
  isSearching = false;

  private readonly destroy$ = new Subject<void>();
  private settings: AppSettings = {
    lastMonth: '',
    lastSearch: '',
    lastType: '',
    lastTag: ''
  };

  constructor(
    private readonly dataService: DataService,
    private readonly filterService: FilterService,
    private readonly notificationService: NotificationService,
    private readonly modalService: NgbModal,
    private readonly route: ActivatedRoute,
    private readonly utilsService: UtilsService
  ) { }

  ngOnInit(): void {
    this.loadInitialData();

    // 檢查是否有要開啟的主題
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      if (params['openTopic']) {
        this.openTopicById(params['openTopic']);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * 載入初始資料
   */
  private async loadInitialData(): Promise<void> {
    this.isLoading = true;

    try {
      // 載入設定
      this.loadSettings();

      // 從 SettingConfig 取得資料
      this.monthsData = SettingConfig.months;
      this.tagsData = SettingConfig.tags;

      // 如果沒有設定的月份，使用第一個月份作為預設
      const lastMonth = this.settings.lastMonth || this.monthsData[0];

      // 設定預設值
      if (lastMonth && this.monthsData.includes(lastMonth)) {
        this.selectedMonth = lastMonth;
        this.searchText = this.settings.lastSearch;
        this.selectedType = this.settings.lastType;
        this.selectedTag = this.settings.lastTag;

        // 載入該月份的資料
        await this.loadMonthData();
      }

    } catch (error) {
      console.error('載入初始資料失敗:', error);
      this.notificationService.showError('載入資料失敗');
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * 載入設定
   */
  private loadSettings(): void {
    const saved = localStorage.getItem('icrt_settings');
    if (saved) {
      try {
        this.settings = JSON.parse(saved);
      } catch (error) {
        console.error('載入設定失敗:', error);
      }
    }
  }

  /**
   * 儲存設定
   */
  private saveSettings(): void {
    this.settings = {
      lastMonth: this.selectedMonth,
      lastSearch: this.searchText,
      lastType: this.selectedType,
      lastTag: this.selectedTag
    };
    localStorage.setItem('icrt_settings', JSON.stringify(this.settings));
  }

  /**
   * 載入月份資料
   */
  private async loadMonthData(): Promise<void> {
    if (!this.selectedMonth) return;

    this.isSearching = true;

    try {
      this.currentData = await firstValueFrom(this.dataService.loadMonthData(this.selectedMonth)) || [];
      this.performFilter();

      // 填充類型選項（通過 getUniqueTypes() 動態生成）

    } catch (error) {
      console.error('載入月份資料失敗:', error);
      this.notificationService.showError('載入資料失敗');
      this.currentData = [];
      this.filteredData = [];
    } finally {
      this.isSearching = false;
    }
  }

  /**
   * 執行搜尋
   */
  async performSearch(): Promise<void> {
    if (!this.selectedMonth) {
      this.notificationService.showError('請選擇月份');
      return;
    }

    this.saveSettings();
    await this.loadMonthData();
  }

  /**
   * 執行過濾
   */
  performFilter(): void {
    this.filteredData = this.filterService.filterTopics(
      this.currentData,
      this.searchText,
      this.selectedType,
      this.selectedTag
    );
  }

  /**
   * 取得唯一類型清單
   */
  getUniqueTypes(): string[] {
    return this.filterService.getUniqueTypes(this.currentData);
  }

  /**
   * 顯示主題詳情
   */
  showTopicDetail(topic: Topic): void {
    this.currentTopic = topic;

    // 開啟主題詳情對話框
    const modalRef = this.modalService.open(TopicDetailDialogComponent, {
      backdrop: 'static',
      scrollable: true,
      fullscreen: true
    });

    // 傳遞主題資料到對話框
    modalRef.componentInstance.topic = topic;

    // 處理對話框結果
    modalRef.result.then(
      (result) => { },
      (dismissed) => { }
    );
  }

  /**
   * 根據ID開啟主題
   */
  openTopicById(topicId: string): void {
    const topic = this.currentData.find(t => t.id === topicId);
    if (topic) {
      this.showTopicDetail(topic);
    } else {
      this.notificationService.showError('找不到指定的主題');
    }
  }

  /**
   * 格式化日期
   */
  formatDate(topicId: string): string {
    return this.utilsService.formatDateFromId(topicId);
  }

  /**
   * 格式化月份標籤
   */
  formatMonthLabel(monthValue: string): string {
    return this.utilsService.formatMonthLabel(monthValue);
  }
}
