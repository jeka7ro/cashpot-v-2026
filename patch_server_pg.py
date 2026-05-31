with open('server.py', 'r') as f:
    content = f.read()

pg_code = """
import psycopg2
PG_DB_CFG = dict(
    host="82.76.35.50", port=26257,
    user="cashpot", password="129hj8oahwd7yaw3e21321",
    dbname="cashpot"
)

def get_pg_conn():
    return psycopg2.connect(**PG_DB_CFG)

def pg_qry(sql, params=None):
    conn = get_pg_conn()
    try:
        with conn.cursor() as c:
            c.execute(sql, params or ())
            try:
                rows = c.fetchall()
                cols = [desc[0] for desc in c.description]
                return [dict(zip(cols, r)) for r in rows]
            except Exception as e:
                return []
    finally:
        conn.close()
"""

content = content.replace("def qry(sql, params=None):", pg_code + "\n\ndef qry(sql, params=None):")

with open('server.py', 'w') as f:
    f.write(content)
