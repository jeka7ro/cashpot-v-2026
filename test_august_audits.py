import sys
sys.path.append('.')
from server import qry

print("August distinct played:", qry("SELECT COUNT(DISTINCT machine_id) as c FROM machine_audit_summaries WHERE date >= '2026-08-01' AND date <= '2026-08-31' AND `in` > 0")[0]['c'])
print("August average played:", qry("SELECT ROUND(COUNT(machine_id) / NULLIF(COUNT(DISTINCT date), 0)) as c FROM machine_audit_summaries WHERE date >= '2026-08-01' AND date <= '2026-08-31' AND `in` > 0")[0]['c'])
