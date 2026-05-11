from server import qry

try:
    for r in qry("SELECT count(*) as cnt FROM sas_machine_meters", []): print("sas_machine_meters:", r['cnt'])
except: pass

try:
    for r in qry("SELECT count(*) as cnt FROM machine_daily_meters", []): print("machine_daily_meters:", r['cnt'])
except: pass

try:
    for r in qry("SELECT count(*) as cnt FROM machine_audit_summaries", []): print("machine_audit_summaries:", r['cnt'])
except: pass

