import cv2
from ultralytics import YOLO

from kafka_producer import Producer
import numpy as np
from queue import Queue
import json
import base64
import datetime
# import requests

class VideoCamera(object):

    """
    Первым делом выполняется:
    1) Установка связи с камерами.
    2) Получаем данные о камере: Имя, местоположение, статус.
    3) Добавляем информацию о камере в БД
    4) Получаем id, выданный на локацию по камере.

    5) Создаем тему в Kafka на имя камеры.
    6) Транслируем инциденты в kafka.
    """
    def __init__(self, dict_camera):
        self.DATA_RECEIVING_ADDRESS = '/sendCameraData'
        self.STREAM_ADDRESS = '/hls/xxx.m3u8'

        self.model = YOLO("best.pt")
        self.producer = Producer()

        self.__status = False
        self.dict_camera = dict_camera
        self.producer.create_topics([dict_camera['name']])
        URL = dict_camera['url']
        self.cap = cv2.VideoCapture(URL + self.STREAM_ADDRESS)
        if self.cap is None or not self.cap.isOpened():
            self.reconnecting(str(URL + self.STREAM_ADDRESS))
        else:
            self.__status = True
        self.frames: Queue = Queue()
        self.signs: Queue = Queue()
    
    def __del__(self):
        try:
            self.cap.release()
        except AttributeError:
            pass

    def getStatusCamera(self):
        return self.__status

    def reconnecting(self, url_camera):
        iter = 0
        print(f'Пробуем переподключиться к камере по адресу: {url_camera}')
        while iter < 5:
            self.cap.release()
            self.cap = cv2.VideoCapture(url_camera)
            if self.cap.isOpened():
                self.__status = True
                print(f'Соединение с камерой {url_camera} восстановлено.')
                break
            iter += 1
        if iter >= 5:
            print(f'Попытка соединения с камерой {url_camera} не увенчалась успехом.')
        
    
    def get_frame(self):
        success, image = self.cap.read()
        if success:
            results = self.model.predict(image)
            annotated_frame = results[0].plot()
            ret, jpeg = cv2.imencode('.jpg', annotated_frame)
            self.get_classes(results, jpeg)
            self.frames.put(jpeg.tobytes())
        else:
            self.__status = False

    """
    Отправляет данные в тему Kafka.
    """
    def get_classes(self, results, jpeg):
        numpy_arr = results[0].boxes.cls.cpu().data.numpy()    # Преобразовать массив из tourch.Tensor в numArray
        uniques, idx = np.unique(numpy_arr, return_counts=True) # Получить два списка - уникальные значения, их количество
        dict_classes = dict(map(lambda i, j: (results[0].names[int(i)], int(j)), uniques, idx))    # Преобразовать в словарь
        if bool(dict_classes):
            self.signs.put(dict_classes)
            dict_classes['camera_data'] = self.dict_camera['index']
            dict_classes['datetime'] = datetime.datetime.now().__str__()
            dict_classes['Image'] = base64.b64encode(jpeg.tobytes()).decode('utf8').replace("'", '"')
            json_results = json.dumps(dict_classes)
            response = self.producer.send_message(self.dict_camera['name'], json_results)