import sys
sys.path.append('.')
from server import qry

end = '2026-08-31'
installed_ap_row = qry("""
    SELECT COUNT(DISTINCT mdm.machine_id) as c 
    FROM machine_daily_meters mdm 
    WHERE mdm.date = (SELECT MAX(date) FROM machine_daily_meters WHERE date <= %s)
""", [end])
print("Total:", installed_ap_row[0]['c'])

craiova_id = qry("SELECT id FROM locations WHERE code='Craiova'")[0]['id']
valcea_id = qry("SELECT id FROM locations WHERE code='Valcea'")[0]['id']

installed_ap_loc = qry(f"""
    SELECT mdm.location_id, COUNT(DISTINCT mdm.machine_id) as c 
    FROM machine_daily_meters mdm 
    WHERE mdm.date = (SELECT MAX(date) FROM machine_daily_meters WHERE date <= %s)
    AND mdm.location_id IN ({craiova_id}, {valcea_id})
    GROUP BY mdm.location_id
""", [end])
print("Locs:", installed_ap_loc)
