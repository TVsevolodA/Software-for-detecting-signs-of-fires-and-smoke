//@ts-check
const reportManager = require('./report_manager');

const express = require('express')
const bodyParser = require('body-parser')
const app = express()
const port = 4000

app.use(bodyParser.json())
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
)

app.listen(port, () => {
console.log(`App running on port ${port}.`)
})

app.get('/', (request, response) => {
  console.log('Запрос получен!');
  response.json({ info: 'Сервис обработки отчетов' });
});

app.get('/getReportById/:id', (request, response) => reportManager.getReportById(request, response));
app.get('/getReports',    (request, response) => reportManager.getReports(request, response));
app.post('/createReport', (request, response) => reportManager.createReport(request, response));
app.post('/updateReport', (request, response) => reportManager.updateReport(request, response));