import sys
import json
sys.path.append('.')
from server import app
with app.test_request_context('/api/locations?start=2026-04-01&end=2026-04-30'):
    from server import locations
    resp = locations()
    data = json.loads(resp.get_data(as_text=True))
    for d in data:
        print(d.get('locatie'), d.get('roata'))
