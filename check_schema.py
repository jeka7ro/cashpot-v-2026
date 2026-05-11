import sys
from server import qry

rows = qry("SHOW TABLES;", [])
for r in rows:
    if 'session' in str(r).lower() or 'player' in str(r).lower():
        print(r)
