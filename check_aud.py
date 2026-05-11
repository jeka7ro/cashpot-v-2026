from server import qry
for r in qry("DESCRIBE machine_audit_summaries", []): print(r['Field'])
