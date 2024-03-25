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
    const numberMatches = (await pool.query(`SELECT FROM notifications WHERE camera_data = $1 AND NOT report_compiled;`, [camera_data])).rowCount;
    console.log(`Получили записей из бд: ${numberMatches}`);
    if (Number(numberMatches) > 0) {
        await pool.query(`UPDATE notifications SET datetime = $2, type_event = $3, captured_image = $4 WHERE camera_data = $1 AND NOT report_compiled;`, [camera_data, datetime, type_event, captured_image]);
    }
    else {
        await pool.query(`INSERT INTO notifications (camera_data, datetime, type_event, captured_image) VALUES ($1, $2, $3, $4);`, [camera_data, datetime, type_event, captured_image]);
    }
}

function registerCamera(request, response) {
    const camera_data = request.body;
    const url_address = camera_data.url + '/sendCameraData';
    sendRequest(url_address, camera_data.url, response);
}

async function infoCamera(request, response) {
    const searchParameter = request.body.camera === 'all' ? null : request.body.camera;
    const cameraObjects = await pool.query(`
                                            SELECT name_camera, url_address, status, longitude, latitude, address
                                            FROM cameras as c
                                            JOIN location_cameras as l ON c.camera_location = l.location_id
                                            WHERE (c.name_camera = $1 OR $1 IS NULL);`,
                                            [searchParameter]);
    const cameras = cameraObjects.rows.map(row => ({
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

// TODO: создание отчета
// async function addReport() {
//     INSERT INTO reports (number_incident, datetime, duty, description, measures_taken, consequences, conclusion) VALUES (1, '01-01-2013 09:00:00', 1, 'пожар', 'пзд', 'еще пзд', 'хана');
//     UPDATE notifications SET report_compiled = TRUE WHERE camera_data = 1 AND NOT report_compiled;
// }

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
}