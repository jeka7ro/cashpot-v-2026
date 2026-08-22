import server
import json
with server.app.test_request_context('/api/rapoarte/lunare?start=2025-08-01&end=2025-08-31'):
    res = server.rep_lunare()
    data = json.loads(res.get_data(as_text=True))
    
    # Let's count machines per location
    locs = {}
    for r in data:
        loc = r['location_name']
        ser = r['serial_nr']
        if loc not in locs: locs[loc] = set()
        locs[loc].add(ser)
    
    for l, s in locs.items():
        if l in ['Craiova', 'Pitesti', 'Ploiesti Centru']:
            print(f"{l}: {len(s)}")
    
    total = set()
    for l, s in locs.items():
        if l in ['Craiova', 'Pitesti', 'Ploiesti Centru']:
            total.update(s)
    print(f"Total unique: {len(total)}")
    
    # Find the one that's in multiple locations
    all_sers = {}
    for l, s in locs.items():
        if l in ['Craiova', 'Pitesti', 'Ploiesti Centru']:
            for ser in s:
                if ser not in all_sers:
                    all_sers[ser] = []
                all_sers[ser].append(l)
    
    for ser, ls in all_sers.items():
        if len(ls) > 1:
            print(f"Machine {ser} is in multiple locations: {ls}")
