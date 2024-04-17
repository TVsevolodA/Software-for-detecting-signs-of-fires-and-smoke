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

const Report = require('./models/report.js');

async function getReportById(request, response) {
    const report_id = parseInt(request.params.id);
    let reportObject = Report.emptyReport(pool);
    const report = (await reportObject.getReportById(report_id));
    if (report !== undefined) response.render("viewingReport.hbs", {"report": JSON.stringify(report), "user": request.session.user});
    else response.status(404).json({'error': 'Не удалось найти отчет с данным идентификатором.'});
}

async function getReports(request, response) {
    const user_id = request.params.id;
    const username = request.params.username;
    if(user_id && username) {
        request.session.user = JSON.stringify({'id': user_id, 'name': username});
        let reportObject = Report.emptyReport(pool);
        const reports = (await reportObject.getReports());
        response.render("reports.hbs", {"reports": JSON.stringify(reports)});
    }
    else response.redirect("http://localhost:5050/login");
}

async function updateReport(request, response) {
    if (request.method === 'GET') {
        const report_id = parseInt(request.params.id);
        let reportObject = Report.emptyReport(pool);
        const report = (await reportObject.getReportById(report_id));
        response.render("report.hbs", {"report": JSON.stringify(report), "user": request.session.user});
    }
    else {
        const user_id = request.body.id;
        const username = request.body.name;
        const report = request.body;
        let reportObject = new Report(pool, report);
        reportObject.update();
        response.redirect(`/getReports/${user_id}/${username}`);
    }
}

module.exports = {
    getReportById,
    getReports,
    updateReport
}