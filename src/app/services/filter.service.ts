import { Injectable } from '@angular/core';
import { Topic, ContentItem } from '../models/topic.model';

@Injectable({
  providedIn: 'root'
})
export class FilterService {

  constructor() { }

  /**
   * 篩選主題資料
   */
  filterTopics(
    topics: Topic[],
    searchText: string,
    selectedType: string,
    selectedTag: string
  ): Topic[] {
    if (!topics || topics.length === 0) {
      return [];
    }

    return topics.filter(topic => {
      // 文字搜尋
      let textMatch = true;
      if (searchText) {
        const searchLower = searchText.toLowerCase();

        // 搜尋主題標題
        const titleMatch = topic.title.toLowerCase().includes(searchLower);

        // 搜尋類型
        const typeMatch = topic.type.toLowerCase().includes(searchLower);

        // 搜尋標籤
        const tagMatch = topic.tag?.some(tag => tag.toLowerCase().includes(searchLower));

        // 搜尋內容（英文和中文）
        const contentMatch = this.searchInContent(topic.content, searchLower);

        // 搜尋單字表
        const vocabularyMatch = this.searchInVocabulary(topic.vocabulary?.content || [], searchLower);

        textMatch = titleMatch || typeMatch || tagMatch || contentMatch || vocabularyMatch;
      }

      // 類型篩選
      let typeMatch = true;
      if (selectedType) {
        typeMatch = topic.type === selectedType;
      }

      // 標籤篩選
      let tagMatch = true;
      if (selectedTag) {
        tagMatch = topic.tag?.includes(selectedTag) || false;
      }

      return textMatch && typeMatch && tagMatch;
    });
  }

  /**
   * 排序主題（按日期新->舊）
   */
  sortTopicsByDate(topics: Topic[]): Topic[] {
    return [...topics].sort((a, b) => {
      const dateA = this.extractDateFromId(a.id);
      const dateB = this.extractDateFromId(b.id);
      return dateB.localeCompare(dateA);
    });
  }

  /**
   * 從內容中搜尋
   */
  private searchInContent(content: ContentItem[], searchLower: string): boolean {
    if (!content || !Array.isArray(content)) {
      return false;
    }

    return content.some(item => {
      const enMatch = item.en?.toLowerCase().includes(searchLower);
      const twMatch = item.tw?.toLowerCase().includes(searchLower);
      return enMatch || twMatch;
    });
  }

  /**
   * 從單字表中搜尋
   */
  private searchInVocabulary(vocabulary: any[], searchLower: string): boolean {
    if (!vocabulary || !Array.isArray(vocabulary)) {
      return false;
    }

    return vocabulary.some(item => {
      const textMatch = item.text?.toLowerCase().includes(searchLower);
      return textMatch;
    });
  }

  /**
   * 從ID提取日期用於排序
   */
  private extractDateFromId(id: string): string {
    const match = id.match(/^(\d{8})-/);
    if (match) {
      return match[1]; // 返回 YYYYMMDD 格式用於排序
    }
    return '00000000';
  }

  /**
   * 獲取所有類型
   */
  getUniqueTypes(topics: Topic[]): string[] {
    const types = new Set<string>();
    topics.forEach(topic => {
      if (topic.type) {
        types.add(topic.type);
      }
    });
    return Array.from(types).sort();
  }
}
