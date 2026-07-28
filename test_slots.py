from cp2_db import qry, normalize_loc_name

locs = qry('SELECT id, code FROM locations')
counts = qry('SELECT location_id, COUNT(*) as c FROM machines WHERE deleted_at IS NULL GROUP BY location_id')
count_map = {str(r['location_id']): r['c'] for r in counts}
groups = {}
for l in locs:
    n = normalize_loc_name(l['code'])
    if n not in groups:
        groups[n] = []
    groups[n].append({'code': l['code'], 'id': l['id'], 'slots': count_map.get(str(l['id']), 0)})
    
for n, v in groups.items():
    if sum(x['slots'] for x in v) > 0:
        print(f"{n}: {sum(x['slots'] for x in v)} -> {v}")
