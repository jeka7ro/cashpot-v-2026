import server
import json
with server.app.test_request_context('/api/rapoarte/lunare?start=2025-08-01&end=2025-08-31'):
    res = server.rep_lunare()
    data = json.loads(res.get_data(as_text=True))
    r = data[0]
    print(f"Keys: {list(r.keys())}")
    print(f"WIN: {r.get('win')} BET: {r.get('bet')}")
