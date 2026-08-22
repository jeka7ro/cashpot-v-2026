import server
with server.get_conn() as conn:
    with conn.cursor() as c:
        c.execute("SHOW DATABASES;")
        print([r['Database'] for r in c.fetchall()])
