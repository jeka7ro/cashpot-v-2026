import sys
sys.path.append('.')
from server import qry

print("kpi without in>0:", qry("""
    SELECT 
        ROUND(COUNT(machine_id) / NULLIF(COUNT(DISTINCT date), 0)) as aparate
    FROM machine_audit_summaries mas
    WHERE date >= '2026-07-01' AND date <= '2026-07-31'
""")[0]['aparate'])

print("meters:", qry("""
    SELECT 
        ROUND(COUNT(machine_id) / NULLIF(COUNT(DISTINCT date), 0)) as aparate
    FROM machine_daily_meters mas
    WHERE date >= '2026-07-01' AND date <= '2026-07-31'
""")[0]['aparate'])
