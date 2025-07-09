import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { SettingConfig } from '../config/setting.config';

@Injectable({
  providedIn: 'root'
})
export class AppInitializerService {
  private readonly ASSETS_PATH = 'assets/data';

  constructor(private http: HttpClient) { }

  /**
   * 初始化應用程式
   * 載入必要的配置資料
   */
  initialize(): Promise<void> {
    console.log('開始初始化應用程式...');

    return new Promise((resolve, reject) => {
      // 使用 forkJoin 並行載入兩個 JSON 檔案
      forkJoin({
        months: this.loadMonthsList(),
        tags: this.loadTagsList()
      }).pipe(
        tap(({ months, tags }) => {
          // 將資料設定到 SettingConfig
          SettingConfig._setMonths(months);
          SettingConfig._setTags(tags);
          SettingConfig._setInitialized(true);
        }),
        catchError(error => {
          console.error('應用程式初始化失敗:', error);
          // 即使失敗也要讓應用程式繼續運行
          SettingConfig._setInitialized(true);
          return of({ months: [], tags: [] });
        })
      ).subscribe({
        next: () => {
          resolve();
        },
        error: (error) => {
          console.error('應用程式初始化發生錯誤:', error);
          // 設定為已初始化以避免應用程式卡住
          SettingConfig._setInitialized(true);
          resolve();
        }
      });
    });
  }

  /**
   * 載入月份清單
   */
  private loadMonthsList(): Observable<string[]> {
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
  private loadTagsList(): Observable<string[]> {
    const randomParam = this.getRandomParam();
    return this.http.get<string[]>(`${this.ASSETS_PATH}/tag.json${randomParam}`)
      .pipe(
        catchError(error => {
          console.error('載入 tag.json 失敗:', error);
          return of([]);
        })
      );
  }

  private getRandomParam(): string {
    return SettingConfig.randomParam;
  }
}
