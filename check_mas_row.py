import sys
sys.path.append('.')
from server import qry

rows = qry("SELECT `in`, `out`, `bet`, `win`, `credits` FROM machine_audit_summaries LIMIT 3")
for r in rows:
    print(r)
