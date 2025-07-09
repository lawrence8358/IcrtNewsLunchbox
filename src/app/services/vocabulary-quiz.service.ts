import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { VocabularyWord, QuizSettings, QuizQuestion, QuizResult, QuizState } from '../models/vocabulary.model';
import { VocabularyService } from './vocabulary.service';

@Injectable({
  providedIn: 'root'
})
export class VocabularyQuizService {
  private readonly QUIZ_SETTINGS_KEY = 'vocabulary_quiz_settings';

  private currentQuizState$ = new BehaviorSubject<QuizState>(QuizState.SETUP);
  private currentQuestions$ = new BehaviorSubject<QuizQuestion[]>([]);
  private currentQuestionIndex$ = new BehaviorSubject<number>(0);
  private quizResult$ = new BehaviorSubject<QuizResult | null>(null);
  private quizStartTime: Date | null = null;

  constructor(private vocabularyService: VocabularyService) {}

  /**
   * 取得測驗狀態
   */
  getQuizState(): Observable<QuizState> {
    return this.currentQuizState$.asObservable();
  }

  /**
   * 取得當前題目列表
   */
  getCurrentQuestions(): Observable<QuizQuestion[]> {
    return this.currentQuestions$.asObservable();
  }

  /**
   * 取得當前題目索引
   */
  getCurrentQuestionIndex(): Observable<number> {
    return this.currentQuestionIndex$.asObservable();
  }

  /**
   * 取得測驗結果
   */
  getQuizResult(): Observable<QuizResult | null> {
    return this.quizResult$.asObservable();
  }

  /**
   * 載入測驗設定
   */
  loadQuizSettings(): QuizSettings {
    try {
      const saved = localStorage.getItem(this.QUIZ_SETTINGS_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('載入測驗設定失敗:', error);
    }

    // 預設設定
    return {
      selectedLevels: [1, 2, 3], // 預設全選
      questionCount: 10
    };
  }

  /**
   * 儲存測驗設定
   */
  saveQuizSettings(settings: QuizSettings): void {
    try {
      localStorage.setItem(this.QUIZ_SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('儲存測驗設定失敗:', error);
    }
  }

  /**
   * 開始測驗
   */
  async startQuiz(settings: QuizSettings): Promise<boolean> {
    try {
      // 記錄開始時間
      this.quizStartTime = new Date();

      // 儲存設定
      this.saveQuizSettings(settings);

      // 取得符合條件的生字
      const allWords = this.vocabularyService.getVocabularyData();
      const vocabularyData = await new Promise<VocabularyWord[]>((resolve) => {
        allWords.subscribe(data => resolve(data));
      });

      // 篩選符合熟悉程度的生字
      const filteredWords = vocabularyData.filter(word =>
        settings.selectedLevels.includes(word.level)
      );

      if (filteredWords.length === 0) {
        return false; // 沒有符合條件的生字
      }

      // 隨機選取題目
      const questionCount = Math.min(settings.questionCount, filteredWords.length);
      const shuffled = this.shuffleArray(filteredWords);
      const selectedWords = shuffled.slice(0, questionCount);

      // 建立題目
      const questions: QuizQuestion[] = selectedWords.map((word: VocabularyWord) => ({
        id: `quiz_${word.id}_${Date.now()}`,
        word,
        userAnswer: '',
        isCorrect: false,
        originalLevel: word.level,
        newLevel: word.level // 初始化為原始等級
      }));

      // 設定測驗狀態
      this.currentQuestions$.next(questions);
      this.currentQuestionIndex$.next(0);
      this.currentQuizState$.next(QuizState.IN_PROGRESS);
      this.quizResult$.next(null);

      return true;
    } catch (error) {
      console.error('開始測驗失敗:', error);
      return false;
    }
  }

  /**
   * 提交單一題目答案
   */
  submitAnswer(questionIndex: number, answer: string): void {
    const questions = this.currentQuestions$.value;
    if (questionIndex >= 0 && questionIndex < questions.length) {
      const updatedQuestions = [...questions];
      updatedQuestions[questionIndex].userAnswer = answer.trim();
      updatedQuestions[questionIndex].isCorrect =
        answer.trim().toLowerCase() === updatedQuestions[questionIndex].word.word.toLowerCase();

      this.currentQuestions$.next(updatedQuestions);
    }
  }

  /**
   * 移到下一題
   */
  nextQuestion(): boolean {
    const currentIndex = this.currentQuestionIndex$.value;
    const questions = this.currentQuestions$.value;

    if (currentIndex < questions.length - 1) {
      this.currentQuestionIndex$.next(currentIndex + 1);
      return true;
    }
    return false;
  }

  /**
   * 移到上一題
   */
  previousQuestion(): boolean {
    const currentIndex = this.currentQuestionIndex$.value;

    if (currentIndex > 0) {
      this.currentQuestionIndex$.next(currentIndex - 1);
      return true;
    }
    return false;
  }

  /**
   * 跳到指定題目
   */
  goToQuestion(index: number): boolean {
    const questions = this.currentQuestions$.value;

    if (index >= 0 && index < questions.length) {
      this.currentQuestionIndex$.next(index);
      return true;
    }
    return false;
  }

  /**
   * 完成測驗
   */
  completeQuiz(): QuizResult {
    const questions = this.currentQuestions$.value;
    const correctAnswers = questions.filter(q => q.isCorrect).length;
    const score = Math.round((correctAnswers / questions.length) * 100);
    const completedAt = new Date();
    const duration = this.quizStartTime ? completedAt.getTime() - this.quizStartTime.getTime() : 0;

    const result: QuizResult = {
      totalQuestions: questions.length,
      correctAnswers,
      score,
      questions,
      completedAt,
      duration,
      settings: this.loadQuizSettings()
    };

    this.quizResult$.next(result);
    this.currentQuizState$.next(QuizState.COMPLETED);

    return result;
  }

  /**
   * 更新題目的熟悉程度
   */
  updateQuestionLevel(questionId: string, newLevel: number): void {
    const questions = this.currentQuestions$.value;
    const updatedQuestions = questions.map(q =>
      q.id === questionId ? { ...q, newLevel } : q
    );
    this.currentQuestions$.next(updatedQuestions);
  }

  /**
   * 套用熟悉程度變更到生字簿
   */
  async applyLevelChanges(): Promise<void> {
    const questions = this.currentQuestions$.value;
    const changedQuestions = questions.filter(q =>
      q.newLevel !== undefined && q.newLevel !== q.originalLevel
    );

    for (const question of changedQuestions) {
      if (question.newLevel !== undefined) {
        const updatedWord = {
          ...question.word,
          level: question.newLevel,
          updatedAt: new Date()
        };
        await this.vocabularyService.addWord(updatedWord);
      }
    }
  }

  /**
   * 洗牌演算法 - Fisher-Yates shuffle
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * 重置測驗
   */
  resetQuiz(): void {
    this.currentQuizState$.next(QuizState.SETUP);
    this.currentQuestions$.next([]);
    this.currentQuestionIndex$.next(0);
    this.quizResult$.next(null);
    this.quizStartTime = null;
  }

  /**
   * 取得可用的生字數量（依熟悉程度）
   */
  async getAvailableWordsCount(selectedLevels: number[]): Promise<number> {
    const allWords = this.vocabularyService.getVocabularyData();
    const vocabularyData = await new Promise<VocabularyWord[]>((resolve) => {
      allWords.subscribe(data => resolve(data));
    });

    return vocabularyData.filter(word =>
      selectedLevels.includes(word.level)
    ).length;
  }
}
