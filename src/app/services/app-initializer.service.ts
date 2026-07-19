import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { SettingConfig } from '../config/setting.config';

interface DataManifest {
  buildVersion: string;
  months: string[];
  tags: string[];
  versions: Record<string, string>;
}

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
      this.loadManifest().pipe(
        tap(({ buildVersion, months, tags, versions }) => {
          // 將資料設定到 SettingConfig
          SettingConfig._setMonths(months);
          SettingConfig._setTags(tags);
          SettingConfig._setDataVersions(versions);
          SettingConfig._setBuildVersion(buildVersion);
          SettingConfig._setInitialized(true);
        }),
        catchError(error => {
          console.error('應用程式初始化失敗:', error);
          // 即使失敗也要讓應用程式繼續運行
          SettingConfig._setInitialized(true);
          return of({ buildVersion: '', months: [], tags: [], versions: {} });
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
   * 載入資料清單。只對這個小檔案略過快取，以便偵測新資料；
   * 各月份 JSON 則使用內容雜湊作為穩定版本，可沿用瀏覽器快取。
   */
  private loadManifest(): Observable<DataManifest> {
    const randomParam = this.getRandomParam();
    return this.http.get<DataManifest>(`${this.ASSETS_PATH}/manifest.json${randomParam}`)
      .pipe(
        catchError(error => {
          console.error('載入 manifest.json 失敗:', error);
          return of({ buildVersion: '', months: [], tags: [], versions: {} });
        })
      );
  }

  private getRandomParam(): string {
    return SettingConfig.randomParam;
  }
}
