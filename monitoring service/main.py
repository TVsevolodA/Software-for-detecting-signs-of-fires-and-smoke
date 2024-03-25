from apscheduler.schedulers.background import BackgroundScheduler
from flask import Flask, render_template, Response, request, redirect, url_for
from flask_socketio import SocketIO
from threading import Lock
from camera_builder import camerasBuilder
from scheduler import Scheduler
import json
import requests

scheduler = BackgroundScheduler()
action_planner = Scheduler(scheduler)
scheduler.start()

app = Flask(__name__)

customer_videos = {}
thread = None
thread_lock = Lock()
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, async_mode='threading')

@app.route('/')
def index():
    return render_template('index.html', cameraСounter = len(camerasBuilder.cameras))

def gen(id_camera_web):
    while True:
        camera, url = camerasBuilder.getVideoCamera(id_camera_web)
        if (camera.getStatusCamera()):
            camera.get_frame()
            frame = camera.frames.get()
            yield (b'--frame\r\n'
                b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n\r\n')
        else:
            camera.reconnecting(url['url'] + camera.STREAM_ADDRESS)
            yield (b'--frame\r\n'
                b'Content-Type: image/jpeg\r\n\r\n\r\n\r\n')

@app.route('/video_feed/<id>/')
def video_feed(id):
    return Response(gen(int(id)),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/addCamera', methods=["GET"])
def addCamera():
    return render_template('addCamera.html')

@app.route('/addedCamera', methods=["POST"])
def addedCamera():
    URL = request.form['url']

    test = requests.get(URL + '/hls/xxx.m3u8')
    if test.status_code == 404:
        return f'<h1>Ошибка! Трансляция недоступна или указан неверный URl</h1>'

    json_url = '{"url": "' + URL + '"}'
    req = requests.post('http://data_service_sm:3000/registerCamera', json=json.loads(json_url))
    dict_req = json.loads(req.text)
    if req.status_code == 201:
        DATA = dict_req['data']
        CAMERA_ID = DATA['index']
        camerasBuilder.addCameraStream(DATA)
        return f'<h1>Успешно добавлена новая камера с id = {CAMERA_ID}!!!</h1>'
    else:
        res = dict_req['result']
        return f'<h1>Ошибка! {res}</h1>'

@app.route('/infoСamera', methods=["GET"], defaults={'camera': 'all', 'idStream': '-1'})
@app.route('/infoСamera/cameras/<camera>/<idStream>')
def infoСamera(camera, idStream):
    requestBody = '{"camera": "' + camera + '"}'
    req = requests.get('http://data_service_sm:3000/infoCamera', json=json.loads(requestBody))
    dict_req = json.loads(req.text)
    if req.status_code == 200:
        if camera == 'all':
            return render_template('infoСamera.html', infoCameras=dict_req)
        else:
            return render_template('infoСameraAlone.html', stream=idStream)
    else:
        return f'<h1>Ошибка:\n{dict_req}</h1>'

@app.route('/scheduledActions/<idCamera>', methods=["GET"], defaults={'idCamera': '-1'})
def scheduledActions(idCamera):
    # TODO: 2 страницы. 1) страница с одной задачей 2) с задачами, если их несколько на одной камере
    return render_template('scheduleActionIndividual.html', idCamera=idCamera)

@app.route('/setAction', methods=["POST"])
def setAction():
    data = request.form
    action_planner.add_task(data)
    return redirect(url_for('index'))

def background_thread(id):
    while True:
        camera, url = camerasBuilder.getVideoCamera(id)
        signs = {}
        if (camera.getStatusCamera()):
            signs = camera.signs.get()
        
        new_signs = {}
        for sign in ['Fire', 'Smoke']:
            el = signs.get(sign)
            if el is not None:
                new_signs[sign] = el
        socketio.emit('data', {'value': new_signs})
        socketio.sleep(1)

def getSigns():
    global thread
    with thread_lock:
        if thread is None:
            id_video = customer_videos.get(request.sid)
            thread = socketio.start_background_task(background_thread, id_video)

@socketio.on('my_event')
def saving_users_video_id(arg):
    customer_videos[request.sid] = int(arg['data'])
    print(f'Получили: {arg}. Его sid: {request.sid}. Сохранили данные в словарь')
    getSigns()

@socketio.on('disconnect')
def test_disconnect():
    customer_videos.pop(request.sid)
    print(f'Клиент отвалился: {request.sid}. Удалили данные о нем')

camerasBuilder = camerasBuilder()
socketio.run(app, host='monitoringService', port=5050, allow_unsafe_werkzeug=True)