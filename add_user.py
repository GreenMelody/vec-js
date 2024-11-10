import hashlib
import sys
import os
from common import db
import json

if 'db' not in sys.modules:
    from common import db

json_info = open('etc/va_rest_api.conf').read()
va_rest_server_info = json.loads(json_info)
log_level = va_rest_server_info['LOG_LEVEL']
db = db.DB(log_level)
db.db_name = va_rest_server_info['DB_NAME']

def hash_password(password):
    return hashlib.sha256(password.encode('utf-8')).hexdigest()

def add_user(user_id, password, name_kr, name_en, email_address, department_code, department_name, auth_level):
    hashed_password = hash_password(password)

    query = f"""
        INSERT INTO user (user_id, password, name_kr, name_en, email_address, department_code, department_name, auth_level)
        VALUES ('{user_id}', '{hashed_password}', '{name_kr}', '{name_en}', '{email_address}', '{department_code}', '{department_name}', {auth_level})
    """
    result = db.query(query)
    if result.isdigit():
        print(f"User {user_id} successfully added with user_index: {result}")
    else:
        print(f"Failed to add user {user_id}. Error: {result}")

if __name__ == '__main__':
    user_id = "user2"
    password = "user2"
    name_kr = "유저2"
    name_en = "user2"
    email_address = "user2@abc.com"
    department_code = "d123"
    department_name = "ddd"
    auth_level = 1

    add_user(user_id, password, name_kr, name_en, email_address, department_code, department_name, auth_level)
