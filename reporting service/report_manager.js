//@ts-check
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

const Report = require('./models/report.js');

async function getReportById(request, response) {
    const report_id = parseInt(request.params.id);
    let reportObject = Report.emptyReport(pool);
    const report = (await reportObject.getReportById(report_id));
    if (report !== undefined) {
        response.status(200).json(report);
    } else {
        response.status(404).json({'error': 'Не удалось найти отчет с данным идентификатором.'});
    }
}

async function getReports(request, response) {
    console.log(request.session);
    // console.log(`${request.body}`);
    let reportObject = Report.emptyReport(pool);
    const reports = (await reportObject.getReports());
    response.render("reports.hbs", {"reports": JSON.stringify(reports)});
}

async function updateReport(request, response) {
    if (request.method === 'GET') {
        const report_id = parseInt(request.params.id);
        let reportObject = Report.emptyReport(pool);
        const report = (await reportObject.getReportById(report_id));
        response.render("report.hbs", {"report": JSON.stringify(report)});
    }
    else {
        // TODO: нужно обновить информацию в отчете + уведомлении!
        console.log(request.body);
        // const report = request.body.report;
        // let reportObject = new Report(pool, report);
        // reportObject.update();
        response.status(200).json({"result": "Данные отчета успешно обновлены"});
    }
}

module.exports = {
    getReportById,
    getReports,
    updateReport
}