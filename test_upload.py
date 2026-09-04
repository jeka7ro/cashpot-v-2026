import requests
import os

url = "http://127.0.0.1:5050/api/contracts"
res = requests.post(url, json={
    "type": "Test",
    "details": "Test Contract",
    "owner_name": "Test Owner",
    "total_amount": 100,
    "currency": "RON",
    "start_date": "2026-01-01",
    "end_date": "2026-12-31"
})
if res.status_code == 200:
    cid = res.json().get('id')
    with open("test.txt", "w") as f:
        f.write("Hello World File Data")
    
    with open("test.txt", "rb") as f:
        fres = requests.post(f"http://127.0.0.1:5050/api/contracts/{cid}/files", files={"file": f}, data={"is_annex": "false"})
    print("Upload file:", fres.status_code, fres.text)
    
    if fres.status_code == 200:
        # get files list? We don't have it here. Let's get it from DB directly to get the file_id
        pass
