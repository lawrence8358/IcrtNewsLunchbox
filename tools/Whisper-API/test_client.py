import json
import sys
import time
from pathlib import Path

import requests


API_URL = "http://localhost:9001/transcribe"
AUDIO_URL = "https://www.icrt.com.tw/en/ext/rss/LunchBox/20250930NK.mp3"


def main() -> int:
    started = time.perf_counter()
    response = requests.post(
        API_URL,
        data={"url": AUDIO_URL, "model_size": "small", "language": "en", "id": "20250930NK-API"},
        timeout=3600,
    )
    elapsed = time.perf_counter() - started
    print(f"HTTP {response.status_code}; elapsed={elapsed:.1f}s")
    response.raise_for_status()
    payload = response.json()
    segments = payload.get("segments", [])
    if payload.get("message") != "success" or not segments:
        raise RuntimeError(f"API 回應沒有成功的 segments: {json.dumps(payload, ensure_ascii=False)[:1000]}")
    durations = [float(seg["end"]) - float(seg["start"]) for seg in segments]
    print(f"segments={len(segments)}; duration_min={min(durations):.2f}s; duration_max={max(durations):.2f}s")
    print(json.dumps(segments[:5], ensure_ascii=False, indent=2))
    output_path = Path(__file__).with_name("whisper-api-validation.json")
    with output_path.open("w", encoding="utf-8") as output:
        json.dump(payload, output, ensure_ascii=False, indent=2)
    print(f"saved={output_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
