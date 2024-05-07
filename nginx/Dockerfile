FROM tiangolo/nginx-rtmp:latest

WORKDIR /ipCamera

RUN apt-get update && apt-get install ffmpeg libsm6 libxext6  -y

COPY nginx.conf /etc/nginx/nginx.conf

COPY 3.mp4 .