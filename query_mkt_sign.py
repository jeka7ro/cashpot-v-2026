import server
import json
with server.app.test_request_context('/api/rapoarte/lunare?start=2025-08-01&end=2025-08-31'):
    res = server.rep_lunare()
    data = json.loads(res.get_data(as_text=True))
    mkt = data[0].get('marketing', 0) if data else 0
    print(f"First row marketing: {mkt}")
    if mkt > 0: print("Marketing is POSITIVE")
    elif mkt < 0: print("Marketing is NEGATIVE")
    else: print("Marketing is ZERO")
