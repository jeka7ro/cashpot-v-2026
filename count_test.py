import sys
sys.path.append('.')
from server import qry

print("Distinct in>0:", qry("SELECT COUNT(DISTINCT machine_id) as c FROM machine_audit_summaries WHERE date >= '2026-07-01' AND date <= '2026-07-31' AND `in` > 0")[0]['c'])
print("Distinct all:", qry("SELECT COUNT(DISTINCT machine_id) as c FROM machine_audit_summaries WHERE date >= '2026-07-01' AND date <= '2026-07-31'")[0]['c'])
print("Meters latest:", qry("SELECT COUNT(DISTINCT machine_id) as c FROM machine_daily_meters WHERE date = (SELECT MAX(date) FROM machine_daily_meters)")[0]['c'])
print("Machines active:", qry("SELECT COUNT(id) as c FROM machines WHERE deleted_at IS NULL")[0]['c'])
print("Meters per loc:", qry("SELECT l.city, COUNT(DISTINCT m.machine_id) as c FROM machine_daily_meters m JOIN locations l ON m.location_id = l.id WHERE m.date = (SELECT MAX(date) FROM machine_daily_meters) GROUP BY l.city"))
