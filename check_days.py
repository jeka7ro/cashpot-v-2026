import server
import json
with server.app.test_request_context('/api/rapoarte/lunare?start=2025-08-01&end=2025-08-31'):
    res = server.rep_lunare()
    data = json.loads(res.get_data(as_text=True))
    if data:
        print(data[0].keys())
        print(f"days_active for first: {data[0].get('days_active')}")
    else:
        print("No data")
