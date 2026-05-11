from server import qry
import pprint

tables = qry("SHOW TABLES;", [])
for t in tables:
    v = list(t.values())[0]
    if 'user' in v or 'role' in v or 'permission' in v or 'location' in v:
        print(v)
