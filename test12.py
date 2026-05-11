import server
conn = server.get_conn()
with conn.cursor() as c:
    c.execute("SHOW TABLES")
    tables = c.fetchall()
    print("TABLES:")
    for t in tables:
        print(t)
