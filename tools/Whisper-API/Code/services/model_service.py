import os
import re
import threading
from pathlib import Path

import torch
from faster_whisper import WhisperModel

from config import settings
from logging_setup import logger

device = "cuda" if torch.cuda.is_available() else "cpu"
logger.info(f"Torch 裝置: {device}")

_model_cache = {}
_model_locks_guard = threading.Lock()
_model_locks = {}
_inference_lock = threading.Lock()
_download_status = {}
_download_status_lock = threading.Lock()

_LANGUAGE_ALIASES = {
    "english": "en",
    "chinese": "zh",
    "mandarin": "zh",
    "castilian": "es",
}

_SHORT_SEGMENT_MAX_SEC = 16.0
_SHORT_SEGMENT_PAUSE_SEC = 0.7


def get_device_info() -> dict:
    return {"device": device, "cuda_available": torch.cuda.is_available()}


def _get_model_lock(model_size: str) -> threading.Lock:
    with _model_locks_guard:
        return _model_locks.setdefault(model_size, threading.Lock())


def _checkpoint_path(model_size: str) -> str:
    cache_root = os.getenv("HF_HOME")
    hub_root = Path(cache_root) / "hub" if cache_root else Path(os.getenv("XDG_CACHE_HOME", Path.home() / ".cache")) / "huggingface" / "hub"
    return str(hub_root / f"models--Systran--faster-whisper-{model_size}")


def is_model_downloaded(model_size: str) -> bool:
    return os.path.isdir(_checkpoint_path(model_size))


def get_model_status(model_size: str) -> str:
    if model_size in _model_cache:
        return "loaded"
    with _download_status_lock:
        if _download_status.get(model_size) == "downloading":
            return "downloading"
    return "downloaded" if is_model_downloaded(model_size) else "not_downloaded"


def list_models() -> list[dict]:
    result = []
    for model_size in settings.MODEL_SIZE_ORDER:
        entry = {"model_size": model_size, "status": get_model_status(model_size)}
        path = _checkpoint_path(model_size)
        if os.path.isdir(path):
            size = sum(file.stat().st_size for file in Path(path).rglob("*") if file.is_file())
            entry["file_size_mb"] = round(size / (1024 * 1024), 1)
        result.append(entry)
    return result


def get_model(model_size: str):
    model = _model_cache.get(model_size)
    if model is not None:
        return model
    with _get_model_lock(model_size):
        model = _model_cache.get(model_size)
        if model is None:
            with _download_status_lock:
                _download_status[model_size] = "downloading"
            try:
                compute_type = "float16" if device == "cuda" else "int8"
                logger.info(f"載入 Whisper 模型 '{model_size}' 至 {device} ...")
                # API 刻意使用原生 WhisperModel，不使用 BatchedInferencePipeline。
                # 這會保留模型自然產生的短語句 segments，而不是批次視窗的長段落。
                model = WhisperModel(model_size, device=device, compute_type=compute_type)
            except Exception:
                with _download_status_lock:
                    _download_status.pop(model_size, None)
                raise
            _model_cache[model_size] = model
            with _download_status_lock:
                _download_status.pop(model_size, None)
            logger.info(f"模型 '{model_size}' 載入完成")
        return model


def download_model_async(model_size: str) -> str:
    status = get_model_status(model_size)
    if status == "loaded":
        return "already_loaded"
    if status == "downloading":
        return "already_downloading"

    def _worker():
        try:
            get_model(model_size)
        except Exception as e:
            logger.error(f"背景下載/載入模型 '{model_size}' 失敗: {e}")

    threading.Thread(target=_worker, daemon=True).start()
    return "started"


def _normalize_language(language: str | None) -> str | None:
    if language is None:
        return None
    normalized = language.strip().lower()
    return _LANGUAGE_ALIASES.get(normalized, normalized)


def _build_short_segments(raw_segments) -> list[dict]:
    """用詞級時間戳把長段落在標點、停頓或 16 秒上限處切開。"""
    result = []
    seen = set()

    def add_segment(start, end, text):
        text = text.strip()
        key = (round(float(start), 3), round(float(end), 3), text)
        if text and key not in seen:
            seen.add(key)
            result.append({"start": start, "end": end, "text": text})

    def append_segment(words, fallback):
        if not words:
            if fallback.text.strip():
                add_segment(fallback.start, fallback.end, fallback.text)
            return
        text = "".join(getattr(word, "word", "") for word in words).strip()
        if text:
            add_segment(words[0].start, words[-1].end, text)

    for segment in raw_segments:
        words = list(getattr(segment, "words", None) or [])
        if not words:
            append_segment([], segment)
            continue

        current = []
        for word in words:
            if current:
                pause = max(0.0, (word.start or 0.0) - (current[-1].end or current[-1].start or 0.0))
                duration = (word.end or word.start or 0.0) - (current[0].start or 0.0)
                if pause >= _SHORT_SEGMENT_PAUSE_SEC or duration >= _SHORT_SEGMENT_MAX_SEC:
                    append_segment(current, segment)
                    current = []
            current.append(word)
            if re.search(r"[.!?。！？]$", getattr(word, "word", "").strip()):
                append_segment(current, segment)
                current = []
        if current:
            append_segment(current, segment)
    return [{"id": index, **segment} for index, segment in enumerate(result)]


def run_inference(model_size: str, file_path: str, language: str | None, task: str, batch_size: int) -> dict:
    """使用 Whisper 原生 segment 邊界；batch_size 保留為相容輸入欄位。"""
    model = get_model(model_size)
    with _inference_lock:
        segments, info = model.transcribe(
            file_path,
            language=_normalize_language(language),
            task=task,
            beam_size=5,
            temperature=0,
            # 長音檔在課文段落間有停頓與背景音；切斷 decoder context 並啟用 VAD，
            # 避免模型在沒有語音時沿用上一段文字產生重複幻覺（例如 Spend）。
            condition_on_previous_text=False,
            vad_filter=True,
            vad_parameters={"min_silence_duration_ms": 500, "speech_pad_ms": 200},
            word_timestamps=True,
        )
        segments = list(segments)
    return {
        "text": "".join(segment.text for segment in segments),
        "language": info.language,
        "segments": _build_short_segments(segments),
    }
