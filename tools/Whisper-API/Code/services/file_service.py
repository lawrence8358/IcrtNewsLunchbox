import os
import threading
import time
from urllib.parse import urlparse

import requests
from fastapi import UploadFile

from config import settings
from logging_setup import logger


async def save_upload_file(file: UploadFile, request_id: str) -> str:
    safe_name = os.path.basename(file.filename) or "audio"
    suffix = os.path.splitext(safe_name)[1] or ".mp3"
    dest_path = os.path.join(settings.TEMP_DIR, f"{request_id}{suffix}")
    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    size = 0
    with open(dest_path, "wb") as buffer:
        while True:
            chunk = await file.read(8192)
            if not chunk:
                break
            size += len(chunk)
            if size > max_bytes:
                buffer.close()
                os.remove(dest_path)
                raise ValueError(f"上傳檔案超過大小限制 ({settings.MAX_UPLOAD_MB} MB)")
            buffer.write(chunk)
    logger.info(f"[{request_id}] 已接收上傳檔案: {safe_name} -> {dest_path}")
    return dest_path


def download_url(url: str, request_id: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError("僅支援 http/https 的 URL")
    suffix = os.path.splitext(parsed.path)[1]
    if not suffix or len(suffix) > 6:
        suffix = ".mp3"
    dest_path = os.path.join(settings.TEMP_DIR, f"{request_id}{suffix}")
    logger.info(f"[{request_id}] 開始下載: {url}")
    max_bytes = settings.MAX_DOWNLOAD_MB * 1024 * 1024
    downloaded = 0
    with requests.get(url, stream=True, timeout=settings.DOWNLOAD_TIMEOUT_SEC) as response:
        response.raise_for_status()
        with open(dest_path, "wb") as output:
            for chunk in response.iter_content(chunk_size=8192):
                if not chunk:
                    continue
                downloaded += len(chunk)
                if downloaded > max_bytes:
                    output.close()
                    os.remove(dest_path)
                    raise ValueError(f"下載檔案超過大小限制 ({settings.MAX_DOWNLOAD_MB} MB)")
                output.write(chunk)
    logger.info(f"[{request_id}] 下載完成: {dest_path}")
    return dest_path


def delete_file(path: str, request_id: str) -> None:
    if not path or not os.path.exists(path):
        return
    try:
        os.remove(path)
        logger.info(f"[{request_id}] 已刪除暫存檔: {path}")
    except Exception as e:
        logger.warning(f"[{request_id}] 刪除暫存檔失敗: {path} ({e})")


def cleanup_temp_dir() -> None:
    cutoff = time.time() - settings.TEMP_RETENTION_DAYS * 86400
    try:
        for name in os.listdir(settings.TEMP_DIR):
            path = os.path.join(settings.TEMP_DIR, name)
            try:
                if os.path.isfile(path) and os.path.getmtime(path) < cutoff:
                    os.remove(path)
                    logger.info(f"[cleanup] 已刪除逾期暫存檔: {path}")
            except Exception as e:
                logger.warning(f"[cleanup] 刪除暫存檔失敗 {path}: {e}")
    except Exception as e:
        logger.warning(f"[cleanup] 掃描暫存目錄失敗: {e}")


def start_cleanup_scheduler() -> None:
    os.makedirs(settings.TEMP_DIR, exist_ok=True)
    cleanup_temp_dir()

    def _loop():
        while True:
            time.sleep(settings.CLEANUP_INTERVAL_SEC)
            cleanup_temp_dir()

    threading.Thread(target=_loop, daemon=True).start()
