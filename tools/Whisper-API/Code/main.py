import uuid
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
import uvicorn

from config import settings
from logging_setup import logger
from services import file_service, model_service
from services.transcription_service import transcribe_request, validate_request

app = FastAPI(title="Whisper Transcribe API")
file_service.start_cleanup_scheduler()


@app.get("/")
def read_root():
    return {"message": "FastAPI for Whisper transcription API is running", **model_service.get_device_info()}


@app.get("/health")
def health():
    return {"status": "ok", **model_service.get_device_info()}


@app.get("/models")
def list_models():
    return {"models": model_service.list_models()}


@app.post("/models/{model_size}/download")
def download_model(model_size: str):
    if model_size not in settings.ALLOWED_MODEL_SIZES:
        raise HTTPException(status_code=400, detail=f"model_size 需為 {sorted(settings.ALLOWED_MODEL_SIZES)} 其中之一")
    return {"model_size": model_size, "result": model_service.download_model_async(model_size)}


@app.post("/transcribe")
async def transcribe(
    file: Optional[UploadFile] = File(default=None),
    url: Optional[str] = Form(default=None),
    model_size: str = Form(default=settings.DEFAULT_MODEL_SIZE),
    batch_size: int = Form(default=settings.DEFAULT_BATCH_SIZE),
    language: Optional[str] = Form(default=None),
    task: str = Form(default="transcribe"),
    output_plain_text: bool = Form(default=True),
    output_timeline_text: bool = Form(default=True),
    id: Optional[str] = Form(default=None),
):
    has_file = file is not None and bool(file.filename)
    has_url = bool(url)
    try:
        validate_request(has_file, has_url, model_size, task, batch_size)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    request_id = id or str(uuid.uuid4())
    try:
        return await transcribe_request(
            file=file,
            url=url,
            model_size=model_size,
            batch_size=batch_size,
            language=language,
            task=task,
            output_plain_text=output_plain_text,
            output_timeline_text=output_timeline_text,
            request_id=request_id,
        )
    except Exception as e:
        logger.exception(f"[{request_id}] 轉錄失敗: {e}")
        return JSONResponse(status_code=500, content={"message": "error", "id": request_id, "error": str(e)})


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=settings.PORT)
