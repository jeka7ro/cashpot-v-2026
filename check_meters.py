from server import qry

print("Tables:")
for t in qry("SHOW TABLES;", []):
    v = list(t.values())[0]
    if 'log' in v or 'meter' in v or 'handpay' in v:
        print(v)
