/**
 * 應用程式設定配置類別
 * 提供靜態方法來存取應用程式的全域設定
 */
export class SettingConfig {
  private static _months: string[] = [];
  private static _tags: string[] = [];
  private static _isInitialized = false;
  private static readonly _randomParam: string = this.getRandomParam();

  /**
   * 取得月份清單
   */
  static get months(): string[] {
    return [...this._months];
  }

  /**
   * 取得標籤清單
   */
  static get tags(): string[] {
    return [...this._tags];
  }

  /**
   * 檢查是否已初始化
   */
  static get isInitialized(): boolean {
    return this._isInitialized;
  }

  /**
   * 取得隨機參數以避免快取
   */
  static get randomParam(): string {
    return this._randomParam;
  }

  /**
   * 設定月份清單（僅供內部使用）
   */
  static _setMonths(months: string[]): void {
    this._months = [...months];
  }

  /**
   * 設定標籤清單（僅供內部使用）
   */
  static _setTags(tags: string[]): void {
    this._tags = [...tags];
  }

  /**
   * 標記為已初始化（僅供內部使用）
   */
  static _setInitialized(initialized: boolean): void {
    this._isInitialized = initialized;
  }

  /**
   * 重置配置（僅供測試使用）
   */
  static _reset(): void {
    this._months = [];
    this._tags = [];
    this._isInitialized = false;
  }


  /**
   * 生成隨機參數防止緩存
   */
  private static getRandomParam(): string {
    return `?v=${Date.now()}&r=${Math.random().toString(36).substring(7)}`;
  }
}
