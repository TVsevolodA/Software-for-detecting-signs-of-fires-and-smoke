//@ts-check
const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const Pool = require('pg').Pool
let types = require('pg').types;
types.setTypeParser(1114, function(stringValue) {return stringValue;});
const pool = new Pool({
    user: process.env.POSTGRES_USER,
    host: process.env.DB_HOST,
    database: process.env.POSTGRES_DB,
    password: process.env.POSTGRES_PASSWORD,
    port: 5432,
})

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
        const res_reg_location = await pool.query('INSERT INTO location_cameras (longitude, latitude, address) VALUES ($1, $2, $3) RETURNING location_id;', [location.longitude, location.latitude, location.address]);
        const camera_location = res_reg_location.rows[0].location_id;

        const res_reg_camera = await pool.query('INSERT INTO cameras (name_camera, camera_location, url_address, status) VALUES ($1, $2, $3, $4) RETURNING camera_id;', [name_camera, camera_location, host, status]);
        const camera_id = res_reg_camera.rows[0].camera_id;
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

async function saveRecord (msg) {
    // TODO: Для отладки
    message = msg;

    // TODO: добавить передаваемое поле duty (дежурный), для оформления записи в отчете!
    const obj = JSON.parse(msg);
    const camera_data = obj.camera_data;
    const datetime = obj.datetime;
    const events = new Map([
        ['Fire', obj.Fire],
        ['Smoke', obj.Smoke],
        ['Camera_event', obj.camera_event],
      ]);
      
    let type_event = '';
    for (const [key, value] of events)
        if (value) type_event += key + ': ' + value + ', ';
    const captured_image = obj.Image;
    type_event = type_event.substring(0, type_event.length - 1);
    const incidents = await pool.query(`SELECT * FROM notifications WHERE camera_data = $1 AND NOT report_compiled;`, [camera_data]);
    const numberMatches = incidents.rowCount;

    let incidentId;
    let type_action_report;
    if (Number(numberMatches) > 0) {
        await pool.query(`UPDATE notifications SET datetime = $2, type_event = $3, captured_image = $4 WHERE camera_data = $1 AND NOT report_compiled;`, [camera_data, datetime, type_event, captured_image]);
        incidentId = incidents.rows[0].incident_id;
        type_action_report = 'update';
    }
    else {
        const db_res = await pool.query(`INSERT INTO notifications (camera_data, datetime, type_event, captured_image) VALUES ($1, $2, $3, $4) RETURNING incident_id;`, [camera_data, datetime, type_event, captured_image]);
        incidentId = db_res.rows[0].incident_id;
        type_action_report = 'create';
    }
    const dutyId = (await pool.query("SELECT user_id FROM users WHERE role = 'system';")).rows[0].user_id;
    const report = {
        'event_based': false,
        'number_incident': incidentId,
        'datetime': datetime,
        'duty': dutyId,
        'description': type_event,
        'measures_taken': '',
        'consequences': '',
        'conclusion': ''
    };
    if (type_action_report === 'update') updateReport(report);
    else addReport(report, camera_data);
    return incidentId;
}

function registerCamera(request, response) {
    const camera_data = request.body;
    const url_address = camera_data.url + '/sendCameraData';
    sendRequest(url_address, camera_data.url, response);
}

async function infoCamera(request, response) {
    const searchParameter = request.body.camera === 'all' ? null : request.body.camera;
    const cameraObjects = await pool.query(`
                                            SELECT camera_id, name_camera, url_address, status, longitude, latitude, address
                                            FROM cameras as c
                                            JOIN location_cameras as l ON c.camera_location = l.location_id
                                            WHERE (c.name_camera = $1 OR $1 IS NULL);`,
                                            [searchParameter]);
    const cameras = cameraObjects.rows.map(row => ({
        id: row.camera_id,
        name: row.name_camera,
        url: row.url_address,
        status: row.status ? 'Работает' : 'Не работает',
        longitude: row.longitude,
        latitude: row.latitude,
        address: row.address,
    }));
    response.status(200).json(cameras);
}

async function getListSources() {
    const sourceObjects = await pool.query('SELECT camera_id, url_address, name_camera FROM cameras');
    const sources = sourceObjects.rows.map(row => ({
        index: row.camera_id,
        url: row.url_address,
        name: row.name_camera,
    }));
    return sources;
}

async function addEventTrigger(request, response) {
    const trigger = request.body;
    const idCamera = trigger['idCamera'];
    const title = trigger['title'];
    const description = trigger['description'];
    const recurring_event = trigger['recurring_event'] === 'True';
    const dateTrigger = trigger['date_event'];
    const date_event = (dateTrigger === null || dateTrigger.length === 0) ? null : dateTrigger;
    const frequency = Number(trigger['frequency']);
    const timeIntervalFrequency = trigger['timeIntervalFrequency'];
    const duration = Number(trigger['duration']);
    const timeIntervalDuration = trigger['timeIntervalDuration'];
    const action = trigger['action'];
    const resAddTrigger = await pool.query(`INSERT INTO triggers (
        idCamera,
        title,
        description,
        recurring_event,
        date_event,
        frequency,
        time_interval_frequency,
        duration,
        time_interval_duration,
        action
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING trigger_id;`,
        [
            idCamera,
            title,
            description,
            recurring_event,
            date_event,
            frequency,
            timeIntervalFrequency,
            duration,
            timeIntervalDuration,
            action
        ]);
    const id_trigger = resAddTrigger.rows[0].trigger_id;
    response.status(201).json({'id_event': id_trigger});
}

async function getEventTriggers(request, response) {
    const triggerObjects = await pool.query('SELECT * FROM triggers');
    const triggers = triggerObjects.rows.map(row => ({
        id_trigger: row.trigger_id,
        idCamera: row.idCamera,
        title: row.title,
        description: row.description,
        recurring_event: row.recurring_event,
        date_event: row.date_event,
        frequency: row.frequency,
        timeIntervalFrequency: row.time_interval_frequency,
        duration: row.duration,
        timeIntervalDuration: row.time_interval_duration,
        action: row.action,
    }));
    response.status(200).json(triggers);
}


/// Поиск записи по расписанию или времени
// TODO: Сделать страницу под функцию! Проверить все комбинации: оба null, только один null, ни один не null.
async function recordSearch(name_camera = null, dateTime = null) {
    if (name_camera || dateTime) {
        const recordObjects = await pool.query(
            `SELECT name_camera, address, url_address, datetime, type_event, captured_image
            FROM cameras as c
            JOIN location_cameras as l ON c.camera_location = l.location_id
            JOIN notifications as n ON c.camera_id = n.camera_data
            WHERE
                    (c.name_camera = $1 OR $1 IS NULL)
                    AND
                    (n.datetime = $2 OR $2 IS NULL)
            ;`,
            [name_camera, dateTime]);
        const records = recordObjects.rows.map(row => ({
            name_camera: row.name_camera,
            url_address: row.url_address,
            datetime: row.datetime,
            type_event: row.type_event,
            captured_image: row.captured_image,
        }));
        return records;
    }
    return new Array();
}

async function addReport(report, idCamera) {
    pool.query(`INSERT INTO reports (
        event_based,
        number_incident,
        datetime,
        duty,
        description,
        measures_taken,
        consequences,
        conclusion)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
        [
            report['event_based'],
            report['number_incident'],
            report['datetime'],
            report['duty'],
            report['description'],
            report['measures_taken'],
            report['consequences'],
            report['conclusion']
        ]);
    const roleUser = (await pool.query("SELECT role FROM users WHERE user_id = $1;", [report['duty']])).rows[0].role;
    if (roleUser.toLowerCase() !== 'system')
        await pool.query(`UPDATE notifications
                        SET report_compiled = TRUE
                        WHERE camera_data = $1 AND NOT report_compiled;`,
                        [idCamera]);
}

async function generateReport(idCamera) {
    /// Отвечает непосредственно за заполнение некоторых полей отчета и вызывает функцию addReport
    const result = await pool.query("SELECT incident_id, datetime, type_event, report_compiled FROM notifications WHERE camera_data = $1 ORDER BY datetime DESC LIMIT 1;", [idCamera]);
    const count_notifi = result.rowCount;
    const info_last_notification = result.rows[0];
    let information_incidents = '';
    let number_incident = -1;
    let datetime = new Date().toISOString().replaceAll(/[A-Z]/g, ' ');
    if (Number(count_notifi) === 0) {
        information_incidents = `За прошедшее время не поступили уведомления о возможных признаках возгорания.`;
        const notification = {
            'camera_data': idCamera,
            'datetime': datetime,
            'events': {'Camera_event': 'Был сформирован отчет на основании событийного триггера.'},
            'Image': ''
        };
        number_incident = await saveRecord(JSON.stringify(notification));
    }
    else {
        const notification_status = info_last_notification.report_compiled === 't' ? 'было обработано' : 'еще не было обработано';
        information_incidents = `За прошедшее время поступило уведомление о возможных признаках возгорания.
        Были распознаны следующие признаки: ${info_last_notification.type_event}.\n
        Время оповещения: ${info_last_notification.datetime}.\n
        При этом данное событие ${notification_status} диспетчером.`;
        number_incident = info_last_notification.incident_id;
        datetime = datetime;
    }
    const dutyId = (await pool.query("SELECT user_id FROM users WHERE role = 'system';")).rows[0].user_id;
    const report = {
        'event_based': true,
        'number_incident': number_incident,
        'datetime': datetime,
        'duty': dutyId,
        'description': `Данный отчет был автоматически создан системой,
                        в результате срабатывания событийного триггера.
                        ${information_incidents}`,
        'measures_taken': '',
        'consequences': '',
        'conclusion': ''
    };
    await addReport(report, Number(idCamera));
    // if (Number(count_notifi) === 0) await addReport(report, Number(idCamera));
    // else await updateReport(report);
}

async function updateReport(newReport) {
    await pool.query(`UPDATE reports
    SET datetime = $1, description = $2, measures_taken = $3, consequences = $4, conclusion = $5
    WHERE number_incident = $6 AND event_based IS NOT TRUE`,
    [newReport['datetime'], newReport['description'], newReport['measures_taken'],
    newReport['consequences'], newReport['conclusion'], newReport['number_incident']]);
}

// TODO: Сделать страницу под функцию! Проверить!
async function getReport(name_camera = null, dateTimeBeginning = null, dateTimeEnding = null) {
    if (name_camera || dateTimeBeginning) {
        if (!dateTimeEnding) dateTimeEnding = Date.now();
        const reportObjects = await pool.query(
            `SELECT name_camera, datetime, type_event, captured_image FROM notifications as n JOIN cameras as c ON n.camera_data = c.camera_id
            WHERE
                    (datetime BETWEEN
                                        to_timestamp($2 / 1000.0)
                                        AND
                                        to_timestamp($3 / 1000.0)
                    )
                    AND
                    (c.name_camera = $1 OR $1 IS NULL)
            ;`,
            [name_camera, dateTimeBeginning, dateTimeEnding]);
        const reports = reportObjects.rows.map(row => ({
            name_camera: row.name_camera,
            datetime: row.datetime,
            type_event: row.type_event,
            captured_image: row.captured_image,
        }));
        return reports;
    }
    return new Array();
}

module.exports = {
    saveRecord,
    getRecord,
    registerCamera,
    getListSources,
    infoCamera,
    getEventTriggers,
    addEventTrigger,
    generateReport,
}