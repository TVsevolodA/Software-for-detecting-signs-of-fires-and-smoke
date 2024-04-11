//@ts-check
const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const Pool = require('pg').Pool;
let types = require('pg').types;
types.setTypeParser(1114, function(stringValue) {return stringValue;});
const pool = new Pool({
    user: process.env.POSTGRES_USER,
    host: process.env.DB_HOST,
    database: process.env.POSTGRES_DB,
    password: process.env.POSTGRES_PASSWORD,
    port: 5432,
});

const Location = require('./models/location.js');
const Camera = require('./models/camera.js');
const Notification = require('./models/notification.js');
const User = require('./models/user.js');
const Trigger = require('./models/trigger.js');
const Report = require('./models/report.js');

function sendRequest (url, host, response) {
    const req = http.request(url, (res) => {
        const statusCode = res.statusCode;
        if (statusCode === 200) {
            res.on('data', (chunk) => {
                const res = JSON.parse(chunk);
                addToDatabase(res, host, response);
            });
            res.on('end', () => {});
        }
        else response.status(statusCode).json({"result": "Не удалось подключиться к камере!"});
    });
    
    req.on('error', (e) => console.error(`Проблемы в запросе: ${e.message}`));
    req.end();
}

async function addToDatabase(camera_data, host, response) {
    const name_camera = camera_data.name_camera;
    const location = camera_data.location;
    const status = camera_data.status === 'Работает' ? true : false;

    try {
        let locationObject = Location.withoutId(pool, location);
        const camera_location = await locationObject.insertWithReturnId();

        camera_data.camera_location = camera_location;
        camera_data.url_address = host;
        camera_data.status = status;
        let cameraObject = Camera.withoutId(pool, camera_data);
        const camera_id = await cameraObject.insertWithReturnId();

        response.status(201).json({ "result": "Камера успешно добавлена в базу.", "data": {"index": camera_id, "url": host, "name": name_camera} });
    } catch (err) {
        const recurringGeoPointErr = 'duplicate key value violates unique constraint "location_cameras_longitude_latitude_unique"';
        const repeatedNameCameraErr = 'duplicate key value violates unique constraint "cameras_name_camera_key"';
        if (err.message === recurringGeoPointErr) {
            response.status(405).json({ "result": "Камера с данной геопозицией уже существует в базе!" });
        }
        else if (err.message === repeatedNameCameraErr) {
            response.status(405).json({ "result": "Камера с таким наименованием уже существует в базе!" });
        }
        else {
            response.status(500).json({ "result": `Получили ошибку: ${err.message}` });
        }
    }
}

// TODO: Для отладки
let message = '';
function getRecord () {
    return message;
}

async function getUserById(request, response) {
    const user_id = request.body.user_id;
    let userObject = User.systemUser(pool);
    const userInDb = (await userObject.getUserById(user_id));
    if (userInDb !== undefined) {
        response.status(200).json(userInDb);
    } else {
        response.status(404).json({'error': 'Не удалось найти пользователя с данным идентификатором.'});
    }
}

async function getUserByLogin(request, response) {
    const login = request.body.login;
    let userObject = User.systemUser(pool);
    const userInDb = await userObject.getUserByLogin(login);
    if (userInDb !== undefined) {
        response.status(200).json(userInDb);
    } else {
        response.status(404).json({'error': 'Не удалось найти пользователя с данным email.'});
    }
}

async function registerUser(request, response) {
    const user_json = request.body.user_json;
    let userObject = User.withoutId(pool, user_json);
    const userInDb = (await userObject.insertWithReturnId());
    response.status(200).json(userInDb);
}

function profileUpdate(request, response) {
    const modifiedDataUser = request.body.modifiedDataUser;
    console.log(`Получили объект нового пользователя: ${JSON.stringify(modifiedDataUser)}`);
    let userObject = new User(pool, modifiedDataUser);
    userObject.update();
    response.status(200).json({"result": "Данные о пользователе успешно обновлены"});
}

async function getListUsersWithRoles(request, response) {
    let userObject = User.systemUser(pool);
    const users = await userObject.getUserRoles();
    response.status(200).json({"users": users});
}

async function changeRoles(request, response) {
    const typeAction = request.body.typeAction;
    const usersId = request.body.usersId;
    let userObject = User.systemUser(pool);
    await userObject.changeRoles(typeAction, usersId);
    response.status(200).json({"result": "Изменения успешно применены."});
}

async function saveRecord(msg) {
    // TODO: Для отладки
    message = msg;

    // TODO: добавить передаваемое поле duty (дежурный), для оформления записи в отчете!
    const obj = JSON.parse(msg);
    let notificationObject = Notification.withoutId(pool, obj);
    let [incidentId, type_action_report] = await notificationObject.updateOrInsertEntry();

    let userObject = User.systemUser(pool);
    const dutyId = await userObject.searchSystemUser();
    const report = {
        'event_based': false,
        'number_incident': incidentId,
        'datetime': notificationObject.datetime,
        'duty': dutyId,
        'description': notificationObject.type_event,
        'measures_taken': '',
        'consequences': '',
        'conclusion': ''
    };
    if (type_action_report === 'update') updateReport(report);
    else addReport(report, notificationObject.camera_data);
    return incidentId;
}

function registerCamera(request, response) {
    const camera_data = request.body;
    const url_address = camera_data.url + '/sendCameraData';
    sendRequest(url_address, camera_data.url, response);
}

async function infoCamera(request, response) {
    const searchParameter = request.body.camera === 'all' ? null : request.body.camera;
    const cameraObject = Camera.emptyCamera(pool);
    const cameras = await cameraObject.requestInformationCamera(searchParameter);
    response.status(200).json(cameras);
}

async function getListSources() {
    const cameraObject = Camera.emptyCamera(pool);
    return await cameraObject.getListCameras();
}

async function addEventTrigger(request, response) {
    const trigger = request.body;
    let triggerObject = Trigger.withoutId(pool, trigger);
    const id_trigger = await triggerObject.insertWithReturnId();
    response.status(201).json({'id_event': id_trigger});
}

async function getEventTriggers(request, response) {
    let triggerObject = Trigger.emptyTrigger(pool);
    const triggers = await triggerObject.getListTriggers();
    response.status(200).json(triggers);
}


/// Поиск записи по расписанию или времени
// TODO: Сделать страницу под функцию! Проверить все комбинации: оба null, только один null, ни один не null.
async function recordSearch(name_camera = null, dateTime = null) {
    if (name_camera || dateTime) {
        let notificationObject = Notification.emptyNotification(pool);
        return await notificationObject.searchNotificationCameraNameorDate(name_camera, dateTime);
    }
    return new Array();
}

async function addReport(report, idCamera) {
    let reportObject = Report.withoutId(pool, report);
    await reportObject.insert();
    let userObject = User.systemUser(pool);
    const roleUser = await userObject.getUserRole(reportObject.duty);
    if (roleUser.toLowerCase() !== 'system') {
        const notificationObject = Notification.emptyNotification(pool);
        await notificationObject.updateNotificationStatusProcessed(idCamera);
    }
}

async function generateReport(idCamera) {
    /// Отвечает непосредственно за заполнение некоторых полей отчета и вызывает функцию addReport
    const notificationObject = Notification.emptyNotification(pool);
    const result = await notificationObject.getLatestNotificationFromCamera(idCamera);
    const count_notifi = result.rowCount;
    const info_last_notification = result.rows[0];
    let information_incidents = '';
    let number_incident = -1;
    let datetime = new Date().toISOString().replaceAll(/[A-Z]/g, ' ');
    if (Number(count_notifi) === 0 || info_last_notification.captured_image.length === 0) {
        information_incidents = `За прошедшее время не поступили уведомления о возможных признаках возгорания.`;
        const notification = {
            'camera_data': idCamera,
            'datetime': datetime,
            'events': {'Camera_event': 'Был сформирован отчет на основании событийного триггера.'},
            'Image': ''
        };
        number_incident = Number(await saveRecord(JSON.stringify(notification)));
    }
    else {
        const notification_status = info_last_notification.report_compiled === 't' ? 'было обработано' : 'еще не было обработано';
        information_incidents = `За прошедшее время поступило уведомление о возможных признаках возгорания.\nБыли распознаны следующие признаки: ${info_last_notification.type_event}.\nВремя оповещения: ${info_last_notification.datetime}.\nПри этом данное событие ${notification_status} диспетчером.`;
        number_incident = info_last_notification.incident_id;
        // datetime = datetime;
    }
    let userObject = User.systemUser(pool);
    const dutyId = await userObject.searchSystemUser();
    const report = {
        'event_based': true,
        'number_incident': number_incident,
        'datetime': datetime,
        'duty': dutyId,
        'description': `Данный отчет был автоматически создан системой, в результате срабатывания событийного триггера. ${information_incidents}`,
        'measures_taken': '',
        'consequences': '',
        'conclusion': ''
    };
    if (Number(count_notifi) === 0) await updateReport(report);
    else await addReport(report, Number(idCamera));
}

async function generateReports(idCamera) {
    /// Создание отчета по нескольким камерам
    const notificationObject = Notification.emptyNotification(pool);
    const info_last_notifications = await notificationObject.getLatestNotificationsFromCameras();
    let information_incidents = '';
    let number_incident = -1;
    let datetime = new Date().toISOString().replaceAll(/[A-Z]/g, ' ');

    const notification = {
        'camera_data': idCamera,
        'datetime': datetime,
        'events': {'Camera_event': 'Был сформирован отчет на основании событийного триггера.'},
        'Image': ''
    };
    number_incident = Number(await saveRecord(JSON.stringify(notification)));

    for (let i = 0; i < info_last_notifications.length; i++) {
        information_incidents += `\nКамера №${info_last_notifications[i].camera_data}:\nЗа прошедшее время поступило уведомление: "${info_last_notifications[i].type_event}".\nВремя оповещения: ${info_last_notifications[i].datetime}.`;
    }
    if (information_incidents.length === 0) {
        information_incidents = 'На данный момент нет никаких уведомлений с камер наблюдения!';
    }

    let userObject = User.systemUser(pool);
    const dutyId = await userObject.searchSystemUser();
    const report = {
        'event_based': true,
        'number_incident': number_incident,
        'datetime': datetime,
        'duty': dutyId,
        'description': `Данный отчет был автоматически создан системой, в результате срабатывания событийного триггера. ${information_incidents}`,
        'measures_taken': '',
        'consequences': '',
        'conclusion': ''
    };
    await addReport(report, Number(idCamera));
}

async function updateReport(newReport) {
    let reportObject = Report.withoutId(pool, newReport);
    await reportObject.update();
}

// TODO: Сделать страницу под функцию! Проверить!
async function getReport(name_camera = null, dateTimeBeginning = null, dateTimeEnding = null) {
    if (name_camera || dateTimeBeginning) {
        if (!dateTimeEnding) dateTimeEnding = Date.now();
        let notificationObject = Notification.emptyNotification(pool);
        return await notificationObject.searchReportCameraNameAndDate(name_camera, dateTimeBeginning, dateTimeEnding);
    }
    return new Array();
}

module.exports = {
    getUserById,
    getUserByLogin,
    registerUser,
    profileUpdate,
    getListUsersWithRoles,
    changeRoles,
    saveRecord,
    getRecord,
    registerCamera,
    getListSources,
    infoCamera,
    getEventTriggers,
    addEventTrigger,
    generateReport,
    generateReports
}