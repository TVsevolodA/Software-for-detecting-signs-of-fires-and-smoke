import requests
import json

class Scheduler():
    def __init__(self, scheduler):
        self.scheduler = scheduler
        self.actions = {
            'generateReport': self.__generate_report,
            'collectStatisticsCameras': self.__collect_camera_statistics,
            'collectStatisticsServer': self.__collect_server_statistics,
            'checkingSystem': self.__checking_system,
            'notify': self.__notification
            }
        self.time_converter ={
            'second': 1,
            'minute': 60,
            'hour': 60*60,
            'day': 24*60*60,
            'week': 7*24*60*60,
            'month': 4.285714286*7*24*60*60
        }
        self.get_saved_triggers()

    def get_saved_triggers(self):
        req = requests.get('http://data_service_sm:3000/getEventTriggers')
        triggers = json.loads(req.text)
        for trigger in triggers:
            self.add_task(trigger, availability_in_db=True)

    def add_task(self, info_trigger, availability_in_db=False):
        if not availability_in_db:
            req = requests.get('http://data_service_sm:3000/addEventTrigger', json=info_trigger)
            dict_req = json.loads(req.text)
            id_event = str(dict_req['id_event'])
        else:
            id_event = str(info_trigger['id_trigger'])
        action = info_trigger['action']
        args = self.get_necessary_arguments(info_trigger, action)
        if info_trigger['recurring_event'] == 't':
          timeIntervalFrequency = info_trigger['timeIntervalFrequency']
          seconds = self.time_converter[timeIntervalFrequency] / int(info_trigger['frequency'])
          self.scheduler.add_job(id=id_event, func=self.actions[action], args=args, trigger='interval', seconds=seconds)
        else:
          date_event = info_trigger['date_event']
          self.scheduler.add_job(id=id_event, func=self.actions[action], args=args, trigger='date', run_date=date_event, timezone='UTC')

    def get_necessary_arguments(self, trigger, action):
        args_action = {
            'generateReport': trigger['idCamera'],
            'collectStatisticsCameras': trigger['idCamera'],
            # TODO: дописать аргументы для остальных действий
            # 'collectStatisticsServer': self.__collect_server_statistics,
            # 'checkingSystem': self.__checking_system,
            # 'notify': self.__notification
            }
        return tuple(args_action[action])

    def get_tasks(self):
        # TODO: получение списка событий из БД
        pass

    def get_tasks(self, id):
        # TODO: получение события из БД
        pass

    def set_task(self, id):
        # TODO: Изменить триггер (Возможно пока не делать)
        pass

    def __generate_report(self, idCamera):
        """
        Сформировать отчет по одной камере
        """
        requests.get('http://data_service_sm:3000/generateReport', json={'idCamera': idCamera})

    def __collect_camera_statistics(self, idCamera):
        """
        Собрать статистику с камер
        """
        requests.get('http://data_service_sm:3000/generateReports', json={'idCamera': idCamera})

    def __collect_server_statistics(self,):
        # Собрать статистику с сервера
        pass

    def __checking_system(self,):
        # Проверка системы
        pass

    def __notification(self,):
        # Оповещение
        pass


