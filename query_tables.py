import server
with server.get_conn() as conn:
    with conn.cursor() as c:
        c.execute("SHOW TABLES IN cyberslot_dbn;")
        print([r['Tables_in_cyberslot_dbn'] for r in c.fetchall() if 'machine' in r['Tables_in_cyberslot_dbn']])
        c.execute("SELECT MIN(date), MAX(date) FROM cyberslot_dbn.machine_audit_summary_per_hours;")
        print("cyberslot_dbn dates:", c.fetchone())
