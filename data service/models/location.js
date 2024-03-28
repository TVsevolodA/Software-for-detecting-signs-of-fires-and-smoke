//@ts-check

module.exports= class Location{
    constructor(db, location_data) {
        this.pool = db;
        this.location_id = location_data.location_id;
        this.longitude = location_data.longitude;
        this.latitude = location_data.latitude;
        this.address = location_data.address;
    }

    static withoutId(db, location_data) { 
        location_data.location_id = -1;
        return new Location(db, location_data);
    }

    async insertWithReturnId() {
        return (await this.pool.query('INSERT INTO location_cameras (longitude, latitude, address) VALUES ($1, $2, $3) RETURNING location_id;', [this.longitude, this.longitude, this.address])).rows[0].location_id;
    }
}