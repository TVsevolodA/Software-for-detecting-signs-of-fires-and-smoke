from apscheduler.schedulers.background import BackgroundScheduler
from flask import Flask, render_template, Response, request, redirect, url_for, jsonify, flash
from flask_socketio import SocketIO
from threading import Lock
from camera_builder import camerasBuilder
from scheduler import Scheduler
import json
import requests

from flask_login import LoginManager, login_user, login_required, logout_user
from user import User

scheduler = BackgroundScheduler()
action_planner = Scheduler(scheduler)
scheduler.start()

app = Flask(__name__)

customer_videos = {}
thread = None
thread_lock = Lock()
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, async_mode='threading')
login = LoginManager(app)

@login.user_loader
def load_user(user_id):
    req = requests.get('http://data_service_sm:3000/getUserById', json={'user_id': user_id})
    return json.loads(req.text)

@app.route('/login', methods=['GET', 'POST'])
def signIn():
    if request.method == 'GET':
        return render_template('signIn.html')
    elif request.method == 'POST':
        login_form = request.form
        user_login = login_form['login']
        password = login_form['password']
        userObject = User(username='', email=user_login, role='dispatcher')
        if user_login and password:
            user = userObject.get_user_by_login(user_login)
            if user and userObject.check_password(password):
                login_user(user)
                flash('Успешно вошел в систему.')
                next = request.args.get('next')
                return redirect(next or url_for('index'))
            else:
                flash('Неверный логин или пароль.')
        return render_template('signIn.html')


@app.route('/registration', methods=['GET', 'POST'])
def signUp():
    if request.method == 'POST':
        login_form = request.form
        username = login_form['username']
        email = login_form['login']
        password = login_form['password']
        if request.method == 'POST':
            new_user = User(username=username, email=email, role='dispatcher')
            new_user.set_password(password)
            new_user.register_user_in_system()
            return redirect(url_for('signIn'))
    return render_template('signUp.html')


@app.route('/logout', methods=['GET', 'POST'])
@login_required
def logout():
    logout_user()
    return redirect(url_for('signIn'))


@app.after_request
def redirect_to_signIn(response):
    if response.status_code == 401:
        return redirect(url_for('signIn') + '?next=' + request.url)
    return response


@app.route('/')
def index():
    return render_template('index.html', cameras = camerasBuilder.cameras)

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
    jsonObject = request.json
    URL = jsonObject['url']
    # URL = request.form['url']

    try:
        test = requests.get(URL + '/hls/xxx.m3u8')
    except Exception:
        return jsonify({'statusCode': 400, 'res': f'Произошла ошибка при установке связи с камерой!'})
    if test.status_code == 404:
        return jsonify({'statusCode': 400, 'res': 'Ошибка! Трансляция недоступна или указан неверный URl'})
        # return f'<h1>Ошибка! Трансляция недоступна или указан неверный URl</h1>'

    json_url = '{"url": "' + URL + '"}'
    req = requests.post('http://data_service_sm:3000/registerCamera', json=json.loads(json_url))
    dict_req = json.loads(req.text)
    if req.status_code == 201:
        DATA = dict_req['data']
        CAMERA_ID = DATA['index']
        camerasBuilder.addCameraStream(DATA)
        return jsonify({'statusCode': 200, 'res': f'Успешно добавлена новая камера с id = {CAMERA_ID}'})
        # return f'<h1>Успешно добавлена новая камера с id = {CAMERA_ID}!!!</h1>'
    else:
        res = dict_req['result']
        return jsonify({'statusCode': 400, 'res': f'Ошибка! {res}'})
        # return f'<h1>Ошибка! {res}</h1>'

@app.route('/infoСamera', methods=["GET"], defaults={'camera': 'all', 'idCamera': '-1', 'idStream': '-1'})
@app.route('/infoСamera/cameras/<camera>/<idCamera>/<idStream>')
def infoСamera(camera, idCamera, idStream):
    requestBody = '{"camera": "' + camera + '"}'
    req = requests.get('http://data_service_sm:3000/infoCamera', json=json.loads(requestBody))
    dict_req = json.loads(req.text)
    if req.status_code == 200:
        if camera == 'all':
            return render_template('infoСamera.html', infoCameras=dict_req)
        else:
            return render_template('infoСameraAlone.html', idCamera=int(idCamera), stream=idStream)
    else:
        return f'<h1>Ошибка:\n{dict_req}</h1>'

@app.route('/scheduledActions/<idCamera>', methods=["GET"])
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