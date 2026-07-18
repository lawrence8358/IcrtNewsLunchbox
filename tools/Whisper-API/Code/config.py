import os
from pathlib import Path

_PROJECT_ROOT = Path(__file__).resolve().parent.parent


class Settings:
    PORT = int(os.environ.get("PORT", 80))
    TEMP_DIR = os.environ.get("TEMP_DIR", str(_PROJECT_ROOT / "Temp"))
    LOG_DIR = os.environ.get("LOG_DIR", str(_PROJECT_ROOT / "Log"))
    TEMP_RETENTION_DAYS = int(os.environ.get("TEMP_RETENTION_DAYS", 7))
    CLEANUP_INTERVAL_SEC = int(os.environ.get("CLEANUP_INTERVAL_SEC", 3600))
    LOG_RETENTION_DAYS = int(os.environ.get("LOG_RETENTION_DAYS", 30))
    MAX_UPLOAD_MB = int(os.environ.get("MAX_UPLOAD_MB", 1024))
    MAX_DOWNLOAD_MB = int(os.environ.get("MAX_DOWNLOAD_MB", 1024))
    DOWNLOAD_TIMEOUT_SEC = int(os.environ.get("DOWNLOAD_TIMEOUT_SEC", 120))
    DEFAULT_MODEL_SIZE = os.environ.get("DEFAULT_MODEL_SIZE", "small")
    DEFAULT_BATCH_SIZE = int(os.environ.get("DEFAULT_BATCH_SIZE", 16))
    MODEL_SIZE_ORDER = ["tiny", "base", "small", "medium", "large", "turbo"]
    ALLOWED_MODEL_SIZES = set(MODEL_SIZE_ORDER)
    ALLOWED_TASKS = {"transcribe", "translate"}


settings = Settings()
