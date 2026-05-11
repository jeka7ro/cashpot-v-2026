from server import qry
for r in qry("SELECT in_meter, jackpot_meter, created_at FROM sas_machine_meters WHERE machine_id=857 ORDER BY id DESC LIMIT 5", []):
    print(r)
