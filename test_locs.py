import requests
import json
r = requests.get('http://127.0.0.1:5050/api/locations?start=2026-05-29&end=2026-05-29')
data = r.json()
print("Date 2026-05-29:", json.dumps(data, indent=2))
