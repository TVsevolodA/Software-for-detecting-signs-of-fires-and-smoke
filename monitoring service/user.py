import requests
from flask import json
from flask_login import UserMixin, login_manager
from werkzeug.security import generate_password_hash, check_password_hash


@login_manager.user_loader
def load_user(user_id):
    req = requests.get('http://data_service_sm:3000/getUserById', json={'user_id': user_id})
    return json.loads(req.text)


class User(UserMixin):
    def __init__(self, username, email, role):
        self.user_id = int()
        self.username = username
        self.email = email
        self.password_hash = str()
        self.role = role

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def get_user_by_login(self, login):
        req = requests.get('http://data_service_sm:3000/getUserByLogin', json={'login': login})
        user = json.loads(req.text)
        self.user_id = user['user_id']
        self.username = user['username']
        self.email = user['email']
        self.password_hash = user['password_hash']
        self.role = user['role']
        return user

    def register_user_in_system(self):
        user_json = {
            'user_id': self.user_id,
            'username': self.username,
            'email': self.email,
            'password_hash': self.password_hash,
            'role': self.role
        }
        requests.get('http://data_service_sm:3000/registerUser', json={'user_json': user_json})
