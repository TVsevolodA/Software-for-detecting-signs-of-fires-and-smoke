import requests
from flask import json
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash

class User(UserMixin):
    def __init__(self, username='', email='', role='', user_id=int(), password_hash=str()):
        self.user_id = user_id
        self.username = username
        self.email = email
        self.password_hash = password_hash
        self.role = role

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def get_user_by_login(self, login):
        req = requests.get('http://data_service_sm:3000/getUserByLogin', json={'login': login})
        if req.status_code == 200:
            user = json.loads(req.text)
            self.user_id = user['user_id']
            self.username = user['username']
            self.email = user['email']
            self.password_hash = user['password_hash']
            self.role = user['role']
            return self#user
        return None

    def register_user_in_system(self):
        user_json = {
            'user_id': self.user_id,
            'username': self.username,
            'email': self.email,
            'password_hash': self.password_hash,
            'role': self.role
        }
        requests.get('http://data_service_sm:3000/registerUser', json={'user_json': user_json})

    def changing_profile(self, username=None, email=None):
        self.username = username
        self.email = email
        modifiedDataUser = {
            'user_id': self.user_id,
            'username': username,
            'email': email,
            'password_hash': self.password_hash,
            'role': self.role
        }
        requests.get('http://data_service_sm:3000/profileUpdate', json={'modifiedDataUser': modifiedDataUser})

    def get_id(self):
        return self.user_id
