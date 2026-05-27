from server import qry
res = qry("SHOW CREATE TABLE machine_audit_summaries")
print(res[0]['Create Table'] if res else "Not found")
