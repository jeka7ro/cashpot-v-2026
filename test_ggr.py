import sys
sys.path.append('.')
from server import qry

try:
    res = qry("SELECT date, `in`, `out`, hh, jackpot FROM machine_audit_summaries WHERE machine_id IN (SELECT id FROM machines WHERE slot_machine_id LIKE '%233056%') ORDER BY date DESC LIMIT 10")
    for r in res:
        print(f"Date: {r['date']}, IN: {r['in']}, OUT: {r['out']}, HH: {r['hh']}, JP: {r['jackpot']}")
except Exception as e:
    print(e)
