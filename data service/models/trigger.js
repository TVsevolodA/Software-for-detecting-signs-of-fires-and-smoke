//@ts-check

module.exports= class Trigger{
    constructor(db, trigger_data) {
        this.pool = db;
        this.trigger_id = trigger_data.trigger_id;
        this.idCamera = trigger_data.idCamera;
        this.title = trigger_data.title;
        this.description = trigger_data.description;
        this.recurring_event = trigger_data.recurring_event;
        this.date_event = trigger_data.date_event;
        this.frequency = trigger_data.frequency;
        this.time_interval_frequency = trigger_data.timeIntervalFrequency;
        // this.duration = trigger_data.duration;
        // this.time_interval_duration = trigger_data.timeIntervalDuration;
        this.action = trigger_data.action;
    }

    static withoutId(db, trigger_data) { 
        trigger_data.trigger_id = -1;
        return new Trigger(db, trigger_data);
    }

    static emptyTrigger(db) {
        let trigger_data = {};
        trigger_data.trigger_id = '';
        trigger_data.idCamera = '';
        trigger_data.title = '';
        trigger_data.description = '';
        trigger_data.recurring_event = '';
        trigger_data.date_event = '';
        trigger_data.frequency = '';
        trigger_data.time_interval_frequency = '';
        // trigger_data.duration = '';
        // trigger_data.time_interval_duration = '';
        trigger_data.action = '';
        return new Trigger(db, trigger_data);
    }

    async getEventById(id) {
        const triggerObjects = (await this.pool.query(`
        SELECT * FROM triggers as t
        JOIN cameras as c ON c.camera_id = t.idcamera
        JOIN location_cameras as l ON c.camera_location = l.location_id
        WHERE t.trigger_id = $1;
        `, [id])).rows[0];
        // const trigger = triggerObjects.rows.map(row => ({
        //     id_trigger: row.trigger_id,
        //     idCamera: String(row.idcamera),
        //     title: row.title,
        //     description: row.description,
        //     recurring_event: row.recurring_event === false ? 'f' : 't',
        //     date_event: row.date_event,
        //     frequency: row.frequency,
        //     timeIntervalFrequency: row.time_interval_frequency,
        //     action: row.action,
        //     nameCamera: row.name_camera,
        //     urlAddress: row.url_address,
        //     longitude: row.longitude,
        //     latitude: row.latitude,
        //     address: row.address,
        // }));
        return triggerObjects;
    }

    async getListTriggers() {
        const triggerObjects = await this.pool.query('SELECT * FROM triggers;');
        const triggers = triggerObjects.rows.map(row => ({
            id_trigger: row.trigger_id,
            idCamera: String(row.idcamera),
            title: row.title,
            description: row.description,
            recurring_event: row.recurring_event === false ? 'f' : 't',
            date_event: row.date_event,
            frequency: row.frequency,
            timeIntervalFrequency: row.time_interval_frequency,
            // duration: row.duration,
            // timeIntervalDuration: row.time_interval_duration,
            action: row.action,
        }));
        return triggers;
    }

    async insertWithReturnId() {
        if (this.date_event === '') {
            this.date_event = null;
        }
        return (await this.pool.query(`INSERT INTO triggers (
            idCamera,
            title,
            description,
            recurring_event,
            date_event,
            frequency,
            time_interval_frequency,
            action
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING trigger_id;`,
            [
                this.idCamera,
                this.title,
                this.description,
                this.recurring_event,
                this.date_event,
                Number(this.frequency),
                this.time_interval_frequency,
                // this.duration,
                // this.time_interval_duration,
                this.action
            ]));
    }

    async deleteEventById(id) {
        this.pool.query('DELETE FROM triggers WHERE trigger_id = $1', [id]);
    }
}