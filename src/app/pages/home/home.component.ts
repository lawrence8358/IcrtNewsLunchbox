import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subject, takeUntil, firstValueFrom } from 'rxjs';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { DataService } from '../../services/data.service';
import { FilterService } from '../../services/filter.service';
import { NotificationService } from '../../services/notification.service';
import { UtilsService } from '../../services/utils.service';
import { LearningStatusService } from '../../services/learning-status.service';
import { Topic, AppSettings } from '../../models/topic.model';
import { TopicDetailDialogComponent } from '../../components/topic-detail-dialog/topic-detail-dialog.component';
import { SettingConfig } from '../../config/setting.config';

@Component({
  selector: 'app-home',
  imports: [FormsModule],
  templateUrl: './home.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './home.component.less'
})
export class HomeComponent implements OnInit, OnDestroy {

  readonly allMonthsValue = 'all';
  readonly pageSize = 20;

  // 資料
  monthsData: string[] = [];
  tagsData: string[] = [];
  typesData: string[] = [];
  currentData: Topic[] = [];
  filteredData: Topic[] = [];
  visibleData: Topic[] = [];
  currentTopic: Topic | null = null;

  // 表單控制項
  selectedMonth = '';
  searchText = '';
  selectedType = '';
  selectedTag = '';
  selectedLearningStatus = ''; // 學習狀態篩選

  readonly learningStatusOptions = [
    { value: '', label: '全部' },
    { value: 'not-started', label: '未進行' },
    { value: 'learning', label: '學習中' },
    { value: 'learned', label: '已學習' }
  ];

  // 狀態
  isLoading = false;
  isSearching = false;
  currentPage = 1;

  private readonly destroy$ = new Subject<void>();
  private settings: AppSettings = {
    lastMonth: '',
    lastSearch: '',
    lastType: '',
    lastTag: '',
    lastLearningStatus: ''
  };

  constructor(
    private readonly dataService: DataService,
    private readonly filterService: FilterService,
    private readonly notificationService: NotificationService,
    private readonly modalService: NgbModal,
    private readonly route: ActivatedRoute,
    private readonly utilsService: UtilsService,
    private readonly learningStatusService: LearningStatusService
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

      // 新使用者預設查詢全部月份；既有使用者沿用上次的查詢範圍
      const lastMonth = this.settings.lastMonth || this.allMonthsValue;

      // 設定預設值
      if (lastMonth === this.allMonthsValue || this.monthsData.includes(lastMonth)) {
        this.selectedMonth = lastMonth;
        this.searchText = this.settings.lastSearch;
        this.selectedType = this.settings.lastType;
        this.selectedTag = this.settings.lastTag;
        this.selectedLearningStatus = this.settings.lastLearningStatus || ''; // 向後相容性處理

        // 載入該月份的資料
        await this.loadSelectedData();
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
      lastTag: this.selectedTag,
      lastLearningStatus: this.selectedLearningStatus
    };
    localStorage.setItem('icrt_settings', JSON.stringify(this.settings));
  }

  /**
   * 載入月份資料
   */
  private async loadSelectedData(): Promise<void> {
    if (!this.selectedMonth) return;

    this.isSearching = true;

    try {
      const dataRequest = this.selectedMonth === this.allMonthsValue
        ? this.dataService.loadMonthsData(this.monthsData)
        : this.dataService.loadMonthData(this.selectedMonth);
      const rawData = await firstValueFrom(dataRequest) || [];
      
      // 應用學習狀態到主題列表
      this.currentData = this.learningStatusService.applyLearningStatusToTopics(rawData);
      this.typesData = this.filterService.getUniqueTypes(this.currentData);
      this.performFilter();

    } catch (error) {
      console.error('載入月份資料失敗:', error);
      this.notificationService.showError('載入資料失敗');
      this.currentData = [];
      this.typesData = [];
      this.filteredData = [];
      this.visibleData = [];
      this.currentPage = 1;
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
    await this.loadSelectedData();
  }

  /**
   * 執行過濾
   */
  performFilter(): void {
    this.filteredData = this.filterService.filterTopics(
      this.currentData,
      this.searchText,
      this.selectedType,
      this.selectedTag,
      this.selectedLearningStatus
    );
    this.currentPage = 1;
    this.updateVisibleData();
  }

  get totalPages(): number {
    return Math.ceil(this.filteredData.length / this.pageSize);
  }

  get visiblePageNumbers(): number[] {
    const firstPage = Math.max(1, Math.min(this.currentPage - 2, this.totalPages - 4));
    const lastPage = Math.min(this.totalPages, firstPage + 4);
    return Array.from({ length: Math.max(0, lastPage - firstPage + 1) }, (_, index) => firstPage + index);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.currentPage) {
      return;
    }

    this.currentPage = page;
    this.updateVisibleData();
    document.getElementById('topicsStart')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /**
   * 更新目前要呈現的搜尋結果，避免一次建立過多 DOM 節點。
   */
  private updateVisibleData(): void {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    this.visibleData = this.filteredData.slice(startIndex, startIndex + this.pageSize);
  }

  /**
   * 取得學習狀態標籤
   */
  getLearningStatusLabel(status?: string): string {
    const statusMap: {[key: string]: string} = {
      'not-started': '未進行',
      'learning': '學習中',
      'learned': '已學習'
    };
    return statusMap[status || 'not-started'] || '未進行';
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
