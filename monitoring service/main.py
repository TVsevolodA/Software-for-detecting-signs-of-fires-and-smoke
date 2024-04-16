from apscheduler.schedulers.background import BackgroundScheduler
from flask import Flask, render_template, Response, request, redirect, url_for, jsonify, flash, session
from flask_socketio import SocketIO
from threading import Lock
from camera_builder import camerasBuilder
from scheduler import Scheduler
import json
import requests

from flask_login import LoginManager, login_user, login_required, logout_user, current_user
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
    if req.status_code == 200:
        objectuser = json.loads(req.text)
        gettingUser = User(user_id=objectuser['user_id'], username=objectuser['username'], email=objectuser['email'], password_hash=objectuser['password_hash'], role=objectuser['role'])
        return gettingUser
    return None

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
                flash('Успешно вошел в систему.', 'info')
                next = request.args.get('next')
                return redirect(next or url_for('index'))
            else:
                flash('Неверный логин или пароль.', 'error')
        return render_template('signIn.html')


@app.route('/registration', methods=['GET', 'POST'])
def signUp():
    if request.method == 'POST':
        login_form = request.form
        username = login_form['username']
        email = login_form['login']
        password = login_form['password']
        # if request.method == 'POST':
        new_user = User(username=username, email=email, role='dispatcher')
        new_user.set_password(password)
        new_user.register_user_in_system()
        return redirect(url_for('signIn'))
    return render_template('signUp.html')

@app.route('/profile', methods=['GET'])
@login_required
def profile():
    username = current_user.username
    email = current_user.email
    return render_template('profile.html', username=username, email=email)

@app.route('/editProfile', methods=['GET', 'POST'])
@login_required
def editProfile():
    username = current_user.username
    email = current_user.email
    if request.method == 'POST':
        login_form = request.form
        newUsername = login_form['username']
        newEmail = login_form['email']
        oldPassword = login_form['oldPassword']
        newPassword = login_form['password']
        # Проверяем что пользователя с новой почтой нет в БД!
        userObject = User(username='', email=newEmail, role='dispatcher')
        modifiedDataUser = userObject.get_user_by_login(newEmail)
        if not modifiedDataUser or modifiedDataUser.user_id == current_user.user_id:
            # Если такого пользователя нет, то проверяет что у текущего пользователя правильно введен старый пароль
            userObject = User(username='', email=email, role='dispatcher')
            oldDataUser = userObject.get_user_by_login(email)
            # Если пользователь ввел новый пароль
            if len(oldPassword) > 0:
                # Изменение данных с паролем
                if userObject.check_password(oldPassword):
                    oldDataUser.set_password(newPassword)
                    oldDataUser.changing_profile(username=newUsername, email=newEmail)
                    current_user.username = newUsername
                    current_user.email = newEmail
                    current_user.password_hash = oldDataUser.password_hash
                    flash('Изменения успешно применены.', 'info')
                    return redirect(url_for('profile'))
                else:
                    flash('Неверно указан пароль.', 'error')
                    return render_template('editProfile.html', username=newUsername, email=newEmail)
            else:
                # Изменение данных без пароля
                oldDataUser.changing_profile(username=newUsername, email=newEmail)
                current_user.username = newUsername
                current_user.email = newEmail
                flash('Изменения успешно применены.', 'info')
                return redirect(url_for('profile'))
        else:
            flash('Введенный адрес электронной почты уже зарегистрирован в системе.', 'error')
    return render_template('editProfile.html', username=username, email=email)


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

@app.route('/reporting', methods=["GET", "POST"])
def reporting():
    authorized_user = {
    'user_id': current_user.user_id,
    'username': current_user.username
    }
    session['user'] = authorized_user
    return redirect("http://localhost:4000/getReports", code=307)

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
@app.route('/infoСamera/cameras/<camera>/<idCamera>/<idStream>', methods=["GET"])
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

@app.route('/scheduledEvents', methods=["GET", "POST"])
def scheduledEvents():
    if request.method == 'GET':
        responseEventsInDb = action_planner.get_tasks()
        eventsInDb = json.loads(responseEventsInDb.text)
        return render_template('scheduledEvents.html', events=eventsInDb)
    else:
        idEvent = request.json
        res = action_planner.delete_task(idEvent['idEvent'])
        return jsonify({'statusCode': 201, 'res': res})

@app.route('/eventData/<idEvent>', methods=["GET", "POST"])
def eventData(idEvent):
    if request.method == 'GET':
        eventData = action_planner.get_task(int(idEvent))
        return render_template('eventData.html', event=eventData)
    else:
        res = action_planner.delete_task(idEvent)
        return jsonify({'statusCode': 201, 'res': res})


@app.route('/scheduledActions/<idCamera>', methods=["GET"])
def scheduledActions(idCamera):
    return render_template('scheduleActionIndividual.html', idCamera=idCamera)

@app.route('/setAction', methods=["POST"])
def setAction():
    data = request.form
    action_planner.add_task(data)
    return redirect(url_for('index'))

@app.route('/managingRoles', methods=["GET", "POST"])
def managingRoles():
    if request.method == 'GET':
        req = requests.get('http://data_service_sm:3000/userRoles')
        if req.status_code == 200:
            dict_req = json.loads(req.text)
            return render_template('managingRoles.html', users=dict_req['users'])
        else:
            return '<h1>Произошла ошибка при обращении к базе данных1</h1>'
    else:
        jsonAction = request.json
        req = requests.post('http://data_service_sm:3000/changeRoles', json=jsonAction)
        if req.status_code == 200:
            dict_req = json.loads(req.text)
            return jsonify({'statusCode': 201, 'res': dict_req})
        else:
            return jsonify({'statusCode': 500, 'res': f'Ошибка! {res}'})


def background_thread(ids):
    while True:
        for id in ids:
            camera, _ = camerasBuilder.getVideoCamera(id)
            signs = {}
            if (camera.getStatusCamera()):
                signs = camera.signs.get()
            
            new_signs = {}
            for sign in ['Fire', 'Smoke']:
                el = signs.get(sign)
                if el is not None:
                    new_signs[sign] = el
            socketio.emit('data', {'camera_name': camera.dict_camera['name'], 'value': new_signs})

def getSigns():
    global thread
    with thread_lock:
        if thread is None:
            id_videos = customer_videos.get(request.sid)
            thread = socketio.start_background_task(background_thread, id_videos)

@socketio.on('my_event')
def saving_users_video_id(arg):
    cv = customer_videos.get(request.sid)
    customer_videos[request.sid] = list(arg['data'])
    print(f'Получили: {arg}. Его sid: {request.sid}. Сохранили данные в словарь')
    getSigns()

@socketio.on('disconnect')
def test_disconnect():
    customer_videos.pop(request.sid)
    print(f'Клиент отвалился: {request.sid}. Удалили данные о нем')

camerasBuilder = camerasBuilder()
socketio.run(app, host='monitoringService', port=5050, allow_unsafe_werkzeug=True)