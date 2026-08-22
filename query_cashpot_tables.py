import server
with server.get_conn() as conn:
    with conn.cursor() as c:
        c.execute("SHOW TABLES LIKE 'machine_audit_summaries';")
        print(c.fetchall())
