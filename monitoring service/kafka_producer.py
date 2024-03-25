import os
from kafka.admin import KafkaAdminClient, NewTopic
from kafka import KafkaProducer

class Producer(object):
    def __init__(self):
        self.BROKER = os.getenv("KAFKA_DEFAULT_BROKER")
        self.producer = KafkaProducer(bootstrap_servers = self.BROKER)
        self.admin_client = KafkaAdminClient(bootstrap_servers=self.BROKER)

    def get_topics(self):
        return self.admin_client.list_topics()

    """
    Функция администратора.
    """
    def create_topics(self, topic_names):
        QUANTITY_PARTITIONS = 1
        REPLICATION_FACTOR = 1
        topic_list = self.get_topics()
        existing_topic_list = topic_list
        topic_list = []
        for topic in topic_names:
            if topic not in existing_topic_list:
                print(f'Топик : {topic} добавлен.')
                topic_list.append(NewTopic(name=topic, num_partitions=QUANTITY_PARTITIONS, replication_factor=REPLICATION_FACTOR))
            else:
                print(f'Топик : {topic} уже существует.')
        try:
            if topic_list:
                self.admin_client.create_topics(new_topics=topic_list, validate_only=False)
                print("Топик успешно создан.")
            else:
                print("Топик существует")
        except  Exception as e:
            print(e)

    def send_message(self, topic, msg):
        msg = msg.encode('utf-8')
        future = self.producer.send(topic, value = msg)
        try:
            record_metadata = future.get(timeout=10)
        except KafkaError:
            return f'Не удалось отправить сообщение: "{log.exception()}"'
        return f'Сообщение "{msg}" добавлено в топик "{topic}"'