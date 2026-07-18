import logging
import os
import sys
from logging.handlers import TimedRotatingFileHandler

from config import settings


def _configure_logging() -> logging.Logger:
    os.makedirs(settings.LOG_DIR, exist_ok=True)
    log = logging.getLogger("whisper_API")
    log.setLevel(logging.INFO)
    formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")
    file_handler = TimedRotatingFileHandler(
        filename=os.path.join(settings.LOG_DIR, "app.log"),
        when="midnight",
        backupCount=settings.LOG_RETENTION_DAYS,
        encoding="utf-8",
    )
    file_handler.setFormatter(formatter)
    log.addHandler(file_handler)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    log.addHandler(console_handler)
    return log


logger = _configure_logging()
