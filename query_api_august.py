import server
import json
with server.app.test_request_context('/api/rapoarte/lunare?start=2025-08-01&end=2025-08-31'):
    res = server.rep_lunare()
    data = json.loads(res.get_data(as_text=True))
    serials = set()
    for r in data:
        if r.get('serial_nr'):
            serials.add(r['serial_nr'])
    print(f"Total rows: {len(data)}")
    print(f"Unique serials: {len(serials)}")
    
    # Check for empty or null
    bad = [r for r in data if not r.get('serial_nr') or str(r.get('serial_nr')).strip() == '']
    print(f"Rows with empty serial: {len(bad)}")
    if bad:
        print(bad)
