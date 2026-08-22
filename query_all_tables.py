import server
with server.get_conn() as conn:
    with conn.cursor() as c:
        for t in ['machine_audit_summaries', 'machine_audits', 'machine_daily_meters']:
            try:
                c.execute(f"SELECT MIN(date), MAX(date) FROM cyberslot_dbn.{t};")
                print(t, c.fetchone())
            except Exception as e:
                print(t, str(e))
