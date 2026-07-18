# Whisper API

Whisper API 是以 FastAPI 與 `faster-whisper` 建立的語音轉文字服務。服務使用 NVIDIA GPU 執行 Whisper 模型，支援上傳音訊檔或提供 HTTP/HTTPS 音訊 URL，並回傳逐段時間戳、純文字及時間軸文字。

## 需求

- Docker 與 Docker Compose
- NVIDIA GPU、相容的驅動程式及 NVIDIA Container Toolkit
- 主機可存取 Hugging Face，以便首次使用模型時下載模型檔

## 環境設定

Docker Compose 會讀取 `Docker/.env`。第一次設定時，可從範例檔建立本機設定：

```powershell
cd tools/Whisper-API/Docker
Copy-Item .env.example .env
```

`.env.example` 列出所有可調整參數及中文說明。公開模型通常不需要 `HF_TOKEN`；如需填入 Token，請勿將實際 `.env` 提交至 Git。

常用設定包括：

- `HOST_PORT`：主機對外連接埠，預設為 `9001`
- `DEFAULT_MODEL_SIZE`：預設模型大小，預設為 `small`
- `TEMP_RETENTION_DAYS`：暫存檔保留天數
- `LOG_RETENTION_DAYS`：Log 保留天數
- `MAX_UPLOAD_MB`、`MAX_DOWNLOAD_MB`：檔案大小上限

## 啟動服務

```powershell
cd tools/Whisper-API/Docker
docker compose up -d --build
```

預設服務位址為 `http://localhost:9001`。可使用健康檢查確認服務及 CUDA 狀態：

```powershell
Invoke-RestMethod http://localhost:9001/health
```

查看服務 Log：

```powershell
docker compose logs -f whisper-api
```

停止服務：

```powershell
docker compose down
```

## API

### `GET /health`

回傳服務狀態、目前運算裝置及 CUDA 是否可用。

### `GET /models`

列出支援的模型，以及各模型目前是否已下載或載入。

### `POST /models/{model_size}/download`

在背景下載並載入指定模型。可用模型為 `tiny`、`base`、`small`、`medium`、`large`、`turbo`。

### `POST /transcribe`

使用 `multipart/form-data` 傳送下列欄位：

- `file`：要轉錄的音訊檔；與 `url` 擇一提供
- `url`：HTTP/HTTPS 音訊 URL；與 `file` 擇一提供
- `model_size`：模型大小，未提供時使用 `DEFAULT_MODEL_SIZE`
- `language`：語言代碼，例如 `en`、`zh`；未提供時自動偵測
- `task`：`transcribe` 或 `translate`
- `id`：選填的請求識別碼
- `output_plain_text`：是否回傳完整純文字
- `output_timeline_text`：是否回傳時間軸文字
- `batch_size`：為輸入介面保留的相容欄位

## 測試

`test_client.py` 會呼叫本機 API，並將驗證結果寫入 `whisper-api-validation.json`：

```powershell
cd tools/Whisper-API
python test_client.py
```

驗證結果包含完整轉錄內容，已由 `.gitignore` 排除。

## 目錄與 Volume

- `Code/`：API 程式碼，開發時掛載至容器 `/app`
- `Temp/`：下載或上傳音訊的暫存目錄，掛載至 `TEMP_DIR`
- `Log/`：應用程式 Log，掛載至 `LOG_DIR`
- Hugging Face 模型快取：儲存在 Docker named volume `whisper_api_model_cache`

修改 Python 程式後執行 `docker compose restart` 即可套用。只有 `requirements.txt`、Dockerfile 或基底 image 變更時，才需要重新執行 `docker compose up -d --build`。
