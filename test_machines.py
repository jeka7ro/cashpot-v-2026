import requests
url = "http://127.0.0.1:5050/api/machines?start=2026-05-08&end=2026-05-08&location_id=1&provider_id=&cabinet_id="
print("Response from api/machines:")
data = requests.get(url).json()
print("Count:", len(data))
if len(data) == 0:
    print("Why 0? URL:", url)
