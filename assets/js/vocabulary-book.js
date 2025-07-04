// 儲存引擎管理類
class StorageManager {
    constructor(useIndexedDB = false) {
        this.useIndexedDB = useIndexedDB;
        this.dbName = 'VocabularyBookDB';
        this.version = 1;
        this.storeName = 'vocabulary';
        this.db = null;
    }

    // 初始化 IndexedDB
    async initIndexedDB() {
        if (!this.useIndexedDB || !window.indexedDB) {
            return false;
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => {
                console.error('IndexedDB 開啟失敗');
                reject(false);
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(true);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
                    store.createIndex('word', 'word', { unique: false });
                    store.createIndex('level', 'level', { unique: false });
                }
            };
        });
    }

    // 載入資料
    async loadData() {
        if (this.useIndexedDB && this.db) {
            return this.loadFromIndexedDB();
        } else {
            return this.loadFromLocalStorage();
        }
    }

    // 儲存資料
    async saveData(data) {
        if (this.useIndexedDB && this.db) {
            return this.saveToIndexedDB(data);
        } else {
            return this.saveToLocalStorage(data);
        }
    }

    // 從 LocalStorage 載入
    loadFromLocalStorage() {
        try {
            const savedData = localStorage.getItem('vocabulary_book');
            return savedData ? JSON.parse(savedData) : [];
        } catch (error) {
            console.error('LocalStorage 載入失敗:', error);
            return [];
        }
    }

    // 儲存到 LocalStorage
    saveToLocalStorage(data) {
        try {
            localStorage.setItem('vocabulary_book', JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('LocalStorage 儲存失敗:', error);
            return false;
        }
    }

    // 從 IndexedDB 載入
    async loadFromIndexedDB() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result || []);
            };

            request.onerror = () => {
                console.error('IndexedDB 載入失敗');
                resolve([]);
            };
        });
    }

    // 儲存到 IndexedDB
    async saveToIndexedDB(data) {
        return new Promise((resolve) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);

            // 清空現有資料
            store.clear();

            // 批次插入新資料
            data.forEach(item => {
                store.add(item);
            });

            transaction.oncomplete = () => {
                resolve(true);
            };

            transaction.onerror = () => {
                console.error('IndexedDB 儲存失敗');
                resolve(false);
            };
        });
    }

    // 切換儲存引擎
    async switchStorage(newUseIndexedDB) {
        if (this.useIndexedDB === newUseIndexedDB) return;

        // 載入當前資料
        const currentData = await this.loadData();

        // 記住舊的引擎類型和連接
        const oldUseIndexedDB = this.useIndexedDB;
        const oldDb = this.db;

        // 清空舊引擎的資料（在切換前進行）
        if (oldUseIndexedDB && !newUseIndexedDB) {
            // 從 IndexedDB 切換到 LocalStorage，清空 IndexedDB
            try {
                if (oldDb) {
                    const transaction = oldDb.transaction([this.storeName], 'readwrite');
                    const store = transaction.objectStore(this.storeName);
                    store.clear();
                    console.log('已清空 IndexedDB 資料');
                }
            } catch (error) {
                console.warn('清空 IndexedDB 失敗:', error);
            }
        } else if (!oldUseIndexedDB && newUseIndexedDB) {
            // 從 LocalStorage 切換到 IndexedDB，清空 LocalStorage
            try {
                localStorage.removeItem('vocabulary_book');
                console.log('已清空 LocalStorage 資料');
            } catch (error) {
                console.warn('清空 LocalStorage 失敗:', error);
            }
        }

        // 切換引擎
        this.useIndexedDB = newUseIndexedDB;

        // 初始化新引擎（如果是 IndexedDB）
        if (newUseIndexedDB) {
            await this.initIndexedDB();
        }

        // 儲存資料到新引擎
        await this.saveData(currentData);

        // 儲存設定
        localStorage.setItem('vocabulary_storage_type', newUseIndexedDB ? 'indexeddb' : 'localstorage');
    }

    // 匯出資料
    async exportData() {
        const data = await this.loadData();
        return {
            version: '1.0',
            exportDate: new Date().toISOString(),
            storageType: this.useIndexedDB ? 'indexeddb' : 'localstorage',
            vocabulary: data
        };
    }

    // 匯入資料
    async importData(importedData) {
        try {
            // 驗證匯入格式
            if (!importedData?.vocabulary || !Array.isArray(importedData.vocabulary)) {
                throw new Error('無效的匯入格式：缺少 vocabulary 陣列');
            }

            // 如果使用 IndexedDB，確保已初始化
            if (this.useIndexedDB && !this.db) {
                console.log('IndexedDB 未初始化，正在初始化...');
                const initSuccess = await this.initIndexedDB();
                if (!initSuccess) {
                    throw new Error('IndexedDB 初始化失敗');
                }
            }

            console.log('開始儲存匯入資料...');
            // 儲存匯入的資料
            const success = await this.saveData(importedData.vocabulary);
            if (!success) {
                throw new Error('資料儲存失敗');
            }

            console.log('匯入完成');
            return true;
        } catch (error) {
            console.error('匯入失敗:', error);
            return false;
        }
    }
}

// 生字簿功能管理類
class VocabularyBook {
    constructor() {
        this.vocabularyData = [];
        this.currentPage = 'home';
        this.selectedText = '';
        this.currentTopic = null;
        this.debug = false; // Debug 模式
        
        // 初始化儲存管理器
        const savedStorageType = localStorage.getItem('vocabulary_storage_type');
        // 預設使用 IndexedDB，除非明確設定為 localStorage 或瀏覽器不支援 IndexedDB
        const supportsIndexedDB = typeof indexedDB !== 'undefined';
        let useIndexedDB = supportsIndexedDB; // 預設使用 IndexedDB
        
        // 如果有明確設定，則使用設定值
        if (savedStorageType === 'localstorage') {
            useIndexedDB = false;
        } else if (savedStorageType === 'indexeddb') {
            useIndexedDB = supportsIndexedDB; // 即使設定要用 IndexedDB，也要確保瀏覽器支援
        }
        
        this.storageManager = new StorageManager(useIndexedDB);
        
        // 如果是第一次使用（沒有儲存設定），則儲存當前選擇
        if (!savedStorageType) {
            localStorage.setItem('vocabulary_storage_type', useIndexedDB ? 'indexeddb' : 'localstorage');
        }

        // 初始化（非同步）
        this.init().catch(error => {
            console.error('初始化失敗:', error);
        });
    }

    // Debug Log
    log(...args) {
        if (this.debug) {
            console.log('[VocabularyBook]', ...args);
        }
    }

    async init() {
        // 初始化 IndexedDB（如果啟用）
        if (this.storageManager.useIndexedDB) {
            await this.storageManager.initIndexedDB();
        }
        
        // 載入生字簿資料
        this.vocabularyData = await this.storageManager.loadData();
        this.log('Loaded vocabulary data:', this.vocabularyData);

        this.bindEvents();
        this.bindWordSelectionEvents();

        // 確保在模態框顯示後重新綁定事件
        $(document).on('shown.bs.modal', '#topicModal', () => {
            this.log('Modal shown, rebinding events');
            // 延遲一點再綁定，確保模態框完全載入
            setTimeout(() => {
                this.bindWordSelectionEvents();
            }, 100);
        });

        // 使用 MutationObserver 監聽內容變化
        const observer = new MutationObserver(() => {
            this.log('DOM mutation detected, rebinding events');
            this.bindWordSelectionEvents();
        });
        // 監聽模態框內容的變化
        const modalBody = document.querySelector('.modal-body');
        if (modalBody) {
            observer.observe(modalBody, {
                childList: true,
                subtree: true
            });
        }

        // 確保右鍵選單存在
        if ($('#wordContextMenu').length === 0) {
            this.log('Warning: Context menu element not found in DOM');
        } else {
            this.log('Context menu element found');
        }

        // 在測試模式下執行測試
        if (this.debug) {
            // 顯示儲存設定按鈕
            $('#storageSettingsBtn').show();
            
            setTimeout(() => {
                this.testContextMenu();
            }, 1000);
        }
    }

    // 載入生字簿資料（用於匯入後重新整理）
    async loadVocabularyData() {
        try {
            this.vocabularyData = await this.storageManager.loadData();
            this.log('Reloaded vocabulary data:', this.vocabularyData);
            return true;
        } catch (error) {
            console.error('載入生字簿資料失敗:', error);
            return false;
        }
    }

    // 儲存生字簿資料（改用 StorageManager）
    async saveVocabularyData() {
        const success = await this.storageManager.saveData(this.vocabularyData);
        if (!success) {
            console.error('儲存生字簿資料失敗');
        }
        return success;
    }

    // 切換儲存引擎
    async switchStorageEngine(useIndexedDB) {
        try {
            await this.storageManager.switchStorage(useIndexedDB);
            
            // 在 debug 模式下重新檢查資料
            if (this.debug) {
                setTimeout(() => {
                    this.checkBothStorageEngines();
                }, 500);
            }
            
            this.showSuccessMessage(
                useIndexedDB ? 
                '已切換至 IndexedDB 儲存，LocalStorage 資料已清空' : 
                '已切換至 LocalStorage 儲存，IndexedDB 資料已清空'
            );
            return true;
        } catch (error) {
            console.error('切換儲存引擎失敗:', error);
            this.showSuccessMessage('切換儲存引擎失敗', 'error');
            return false;
        }
    }

    // 檢查兩個儲存引擎的資料（debug 用）
    async checkBothStorageEngines() {
        try {
            // 檢查 LocalStorage
            const localStorageData = localStorage.getItem('vocabulary_book');
            const localCount = localStorageData ? JSON.parse(localStorageData).length : 0;
            
            // 檢查 IndexedDB
            let indexedDBCount = 0;
            if (typeof indexedDB !== 'undefined') {
                try {
                    // 創建臨時連接來檢查 IndexedDB
                    const tempRequest = indexedDB.open('VocabularyBookDB', 1);
                    tempRequest.onsuccess = (event) => {
                        const tempDb = event.target.result;
                        if (tempDb.objectStoreNames.contains('vocabulary')) {
                            const transaction = tempDb.transaction(['vocabulary'], 'readonly');
                            const store = transaction.objectStore('vocabulary');
                            const countRequest = store.count();
                            countRequest.onsuccess = () => {
                                indexedDBCount = countRequest.result;
                                console.log(`[Debug] 儲存引擎資料檢查:`);
                                console.log(`  LocalStorage: ${localCount} 筆`);
                                console.log(`  IndexedDB: ${indexedDBCount} 筆`);
                                tempDb.close();
                            };
                        } else {
                            console.log(`[Debug] 儲存引擎資料檢查:`);
                            console.log(`  LocalStorage: ${localCount} 筆`);
                            console.log(`  IndexedDB: 0 筆 (無資料表)`);
                            tempDb.close();
                        }
                    };
                } catch (error) {
                    console.log(`[Debug] 儲存引擎資料檢查:`);
                    console.log(`  LocalStorage: ${localCount} 筆`);
                    console.log(`  IndexedDB: 檢查失敗 (${error.message})`);
                }
            } else {
                console.log(`[Debug] 儲存引擎資料檢查:`);
                console.log(`  LocalStorage: ${localCount} 筆`);
                console.log(`  IndexedDB: 不支援`);
            }
        } catch (error) {
            console.warn('[Debug] 檢查儲存引擎失敗:', error);
        }
    }

    // 取得當前儲存引擎狀態
    getStorageEngineStatus() {
        return {
            current: this.storageManager.useIndexedDB ? 'IndexedDB' : 'LocalStorage',
            useIndexedDB: this.storageManager.useIndexedDB,
            supported: {
                localStorage: typeof Storage !== 'undefined',
                indexedDB: typeof indexedDB !== 'undefined'
            }
        };
    }

    // 綁定事件監聽器
    bindEvents() {
        // 頁面導航
        $('#homeTab').on('click', (e) => {
            e.preventDefault();
            this.showPage('home');
        });

        $('#vocabularyBookTab').on('click', (e) => {
            e.preventDefault();
            this.showPage('vocabulary');
        });

        // 生字簿控制項
        $('#vocabularyLevelFilter, #vocabularySearch').on('change input', () => {
            this.filterVocabulary();
        });

        // 新增單字表單
        $('#saveWordBtn').on('click', () => {
            this.saveNewWord();
        });

        // 右鍵選單
        $('#addToVocabulary').on('click', () => {
            this.showAddWordModal();
        });

        // 儲存設定相關（僅 debug 模式）
        if (this.debug) {
            $('#storageSettingsBtn').on('click', () => {
                this.showStorageSettings();
            });

            $('#applyStorageSettings').on('click', () => {
                this.applyStorageSettings();
            });
        }

        // 匯出匯入功能
        $('#exportVocabularyBtn').on('click', () => {
            this.exportVocabulary();
        });

        $('#importVocabularyFile').on('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.importVocabulary(file);
                e.target.value = ''; // 清空檔案選擇
            }
        });

        // 點擊其他地方隱藏右鍵選單
        $(document).on('click', (e) => {
            if (!$(e.target).closest('#wordContextMenu').length) {
                $('#wordContextMenu').hide();
                this.hideSelectionHint();
            }
        });
    }

    // 綁定文字選擇事件
    bindWordSelectionEvents() {
        // 清除可能的重複事件綁定
        $(document).off('mouseup.vocabulary touchend.vocabulary contextmenu.vocabulary dblclick.vocabulary');

        // 先綁定文字選擇事件
        $(document).on('mouseup.vocabulary touchend.vocabulary', '.modal-body .english-text, .modal-body .vocabulary-text', (e) => {
            setTimeout(() => {
                const selection = window.getSelection();
                const selectedText = selection.toString().trim();
                this.log('Text selected:', selectedText);
                if (selectedText && selectedText.length > 0 && this.isValidWord(selectedText)) {
                    this.selectedText = selectedText;
                    this.showSelectionHint(e);
                    // 觸控設備長按後顯示選單
                    if (e.type === 'touchend' && this.touchHoldTimer) {
                        this.showContextMenu(e);
                    }
                } else {
                    this.hideSelectionHint();
                }
            }, 50);
        });

        // 更精確的右鍵事件處理
        $(document).on('contextmenu.vocabulary', (e) => {
            // 確保事件發生在模態框內的文字區域
            const target = $(e.target);
            const isInModalText = target.closest('.modal-body .english-text, .modal-body .vocabulary-text').length > 0;

            if (isInModalText) {
                e.preventDefault();
                e.stopPropagation();

                // 檢查是否有選擇文字
                const selection = window.getSelection();
                const selectedText = selection.toString().trim();

                this.log('Right click detected:', {
                    selectedText,
                    target: e.target,
                    pageX: e.pageX,
                    pageY: e.pageY
                });

                if (selectedText && selectedText.length > 0 && this.isValidWord(selectedText)) {
                    this.selectedText = selectedText;
                    // 隱藏選擇提示
                    this.hideSelectionHint();
                    // 延遲顯示選單，確保事件處理完成
                    setTimeout(() => {
                        this.showContextMenu(e);
                    }, 10);
                } else {
                    $('#wordContextMenu').hide();
                    this.hideSelectionHint();
                }
                return false;
            }
        });

        // 雙擊快速添加
        $(document).on('dblclick.vocabulary', '.modal-body .english-text, .modal-body .vocabulary-text', (e) => {
            e.preventDefault();
            const selection = window.getSelection();
            const selectedText = selection.toString().trim();
            this.log('Double click text selection:', selectedText);
            if (selectedText && selectedText.length > 0 && this.isValidWord(selectedText)) {
                this.selectedText = selectedText;
                this.hideSelectionHint();
                this.showContextMenu(e);
            }
        });

        // 觸控設備的長按處理
        let touchTimer = null;
        $(document).on('touchstart.vocabulary', '.modal-body .english-text, .modal-body .vocabulary-text', (e) => {
            touchTimer = setTimeout(() => {
                const selection = window.getSelection();
                const selectedText = selection.toString().trim();
                if (selectedText && selectedText.length > 0 && this.isValidWord(selectedText)) {
                    this.selectedText = selectedText;
                    this.showContextMenu(e);
                }
            }, 800); // 長按800ms
        });

        $(document).on('touchend.vocabulary touchcancel.vocabulary touchmove.vocabulary', '.modal-body .english-text, .modal-body .vocabulary-text', () => {
            if (touchTimer) {
                clearTimeout(touchTimer);
                touchTimer = null;
            }
        });
    }

    // 驗證選擇的文字是否為有效單字
    isValidWord(text) {
        // 移除標點符號和多餘空格
        const cleanText = text.replace(/[^\w\s'-]/g, '').trim();

        // 檢查是否為單一單字（不超過3個單字）
        const words = cleanText.split(/\s+/);
        if (words.length > 3) {
            return false;
        }

        // 檢查長度（1-50個字符）
        if (cleanText.length < 1 || cleanText.length > 50) {
            return false;
        }

        // 檢查是否包含英文字母
        return /[a-zA-Z]/.test(cleanText);
    }

    // 顯示右鍵選單
    showContextMenu(e) {
        const menu = $('#wordContextMenu');

        // 確保選單元素存在
        if (menu.length === 0) {
            this.log('Context menu element not found');
            return;
        }

        // 隱藏現有選單
        menu.hide();

        // 獲取座標並顯示選單
        const coords = this.getEventCoordinates(e);
        const adjustedCoords = this.adjustMenuPosition(coords);

        this.log('Final menu position:', adjustedCoords);

        // 設置選單位置和樣式
        menu.css({
            left: adjustedCoords.x + 'px',
            top: adjustedCoords.y + 'px',
            position: 'absolute',
            display: 'block',
            zIndex: 10000
        });

        // 檢查選單顯示狀態
        this.validateMenuDisplay(menu);

        // 5秒後自動隱藏
        setTimeout(() => {
            menu.hide();
        }, 5000);
    }

    // 獲取事件座標
    getEventCoordinates(e) {
        let x = 0;
        let y = 0;

        if (e.type === 'contextmenu') {
            x = e.pageX || e.clientX;
            y = e.pageY || e.clientY;
        } else if (e.type === 'touchstart' || e.type === 'touchend') {
            const touch = this.getTouchFromEvent(e);
            if (touch) {
                x = touch.pageX || touch.clientX;
                y = touch.pageY || touch.clientY;
            }
        } else {
            x = e.pageX || e.clientX || 0;
            y = e.pageY || e.clientY || 0;
        }

        this.log('Event coordinates:', { x, y, eventType: e.type });

        // 如果座標無效，使用選擇範圍的座標
        if (x === 0 && y === 0) {
            return this.getSelectionCoordinates();
        }

        return { x, y };
    }

    // 從觸控事件獲取觸點
    getTouchFromEvent(e) {
        if (e.originalEvent) {
            return e.originalEvent.touches?.[0] || e.originalEvent.changedTouches?.[0];
        }
        return e.touches?.[0];
    }

    // 獲取選擇範圍的座標
    getSelectionCoordinates() {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            const coords = {
                x: rect.left + window.pageXOffset,
                y: rect.bottom + window.pageYOffset
            };
            this.log('Using selection coordinates:', coords);
            return coords;
        }
        return { x: 0, y: 0 };
    }

    // 調整選單位置，避免超出視窗邊界
    adjustMenuPosition(coords) {
        const $window = $(window);
        const windowWidth = $window.width();
        const windowHeight = $window.height();
        const scrollTop = $window.scrollTop();
        const scrollLeft = $window.scrollLeft();

        const menuWidth = 150;
        const menuHeight = 50;

        let { x, y } = coords;

        // 調整 x 座標
        if (x + menuWidth > scrollLeft + windowWidth) {
            x = scrollLeft + windowWidth - menuWidth - 10;
        }
        if (x < scrollLeft) {
            x = scrollLeft + 10;
        }

        // 調整 y 座標
        if (y + menuHeight > scrollTop + windowHeight) {
            y = y - menuHeight - 10;
        }
        if (y < scrollTop) {
            y = scrollTop + 10;
        }

        return { x, y };
    }

    // 驗證選單顯示狀態
    validateMenuDisplay(menu) {
        setTimeout(() => {
            if (menu.is(':visible')) {
                this.log('Context menu successfully displayed');
            } else {
                this.log('Context menu failed to display');
                menu.show();
            }
        }, 50);
    }

    /**
     * 顯示新增/編輯單字對話框
     * @param {string} wordId - 若有傳入則為編輯模式，否則為新增模式
     */
    showAddWordModal(wordId) {
        $('#wordContextMenu').hide();

        // 1. 判斷模式與取得單字資料
        let isEditMode = !!wordId;
        let wordData = null;
        let existed = null;
        let cleanedText = '';
        if (isEditMode) {
            wordData = this.vocabularyData.find(w => w.id === wordId.toString());
        } else if (this.selectedText) {
            cleanedText = this.selectedText.replace(/[^\w\s'-]/g, '').trim();
            existed = this.vocabularyData.find(w => w.word.toLowerCase() === cleanedText.toLowerCase());
        }

        // 2. 欄位預設值
        const defaults = this.getWordFieldDefaults(isEditMode, wordData, existed, cleanedText);
        $('#selectedWord').val(defaults.word);
        $('#wordPhonetic').val(defaults.phonetic);
        $('#wordTranslation').val(defaults.translation);
        $('#wordLevel').val(defaults.level);

        // 3. 來源合併
        let sources = this.getMergedSources(isEditMode, wordData, existed, cleanedText);
        this.editingWordId = isEditMode ? wordData.id : null;
        this.editingSources = sources;

        // 4. 渲染來源清單，僅編輯模式可移除來源
        this.renderSourceList(this.editingSources, this.editingWordId, isEditMode);

        // 5. 刪除按鈕顯示
        if (isEditMode) {
            $('#deleteWordBtn').show().off('click').on('click', () => {
                this.deleteWord(wordData.id);
            });
        } else {
            $('#deleteWordBtn').hide();
        }

        // 6. 聚焦翻譯欄位並顯示 Modal
        setTimeout(() => { $('#wordTranslation').focus(); }, 500);
        const modal = new bootstrap.Modal('#addWordModal');
        modal.show();
    }

    // 取得欄位預設值
    getWordFieldDefaults(isEditMode, wordData, existed, cleanedText) {
        return {
            word: isEditMode ? wordData.word : cleanedText,
            phonetic: isEditMode ? wordData.phonetic : existed?.phonetic || '',
            translation: isEditMode ? wordData.translation : existed?.translation || '',
            level: isEditMode ? wordData.level : existed?.level || ''
        };
    }

    // 取得來源合併結果
    getMergedSources(isEditMode, wordData, existed, cleanedText) {
        let sources = [];
        if (isEditMode) {
            sources = Array.isArray(wordData.sources) ? JSON.parse(JSON.stringify(wordData.sources)) : [];
        } else {
            if (existed && Array.isArray(existed.sources)) {
                sources = JSON.parse(JSON.stringify(existed.sources));
            }
            const sourceInfo = this.getCurrentTopicInfo();
            if (sourceInfo && !sources.some(s => s.topicId === sourceInfo.topicId)) {
                sources.push(sourceInfo);
            }
        }
        return sources;
    }

    // 動態渲染來源文章清單，支援單獨刪除
    renderSourceList(sources, wordId, canRemove = true) {
        let html = '';
        if (sources && sources.length > 0) {
            const allowRemove = canRemove && sources.length > 1;
            html = `<div class='mb-2'><small class='text-muted'>來源文章：</small><br>` +
                sources.map((source, idx) =>
                    `<span class='badge bg-secondary me-2 mb-1 source-badge' data-idx='${idx}' data-word-id='${wordId}'>
                        ${source.title}
                        ${allowRemove ? `<i class='fas fa-times ms-1 source-remove' title='移除來源' style='cursor:pointer;'></i>` : ''}
                    </span>`
                ).join('') + '</div>';
        }
        if ($('#addWordModal .modal-body .source-list').length === 0) {
            $('#addWordModal .modal-body').append(`<div class='source-list'></div>`);
        }
        $('#addWordModal .modal-body .source-list').html(html);
        // 綁定來源刪除事件（僅編輯模式且來源數>1）
        if (canRemove && sources.length > 1) {
            $('.source-remove').off('click').on('click', (e) => {
                const idx = $(e.target).closest('.source-badge').data('idx');
                this.removeSourceFromWord(idx);
                e.stopPropagation();
            });
        }
    }

    // 刪除單一來源（只動暫存陣列，UI即時同步）
    removeSourceFromWord(idx) {
        if (this.editingSources && this.editingSources.length > idx) {
            this.editingSources.splice(idx, 1);
            // 取得目前是否為編輯模式（只有編輯模式才可移除來源）
            const isEditMode = !!this.editingWordId;
            this.renderSourceList(this.editingSources, this.editingWordId, isEditMode);
        }
    }

    // 儲存新單字或覆蓋
    saveNewWord() {
        const word = $('#selectedWord').val().trim();
        const phonetic = $('#wordPhonetic').val().trim();
        const translation = $('#wordTranslation').val().trim();
        const level = $('#wordLevel').val();
        if (!word || !level) {
            alert('請填寫所有必填欄位');
            return;
        }
        // 檢查是否已存在
        const existingWordIndex = this.vocabularyData.findIndex(item => item.word.toLowerCase() === word.toLowerCase());
        const sourceInfo = this.getCurrentTopicInfo();
        let sourcesArr = [];
        if (this.editingSources) {
            sourcesArr = JSON.parse(JSON.stringify(this.editingSources));
        } else if (sourceInfo) {
            sourcesArr = [sourceInfo];
        }
        if (existingWordIndex >= 0) {
            // 覆蓋現有單字
            const existingWord = this.vocabularyData[existingWordIndex];
            existingWord.phonetic = phonetic;
            existingWord.translation = translation;
            existingWord.level = level;
            existingWord.updatedAt = new Date().toISOString();
            // 來源資料以暫存陣列為主
            existingWord.sources = this.editingSources ? JSON.parse(JSON.stringify(this.editingSources)) : [];
            // 新增來源文章（如果不存在且有來源）
            if (sourceInfo && !existingWord.sources.some(s => s.topicId === sourceInfo.topicId)) {
                existingWord.sources.push(sourceInfo);
            }
        } else {
            // 新增新單字
            const newWord = {
                id: Date.now().toString(),
                word: word,
                phonetic: phonetic,
                translation: translation,
                level: level,
                sources: sourcesArr,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            this.vocabularyData.push(newWord);
        }
        this.saveVocabularyData();
        bootstrap.Modal.getInstance('#addWordModal').hide();
        this.showSuccessMessage(existingWordIndex >= 0 ? '單字已更新' : '單字已加入生字簿');
        if (this.currentPage === 'vocabulary') {
            this.renderVocabularyList();
        }
    }

    // 刪除單字（Dialog 內）
    deleteWord(wordId) {
        if (confirm('確定要刪除這個單字嗎？')) {
            this.vocabularyData = this.vocabularyData.filter(word => word.id !== wordId);
            this.saveVocabularyData();
            // 強制關閉 Modal（保險處理）
            const modalEl = document.getElementById('addWordModal');
            if (modalEl) {
                const modalInstance = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
                modalInstance.hide();
            }
            this.renderVocabularyList();
            this.showSuccessMessage('單字已刪除');
        }
    }

    // 取得當前主題資訊
    getCurrentTopicInfo() {
        if (window.icrtApp?.currentTopic) {
            const topic = window.icrtApp.currentTopic;
            return {
                topicId: topic.id,
                title: topic.title,
                type: topic.type,
                tag: topic.tag || []
            };
        }
        return null;
    }

    // 顯示成功訊息（支援錯誤訊息）
    showSuccessMessage(message, type = 'success') {
        const alertClass = type === 'error' ? 'alert-danger' : 'alert-success';
        const iconClass = type === 'error' ? 'fas fa-exclamation-triangle' : 'fas fa-check-circle';
        
        // 創建臨時提示元素
        const alert = $(`
            <div class="alert ${alertClass} alert-dismissible fade show position-fixed" 
                 style="top: 20px; right: 20px; z-index: 9999; min-width: 250px;">
                <i class="${iconClass} me-2"></i>${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `);

        $('body').append(alert);

        // 3秒後自動移除
        setTimeout(() => {
            alert.alert('close');
        }, 3000);
    }

    // 頁面切換
    showPage(page) {
        this.currentPage = page;

        // 更新導航狀態
        $('.nav-link').removeClass('active');
        if (page === 'home') {
            $('#homeTab').addClass('active');
            $('#homePage').show();
            $('#vocabularyBookPage').hide();
        } else if (page === 'vocabulary') {
            $('#vocabularyBookTab').addClass('active');
            $('#homePage').hide();
            $('#vocabularyBookPage').show();
            this.renderVocabularyList();
        }
    }

    // 渲染生字簿列表（單字旁加編輯icon，點擊可編輯）
    renderVocabularyList() {
        const container = $('#vocabularyList');

        if (this.vocabularyData.length === 0) {
            container.html(`
                <div class="empty-vocabulary-state">
                    <i class="fas fa-bookmark"></i>
                    <h5>生字簿是空的</h5>
                    <p>開始選擇文章中的單字來建立你的生字簿吧！</p>
                </div>
            `);
            return;
        }

        // 篩選和排序
        const filteredData = this.getFilteredVocabulary();

        if (filteredData.length === 0) {
            container.html(`
                <div class="empty-vocabulary-state">
                    <i class="fas fa-search"></i>
                    <h5>找不到符合條件的單字</h5>
                    <p>請調整篩選條件</p>
                </div>
            `);
            return;
        }

        let html = '';
        filteredData.forEach(wordData => {
            const levelClass = `level-${wordData.level}`;

            html += `
                <div class="vocabulary-word-card ${levelClass}">
                    <div class="vocabulary-word-header">
                        <div class="vocabulary-word-main">
                            <div class="vocabulary-word-text">${wordData.word}</div>
                            <button class="btn btn-sm btn-outline-primary btn-pronounce" data-word="${wordData.word}">
                                <i class="fas fa-volume-up"></i>
                            </button>
                        </div>
                        <div class="vocabulary-word-actions d-flex align-items-center">
                            <i class='fas fa-pen-to-square text-primary me-1 edit-icon' title='編輯' style='cursor:pointer;' data-word-id="${wordData.id}"></i>
                            <span class="badge bg-light text-dark ms-0">${this.getLevelText(wordData.level)}</span>
                        </div>
                    </div>
                    <div class="vocabulary-phonetic">${wordData.phonetic ? wordData.phonetic : ''}</div>
                    <div class="vocabulary-translation">${wordData.translation}</div>
                    ${wordData.sources && wordData.sources.length > 0 ? `
                        <div class="vocabulary-sources">
                            <small class="text-muted">來源文章：</small><br>
                            ${wordData.sources.map(source => `
                                <span class="vocabulary-source-tag" data-topic-id="${source.topicId}">
                                    ${source.title}
                                </span>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
        });

        container.html(html);
        this.bindVocabularyEvents();
    }

    // 綁定生字簿相關事件
    bindVocabularyEvents() {
        // 編輯icon點擊可編輯
        $('.edit-icon').on('click', (e) => {
            const wordId = $(e.currentTarget).data('word-id');
            this.showAddWordModal(wordId);
        });
        // 發音功能
        $('.btn-pronounce').on('click', (e) => {
            const word = $(e.currentTarget).data('word');
            this.pronounceWord(word);
        });
        // 來源文章點擊
        $('.vocabulary-source-tag').on('click', (e) => {
            const topicId = $(e.currentTarget).data('topic-id');
            this.openTopicFromVocabulary(topicId);
        });
    }

    // 修正查詢功能，讓搜尋能即時過濾
    filterVocabulary() {
        this.renderVocabularyList();
    }

    // 篩選生字
    getFilteredVocabulary() {
        const levelFilter = $('#vocabularyLevelFilter').val();
        const searchText = $('#vocabularySearch').val().toLowerCase();

        let filtered = this.vocabularyData;

        // 等級篩選
        if (levelFilter) {
            filtered = filtered.filter(word => word.level === levelFilter);
        }

        // 文字搜尋
        if (searchText) {
            filtered = filtered.filter(word =>
                word.word.toLowerCase().includes(searchText) ||
                word.translation.toLowerCase().includes(searchText)
            );
        }

        // 排序：先按等級，再按英文字母
        filtered.sort((a, b) => {
            const levelOrder = { 'unknown': 0, 'fair': 1, 'known': 2 };

            if (a.level !== b.level) {
                return levelOrder[a.level] - levelOrder[b.level];
            }

            return a.word.toLowerCase().localeCompare(b.word.toLowerCase());
        });

        return filtered;
    }

    // 發音功能
    pronounceWord(word) {
        if (!('speechSynthesis' in window)) {
            console.warn('瀏覽器不支援語音合成功能');
            return;
        }

        // 停止當前播放
        speechSynthesis.cancel();

        // 等待語音引擎載入完成
        const speak = () => {
            const utterance = new SpeechSynthesisUtterance(word);
            
            // 設定語音參數
            utterance.lang = 'en-US';
            utterance.rate = 0.8;
            utterance.pitch = 1.0;
            utterance.volume = 1.0;
            
            // 嘗試選擇英文語音
            const voices = speechSynthesis.getVoices();
            const englishVoice = voices.find(voice => 
                voice.lang.startsWith('en') && (voice.name.includes('English') || voice.name.includes('US'))
            );
            if (englishVoice) {
                utterance.voice = englishVoice;
            }

            // 錯誤處理
            utterance.onerror = (event) => {
                console.warn('語音播放失敗:', event.error);
            };

            utterance.onstart = () => {
                this.log('開始播放:', word);
            };

            utterance.onend = () => {
                this.log('播放完成:', word);
            };

            // 播放語音
            speechSynthesis.speak(utterance);
        };

        // 如果語音清單未載入，等待載入完成
        if (speechSynthesis.getVoices().length === 0) {
            speechSynthesis.addEventListener('voiceschanged', speak, { once: true });
        } else {
            speak();
        }
    }

    // 更新單字等級
    updateWordLevel(wordId, newLevel) {
        const wordIndex = this.vocabularyData.findIndex(word => word.id === wordId);
        if (wordIndex >= 0) {
            this.vocabularyData[wordIndex].level = newLevel;
            this.vocabularyData[wordIndex].updatedAt = new Date().toISOString();
            this.saveVocabularyData();

            // 重新渲染以更新排序
            this.renderVocabularyList();
        }
    }

    // 從生字簿開啟文章
    openTopicFromVocabulary(topicId) {
        // 通知主應用程式開啟特定文章
        if (window.icrtApp && typeof window.icrtApp.openTopicById === 'function') {
            window.icrtApp.openTopicById(topicId);
        } else {
            console.warn('無法開啟文章：主應用程式方法不可用');
        }
    }

    // 取得等級文字
    getLevelText(level) {
        const levelTexts = {
            'unknown': '不熟',
            'fair': '尚可',
            'known': '記住了'
        };
        return levelTexts[level] || level;
    }

    // 匯出生字簿資料（增強版）
    async exportVocabulary() {
        try {
            const exportData = await this.storageManager.exportData();
            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);

            const now = new Date();
            const timestamp = now.toISOString().slice(0, 19).replace(/[:-]/g, '');
            const filename = `vocabulary-book-${timestamp}.json`;

            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.click();

            URL.revokeObjectURL(url);
            this.showSuccessMessage(`生字簿已匯出: ${filename}`);
        } catch (error) {
            console.error('匯出失敗:', error);
            this.showSuccessMessage('匯出失敗', 'error');
        }
    }

    // 匯入生字簿資料（增強版）
    async importVocabulary(file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                this.log('匯入資料:', importedData);
                
                // 支援舊格式（直接為陣列）
                if (Array.isArray(importedData)) {
                    this.vocabularyData = importedData;
                    await this.saveVocabularyData();
                    this.renderVocabularyList();
                    this.showSuccessMessage('生字簿已匯入（舊格式）');
                    return;
                }

                // 檢查新格式是否有效
                if (!importedData?.vocabulary || !Array.isArray(importedData.vocabulary)) {
                    throw new Error('無效的匯入格式：缺少 vocabulary 陣列');
                }

                // 新格式匯入 - 先確保儲存管理器已初始化
                if (this.storageManager.useIndexedDB) {
                    this.log('使用 IndexedDB，檢查初始化狀態...');
                    if (!this.storageManager.db) {
                        this.log('IndexedDB 未初始化，正在初始化...');
                        const initSuccess = await this.storageManager.initIndexedDB();
                        if (!initSuccess) {
                            throw new Error('IndexedDB 初始化失敗');
                        }
                        this.log('IndexedDB 初始化成功');
                    }
                } else {
                    this.log('使用 LocalStorage');
                }

                // 執行匯入
                this.log('開始匯入資料...');
                const success = await this.storageManager.importData(importedData);
                if (success) {
                    this.log('匯入成功，重新載入資料...');
                    await this.loadVocabularyData();
                    this.renderVocabularyList();
                    this.showSuccessMessage(`生字簿已匯入 (${importedData.vocabulary.length} 個單字)`);
                } else {
                    throw new Error('匯入處理失敗');
                }
            } catch (error) {
                console.error('匯入生字簿失敗:', error);
                this.showSuccessMessage(`匯入失敗：${error.message}`, 'error');
            }
        };
        reader.readAsText(file);
    }

    // 顯示選擇提示
    showSelectionHint(e) {
        const hint = $('#selectionHint');
        if (hint.length === 0) return;

        const coords = this.getEventCoordinates(e);
        const adjustedCoords = this.adjustMenuPosition(coords);

        hint.css({
            left: adjustedCoords.x + 'px',
            top: (adjustedCoords.y - 35) + 'px', // 顯示在選擇位置上方
            position: 'absolute',
            display: 'block'
        }).addClass('show');

        // 3秒後自動隱藏
        setTimeout(() => {
            this.hideSelectionHint();
        }, 3000);
    }

    // 隱藏選擇提示
    hideSelectionHint() {
        $('#selectionHint').removeClass('show').hide();
    }

    // 測試右鍵選單功能
    testContextMenu() {
        if (!this.d) return;

        this.log('Testing context menu functionality...');

        // 檢查必要元素
        const contextMenu = $('#wordContextMenu');
        const selectionHint = $('#selectionHint');

        this.log('Context menu element:', contextMenu.length > 0 ? 'Found' : 'Missing');
        this.log('Selection hint element:', selectionHint.length > 0 ? 'Found' : 'Missing');

        // 模擬右鍵選單顯示
        if (contextMenu.length > 0) {
            contextMenu.css({
                left: '100px',
                top: '100px',
                position: 'absolute',
                display: 'block',
                zIndex: 10000
            });

            this.log('Test menu displayed at 100,100');

            setTimeout(() => {
                contextMenu.hide();
                this.log('Test menu hidden');
            }, 2000);
        }
    }

    // 顯示儲存設定
    showStorageSettings() {
        const status = this.getStorageEngineStatus();
        
        // 在 debug 模式下檢查兩個儲存引擎的資料
        if (this.debug) {
            this.checkBothStorageEngines();
        }
        
        // 更新當前狀態顯示
        $('#currentStorageText').text(
            `目前使用：${status.current} | 支援狀態：LocalStorage(${status.supported.localStorage ? '✓' : '✗'}) IndexedDB(${status.supported.indexedDB ? '✓' : '✗'})`
        );

        // 設定選項
        $(`input[name="storageEngine"][value="${status.useIndexedDB ? 'indexedDB' : 'localStorage'}"]`).prop('checked', true);
        
        // 禁用不支援的選項
        $('#useLocalStorage').prop('disabled', !status.supported.localStorage);
        $('#useIndexedDB').prop('disabled', !status.supported.indexedDB);

        const modal = new bootstrap.Modal('#storageSettingsModal');
        modal.show();
    }

    // 套用儲存設定
    async applyStorageSettings() {
        const selectedEngine = $('input[name="storageEngine"]:checked').val();
        const useIndexedDB = selectedEngine === 'indexedDB';
        
        // 如果沒有變更，直接關閉
        if (useIndexedDB === this.storageManager.useIndexedDB) {
            bootstrap.Modal.getInstance('#storageSettingsModal').hide();
            return;
        }

        // 顯示載入狀態
        $('#applyStorageSettings').prop('disabled', true).html('<i class="fas fa-spinner fa-spin me-1"></i>處理中...');

        try {
            const success = await this.switchStorageEngine(useIndexedDB);
            if (success) {
                bootstrap.Modal.getInstance('#storageSettingsModal').hide();
            }
        } finally {
            $('#applyStorageSettings').prop('disabled', false).html('<i class="fas fa-save me-1"></i>套用設定');
        }
    }
}

// 全域生字簿實例
let vocabularyBook;

// 當頁面載入完成時初始化生字簿
$(document).ready(() => {
    vocabularyBook = new VocabularyBook();

    // 將生字簿實例設為全域可存取
    window.vocabularyBook = vocabularyBook;
});
