FROM nvidia/cuda:12.8.1-cudnn-devel-ubuntu24.04

ENV DEBIAN_FRONTEND=noninteractive
ENV NVIDIA_VISIBLE_DEVICES=all
ENV NVIDIA_DRIVER_CAPABILITIES=compute,utility
ENV LD_LIBRARY_PATH=/usr/local/lib:$LD_LIBRARY_PATH
ENV TZ=Asia/Taipei
WORKDIR /app

RUN apt-get update && apt-get install -y \
    python3 python3-dev python3-pip ffmpeg git cmake build-essential libopenblas-dev tzdata \
    && ln -sf /usr/bin/python3 /usr/bin/python \
    && ln -sf /usr/share/zoneinfo/$TZ /etc/localtime \
    && echo $TZ > /etc/timezone \
    && rm -rf /var/lib/apt/lists/*

COPY Docker/requirements.txt .
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

COPY Code/ .
RUN mkdir -p Temp Log

EXPOSE 80
ENV PORT=80
ENV TEMP_DIR=/app/Temp
ENV LOG_DIR=/app/Log
CMD ["python", "main.py"]
