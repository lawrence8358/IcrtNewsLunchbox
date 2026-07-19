import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, of } from 'rxjs';
import { catchError, map, mergeMap, reduce, shareReplay } from 'rxjs/operators';
import { Topic, AppSettings } from '../models/topic.model';
import { SettingConfig } from '../config/setting.config';

@Injectable({
  providedIn: 'root'
})
export class DataService {
  private readonly ASSETS_PATH = 'assets/data';
  private readonly SETTINGS_KEY = 'icrt_settings';
  private readonly monthCache = new Map<string, Observable<Topic[]>>();

  constructor(private readonly http: HttpClient) { }

  /**
   * 載入指定月份的主題資料
   */
  loadMonthData(month: string): Observable<Topic[]> {
    const cached = this.monthCache.get(month);
    if (cached) {
      return cached;
    }

    const fileName = month.replace('-', '');
    const version = SettingConfig.getDataVersion(fileName);
    const versionParam = version ? `?v=${encodeURIComponent(version)}` : '';
    const request$ = this.http.get<Topic[]>(`${this.ASSETS_PATH}/${fileName}.json${versionParam}`)
      .pipe(
        map(data => {
          // 依 topic.id 排序 desc
          return [...data].sort((a, b) => b.id.localeCompare(a.id));
        }),
        catchError(error => {
          console.error(`載入 ${fileName}.json 失敗:`, error);
          this.monthCache.delete(month);
          return of([]);
        }),
        shareReplay({ bufferSize: 1, refCount: false })
      );

    this.monthCache.set(month, request$);
    return request$;
  }

  /**
   * 載入多個月份，限制同時請求數並合併成日期新到舊的清單。
   */
  loadMonthsData(months: string[], concurrency = 4): Observable<Topic[]> {
    return from(months).pipe(
      mergeMap(month => this.loadMonthData(month), concurrency),
      reduce((allTopics, monthTopics) => allTopics.concat(monthTopics), [] as Topic[]),
      map(topics => topics.sort((a, b) => b.id.localeCompare(a.id)))
    );
  }

  /**
   * 取得所有基礎資料（從 SettingConfig 取得）
   */
  getAllBaseData(): { months: string[], tags: string[] } {
    return {
      months: SettingConfig.months,
      tags: SettingConfig.tags
    };
  }

  /**
   * 載入設定
   */
  loadSettings(): AppSettings {
    const savedSettings = localStorage.getItem(this.SETTINGS_KEY);

    if (savedSettings) {
      return JSON.parse(savedSettings);
    }

    return {
      lastMonth: this.getCurrentMonth(),
      lastSearch: '',
      lastType: '',
      lastTag: ''
    };
  }

  /**
   * 儲存設定
   */
  saveSettings(settings: AppSettings): void {
    localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settings));
  }

  /**
   * 獲取當前月份 (YYYYMM 格式)
   */
  getCurrentMonth(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}${month}`;
  }
}
