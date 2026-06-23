import server

try:
    cols = server.qry("DESCRIBE machine_audit_summary_per_hours")
    print([c['Field'] for c in cols])
except Exception as e:
    print("Error:", e)
