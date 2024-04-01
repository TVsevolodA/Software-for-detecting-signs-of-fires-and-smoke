FROM python:3.10
WORKDIR /monitoringService
RUN pip install --upgrade pip
RUN pip install kafka-python
RUN pip install flask
RUN pip install Flask-SocketIO
RUN pip install Flask-Login
RUN pip install Flask-APScheduler
RUN pip install python-dotenv

RUN apt-get update && apt-get install ffmpeg libsm6 libxext6  -y
RUN pip install opencv-python
# RUN pip install python-ffmpeg
# RUN pip install python-ffmpeg-video-streaming
RUN pip install ultralytics
COPY . .
ENTRYPOINT ["tail", "-f", "/dev/null"]
# CMD [ "python", "main.py" ]