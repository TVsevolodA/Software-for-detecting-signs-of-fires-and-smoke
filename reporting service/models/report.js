//@ts-check

module.exports= class Report{
    constructor(db, report_data) {
        this.pool = db;
        this.report_id = report_data.report_id;
        this.event_based = report_data.event_based;
        this.number_incident = report_data.number_incident;
        this.datetime = report_data.datetime;
        this.duty = report_data.duty;
        this.description = report_data.description;
        this.measures_taken = report_data.measures_taken;
        this.consequences = report_data.consequences;
        this.conclusion = report_data.conclusion;
    }

    static withoutId(db, report_data) { 
        report_data.report_id = -1;
        return new Report(db, report_data);
    }

    static emptyReport(db) {
        let report_data = {};
        report_data.report_id = -1;
        report_data.event_based = '';
        report_data.number_incident = '';
        report_data.datetime = '';
        report_data.duty = 'system';
        report_data.description = '';
        report_data.measures_taken = '';
        report_data.consequences = '';
        report_data.conclusion = '';
        return new Report(db, report_data);
    }

    async insertWithReturnId() {
        return (await this.pool.query(`INSERT INTO reports (
            event_based,
            number_incident,
            datetime,
            duty,
            description,
            measures_taken,
            consequences,
            conclusion)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING report_id;`,
            [
                this.event_based,
                this.number_incident,
                this.datetime,
                this.duty,
                this.description,
                this.measures_taken,
                this.consequences,
                this.conclusion
            ])).rows[0].report_id;;
    }

    async getReportById(report_id) {
        return (await this.pool.query(`
        SELECT *
        FROM reports as r
        JOIN notifications as n ON r.number_incident = n.incident_id
        JOIN cameras as c ON n.camera_data = c.camera_id
        JOIN location_cameras as l ON l.location_id = c.camera_location
        JOIN users as u ON u.user_id = r.duty
        WHERE report_id = $1;`, [report_id])).rows[0];
    }

    async getReports() {
        return (await this.pool.query(`
        SELECT report_id, name_camera, address, r.datetime, type_event, captured_image, report_compiled
        FROM reports as r
        JOIN notifications as n ON r.number_incident = n.incident_id
        JOIN cameras as c ON n.camera_data = c.camera_id
        JOIN location_cameras as l ON l.location_id = c.camera_location;`)).rows;
    }

    async update() {
        await this.pool.query(`UPDATE reports
        SET
        datetime = $1,
        description = $2,
        measures_taken = $3,
        consequences = $4,
        conclusion = $5
        WHERE number_incident = $6 AND event_based IS NOT TRUE`,
        [
            this.datetime,
            this.description,
            this.measures_taken,
            this.consequences,
            this.conclusion,
            this.number_incident
        ]);
    }
}