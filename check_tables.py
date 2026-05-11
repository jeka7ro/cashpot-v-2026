import sys
sys.path.append('.')
from server import qry

rows = qry("SHOW TABLES")
for r in rows:
    print(r.values())
