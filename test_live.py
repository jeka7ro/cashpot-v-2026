import requests

url = 'https://cashpot.up.railway.app'
login_data = {'email': 'jeka7ro@gmail.com', 'password': '11Mai2026!'}
session = requests.Session()
r = session.post(f"{url}/api/login", json=login_data)
print("Login:", r.status_code, r.text)

if r.status_code == 200:
    token = r.json().get('token')
    headers = {'Authorization': f'Bearer {token}'}
    
    # Try fetching users
    r2 = session.get(f"{url}/api/users", headers=headers)
    print("Users:", r2.status_code, r2.text)
