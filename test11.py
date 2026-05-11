import pymysql, json
import server
conn = server.get_db()
with conn.cursor() as c:
    c.execute("SHOW TABLES")
    tables = c.fetchall()
    print("TABLES:", tables)
