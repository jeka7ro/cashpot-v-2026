import sys
sys.path.append('.')
from server import qry

print("Meters latest locs:", qry("SELECT l.display_code, COUNT(DISTINCT m.machine_id) as c FROM machine_daily_meters m JOIN locations l ON m.location_id = l.id WHERE m.date = (SELECT MAX(date) FROM machine_daily_meters) GROUP BY l.display_code"))
print("Audits latest locs:", qry("SELECT l.display_code, COUNT(DISTINCT m.machine_id) as c FROM machine_audit_summaries m JOIN locations l ON m.location_id = l.id WHERE m.date = (SELECT MAX(date) FROM machine_audit_summaries) GROUP BY l.display_code"))
