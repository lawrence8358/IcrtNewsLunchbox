import { Injectable } from '@angular/core';
import { Topic } from '../models/topic.model';

@Injectable({
  providedIn: 'root'
})
export class FavoriteService {
  private readonly storageKey = 'icrt_favorites';

  constructor() { }

  /**
   * 載入所有最愛主題 ID
   */
  loadFavorites(): string[] {
    try {
      const stored = localStorage.getItem(this.storageKey);
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('載入我的最愛失敗:', error);
      return [];
    }
  }

  /**
   * 判斷主題是否為最愛
   */
  isFavorite(topicId: string): boolean {
    return this.loadFavorites().includes(topicId);
  }

  /**
   * 切換主題的最愛狀態，回傳切換後的狀態
   */
  toggleFavorite(topicId: string): boolean {
    try {
      const favorites = this.loadFavorites();
      const index = favorites.indexOf(topicId);
      const isFavorite = index === -1;

      if (isFavorite) {
        favorites.push(topicId);
      } else {
        favorites.splice(index, 1);
      }

      localStorage.setItem(this.storageKey, JSON.stringify(favorites));
      return isFavorite;
    } catch (error) {
      console.error('儲存我的最愛失敗:', error);
      return this.isFavorite(topicId);
    }
  }

  /**
   * 將最愛狀態應用到主題列表
   */
  applyFavoritesToTopics(topics: Topic[]): Topic[] {
    const favorites = new Set(this.loadFavorites());

    return topics.map(topic => ({
      ...topic,
      isFavorite: favorites.has(topic.id)
    }));
  }

  /**
   * 移除最愛
   */
  removeFavorite(topicId: string): void {
    try {
      const favorites = this.loadFavorites();
      const index = favorites.indexOf(topicId);
      if (index !== -1) {
        favorites.splice(index, 1);
        localStorage.setItem(this.storageKey, JSON.stringify(favorites));
      }
    } catch (error) {
      console.error('移除我的最愛失敗:', error);
    }
  }

  /**
   * 清除所有最愛
   */
  clearAllFavorites(): void {
    try {
      localStorage.removeItem(this.storageKey);
    } catch (error) {
      console.error('清除所有我的最愛失敗:', error);
    }
  }
}
