import requests
import json

url = 'https://cashpot.up.railway.app'
login_data = {'email': 'jeka7ro@gmail.com', 'password': '11Mai2026!'}
session = requests.Session()
r = session.post(f"{url}/api/login", json=login_data)

if r.status_code == 200:
    token = r.json().get('token')
    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    
    users = [
        {"name": "Laurentiu", "email": "laurentiu@cashpot.ro", "password": "20Mai2026!", "role": "Operational", "permissions": {"pages":["dashboard","cheltuieli","pl","rapoarte","dispozitive","live"]}},
        {"name": "George", "email": "george@cashpot.ro", "password": "20Mai2026!", "role": "Marketing", "permissions": {"pages":["dashboard","cheltuieli","pl","rapoarte","dispozitive","live"]}},
        {"name": "Vadim", "email": "vadim@cashpot.ro", "password": "20Mai2026!", "role": "Financiar", "permissions": {"pages":["dashboard","cheltuieli","pl","rapoarte","dispozitive","live"]}}
    ]
    
    for u in users:
        res = session.post(f"{url}/api/users", headers=headers, json=u)
        print(u['name'], res.status_code, res.text)
