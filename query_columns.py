import server
with server.get_conn() as conn:
    with conn.cursor() as c:
        c.execute("SHOW COLUMNS FROM cyberslot_dbn.machine_audit_summaries;")
        print([r['Field'] for r in c.fetchall()])
