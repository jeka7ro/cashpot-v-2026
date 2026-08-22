import server
import json
with server.app.test_request_context('/api/rapoarte/lunare?start=2026-07-01&end=2026-07-31'):
    res = server.rep_lunare()
    data = json.loads(res.get_data(as_text=True))
    for r in data:
        days = r.get('days_active')
        if days is not None and int(days) < 3:
            print(f"Machine {r['serial_nr']} in {r['location_name']} has {days} days")
    print(f"Total rows in july: {len(data)}")
    print(f"Rows with < 3 days: {sum(1 for r in data if r.get('days_active') and int(r.get('days_active')) < 3)}")
