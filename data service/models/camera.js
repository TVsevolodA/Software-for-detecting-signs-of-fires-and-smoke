//@ts-check

module.exports= class Camera{
    constructor(db, camera_data) {
        this.pool = db;
        this.camera_id = camera_data.camera_id;
        this.name_camera = camera_data.name_camera;
        this.camera_location = camera_data.camera_location;
        this.url_address = camera_data.url_address;
        this.status = camera_data.status;
    }

    static withoutId(db, camera_data) { 
        camera_data.camera_id = -1;
        return new Camera(db, camera_data);
    }

    static emptyCamera(db) {
        let camera_data = {};
        camera_data.camera_id = -1;
        camera_data.name_camera = '';
        camera_data.camera_location = -1;
        camera_data.url_address = '';
        camera_data.status = false;
        return new Camera(db, camera_data);
    }

    async insertWithReturnId() {
        return (await this.pool.query('INSERT INTO cameras (name_camera, camera_location, url_address, status) VALUES ($1, $2, $3, $4) RETURNING camera_id;', [this.name_camera, this.camera_location, this.url_address, this.status])).rows[0].camera_id;
    }

    async getListCameras() {
        const sourceObjects = await this.pool.query('SELECT camera_id, url_address, name_camera FROM cameras');
        const sources = sourceObjects.rows.map(row => ({
            index: row.camera_id,
            url: row.url_address,
            name: row.name_camera,
        }));
        return sources;
    }

    async requestInformationCamera(name_camera) {
        const cameraObjects = await this.pool.query(`
                                SELECT camera_id, name_camera, url_address, status, longitude, latitude, address
                                FROM cameras as c
                                JOIN location_cameras as l ON c.camera_location = l.location_id
                                WHERE (c.name_camera = $1 OR $1 IS NULL);`,
                                [name_camera]);
        const cameras = cameraObjects.rows.map(row => ({
            id: row.camera_id,
            name: row.name_camera,
            url: row.url_address,
            status: row.status ? 'Работает' : 'Не работает',
            longitude: row.longitude,
            latitude: row.latitude,
            address: row.address,
        }));
        return cameras;
    }
}