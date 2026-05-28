import sys
sys.path.append('.')
from server import qry

try:
    res = qry("SELECT date, machine_id, `out`, hh, jackpot FROM machine_audit_summaries ORDER BY hh DESC LIMIT 5")
    print(res)
except Exception as e:
    print(e)
