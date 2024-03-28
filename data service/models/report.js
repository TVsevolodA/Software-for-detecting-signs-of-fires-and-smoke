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

    async insert() {
        await this.pool.query(`INSERT INTO reports (
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
                this.event_based,
                this.number_incident,
                this.datetime,
                this.duty,
                this.description,
                this.measures_taken,
                this.consequences,
                this.conclusion
            ]);
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