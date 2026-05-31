import requests
import collections
r = requests.get('http://127.0.0.1:5050/api/multigame?start=2026-05-01&end=2026-05-29')
data = r.json()
if isinstance(data, list):
    names = [x['game'].strip().lower() for x in data]
    dups = [item for item, count in collections.Counter(names).items() if count > 1]
    print(f"Total results: {len(data)}")
    print(f"Duplicates (case/strip): {dups}")
    for d in data:
        if d['game'].strip().lower() in dups:
            print(f"'{d['game']}'")
