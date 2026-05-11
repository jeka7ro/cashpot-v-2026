import sys
sys.path.append('.')
from server import qry

rows = qry("SHOW COLUMNS FROM machine_audit_summaries")
for r in rows:
    print(r['Field'])
