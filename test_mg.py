import requests
import json
r = requests.get('http://127.0.0.1:5050/api/multigame?start=2026-05-01&end=2026-05-29')
data = r.json()
if isinstance(data, list):
    names = [x['game'] for x in data]
    import collections
    dups = [item for item, count in collections.Counter(names).items() if count > 1]
    print(f"Total results: {len(data)}")
    print(f"Duplicates: {dups}")
    for d in data:
        if d['game'] in dups:
            print(d['game'], d['game_id'], d['bet'])
else:
    print(data)
