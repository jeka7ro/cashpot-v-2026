from server import qry, pg_qry, normalize_loc_name
import datetime

date_param = "2026-05-22"
today = datetime.datetime.now().strftime('%Y-%m-%d')
print("today:", today)

mysql_locs = qry("SELECT id, code FROM locations")
pg_locs = pg_qry("SELECT id, name FROM casino_locations")
pg_name_to_id = {normalize_loc_name(l['name']): str(l['id']) for l in pg_locs}

active_m = qry("SELECT location_id, COUNT(*) as c FROM machines WHERE deleted_at IS NULL GROUP BY location_id")
print("active_m:", active_m)

mysql_slot_counts = {str(r['location_id']): r['c'] for r in active_m}
print("mysql_slot_counts:", mysql_slot_counts)

pg_slots = {str(l['id']): 0 for l in pg_locs}
for ml in mysql_locs:
    norm = normalize_loc_name(ml['code'])
    if norm in pg_name_to_id:
        pid = pg_name_to_id[norm]
        pg_slots[pid] += mysql_slot_counts.get(str(ml['id']), 0)

print("pg_slots:", pg_slots)
loc_ids = [
    "e78a6daf-7e8a-47a6-9856-90b78fb4a523", # Craiova
    "36d01a7c-f228-49d3-9cb4-275974a23ae5"  # Pitesti
]

total_slots = sum([pg_slots.get(str(lid), 0) for lid in loc_ids])
print("total_slots:", total_slots)
amount = 50000

for lid in loc_ids:
    s_count = pg_slots.get(str(lid), 0)
    loc_amount = round(amount * (s_count / total_slots), 2) if total_slots > 0 else 0
    print(f"lid {lid}: s_count={s_count}, loc_amount={loc_amount}")

