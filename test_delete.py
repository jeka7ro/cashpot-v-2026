import requests

r = requests.get('http://localhost:5050/api/contracts')
contracts = r.json()
found_files = False
for c in contracts:
    if c['files']:
        found_files = True
        print(f"Contract ID: {c['id']}")
        for f in c['files']:
            print(f"  File: {f['filename']} (ID: {f['id']})")
if not found_files:
    print("No files found.")
