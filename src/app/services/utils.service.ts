import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class UtilsService {

  constructor() { }

  /**
   * 格式化日期並加上星期顯示
   */
  formatDateWithWeekday(dateString: string): string {
    if (!dateString) return '';

    const date = new Date(dateString);
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    const weekday = weekdays[date.getDay()];

    return `${dateString}(${weekday})`;
  }

  /**
   * 將 YYYYMM 格式轉換為顯示標籤
   */
  formatMonthLabel(monthValue: string): string {
    if (!monthValue || monthValue.length !== 6) return monthValue;

    const year = monthValue.substring(0, 4);
    const month = monthValue.substring(4, 6);
    return `${year}年${month}月`;
  }

  /**
   * 從ID提取日期並格式化為 YYYY-MM-DD
   */
  formatDateFromId(id: string): string {
    const match = id.match(/^(\d{4})(\d{2})(\d{2})-/);
    if (match) {
      const [, year, month, day] = match;
      const dateString = `${year}-${month}-${day}`;
      return this.formatDateWithWeekday(dateString);
    }
    return '';
  }

  /**
   * 將時間字符串轉換為秒數
   */
  parseTimeToSeconds(timeString: string | number): number | null {
    if (typeof timeString === 'number') {
      return timeString;
    }

    if (!timeString || typeof timeString !== 'string') {
      return null;
    }

    const parts = timeString.split(':');
    if (parts.length === 2) {
      // 格式: "分:秒" 例如 "1:08" = 1分8秒 = 68秒
      const minutes = parseInt(parts[0]) || 0;
      const seconds = parseInt(parts[1]) || 0;
      return minutes * 60 + seconds;
    } else if (parts.length === 3) {
      // 格式: "時:分:秒" 例如 "1:30:45"
      const hours = parseInt(parts[0]) || 0;
      const minutes = parseInt(parts[1]) || 0;
      const seconds = parseInt(parts[2]) || 0;
      return hours * 3600 + minutes * 60 + seconds;
    } else if (parts.length === 1) {
      // 格式: 純秒數 "30"
      return parseInt(parts[0]) || 0;
    }

    return null;
  }

  /**
   * 截斷文字並加上省略號
   */
  truncateText(text: string, maxLength: number): string {
    if (!text || text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength) + '...';
  }

  /**
   * 從主題ID推斷月份
   */
  extractMonthFromTopicId(topicId: string): string | null {
    const match = topicId.match(/^(\d{6})/);
    return match ? match[1] : null;
  }
}
