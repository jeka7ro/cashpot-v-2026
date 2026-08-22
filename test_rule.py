import os
import sys
sys.path.append('.')
from server import qry

rows = qry("""
    SELECT 
        COUNT(DISTINCT machine_id) as distinct_machines,
        COUNT(machine_id) as total_machine_days,
        COUNT(DISTINCT date) as days,
        ROUND(COUNT(machine_id) / NULLIF(COUNT(DISTINCT date), 0)) as avg_machines
    FROM machine_audit_summaries
    WHERE date >= '2026-07-01' AND date <= '2026-07-31' AND `in` > 0
""")
print(rows)
