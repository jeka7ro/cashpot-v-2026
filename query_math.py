import server
import json
with server.app.test_request_context('/api/rapoarte/lunare?start=2025-08-01&end=2025-08-31'):
    res = server.rep_lunare()
    data = json.loads(res.get_data(as_text=True))
    r = data[0]
    print(f"IN: {r.get('in_val')} OUT: {r.get('out_val')}")
    print(f"GGR: {r.get('ggr')}")
    print(f"MKT: {r.get('marketing')}")
    print(f"NGR: {r.get('ngr')}")
