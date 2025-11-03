import { Injectable } from '@angular/core';
import { Topic } from '../models/topic.model';

@Injectable({
  providedIn: 'root'
})
export class LearningStatusService {
  private readonly storageKey = 'icrt_learning_status';

  constructor() { }

  /**
   * 載入所有學習狀態
   */
  loadLearningStatuses(): { [topicId: string]: string } {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('載入學習狀態失敗:', error);
      return {};
    }
  }

  /**
   * 儲存學習狀態
   */
  saveLearningStatus(topicId: string, status: string): void {
    try {
      const learningStatusData = this.loadLearningStatuses();
      learningStatusData[topicId] = status;
      localStorage.setItem(this.storageKey, JSON.stringify(learningStatusData));
    } catch (error) {
      console.error('儲存學習狀態失敗:', error);
    }
  }

  /**
   * 取得特定主題的學習狀態
   */
  getLearningStatus(topicId: string): string {
    const statuses = this.loadLearningStatuses();
    return statuses[topicId] || 'not-started';
  }

  /**
   * 將學習狀態應用到主題列表
   */
  applyLearningStatusToTopics(topics: Topic[]): Topic[] {
    const statuses = this.loadLearningStatuses();
    
    return topics.map(topic => ({
      ...topic,
      learningStatus: (statuses[topic.id] as 'learned' | 'learning' | 'not-started') || 'not-started'
    }));
  }

  /**
   * 刪除學習狀態
   */
  removeLearningStatus(topicId: string): void {
    try {
      const learningStatusData = this.loadLearningStatuses();
      delete learningStatusData[topicId];
      localStorage.setItem(this.storageKey, JSON.stringify(learningStatusData));
    } catch (error) {
      console.error('刪除學習狀態失敗:', error);
    }
  }

  /**
   * 清除所有學習狀態
   */
  clearAllLearningStatuses(): void {
    try {
      localStorage.removeItem(this.storageKey);
    } catch (error) {
      console.error('清除所有學習狀態失敗:', error);
    }
  }
}