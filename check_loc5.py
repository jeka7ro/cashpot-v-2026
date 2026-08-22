import psycopg2
PG_DB_CFG = dict(
    host="82.76.35.50", port=26257,
    user="cashpot", password="129hj8oahwd7yaw3e21321",
    dbname="cashpot"
)
conn = psycopg2.connect(**PG_DB_CFG)
try:
    with conn.cursor() as c:
        c.execute("""
            SELECT c.id, c.type, c.owner_name, c.total_amount, cl.amount 
            FROM cp2_contracts c
            JOIN cp2_contract_locations cl ON c.id = cl.contract_id
            WHERE cl.location_id = 5
        """)
        rows = c.fetchall()
        for r in rows:
            print(r)
finally:
    conn.close()
