import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Topic, AppSettings } from '../models/topic.model';
import { SettingConfig } from '../config/setting.config';

@Injectable({
  providedIn: 'root'
})
export class DataService {
  private readonly ASSETS_PATH = 'assets/data';
  private readonly SETTINGS_KEY = 'icrt_settings';

  constructor(private readonly http: HttpClient) { }

  /**
   * 載入指定月份的主題資料
   */
  loadMonthData(month: string): Observable<Topic[]> {
    const fileName = month.replace('-', '');
    const randomParam = SettingConfig.randomParam
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
