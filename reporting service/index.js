//@ts-check
const reportManager = require('./report_manager');

const express = require('express')
const path = require('path')
const bodyParser = require('body-parser')
const app = express()
const port = 4000
const urlencodedParser = express.urlencoded({extended: false});
const session = require('express-session');

app.use(bodyParser.json())
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
)
app.use(
  session({
      secret: 'secret!',
      saveUninitialized: true,
  })
)

app.listen(port, () => {
console.log(`App running on port ${port}.`)
})

app.use('/images', express.static(path.join(__dirname, 'images')))

app.get('/', (request, response) => {
  console.log('Запрос получен!');
  response.json({ info: 'Сервис обработки отчетов' });
});

app.get('/getReportById/:id', (request, response) => reportManager.getReportById(request, response));
app.post('/getReports',    (request, response) => reportManager.getReports(request, response));
app.get('/getReports/:id/:username/:role',    (request, response) => reportManager.getReports(request, response));
app.get('/getReports',    (request, response) => reportManager.getReports(request, response));
app.get('/updateReport/:id', (request, response) => reportManager.updateReport(request, response));
app.post('/updateReport/:id', urlencodedParser, (request, response) => reportManager.updateReport(request, response));

app.use(function(req,res){
  res.status(404).render('error404.hbs');
});

app.use(function(req,res){
  res.status(500).render('error500.hbs');
});