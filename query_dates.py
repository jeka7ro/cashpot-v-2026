import server
with server.get_conn() as conn:
    with conn.cursor() as c:
        c.execute("SELECT MIN(date), MAX(date) FROM machine_audit_summary_per_hours;")
        print(c.fetchone())
