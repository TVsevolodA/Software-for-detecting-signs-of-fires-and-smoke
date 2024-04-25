//@ts-check

module.exports= class Notification{
    constructor(db, notification_data) {
        this.pool = db;
        this.incident_id = notification_data.incident_id;
        this.camera_data = notification_data.camera_data;
        this.datetime = notification_data.datetime;
        this.captured_image = notification_data.Image;
        this.report_compiled = notification_data.report_compiled;

        const events = new Map([
            ['Fire', notification_data.Пожар], //Fire
            ['Smoke', notification_data.Задымление], //Smoke
            ['Camera_event', notification_data.Camera_event],
        ]);
      
        let type_event = '';
        for (const [key, value] of events)
            if (value) type_event += key + ': ' + value + ', ';
        this.type_event = type_event.substring(0, type_event.length - 1);
    }

    static withoutId(db, notification_data) { 
        notification_data.incident_id = -1;
        return new Notification(db, notification_data);
    }

    static emptyNotification(db) {
        let notification_data = {};
        notification_data.incident_id = '';
        notification_data.camera_data = '';
        notification_data.datetime = '';
        notification_data.captured_image = '';
        notification_data.report_compiled = '';
        return new Notification(db, notification_data);
    }

    async insertWithReturnId() {
        return (await this.pool.query(`INSERT INTO notifications (camera_data, datetime, type_event, captured_image) VALUES ($1, $2, $3, $4) RETURNING incident_id;`, [this.camera_data, this.datetime, this.type_event, this.captured_image])).rows[0].incident_id;
    }

    async updateWithReturnId() {
        if (this.captured_image.length !== 0) {
            return await this.pool.query(`UPDATE notifications SET datetime = $2, type_event = $3, captured_image = $4 WHERE camera_data = $1 AND NOT report_compiled;`, [this.camera_data, this.datetime, this.type_event, this.captured_image]);
        }
    }

    async updateNotificationStatusProcessed(camera_data) {
        await this.pool.query(`UPDATE notifications
                                SET report_compiled = TRUE
                                WHERE camera_data = $1 AND NOT report_compiled;`,
                                [camera_data]);
    }

    async updateOrInsertEntry() {
        let incident_id = -1;
        let completedOperation = 'create';
        let incidents = await this.searchNumberEntriesCameraAndEmptyReport();
        const numberMatches = incidents.rowCount;
        if (Number(numberMatches) > 0) {
            await this.updateWithReturnId();
            incident_id = incidents.rows[0].incident_id;
            completedOperation = 'update';
        }
        else {
            incident_id = await this.insertWithReturnId();
            completedOperation = 'create';
        }
        return [incident_id, completedOperation];
    }

    async searchNumberEntriesCameraAndEmptyReport() {
        return await this.pool.query(`SELECT * FROM notifications WHERE camera_data = $1 AND NOT report_compiled;`, [this.camera_data]);
    }

    async getLatestNotificationFromCamera(camera_data) {
        return await this.pool.query("SELECT * FROM notifications WHERE camera_data = $1 ORDER BY datetime DESC LIMIT 1;", [camera_data]);
    }

    async getLatestNotificationsFromCameras() {
        return (await this.pool.query(`SELECT * FROM (
                                                    SELECT
                                                            DISTINCT ON (camera_data) camera_data,
                                                            incident_id,
                                                            datetime,
                                                            type_event,
                                                            captured_image,
                                                            report_compiled
                                                    FROM notifications
                                                    ORDER BY camera_data, datetime DESC
                                                    ) ORDER BY datetime;`)).rows;
    }

    async searchNotificationCameraNameorDate(name_camera, dateTime) {
        const recordObjects = await this.pool.query(
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

    async searchReportCameraNameAndDate(name_camera, dateTimeBeginning, dateTimeEnding) {
        const reportObjects = await this.pool.query(
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
}