from threading import Thread
import requests
import json

from camera import VideoCamera

class camerasBuilder(object):
    def __init__(self):
        self.cameras = self.getCameras()
        self.__VideoCameras = []
        self.threads = []
        for index, data in enumerate(self.cameras):
            self.__creature(data)

    def getCameras(self):
        list_url = requests.get('http://data_service_sm:3000/getListSources')
        dict_url = json.loads(list_url.text)
        return dict_url

    def createStreamingCamera(self, dict_camera):
        return VideoCamera(dict_camera)

    def __creature(self, data):
        camera = self.createStreamingCamera(data)
        self.__VideoCameras.append(camera)
        thread = Thread(target=self.createStreamingCamera, args=(data, ))
        thread.daemon = True
        thread.start()
        self.threads.append(thread)

    def getVideoCamera(self, index):
        return self.__VideoCameras[index], self.cameras[index]

    def addCameraStream(self, dataCamera):
        self.__creature(dataCamera)
        self.cameras.append(dataCamera)