import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { VocabularyQuizService } from '../../services/vocabulary-quiz.service';
import { VocabularyService } from '../../services/vocabulary.service';
import { NotificationService } from '../../services/notification.service';
import { QuizSettings, QuizQuestion, QuizResult, QuizState } from '../../models/vocabulary.model';
import { VocabularyLevelUtils } from '../../models/vocabulary-level.constants';

@Component({
  selector: 'app-vocabulary-quiz',
  imports: [CommonModule, FormsModule],
  templateUrl: './vocabulary-quiz.component.html',
  styleUrl: './vocabulary-quiz.component.less'
})
export class VocabularyQuizComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  // 測驗狀態
  currentState: QuizState = QuizState.SETUP;
  QuizState = QuizState; // 讓模板可以使用

  // 設定相關
  quizSettings: QuizSettings = {
    selectedLevels: [1, 2, 3],
    questionCount: 10
  };
  availableWordsCount = 0;

  // 熟悉度選項 - 使用屬性而不是 getter 來避免無窮迴圈
  familiarityLevels = [
    { value: 1, label: '不熟', checked: true },
    { value: 2, label: '尚可', checked: true },
    { value: 3, label: '記住了', checked: true }
  ];

  // 測驗進行中
  questions: QuizQuestion[] = [];
  currentQuestionIndex = 0;
  currentQuestion: QuizQuestion | null = null;
  userAnswer = '';

  // 測驗結果
  quizResult: QuizResult | null = null;

  // UI 相關
  isStarting = false;
  isSubmitting = false;

  // 工具
  readonly VocabularyLevelUtils = VocabularyLevelUtils;
  readonly Math = Math; // 讓模板可以使用 Math

  // 屬性別名，方便模板使用
  get quizQuestions(): QuizQuestion[] {
    return this.questions;
  }

  get currentAnswer(): string {
    return this.userAnswer;
  }

  set currentAnswer(value: string) {
    this.userAnswer = value;
  }

  constructor(
    private readonly quizService: VocabularyQuizService,
    private readonly vocabularyService: VocabularyService,
    private readonly notificationService: NotificationService
  ) { }

  ngOnInit(): void {
    this.loadSettings();
    this.subscribeToQuizState();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * 載入設定
   */
  private loadSettings(): void {
    this.quizSettings = this.quizService.loadQuizSettings();
    this.updateFamiliarityLevels();
    this.updateAvailableWordsCount();
  }

  /**
   * 更新熟悉度選項的選中狀態
   */
  private updateFamiliarityLevels(): void {
    this.familiarityLevels.forEach(level => {
      level.checked = this.quizSettings.selectedLevels.includes(level.value);
    });
  }

  /**
   * 訂閱測驗狀態變化
   */
  private subscribeToQuizState(): void {
    this.quizService.getQuizState()
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.currentState = state;
      });

    this.quizService.getCurrentQuestions()
      .pipe(takeUntil(this.destroy$))
      .subscribe(questions => {
        this.questions = questions;
        this.updateCurrentQuestion();
      });

    this.quizService.getCurrentQuestionIndex()
      .pipe(takeUntil(this.destroy$))
      .subscribe(index => {
        this.currentQuestionIndex = index;
        this.updateCurrentQuestion();
      });

    this.quizService.getQuizResult()
      .pipe(takeUntil(this.destroy$))
      .subscribe(result => {
        this.quizResult = result;
      });
  }

  /**
   * 更新可用生字數量
   */
  private updateAvailableWordsCount(): void {
    // 取得所有生字
    this.vocabularyService.getVocabularyData()
      .pipe(takeUntil(this.destroy$))
      .subscribe(words => {
        // 過濾符合選中熟悉度的生字
        const filteredWords = words.filter(word =>
          this.quizSettings.selectedLevels.includes(word.level)
        );

        this.availableWordsCount = filteredWords.length;
      });
  }

  /**
   * 開始測驗
   */
  async startQuiz(): Promise<void> {
    if (this.availableWordsCount === 0) {
      this.notificationService.showError('沒有符合條件的生字可以測驗');
      return;
    }

    this.isStarting = true;
    this.quizService.saveQuizSettings(this.quizSettings);

    // 使用 service 開始測驗
    const success = await this.quizService.startQuiz(this.quizSettings);

    if (!success) {
      this.notificationService.showError('測驗開始失敗，請再試一次');
    }

    this.isStarting = false;
  }

  /**
   * 熟悉度變更事件
   */
  onFamiliarityChange(): void {
    this.quizSettings.selectedLevels = this.familiarityLevels
      .filter(level => level.checked)
      .map(level => level.value);
    this.updateAvailableWordsCount();
  }

  /**
   * 檢查答案
   */
  checkAnswer(): void {
    if (!this.userAnswer.trim() || !this.currentQuestion) return;

    // 提交答案到 service
    this.quizService.submitAnswer(this.currentQuestionIndex, this.userAnswer);

    // 清空輸入框，讓用戶知道答案已提交
    this.userAnswer = '';
  }

  /**
   * 上一題
   */
  previousQuestion(): void {
    this.quizService.previousQuestion();
  }

  /**
   * 下一題
   */
  nextQuestion(): void {
    this.quizService.nextQuestion();
  }

  /**
   * 跳到指定題目
   */
  goToQuestion(index: number): void {
    this.quizService.goToQuestion(index);
  }

  /**
   * 更新當前問題
   */
  private updateCurrentQuestion(): void {
    if (this.questions.length > 0 && this.currentQuestionIndex >= 0 && this.currentQuestionIndex < this.questions.length) {
      this.currentQuestion = this.questions[this.currentQuestionIndex];
      this.userAnswer = this.currentQuestion?.userAnswer || '';
    } else {
      this.currentQuestion = null;
      this.userAnswer = '';
    }
  }

  /**
   * 檢查是否所有問題都已回答
   */
  allQuestionsAnswered(): boolean {
    return this.questions.length > 0 && this.questions.every(q => q.userAnswer.trim() !== '');
  }

  /**
   * 完成測驗
   */
  finishQuiz(): void {
    // 確保每個問題都有 newLevel 屬性
    this.questions.forEach(question => {
      if (!question.newLevel) {
        question.newLevel = question.originalLevel;
      }
    });

    this.quizService.completeQuiz();
  }

  /**
   * 離開測驗
   */
  exitQuiz(): void {
    if (confirm('確定要離開測驗嗎？目前的答題進度將會遺失。')) {
      this.resetQuiz();
    }
  }

  /**
   * 重設測驗
   */
  resetQuiz(): void {
    this.quizService.resetQuiz();
    // 其他狀態將透過 service 訂閱自動更新
  }

  /**
   * 回到設定
   */
  backToSettings(): void {
    this.currentState = QuizState.SETUP;
  }

  /**
   * 重設設定
   */
  resetSettings(): void {
    this.quizSettings = {
      selectedLevels: [1, 2, 3],
      questionCount: 10
    };
    this.updateFamiliarityLevels();
    this.quizService.saveQuizSettings(this.quizSettings);
    this.updateAvailableWordsCount();
  }

  /**
   * 取得熟悉度標籤
   */
  getFamiliarityLabel(level: number): string {
    return VocabularyLevelUtils.levelToLabel(level);
  }

  /**
   * 取得問題指示器樣式
   */
  getQuestionIndicatorClass(index: number): string {
    const question = this.questions[index];
    const isCurrent = index === this.currentQuestionIndex;

    if (isCurrent) return 'current';
    if (!question.userAnswer) return '';
    return question.isCorrect ? 'correct' : 'incorrect';
  }

  /**
   * 取得分數樣式
   */
  getScoreClass(score: number): string {
    if (!this.quizResult) return '';
    const percentage = score / this.quizResult.totalQuestions * 100;
    if (percentage >= 90) return 'excellent';
    if (percentage >= 70) return 'good';
    if (percentage >= 50) return 'average';
    return 'poor';
  }

  /**
   * 格式化持續時間
   */
  formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes > 0) {
      return `${minutes}分${remainingSeconds}秒`;
    }
    return `${remainingSeconds}秒`;
  }

  /**
   * 熟悉度更新事件
   */
  onFamiliarityUpdate(question: QuizQuestion): void {
    // 確保 newLevel 被正確設定
    if (!question.newLevel) {
      question.newLevel = question.originalLevel;
    }
  }

  /**
   * 套用所有熟悉度變更
   */
  async applyAllFamiliarityChanges(): Promise<void> {
    if (!this.questions || this.questions.length === 0) {
      this.notificationService.showError('沒有可更新的生字資料');
      return;
    }

    this.isSubmitting = true;
    let updatedCount = 0;

    try {
      for (const question of this.questions) {
        const newLevel = +(question.newLevel || question.originalLevel);

        // 只更新真正有變更的生字
        if (newLevel !== question.originalLevel) {
          const updatedWord = {
            ...question.word,
            level: newLevel,
            updatedAt: new Date()
          };

          try {
            // 使用 await 確保更新完成
            await this.vocabularyService.addWord(updatedWord);

            updatedCount++;

            // 更新本地狀態
            question.originalLevel = newLevel;
            question.word.level = newLevel;
          } catch (error) {
            console.error(`更新生字 "${question.word.word}" 失敗:`, error);
            throw error;
          }
        }
      }

      if (updatedCount > 0) {
        this.notificationService.showSuccess(`已成功更新 ${updatedCount} 個生字的熟悉度`);
      } else {
        this.notificationService.showInfo('沒有熟悉度變更需要儲存');
      }
    } catch (error) {
      console.error('更新熟悉度失敗:', error);
      this.notificationService.showError('更新熟悉度時發生錯誤');
    } finally {
      this.isSubmitting = false;
    }
  }

  /**
   * 取得實際出題數量
   */
  getActualQuestionCount(): number {
    return Math.min(this.quizSettings.questionCount, this.availableWordsCount);
  }

  /**
   * 取得當前進度百分比
   */
  getCurrentProgressPercentage(): number {
    if (this.quizQuestions.length === 0) return 0;
    return Math.round((this.currentQuestionIndex + 1) / this.quizQuestions.length * 100);
  }

  /**
   * 取得正確率百分比
   */
  getCorrectPercentage(): number {
    if (!this.quizResult || this.quizResult.totalQuestions === 0) return 0;
    return Math.round((this.quizResult.score / this.quizResult.totalQuestions) * 100);
  }

  /**
   * 將換行符號轉換為 HTML 的 br 標籤
   */
  replaceNewlines(text: string): string {
    if (!text) return '';
    return text.replace(/\n/g, '<br>');
  }
}
