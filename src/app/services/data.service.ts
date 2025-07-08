import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, combineLatest, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Topic, AppSettings } from '../models/topic.model';

@Injectable({
  providedIn: 'root'
})
export class DataService {
  private readonly ASSETS_PATH = 'assets/data';
  private readonly SETTINGS_KEY = 'icrt_settings';

  constructor(private http: HttpClient) { }

  /**
   * 載入月份清單
   */
  loadMonthsList(): Observable<string[]> {
    const randomParam = this.getRandomParam();
    return this.http.get<string[]>(`${this.ASSETS_PATH}/months.json${randomParam}`)
      .pipe(
        catchError(error => {
          console.error('載入 months.json 失敗:', error);
          return of([]);
        })
      );
  }

  /**
   * 載入標籤清單
   */
  loadTagsList(): Observable<string[]> {
    const randomParam = this.getRandomParam();
    return this.http.get<string[]>(`${this.ASSETS_PATH}/tag.json${randomParam}`)
      .pipe(
        catchError(error => {
          console.error('載入 tag.json 失敗:', error);
          return of([]);
        })
      );
  }

  /**
   * 載入指定月份的主題資料
   */
  loadMonthData(month: string): Observable<Topic[]> {
    const fileName = month.replace('-', '');
    const randomParam = this.getRandomParam();
    return this.http.get<Topic[]>(`${this.ASSETS_PATH}/${fileName}.json${randomParam}`)
      .pipe(
        map(data => {
          // 依 topic.id 排序 desc
          return data.sort((a, b) => b.id.localeCompare(a.id));
        }),
        catchError(error => {
          console.error(`載入 ${fileName}.json 失敗:`, error);
          return of([]);
        })
      );
  }

  /**
   * 同時載入所有基礎資料
   */
  loadAllBaseData(): Observable<{ months: string[], tags: string[] }> {
    return combineLatest([
      this.loadMonthsList(),
      this.loadTagsList()
    ]).pipe(
      map(([months, tags]) => ({ months, tags }))
    );
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

  /**
   * 生成隨機參數防止緩存
   */
  private getRandomParam(): string {
    return `?v=${Date.now()}&r=${Math.random().toString(36).substring(7)}`;
  }
}
