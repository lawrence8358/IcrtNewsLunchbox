class ICRTApp {
    constructor() {
        this.currentData = [];
        this.filteredData = [];
        this.currentTopic = null;
        this.audio = null;
        this.monthsData = [];
    }
    
    async init() {
        this.bindEvents();
        await this.loadAllDataAndSettings();
        this.loadInitialData();
    }
    
    // 共用的日期格式化函數 - 加上星期顯示
    formatDateWithWeekday(dateString) {
        if (!dateString) return '';
        
        const date = new Date(dateString);
        const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
        const weekday = weekdays[date.getDay()];
        
        return `${dateString}(${weekday})`;
    }
    
    // 同時載入所有資料和設定
    async loadAllDataAndSettings() {
        // 先嘗試載入本地設定
        const savedSettings = localStorage.getItem('icrt_settings');
        
        try {
            // 並行載入 months.json 和 tag.json
            const randomParam = `?v=${Date.now()}&r=${Math.random().toString(36).substring(7)}`;
            const [monthsResponse, tagsResponse] = await Promise.all([
                fetch(`assets/data/months.json${randomParam}`),
                fetch(`assets/data/tag.json${randomParam}`)
            ]);
            
            // 處理 months.json
            if (monthsResponse.ok) {
                this.monthsData = await monthsResponse.json();
            } else {
                console.error('載入 months.json 失敗');
                this.monthsData = [];
            }
            
            // 處理 tag.json
            let tagsData = [];
            if (tagsResponse.ok) {
                tagsData = await tagsResponse.json();
            } else {
                console.error('載入 tag.json 失敗');
            }
            
            // 設定 settings
            if (savedSettings) {
                this.settings = JSON.parse(savedSettings);
            } else {
                // 如果沒有設定檔，使用 months.json 的最新月份
                let latestMonth = this.getCurrentMonth();
                if (this.monthsData && this.monthsData.length > 0) {
                    latestMonth = this.monthsData[this.monthsData.length - 1];
                }
                
                this.settings = {
                    lastMonth: latestMonth,
                    lastSearch: '',
                    lastType: '',
                    lastTag: ''
                };
            }
            
            // 設定月份選項
            this.populateMonthOptions();
            
            // 設定標籤選項
            this.populateTagOptions(tagsData);
            
        } catch (error) {
            console.error('載入資料時發生錯誤:', error);
            
            // 如果載入失敗，使用預設設定和備用選項
            if (savedSettings) {
                this.settings = JSON.parse(savedSettings);
            } else {
                this.settings = {
                    lastMonth: this.getCurrentMonth(),
                    lastSearch: '',
                    lastType: '',
                    lastTag: ''
                };
            }
            
            this.populateMonthOptionsFallback();
        }
    }
    
    // 設定月份選項（使用已載入的資料）
    populateMonthOptions() {
        const select = $('#monthSelect');
        select.empty();
        select.append('<option value="">請選擇月份</option>');
        
        if (this.monthsData && this.monthsData.length > 0) {
            this.monthsData.forEach(monthValue => {
                const label = this.formatMonthLabel(monthValue);
                select.append(`<option value="${monthValue}">${label}</option>`);
            });
        }
        
        // 恢復之前的選擇
        if (this.settings.lastMonth) {
            const lastMonthFormatted = this.settings.lastMonth.replace('-', '');
            select.val(lastMonthFormatted);
        }
        
        // 設定其他欄位的預設值
        $('#topicSearch').val(this.settings.lastSearch);
    }
    
    // 設定標籤選項（使用已載入的資料）
    populateTagOptions(tagsData) {
        const tagSelect = $('#tagSelect');
        tagSelect.empty().append('<option value="">全部標籤</option>');
        
        if (tagsData && tagsData.length > 0) {
            tagsData.forEach(tag => {
                tagSelect.append(`<option value="${tag}">${tag}</option>`);
            });
        }
        
        // 設定預設值
        tagSelect.val(this.settings.lastTag);    }

    saveSettings() {
        localStorage.setItem('icrt_settings', JSON.stringify(this.settings));
    }
    
    getCurrentMonth() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        return `${year}${month}`;
    }
    
    // 將 yyyyMM 格式轉換為顯示標籤
    formatMonthLabel(monthValue) {
        if (!monthValue || monthValue.length !== 6) return monthValue;
        
        const year = monthValue.substring(0, 4);
        const month = monthValue.substring(4, 6);
        return `${year}年${month}月`;
    }
    
    // 備用的月份生成邏輯
    populateMonthOptionsFallback() {
        const select = $('#monthSelect');
        const currentYear = new Date().getFullYear();
        
        // 生成過去12個月的選項
        for (let i = 0; i < 12; i++) {
            const date = new Date(currentYear, new Date().getMonth() - i, 1);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const value = `${year}${month}`;
            const label = this.formatMonthLabel(value);
            
            select.append(`<option value="${value}">${label}</option>`);
        }
        
        // 設定預設值
        if (this.settings.lastMonth) {
            const lastMonthFormatted = this.settings.lastMonth.replace('-', '');
            select.val(lastMonthFormatted);
        }
        $('#topicSearch').val(this.settings.lastSearch);
    }
    
    populateFilterOptions() {
        if (!this.currentData || this.currentData.length === 0) return;
        
        // 收集所有類型
        const types = new Set();
        
        this.currentData.forEach(topic => {
            if (topic.type) types.add(topic.type);
        });
        
        // 填充類型選項
        const typeSelect = $('#typeSelect');
        typeSelect.empty().append('<option value="">全部程度</option>');
        Array.from(types).sort().forEach(type => {
            typeSelect.append(`<option value="${type}">${type}</option>`);
        });
        
        // 設定預設值
        typeSelect.val(this.settings.lastType);
    }
    
    bindEvents() {
        $('#searchBtn').on('click', () => this.performSearch());
        $('#topicSearch').on('keypress', (e) => {
            if (e.which === 13) this.performSearch();
        });
        
        // 移除自動搜尋，只保留手動搜尋
        
        $(document).on('click', '.topic-card', (e) => {
            const topicId = $(e.currentTarget).data('topic-id');
            this.showTopicDetail(topicId);
        });
        
        $(document).on('click', '.btn-toggle-translation', (e) => {
            e.preventDefault();
            const btn = $(e.currentTarget);
            const contentItem = btn.closest('.content-item');
            const chineseText = contentItem.find('.chinese-text');
            
            if (chineseText.is(':visible')) {
                chineseText.slideUp();
                btn.removeClass('active');
                btn.html('<i class="fas fa-language"></i>');
            } else {
                chineseText.slideDown();
                btn.addClass('active');
                btn.html('<i class="fas fa-eye-slash"></i>');
            }
        });
        
        $(document).on('click', '.btn-jump-time', (e) => {
            e.preventDefault();
            const time = $(e.currentTarget).data('time');
            if (time && this.audio) {
                this.audio.currentTime = time;
                this.audio.play().catch(error => {
                    console.error('Audio play failed:', error);
                });
            }
        });
        
        // Quiz 選項點擊事件
        $(document).on('click', '.quiz-option', (e) => {
            const option = $(e.currentTarget);
            const quizItem = option.closest('.quiz-item');
            
            // 清除同一題的其他選項選中狀態
            quizItem.find('.quiz-option').removeClass('selected');
            option.addClass('selected');
        });
        
        // 顯示答案按鈕事件
        $(document).on('click', '.btn-show-answer', (e) => {
            const btn = $(e.currentTarget);
            const quizItem = btn.closest('.quiz-item');
            const correctAnswer = btn.data('answer');
            
            // 顯示正確答案
            quizItem.find('.quiz-option').each(function() {
                const option = $(this);
                const optionValue = option.data('value');
                
                if (optionValue === correctAnswer) {
                    option.addClass('correct');
                } else if (option.hasClass('selected')) {
                    option.addClass('incorrect');
                }
            });
            
            btn.prop('disabled', true).text('已顯示答案');
        });
    }
    
    async loadInitialData() {
        if (this.settings.lastMonth) {
            // 將舊格式 yyyy-MM 轉換為新格式 yyyyMM
            let formattedMonth = this.settings.lastMonth;
            if (formattedMonth.includes('-')) {
                formattedMonth = formattedMonth.replace('-', '');
            }
            
            // 第一次載入時恢復所有設定
            $('#monthSelect').val(formattedMonth);
            $('#topicSearch').val(this.settings.lastSearch);
            $('#typeSelect').val(this.settings.lastType);
            $('#tagSelect').val(this.settings.lastTag);
            
            await this.loadMonthData(formattedMonth);
            
            // 填充篩選選項
            this.populateFilterOptions();
            
            // 執行篩選
            this.performFilter();
        }
    }
    
    async loadMonthData(month) {
        try {
            const fileName = month.replace('-', '');
            // 加上隨機查詢字串防止快取
            const randomParam = `?v=${Date.now()}&r=${Math.random().toString(36).substring(7)}`;
            const response = await fetch(`assets/data/${fileName}.json${randomParam}`);
            
            if (!response.ok) {
                throw new Error('資料載入失敗');
            }
            
            this.currentData = await response.json();
        } catch (error) {
            console.error('載入資料時發生錯誤:', error);
            this.currentData = [];
            this.showError('無法載入該月份的資料，請選擇其他月份。');
        }
    }
    
    async performSearch() {
        const selectedMonth = $('#monthSelect').val();
        const searchText = $('#topicSearch').val(); // 保留原始輸入，不轉小寫
        const selectedType = $('#typeSelect').val();
        const selectedTag = $('#tagSelect').val();
        
        if (!selectedMonth) {
            this.showError('請選擇月份');
            return;
        }
        
        // 更新設定
        this.settings.lastMonth = selectedMonth;
        this.settings.lastSearch = searchText; // 儲存原始輸入
        this.settings.lastType = selectedType;
        this.settings.lastTag = selectedTag;
        this.saveSettings();
        
        // 載入資料
        $('#topicsList').html(`
            <div class="loading">
                <i class="fas fa-spinner fa-spin fa-2x"></i>
                <p class="mt-2">載入中...</p>
            </div>
        `);
        
        await this.loadMonthData(selectedMonth);
        
        // 填充篩選選項
        this.populateFilterOptions();
        
        // 執行篩選
        this.performFilter();
    }
    
    performFilter() {
        const searchText = $('#topicSearch').val(); // 保留原始輸入
        const selectedType = $('#typeSelect').val();
        const selectedTag = $('#tagSelect').val();
        
        if (!this.currentData || this.currentData.length === 0) {
            this.showError('沒有資料可以篩選');
            return;
        }
        
        // 過濾資料
        this.filteredData = this.currentData.filter(topic => {
            // 文字搜尋 - 搜尋主題、類型、標籤和內容
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
                let contentMatch = false;
                if (topic.content && Array.isArray(topic.content)) {
                    contentMatch = topic.content.some(item => {
                        const enMatch = item.en?.toLowerCase().includes(searchLower);
                        const twMatch = item.tw?.toLowerCase().includes(searchLower);
                        return enMatch || twMatch;
                    });
                }
                
                // 搜尋單字表
                let vocabularyMatch = false;
                if (topic.vocabulary && Array.isArray(topic.vocabulary)) {
                    vocabularyMatch = topic.vocabulary.some(item => {
                        const enMatch = item.en?.toLowerCase().includes(searchLower);
                        const twMatch = item.tw?.toLowerCase().includes(searchLower);
                        return enMatch || twMatch;
                    });
                }
                
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
                tagMatch = topic.tag?.includes(selectedTag);
            }
            
            return textMatch && typeMatch && tagMatch;
        });
        
        this.renderTopicsList();
    }
    
    renderTopicsList() {
        const container = $('#topicsList');
        
        if (this.filteredData.length === 0) {
            container.html(`
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <h5>找不到相關主題</h5>
                    <p>請嘗試調整搜尋條件或選擇其他月份</p>
                </div>
            `);
            return;
        }
        
        // 按日期排序（新->舊）
        const sortedData = [...this.filteredData].sort((a, b) => {
            const dateA = this.extractDateFromId(a.id);
            const dateB = this.extractDateFromId(b.id);
            return dateB.localeCompare(dateA); // 降序排列
        });
        
        let html = '';
        sortedData.forEach(topic => {
            const preview = topic.content[0]?.en || '';
            const previewText = preview.length > 100 ? preview.substring(0, 100) + '...' : preview;
            
            // 生成標籤HTML
            let tagsHtml = '';
            if (topic.tag && Array.isArray(topic.tag)) {
                tagsHtml = topic.tag.map(tag => `<span class="topic-tag">${tag}</span>`).join('');
            }
            
            // 提取並格式化日期
            const formattedDate = this.formatDateFromId(topic.id);
            
            html += `
                <div class="topic-card" data-topic-id="${topic.id}">
                    <div class="topic-meta">
                        <span class="topic-type">${topic.type}</span>
                        <span class="topic-date">${formattedDate}</span>
                    </div>
                    ${tagsHtml ? `<div class="topic-tags">${tagsHtml}</div>` : ''}
                    <div class="topic-title">${topic.title}</div>
                    <div class="topic-preview">${previewText}</div>
                </div>
            `;
        });
        
        container.html(html);
    }
    
    // 從ID提取日期並格式化為 yyyy-MM-dd
    formatDateFromId(id) {
        const match = id.match(/^(\d{4})(\d{2})(\d{2})-/);
        if (match) {
            const [, year, month, day] = match;
            const dateString = `${year}-${month}-${day}`;
            return this.formatDateWithWeekday(dateString);
        }
        return '';
    }
    
    // 從ID提取日期用於排序
    extractDateFromId(id) {
        const match = id.match(/^(\d{8})-/);
        if (match) {
            return match[1]; // 返回 YYYYMMDD 格式用於排序
        }
        return '00000000';
    }
    
    showTopicDetail(topicId) {
        this.currentTopic = this.filteredData.find(topic => topic.id === topicId);
        if (!this.currentTopic) return;

        // 將當前主題設為全域可存取（供生字簿使用）
        window.icrtApp = window.icrtApp || {};
        window.icrtApp.currentTopic = this.currentTopic;

        // 設定標題
        $('#modalTitle').html(`
            <div class="modal-title-content">
                <i class="fas fa-book-open me-2"></i>
                <span title="${this.currentTopic.title}">${this.currentTopic.title}</span>
            </div>
        `);
        
        // 設定音效
        const audio = $('#topicAudio')[0];
        if (this.currentTopic.audio) {
            audio.src = this.currentTopic.audio;
            this.audio = audio;
        } else {
            audio.src = '';
            this.audio = null;
        }
        
        // 設定主題資訊
        let tagsHtml = '';
        if (this.currentTopic.tag && Array.isArray(this.currentTopic.tag)) {
            tagsHtml = this.currentTopic.tag.map(tag => `<span class="topic-tag">${tag}</span>`).join('');
        }
        
        const formattedDate = this.formatDateFromId(this.currentTopic.id);
        
        $('#topicInfo').html(`
            <div class="topic-meta mb-2">
                <span class="topic-type">${this.currentTopic.type}</span>
                ${formattedDate ? `<span class="topic-date">${formattedDate}</span>` : ''}
            </div>
            ${tagsHtml ? `<div class="topic-tags mb-2">${tagsHtml}</div>` : ''}
            <h5 class="text-primary">${this.currentTopic.title}</h5>
        `);
        
        // 渲染所有內容
        this.renderTopicContent();
        this.renderVocabulary();
        this.renderQuiz();
        
        // 顯示 Modal
        const modal = new bootstrap.Modal('#topicModal');
        modal.show();
    }
    
    renderTopicContent() {
        const container = $('#contentList');
        let html = '';
        
        this.currentTopic.content.forEach((item, index) => {
            const hasTime = item.time !== null && item.time !== undefined;
            const hasTranslation = item.tw && item.tw.trim() !== '';
            
            // 將時間字符串轉換為秒數
            let timeInSeconds = null;
            if (hasTime && typeof item.time === 'string') {
                timeInSeconds = this.parseTimeToSeconds(item.time);
            } else if (hasTime && typeof item.time === 'number') {
                timeInSeconds = item.time;
            }
            
            html += `
                <div class="content-item">
                    <div class="content-controls">
                        ${timeInSeconds !== null ? `
                            <button class="btn-jump-time" data-time="${timeInSeconds}" title="跳到此時間點 (${item.time})">
                                <i class="fas fa-play"></i>
                            </button>
                        ` : ''}
                        ${hasTranslation ? `
                            <button class="btn-toggle-translation" title="顯示/隱藏中文翻譯">
                                <i class="fas fa-language"></i>
                            </button>
                        ` : ''}
                    </div>
                    <div class="english-text">${item.en}</div>
                    ${hasTranslation ? `
                        <div class="chinese-text">${item.tw}</div>
                    ` : ''}
                </div>
            `;
        });
        
        container.html(html);
    }
    
    renderVocabulary() {
        const container = $('#vocabularyContent');
        
        if (!this.currentTopic.vocabulary) {
            container.html('<p class="text-muted">此主題沒有單字內容</p>');
            return;
        }
        
        let html = '';
        
        // 前言
        if (this.currentTopic.vocabulary.preface) {
            html += `<div class="vocabulary-preface">${this.currentTopic.vocabulary.preface}</div>`;
        }
        
        // 單字內容
        if (this.currentTopic.vocabulary.content && Array.isArray(this.currentTopic.vocabulary.content)) {
            this.currentTopic.vocabulary.content.forEach((item, index) => {
                const hasTime = item.time !== null && item.time !== undefined;
                let timeInSeconds = null;
                if (hasTime && typeof item.time === 'string') {
                    timeInSeconds = this.parseTimeToSeconds(item.time);
                } else if (hasTime && typeof item.time === 'number') {
                    timeInSeconds = item.time;
                }
                
                html += `
                    <div class="vocabulary-item">
                        <div class="content-controls">
                            ${timeInSeconds !== null ? `
                                <button class="btn-jump-time" data-time="${timeInSeconds}" title="跳到此時間點 (${item.time})">
                                    <i class="fas fa-play"></i>
                                </button>
                            ` : ''}
                        </div>
                        <div class="vocabulary-text">${item.text.replace(/\n/g, '<br>')}</div>
                    </div>
                `;
            });
        }
        
        // 後記
        if (this.currentTopic.vocabulary.postscript) {
            html += `<div class="vocabulary-postscript">${this.currentTopic.vocabulary.postscript}</div>`;
        }
        
        container.html(html);
    }
    
    renderQuiz() {
        const container = $('#quizContent');
        
        if (!this.currentTopic.quiz || !Array.isArray(this.currentTopic.quiz)) {
            container.html('<p class="text-muted">此主題沒有測驗內容</p>');
            return;
        }
        
        let html = '';
        
        this.currentTopic.quiz.forEach((quiz, index) => {
            // 處理時間跳轉
            const hasTime = quiz.time !== null && quiz.time !== undefined;
            let timeInSeconds = null;
            if (hasTime && typeof quiz.time === 'string') {
                timeInSeconds = this.parseTimeToSeconds(quiz.time);
            } else if (hasTime && typeof quiz.time === 'number') {
                timeInSeconds = quiz.time;
            }
            
            html += `
                <div class="quiz-item">
                    <div class="quiz-header">
                        <div class="quiz-question">${quiz.question}</div>
                        ${timeInSeconds !== null ? `
                            <button class="btn-jump-time" data-time="${timeInSeconds}" title="跳到此時間點 (${quiz.time})">
                                <i class="fas fa-play"></i>
                            </button>
                        ` : ''}
                    </div>
                    <div class="quiz-options">
            `;
            
            if (quiz.options && Array.isArray(quiz.options)) {
                quiz.options.forEach(option => {
                    // 提取選項值（a, b, c等）
                    const optionValue = option.substring(0, 1);
                    html += `
                        <div class="quiz-option" data-value="${optionValue}">
                            ${option}
                        </div>
                    `;
                });
            }
            
            html += `
                    </div>
                    <div class="quiz-controls">
                        <button class="btn-show-answer" data-answer="${quiz.answer}">
                            <i class="fas fa-eye me-1"></i>顯示答案
                        </button>
                    </div>
                </div>
            `;
        });
        
        container.html(html);
    }
    
    // 將時間字符串轉換為秒數的輔助函數
    parseTimeToSeconds(timeString) {
        if (!timeString || typeof timeString !== 'string') return null;
        
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
    
    // 從生字簿開啟特定文章
    openTopicById(topicId) {
        // 在當前資料中尋找文章
        const topic = this.currentData.find(t => t.id === topicId);
        if (topic) {
            this.showTopicDetail(topicId);
        } else {
            // 如果當前資料中沒有，嘗試從文章ID推斷月份並載入
            const monthMatch = topicId.match(/^(\d{6})/);
            if (monthMatch) {
                const month = monthMatch[1];
                this.loadMonthData(month).then(() => {
                    const foundTopic = this.currentData.find(t => t.id === topicId);
                    if (foundTopic) {
                        this.showTopicDetail(topicId);
                    } else {
                        alert('找不到指定的文章');
                    }
                });
            } else {
                alert('找不到指定的文章');
            }
        }
    }

    showError(message) {
        $('#topicsList').html(`
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle text-warning"></i>
                <h5>發生錯誤</h5>
                <p>${message}</p>
            </div>
        `);
    }
}

// 初始化應用程式
$(document).ready(async () => {
    const app = new ICRTApp();
    await app.init();
    
    // 將應用程式實例設為全域可存取（供生字簿使用）
    window.icrtApp = app;
});
