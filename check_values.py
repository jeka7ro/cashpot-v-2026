import sys
sys.path.append('.')
from server import qry

rows = qry("SELECT SUM(cb_fortune_wheel) as roata, SUM(cashback) as cb FROM machine_audit_summaries LIMIT 1")
print(rows)
