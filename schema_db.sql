CREATE TABLE location_cameras (
  location_id SERIAL PRIMARY KEY,
  longitude   DOUBLE PRECISION NOT NULL,
  latitude    DOUBLE PRECISION NOT NULL,
  address     VARCHAR (100)
);

CREATE UNIQUE INDEX location_cameras_longitude_latitude_unique ON location_cameras (longitude, latitude);

CREATE TABLE cameras (
  camera_id         SERIAL PRIMARY KEY,
  name_camera       VARCHAR (100) NOT NULL UNIQUE,  -- Название камеры не меняется! А то не сможем понять это новая камера или старая.
  camera_location   INTEGER REFERENCES location_cameras (location_id),
  url_address       VARCHAR (100) NOT NULL UNIQUE, -- UNIQUE
  status            BOOLEAN NOT NULL        -- FIXME: А нужно ли?
);

CREATE TABLE notifications (
  incident_id     SERIAL PRIMARY KEY,
  camera_data     INTEGER REFERENCES cameras (camera_id), -- UNIQUE
  datetime        TIMESTAMP NOT NULL,
  type_event      VARCHAR (100) NOT NULL, -- Обнаруженные классы, либо сообщения о работе/неработе камеры.
  captured_image  VARCHAR (100000),
  report_compiled BOOLEAN DEFAULT FALSE
);

CREATE TABLE users (
  user_id         SERIAL PRIMARY KEY,
  username        VARCHAR (100) NOT NULL,
  email           VARCHAR (100) NOT NULL,
  password_hash   VARCHAR (100) NOT NULL,
  role            VARCHAR (100) NOT NULL
);

CREATE TABLE reports (
  report_id       SERIAL PRIMARY KEY,
  number_incident INTEGER REFERENCES notifications (incident_id) UNIQUE,
  datetime        TIMESTAMP NOT NULL,
  duty            INTEGER REFERENCES users (user_id), -- дежурный
  description     VARCHAR (1000) NOT NULL,            -- описание ситуации
  measures_taken  VARCHAR (1000) NOT NULL,            -- принятые меры
  consequences    VARCHAR (1000) NOT NULL,            -- последствия
  conclusion      VARCHAR (1000) NOT NULL            -- заключение
);

INSERT INTO location_cameras (longitude, latitude, address) VALUES (45.980185, 51.529657, 'г.Саратов,ул.Политехническая,77');
-- INSERT INTO location_cameras (longitude, latitude, address) VALUES (46.02105074284403, 51.53410530670002, 'Саратов, улица имени В.И. Чапаева, 61');

INSERT INTO cameras (name_camera, camera_location, url_address, status) VALUES ('Xiaomi_Smart_Camera', 1, 'http://camera:5040', true);
-- INSERT INTO cameras (name_camera, camera_location, url_address, status) VALUES ('Hi_Watch', 2, 'http://hi_watch:5030', true);

-- TODO: создать еще таблицы: Пользователи, (Интнерфейс, связан с пользователем).
