import psycopg2
PG_DB_CFG = dict(
    host="82.76.35.50", port=26257,
    user="cashpot", password="129hj8oahwd7yaw3e21321",
    dbname="cashpot"
)
conn = psycopg2.connect(**PG_DB_CFG)
try:
    with conn.cursor() as c:
        c.execute("SELECT id, owner_name, total_amount, m2, address FROM cp2_contracts WHERE address LIKE 'Craiova%'")
        rows = c.fetchall()
        for r in rows:
            print(r)
finally:
    conn.close()
