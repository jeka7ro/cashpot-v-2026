import sys
sys.path.append('.')
from server import qry

print("August distinct meters:", qry("SELECT COUNT(DISTINCT machine_id) as c FROM machine_daily_meters WHERE date >= '2026-08-01' AND date <= '2026-08-31'")[0]['c'])
print("August average meters:", qry("SELECT ROUND(COUNT(machine_id) / NULLIF(COUNT(DISTINCT date), 0)) as c FROM machine_daily_meters WHERE date >= '2026-08-01' AND date <= '2026-08-31'")[0]['c'])
