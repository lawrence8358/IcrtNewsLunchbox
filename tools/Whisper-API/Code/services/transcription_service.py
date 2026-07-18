import asyncio
import time
from typing import Optional

from fastapi import UploadFile

from config import settings
from logging_setup import logger
from services import file_service, model_service
from utils.timeline import build_timeline_text, seconds_to_timestamp


def validate_request(has_file: bool, has_url: bool, model_size: str, task: str, batch_size: int) -> None:
    if not has_file and not has_url:
        raise ValueError("請提供 file 或 url 其中一項")
    if has_file and has_url:
        raise ValueError("file 與 url 僅能提供一項")
    if model_size not in settings.ALLOWED_MODEL_SIZES:
        raise ValueError(f"model_size 需為 {sorted(settings.ALLOWED_MODEL_SIZES)} 其中之一")
    if task not in settings.ALLOWED_TASKS:
        raise ValueError(f"task 需為 {sorted(settings.ALLOWED_TASKS)} 其中之一")
    if batch_size < 1:
        raise ValueError("batch_size 需為大於 0 的整數")


async def transcribe_request(
    *, file: Optional[UploadFile], url: Optional[str], model_size: str, batch_size: int,
    language: Optional[str], task: str, output_plain_text: bool,
    output_timeline_text: bool, request_id: str,
) -> dict:
    started = time.time()
    source = "url" if url else "upload"
    file_path = None
    try:
        if url:
            file_path = await asyncio.to_thread(file_service.download_url, url, request_id)
        else:
            file_path = await file_service.save_upload_file(file, request_id)
        result = await asyncio.to_thread(model_service.run_inference, model_size, file_path, language, task, batch_size)
        segments = [
            {
                "index": index,
                "start": round(seg.get("start", 0), 3),
                "end": round(seg.get("end", 0), 3),
                "start_time": seconds_to_timestamp(seg.get("start", 0)),
                "end_time": seconds_to_timestamp(seg.get("end", 0)),
                "text": seg.get("text", "").strip(),
            }
            for index, seg in enumerate(result.get("segments", []))
        ]
        response = {
            "message": "success",
            "id": request_id,
            "source": source,
            "model_size": model_size,
            "language": result.get("language"),
            "segments": segments,
        }
        if output_plain_text:
            response["plain_text"] = result.get("text", "").strip()
        if output_timeline_text:
            response["timeline_text"] = build_timeline_text(segments)
        logger.info(f"[{request_id}] API 轉錄完成，耗時 {time.time() - started:.1f} 秒 (model={model_size}, source={source})")
        return response
    finally:
        file_service.delete_file(file_path, request_id)
