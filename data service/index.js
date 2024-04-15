//@ts-check
/*
TODO: Задачи сервиса обработки данных.
1) Поиск записей; +
2) Получение отчетов; +
3) (Возможно) Полноценный CRUD.
*/
/*
 [=========================================================]
 [                       Сервер                            ]
 [=========================================================]
*/
const databaseManager = require('./database_manager');

const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

app.listen(port, () => { console.log(`App running on port ${port}.`) });

app.get('/', (request, response) => {
  response.json({ info: 'Сервис по обработке данных из Kafka' });
});


app.post('/registerCamera', async (request, response) => {
  databaseManager.registerCamera(request, response);
  await consumer.disconnect();
  await run();
});

app.get('/infoCamera', (request, response) => databaseManager.infoCamera(request, response));

app.get('/getListSources', async (request, response) => {
  const listSources = await databaseManager.getListSources();
  response.json(listSources);
});

app.get('/getUserById', (request, response) => databaseManager.getUserById(request, response));
app.get('/getUserByLogin', (request, response) => databaseManager.getUserByLogin(request, response));
app.post('/registerUser', (request, response) => databaseManager.registerUser(request, response));
app.post('/profileUpdate', (request, response) => databaseManager.profileUpdate(request, response));
app.get('/userRoles', (request, response) => databaseManager.getListUsersWithRoles(request, response));
app.post('/changeRoles', (request, response) => databaseManager.changeRoles(request, response));
app.get('/getEventTriggerById', (request, response) => databaseManager.getEventTriggerById(request, response));
app.post('/deleteEventTriggerById', (request, response) => databaseManager.deleteEventTriggerById(request, response));


app.get('/getEventTriggers', async (request, response) => await databaseManager.getEventTriggers(request, response));
app.get('/addEventTrigger', async (request, response) => await databaseManager.addEventTrigger(request, response));

app.get('/generateReport', async (request, response) => {
  const idCamera = request.body['idCamera'];
  await databaseManager.generateReport(idCamera);
  response.json({'status': 'Отчет успешно создан'});
});

app.get('/generateReports', async (request, response) => {
  const idCamera = request.body['idCamera'];
  await databaseManager.generateReports(idCamera);
  response.json({'status': 'Отчет успешно создан'});
});

// TODO: Рабочий вариант! Потом доработать до полноценноценной страницы просмотра данных с БД!
app.get('/getFrame', (request, response) => {
  let message = databaseManager.getRecord();
  if (message.length !== 0) {
    let obj = JSON.parse(message);
    response.render("renderFrame.hbs", {Image: obj.Image});
  }
  else {
    response.json({info: 'Все спокойно'});
  }
});

/*
 [=========================================================]
 [                       Kafka                             ]
 [=========================================================]
*/
// FIXME: есть проблема с запуском! Нужно запускать только после инициализации Kafka!
const { Kafka } = require('kafkajs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const clientId = process.env.KAFKA_CLIENT_ID;
const brokers = [process.env.KAFKA_DEFAULT_BROKER];
 
const kafka = new Kafka({ clientId: clientId, brokers: brokers });
const consumer = kafka.consumer({ groupId: clientId });

run();

async function run() {
  ///  Получаем список топиков
  const listSources = await databaseManager.getListSources();
  const topics = listSources.map(item => item.name);

  await consumer.connect();
  await consumer.subscribe({ topics: topics });
  await consumer.run({
    eachMessage: async ({ message }) => {
      const contextMessage = message.value.toString();
      await databaseManager.saveRecord(contextMessage);
    },
  });
}